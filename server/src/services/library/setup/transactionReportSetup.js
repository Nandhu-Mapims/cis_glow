import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { logLibrarySetup, toIsoDate } from '../setupAudit.js';

const PAGE = 'transaction_report.php';

function fmtDateExpr(col, alias) {
  const a = alias || col.split('.').pop();
  return `IF(${col}='0000-00-00' OR ${col}='0000-00-00 00:00:00','',DATE_FORMAT(${col},'%Y-%m-%d')) AS ${a}`;
}

export async function loadTransactionReportSetup(memberId, fields = {}, audit = {}) {
  const fromDate = toIsoDate(fields.fromDate) || new Date().toISOString().slice(0, 10);
  const toDate = toIsoDate(fields.toDate) || fromDate;
  const issueReturn = String(fields.issueReturn || '').trim();
  const registerNo = String(fields.registerNo || '').trim().toUpperCase();
  const isDamaged = fields.isDamaged === '' || fields.isDamaged === undefined ? '' : String(fields.isDamaged);

  let dateFilter = '';
  if (issueReturn === 'Issued') {
    dateFilter = ` AND (A.check_out_date >= '${fromDate}' AND A.check_out_date <= '${toDate}')`;
  } else if (issueReturn === 'Return') {
    dateFilter = ` AND (A.check_in_date >= '${fromDate}' AND A.check_in_date <= '${toDate}')`;
  } else if (issueReturn === 'Due') {
    dateFilter = ` AND (A.due_date >= '${fromDate}' AND A.due_date <= '${toDate}' AND (A.check_in_date = '0000-00-00 00:00:00' OR A.check_in_date = '1970-01-01 00:00:00'))`;
  } else {
    dateFilter = ` AND ((A.check_out_date >= '${fromDate}' AND A.check_out_date <= '${toDate}') OR (A.check_in_date >= '${fromDate}' AND A.check_in_date <= '${toDate}'))`;
  }

  let rows = [];
  if (fields.search) {
    let sql = `
      SELECT A.register_no, A.book_id,
        ${fmtDateExpr('A.check_out_date', 'check_out_date')},
        ${fmtDateExpr('A.due_date', 'due_date')},
        ${fmtDateExpr('A.check_in_date', 'check_in_date')},
        B.resource_name, B.author_name, A.is_damage
      FROM library_transaction_tb AS A
      INNER JOIN book_tb AS B ON A.book_id = B.accession_no AND B.del = 1
      WHERE A.del = 1 ${dateFilter}`;
    if (registerNo) sql += ` AND A.register_no = '${escapeSql(registerNo)}'`;
    if (isDamaged !== '') sql += ` AND A.is_damage = '${escapeSql(isDamaged)}'`;
    sql += ' ORDER BY A.id ASC LIMIT 500';
    rows = await prisma.$queryRawUnsafe(sql);
  }

  await logLibrarySetup(PAGE, 'View', 'Successful', `${fromDate}-${toDate}`, memberId, audit);
  return {
    fromDate,
    toDate,
    issueReturn,
    registerNo,
    isDamaged,
    rows: rows.map((row) => ({
      registerNo: row.register_no || '',
      bookId: row.book_id || '',
      checkOutDate: row.check_out_date || '',
      dueDate: row.due_date || '',
      checkInDate: row.check_in_date || '',
      resourceName: row.resource_name || '',
      authorName: row.author_name || '',
      isDamage: Number(row.is_damage) === 1,
    })),
  };
}

export async function saveTransactionReportSetup(payload, memberId, audit = {}) {
  return loadTransactionReportSetup(memberId, { ...payload, search: true }, audit);
}
