import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { formatDisplayDate, loadFeeLabelMap, parseDisplayDate, titleCaseName } from './feeHelpers.js';
import { lookupReceiptDetail } from './feeReceiptDetail.js';
import { insertLog } from '../logService.js';

export async function lookupReceiptForDelete(receiptNo, memberId) {
  const receipt = String(receiptNo || '').trim();
  const pending = await prisma.$queryRawUnsafe(
    `SELECT id FROM fee_delete_tb WHERE del = 1 AND status = 0 AND receipt_no = '${escapeSql(receipt)}' LIMIT 1`,
  );
  if (pending.length) {
    return { error: 'A pending delete request already exists for this receipt' };
  }

  return lookupReceiptDetail(receipt);
}

export async function submitFeeDeleteRequest(receiptNo, remarks, memberId, meta = {}) {
  const receipt = String(receiptNo || '').trim().toUpperCase();
  const lookup = await lookupReceiptDetail(receipt);
  if (lookup.error) return { success: false, error: lookup.error };

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const ip = meta.ip || '';
  await prisma.$executeRawUnsafe(
    `INSERT INTO fee_delete_tb (receipt_no, comments, created_dt, created_by, created_ip, del, status)
     VALUES ('${escapeSql(receipt)}', '${escapeSql(remarks || '')}', '${escapeSql(now)}', '${escapeSql(memberId)}', '${escapeSql(ip)}', 1, 0)`,
  );

  await insertLog(
    ['fee_delete_request', 'Add', 'Successful', receipt, new Date(), ip, '', memberId],
    '',
  );
  return { success: true, message: 'Delete request submitted' };
}

export async function listMyFeeDeleteRequests(memberId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT receipt_no, comments, status, CAST(created_dt AS CHAR) AS created_dt
     FROM fee_delete_tb
     WHERE del = 1 AND created_by = '${escapeSql(memberId)}'
     ORDER BY status ASC, created_dt DESC
     LIMIT 100`,
  );
  return {
    requests: rows.map((row) => ({
      receiptNo: row.receipt_no,
      comments: row.comments,
      status: Number(row.status),
      createdAt: row.created_dt,
    })),
  };
}

export async function listPendingFeeDeleteApprovals() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT receipt_no, comments, CAST(created_dt AS CHAR) AS created_dt, created_by
     FROM fee_delete_tb
     WHERE del = 1 AND status = 0
     ORDER BY created_dt ASC`,
  );
  return {
    requests: rows.map((row) => ({
      receiptNo: row.receipt_no,
      comments: row.comments,
      createdAt: row.created_dt,
      createdBy: row.created_by,
    })),
  };
}

export async function loadPendingDeleteApprovalDetail(receiptNo, memberId) {
  const receipt = String(receiptNo || '').trim();
  const lookup = await lookupReceiptDetail(receipt);
  if (lookup.error) return lookup;

  const row = await prisma.$queryRawUnsafe(
    `SELECT comments FROM fee_delete_tb WHERE del = 1 AND status = 0 AND receipt_no = '${escapeSql(receipt)}' LIMIT 1`,
  );
  return {
    receiptNo: receipt,
    receipt: lookup.receipt,
    remarks: row[0]?.comments || '',
  };
}

