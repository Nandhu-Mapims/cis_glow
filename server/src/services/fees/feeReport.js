import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { formatDisplayDate, formatIndianMoney, loadFeeLabelMap, parseDisplayDate, titleCaseName } from './feeHelpers.js';
import { insertLog } from '../logService.js';

const STUDENT_FEE_REPORT_COLUMNS = `
  receipt_no, CAST(paid_date AS CHAR) AS paid_date, register_no, course_id, academic_batch,
  class_year, fee_name, fee_amount, fine_amount, discount_amount, total_amount,
  amount_type, slip_id, created_by
`;

function buildCollectionReportTable({ columns, rows, footer }) {
  let html = '<table class="table table-bordered" cellpadding="3" cellspacing="0"><thead><tr bgcolor="#CCC">';
  html += '<th height="35">#</th><th>Receipt</th><th>Date</th><th>Name</th><th>Year</th>';
  columns.forEach((col) => { html += `<th><small>${col.label}</small></th>`; });
  html += '<th><small>Total Amount</small></th><th>Mode</th><th>Approved/Paid</th><th>Remarks</th></tr></thead><tbody>';
  rows.forEach((row, idx) => {
    html += `<tr>
      <td>${idx + 1}</td>
      <td>${row.receipt}</td>
      <td>${row.date}</td>
      <td>${row.studentLabel}<br><strong>${row.registerNo}</strong><small> | ${row.classLabel}</small></td>
      <td nowrap>${row.yearLabel}</td>`;
    columns.forEach((col) => {
      html += `<td align="right">${row.amounts[col.key] ? formatIndianMoney(row.amounts[col.key]) : ''}</td>`;
    });
    html += `<td align="right">${formatIndianMoney(row.total)}</td>
      <td>${row.mode}</td><td>${row.approvedBy}</td><td>${row.remarks || ''}</td></tr>`;
  });
  html += '<tr bgcolor="#F4F4F4"><td colspan="5" align="right"><strong>Total</strong></td>';
  columns.forEach((col) => {
    html += `<td align="right"><strong>${footer[col.key] ? formatIndianMoney(footer[col.key]) : ''}</strong></td>`;
  });
  html += `<td align="right"><strong>${formatIndianMoney(footer.overall)}</strong></td><td colspan="3"></td></tr>`;
  html += '</tbody></table>';
  return html;
}

export async function generateFeeCollectionReport(payload, memberId, meta = {}) {
  const fromDate = parseDisplayDate(payload.fromDate);
  const toDate = payload.toDate ? parseDisplayDate(payload.toDate) : '';
  const studentId = String(payload.studentId || '').trim();
  const amountType = String(payload.amountType || '').trim();
  const feeType = String(payload.feeType || '').trim();

  let dateSql = '';
  if (fromDate) dateSql += ` AND DATE(paid_date) >= '${escapeSql(fromDate)}'`;
  if (toDate) dateSql += ` AND DATE(paid_date) <= '${escapeSql(toDate)}'`;
  if (studentId) dateSql += ` AND register_no = '${escapeSql(studentId)}'`;
  if (amountType) dateSql += ` AND amount_type = '${escapeSql(amountType)}'`;
  if (feeType) dateSql += ` AND fee_name = '${escapeSql(feeType)}'`;

  const { labels } = await loadFeeLabelMap(prisma);
  const nameRows = await prisma.$queryRawUnsafe(
    'SELECT DISTINCT fee_name FROM fee_name_master WHERE del = 1 ORDER BY id ASC',
  );
  const columnMap = {};
  nameRows.forEach((row) => {
    columnMap[row.fee_name] = labels[row.fee_name] || row.fee_name;
  });

  const receiptRows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT receipt_no FROM student_fee WHERE del = 1 ${dateSql} ORDER BY paid_date ASC, id ASC`,
  );

  const rows = [];
  const footer = { overall: 0 };
  const activeColumns = {};

  for (const { receipt_no: receiptNo } of receiptRows) {
    const feeRows = await prisma.$queryRawUnsafe(
      `SELECT ${STUDENT_FEE_REPORT_COLUMNS}
       FROM student_fee WHERE del = 1 AND receipt_no = '${escapeSql(receiptNo)}' ORDER BY id ASC`,
    );
    if (!feeRows.length) continue;

    const first = feeRows[0];
    const stuRows = await prisma.$queryRawUnsafe(
      `SELECT student_name, student_initial FROM student_profile_tb WHERE del = 1 AND register_no = '${escapeSql(first.register_no)}' LIMIT 1`,
    );
    const courseRows = await prisma.$queryRawUnsafe(
      `SELECT degree_name, department_short_name, course_name FROM basic_setup_course_tb WHERE del = 1 AND id = ${Number(first.course_id)} LIMIT 1`,
    );
    const stu = stuRows[0] || {};
    const course = courseRows[0] || {};
    const dept = course.department_short_name && course.department_short_name !== '-'
      ? ` - ${course.department_short_name}` : '';

    const amounts = {};
    let fine = 0;
    let concession = 0;
    let total = 0;
    const yearParts = new Set();

    feeRows.forEach((line) => {
      const key = line.fee_name;
      amounts[key] = (amounts[key] || 0) + Number(line.fee_amount || 0);
      activeColumns[key] = columnMap[key] || key;
      fine += Number(line.fine_amount || 0);
      concession += Number(line.discount_amount || 0);
      total += Number(line.total_amount || line.fee_amount || 0);
      yearParts.add(line.class_year);
    });

    let remarks = '';
    if (first.slip_id) {
      const slipRows = await prisma.$queryRawUnsafe(
        `SELECT GROUP_CONCAT(CONCAT(bank_id, '__', receipt_no) SEPARATOR ',') AS br, pay_bank
         FROM fee_slip_tb WHERE del = 1 AND group_id = '${escapeSql(first.slip_id)}' GROUP BY group_id LIMIT 1`,
      );
      if (slipRows[0]?.br) {
        const bankRows = await prisma.$queryRawUnsafe('SELECT id, bank_ptext FROM fee_bank_master WHERE del = 1');
        const bankMap = {};
        bankRows.forEach((b) => { bankMap[b.id] = b.bank_ptext; });
        remarks = slipRows[0].br.split(',').map((part) => {
          const [bankId, no] = part.split('__');
          return `${bankMap[bankId] || ''}${String(no).padStart(4, '0')}`;
        }).join(', ');
      }
    }

    Object.entries(amounts).forEach(([k, v]) => {
      footer[k] = (footer[k] || 0) + v;
    });
    footer.overall += total;

    rows.push({
      receipt: receiptNo,
      date: formatDisplayDate(first.paid_date),
      registerNo: first.register_no,
      studentLabel: titleCaseName(stu.student_name, stu.student_initial),
      classLabel: `${course.degree_name || ''}${dept}`,
      yearLabel: [...yearParts].join(', '),
      amounts,
      fine,
      concession,
      total,
      mode: first.amount_type,
      approvedBy: first.created_by,
      remarks,
      batch: first.academic_batch,
    });
  }

  const columns = Object.entries(activeColumns)
    .filter(([, label]) => label)
    .map(([key, label]) => ({ key, label }));

  if (!rows.length) {
    return {
      rows: [],
      columns: [],
      html: '<p class="text-muted">No fee collection data for the selected filters.</p>',
    };
  }

  const html = buildCollectionReportTable({ columns, rows, footer });
  await insertLog(
    ['student_fee_report', 'Report', 'Successful', `${payload.fromDate || ''} - ${payload.toDate || ''}`, new Date(), meta.ip || '', '', memberId],
    '',
  );

  return { rows, columns, footer, html };
}
