import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { buildFeeReceiptHtml } from './feeReceiptPrint.js';
import { insertLog } from '../logService.js';

export async function listApprovedFeeSlips(payload = {}) {
  const limit = Math.min(Number(payload.limit) || 20, 50);
  const page = Math.max(Number(payload.page) || 1, 1);
  const offset = (page - 1) * limit;
  const search = String(payload.search || '').trim();

  let searchSql = '';
  if (search) {
    searchSql = ` AND register_no LIKE '${escapeSql(search)}%'`;
  }

  const countRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(DISTINCT group_id) AS total
     FROM fee_slip_tb
     WHERE del = 1 AND f_status = 1 AND group_id != '' AND id > 540 ${searchSql}`,
  );
  const total = Number(countRows[0]?.total || 0);

  const rows = await prisma.$queryRawUnsafe(
    `SELECT group_id,
            GROUP_CONCAT(CONCAT(bank_id, '__', receipt_no) SEPARATOR ',') AS bank_receipts,
            register_no,
            CAST(paid_date AS CHAR) AS paid_date,
            ref_id,
            pay_bank,
            CAST(created_dt AS CHAR) AS created_dt
     FROM fee_slip_tb
     WHERE del = 1 AND f_status = 1 AND group_id != '' AND id > 540 ${searchSql}
     GROUP BY group_id
     ORDER BY created_dt DESC
     LIMIT ${limit} OFFSET ${offset}`,
  );

  const registerNos = [...new Set(rows.map((r) => r.register_no))];
  const studentMap = {};
  if (registerNos.length) {
    const inList = registerNos.map((r) => `'${escapeSql(r)}'`).join(',');
    const students = await prisma.$queryRawUnsafe(
      `SELECT A.register_no, A.student_name, A.student_initial, B.degree_name
       FROM student_profile_tb AS A
       INNER JOIN basic_setup_course_tb AS B ON A.course_id = B.id
       WHERE A.del = 1 AND B.del = 1 AND A.register_no IN (${inList})`,
    );
    students.forEach((s) => {
      studentMap[s.register_no] = `${s.student_name || ''} ${s.student_initial || ''} | ${s.degree_name || ''}`.trim();
    });
  }

  const bankRows = await prisma.$queryRawUnsafe(
    'SELECT id, bank_id, bank_ptext FROM fee_bank_master WHERE del = 1',
  );
  const bankMap = {};
  bankRows.forEach((b) => {
    bankMap[b.id] = b.bank_ptext;
  });

  const slips = await Promise.all(rows.map(async (row) => {
    const approved = await prisma.$queryRawUnsafe(
      `SELECT CAST(created_dt AS CHAR) AS created_dt, created_by
       FROM student_fee WHERE del = 1 AND slip_id = '${escapeSql(row.group_id)}' LIMIT 1`,
    );
    const receiptLabels = String(row.bank_receipts || '')
      .split(',')
      .filter(Boolean)
      .map((part) => {
        const [bankId, receiptNo] = part.split('__');
        const prefix = bankMap[bankId] || '';
        return `${prefix}${String(receiptNo).padStart(4, '0')}`;
      });

    return {
      groupId: row.group_id,
      registerNo: row.register_no,
      studentLabel: studentMap[row.register_no] || row.register_no,
      paidDate: row.paid_date,
      amount: row.ref_id,
      payBank: row.pay_bank,
      receiptNos: receiptLabels,
      approvedAt: approved[0]?.created_dt || row.created_dt,
      approvedBy: approved[0]?.created_by || '',
    };
  }));

  return {
    slips,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function deleteApprovedFeeSlip(groupId, memberId, meta = {}) {
  const id = String(groupId || '').trim();
  if (!id) {
    return { success: false, error: 'groupId is required' };
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const ip = meta.ip || '';

  await prisma.$executeRawUnsafe(
    `UPDATE fee_slip_tb SET del = 0, updated_dt = '${escapeSql(now)}', updated_ip = '${escapeSql(ip)}', updated_by = '${escapeSql(memberId)}'
     WHERE group_id = '${escapeSql(id)}' AND del = 1`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE student_fee SET del = 0, updated_dt = '${escapeSql(now)}', updated_ip = '${escapeSql(ip)}', updated_by = '${escapeSql(memberId)}'
     WHERE slip_id = '${escapeSql(id)}' AND del = 1`,
  );

  await insertLog(
    ['student_fee_delete', 'Delete', 'Successful', id, new Date(), ip, '', memberId],
    '',
  );
  return { success: true, message: 'Approved slip and fee entries deleted' };
}

export async function reprintFeeReceipt(payload, memberId) {
  return buildFeeReceiptHtml({
    receiptNo: payload.receiptNo || '',
    groupId: payload.groupId || '',
  });
}