export async function approveFeeDeleteRequest(receiptNo, memberId, meta = {}) {
  const receipt = String(receiptNo || '').trim().toUpperCase();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const ip = meta.ip || '';

  await prisma.$executeRawUnsafe(
    `UPDATE student_fee SET del = 0, updated_dt = '${escapeSql(now)}', updated_ip = '${escapeSql(ip)}', updated_by = '${escapeSql(memberId)}'
     WHERE receipt_no = '${escapeSql(receipt)}'`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE fee_delete_tb SET status = 1, updated_dt = '${escapeSql(now)}', updated_ip = '${escapeSql(ip)}', updated_by = '${escapeSql(memberId)}'
     WHERE receipt_no = '${escapeSql(receipt)}' AND del = 1`,
  );

  await insertLog(
    ['fee_delete_approve', 'Delete', 'Successful', receipt, new Date(), ip, '', memberId],
    '',
  );
  return { success: true, message: 'Receipt deleted from student_fee' };
}

export async function generateFeeDeleteReport(payload, memberId, meta = {}) {
  const fromDate = payload.fromDate ? parseDisplayDate(payload.fromDate) : '';
  let toDate = payload.toDate ? parseDisplayDate(payload.toDate) : '';
  if (!fromDate && !toDate) {
    toDate = '';
  }

  let dateSql = '';
  if (fromDate) dateSql += ` AND DATE(updated_dt) >= '${escapeSql(fromDate)}'`;
  if (toDate) dateSql += ` AND DATE(updated_dt) <= '${escapeSql(toDate)}'`;

  const { labels } = await loadFeeLabelMap(prisma);
  const deleteRows = await prisma.$queryRawUnsafe(
    `SELECT receipt_no, comments, CAST(updated_dt AS CHAR) AS updated_dt
     FROM fee_delete_tb WHERE del = 1 AND status = 1 ${dateSql} ORDER BY id ASC`,
  );

  const rows = [];
  for (const delRow of deleteRows) {
    const feeRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM student_fee WHERE del = 0 AND receipt_no = '${escapeSql(delRow.receipt_no)}' ORDER BY id ASC`,
    );
    if (!feeRows.length) continue;

    const first = feeRows[0];
    const stuRows = await prisma.$queryRawUnsafe(
      `SELECT A.student_name, A.student_initial, A.academic_year, B.degree_name, B.department_name
       FROM student_profile_tb AS A INNER JOIN basic_setup_course_tb AS B ON A.course_id = B.id
       WHERE A.del = 1 AND B.del = 1 AND A.register_no = '${escapeSql(first.register_no)}' LIMIT 1`,
    );
    const stu = stuRows[0] || {};
    const feeTypes = [];
    let feeAmount = 0;
    let discount = Number(first.discount_amount || 0);
    feeRows.forEach((line) => {
      feeTypes.push(labels[line.fee_name] || line.fee_name);
      feeAmount += Number(line.amount || line.fee_amount || 0);
    });

    rows.push({
      receiptNo: delRow.receipt_no,
      paidDate: formatDisplayDate(first.paid_date),
      registerNo: first.register_no,
      studentName: titleCaseName(stu.student_name, stu.student_initial),
      courseLabel: `${stu.degree_name || ''} ${stu.department_name || ''} ${stu.academic_year || ''}`.trim(),
      feeTypes: feeTypes.join(', '),
      amount: feeAmount - discount,
      reason: delRow.comments,
      deletedOn: formatDisplayDate(delRow.updated_dt),
    });
  }

  if (!rows.length) {
    return {
      rows: [],
      html: '<p class="text-muted">No deleted receipts for the selected period.</p>',
    };
  }

  let html = `<table cellpadding="3" cellspacing="0" class="table"><thead>
    <tr bgcolor="#CCCCCC">
      <th>#</th><th>Receipt</th><th>Date</th><th>Roll No.</th><th>Name</th><th>Course</th>
      <th>Fee Type</th><th>Amount</th><th>Reason</th><th>Deleted on</th>
    </tr></thead><tbody>`;
  rows.forEach((row, idx) => {
    const bg = idx % 2 === 0 ? ' bgcolor="#F4F4F4"' : ' bgcolor="#FFFFFF"';
    html += `<tr${bg}>
      <td>${idx + 1}</td><td>${row.receiptNo}</td><td>${row.paidDate}</td><td>${row.registerNo}</td>
      <td>${row.studentName}</td><td>${row.courseLabel}</td><td>${row.feeTypes}</td>
      <td align="right">${row.amount}</td><td>${row.reason || ''}</td><td>${row.deletedOn}</td></tr>`;
  });
  html += '</tbody></table>';

  await insertLog(
    ['fee_delete_report', 'Generate', 'Successful', `${payload.fromDate || ''} - ${payload.toDate || ''}`, new Date(), meta.ip || '', '', memberId],
    '',
  );

  return { rows, html };
}
