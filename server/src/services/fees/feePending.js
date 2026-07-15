import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';

// Native rewrite of legacy-bridge/student_fee_pending_list.php, which scraped this
// same data out of student_fee_add_new.php's rendered HTML. Matches that screen's
// query at ~line 1323 (SELECT group_id, GROUP_CONCAT(bank_id__receipt_no), register_no,
// paid_date, ref_id, pay_bank ... GROUP BY group_id ORDER BY created_dt ASC) plus the
// separate group-count query used for its "Showing X to Y of Z" pagination line.
export async function getPendingFeeSlips(payload = {}) {
  const limit = Math.min(Number(payload.limit) || 50, 100);
  const registerNo = String(payload.registerNo || '').trim();
  const searchSql = registerNo ? ` AND S.register_no LIKE '${escapeSql(registerNo)}'` : '';
  const baseWhere = `S.del = 1 AND S.f_status = 0 AND S.group_id != '' AND S.id > 306${searchSql}`;

  const groupRows = await prisma.$queryRawUnsafe(
    `SELECT S.group_id, MIN(S.created_dt) AS first_created_dt
     FROM fee_slip_tb AS S
     WHERE ${baseWhere}
     GROUP BY S.group_id
     ORDER BY first_created_dt ASC`,
  );
  const total = groupRows.length;
  const pageGroupIds = groupRows.slice(0, limit).map((row) => row.group_id);

  if (!pageGroupIds.length) {
    return { slips: [], total, source: 'sql' };
  }

  const idList = pageGroupIds.map((id) => `'${escapeSql(id)}'`).join(',');
  const [rows, bankRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT S.group_id, S.register_no, CAST(S.paid_date AS CHAR) AS paid_date,
              S.pay_bank, S.ref_id, S.bank_id, S.receipt_no,
              CAST(S.created_dt AS CHAR) AS created_dt, S.created_by,
              P.student_name, P.student_initial, C.degree_name
       FROM fee_slip_tb AS S
       LEFT JOIN student_profile_tb AS P ON P.del = 1 AND P.register_no = S.register_no
       LEFT JOIN basic_setup_course_tb AS C ON C.del = 1 AND C.id = P.course_id
       WHERE S.del = 1 AND S.f_status = 0 AND S.group_id IN (${idList})
       ORDER BY S.created_dt ASC`,
    ),
    prisma.$queryRawUnsafe('SELECT id, bank_ptext FROM fee_bank_master WHERE del = 1'),
  ]);

  const bankPrefixById = new Map(bankRows.map((bank) => [String(bank.id), bank.bank_ptext || '']));

  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.group_id)) {
      const studentName = [row.student_name, row.student_initial].filter(Boolean).join(' ').trim();
      groups.set(row.group_id, {
        groupId: row.group_id,
        registerNo: row.register_no,
        studentName,
        degreeName: row.degree_name || '',
        paidDate: row.paid_date,
        payBank: row.pay_bank,
        amount: row.ref_id,
        createdAt: row.created_dt,
        createdBy: row.created_by,
        receiptParts: [],
      });
    }
    const prefix = bankPrefixById.get(String(row.bank_id)) || '';
    const receiptNo = String(row.receipt_no ?? '').padStart(4, '0');
    groups.get(row.group_id).receiptParts.push(`${prefix}${receiptNo}`);
  }

  const slips = pageGroupIds
    .map((id) => groups.get(id))
    .filter(Boolean)
    .map(({ receiptParts, ...slip }) => ({ ...slip, receipts: receiptParts.join(', ') }));

  return { slips, total, source: 'sql' };
}
