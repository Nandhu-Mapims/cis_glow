import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { logLibrarySetup, toIsoDate } from '../setupAudit.js';
import { loadAcademicConfig } from '../../shared/ciaSetupHelpers.js';

const PAGE = 'transaction_report.php';

function fmtDateExpr(col, alias) {
  const a = alias || col.split('.').pop();
  return `IF(${col}='0000-00-00' OR ${col}='0000-00-00 00:00:00','',DATE_FORMAT(${col},'%Y-%m-%d')) AS ${a}`;
}

function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function buildPrintHtml(rows) {
  const body = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(r.registerNo)}</td>
      <td>${esc(r.bookId)}</td>
      <td>${esc(r.checkOutDate)}</td>
      <td>${esc(r.dueDate)}</td>
      <td>${esc(r.checkInDate)}</td>
      <td>${esc(r.resourceName)}</td>
      <td>${esc(r.authorName)}</td>
      <td>${r.isDamage ? 'Yes' : ''}</td>
    </tr>`).join('');
  return `<h3>Transactions Report</h3><table border="1" cellspacing="0" cellpadding="4"><thead><tr>
    <th>S.No.</th><th>Register</th><th>Book</th><th>Checkout</th><th>Due</th><th>Return</th><th>Title</th><th>Author</th><th>Dmg</th>
  </tr></thead><tbody>${body}</tbody></table>`;
}

async function loadAcademicYearOptions() {
  const config = await loadAcademicConfig();
  const years = new Set([config['U.G'].regular, config['U.G'].additional, config['P.G'].regular, ...config.EXAM].filter(Boolean));
  return [...years].sort().reverse().map((y) => ({ value: y, label: y }));
}

export async function loadTransactionReportSetup(memberId, fields = {}, audit = {}) {
  const fromDate = toIsoDate(fields.fromDate) || new Date().toISOString().slice(0, 10);
  const toDate = toIsoDate(fields.toDate) || fromDate;
  const issueReturn = String(fields.issueReturn || '').trim();
  const registerNo = String(fields.registerNo || '').trim().toUpperCase();
  const isDamaged = fields.isDamaged === '' || fields.isDamaged === undefined ? '' : String(fields.isDamaged);
  const academicYear = String(fields.academicYear || '').trim();
  const batch = String(fields.batch || '').trim();

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
    const needsStudentJoin = academicYear || batch;
    let sql = `
      SELECT A.register_no, A.book_id,
        ${fmtDateExpr('A.check_out_date', 'check_out_date')},
        ${fmtDateExpr('A.due_date', 'due_date')},
        ${fmtDateExpr('A.check_in_date', 'check_in_date')},
        B.resource_name, B.author_name, A.is_damage
      FROM library_transaction_tb AS A
      INNER JOIN book_tb AS B ON A.book_id = B.accession_no AND B.del = 1
      ${needsStudentJoin ? 'INNER JOIN student_academic_tb AS C ON C.register_no = A.register_no AND C.del = 1' : ''}
      WHERE A.del = 1 ${dateFilter}`;
    if (registerNo) sql += ` AND A.register_no = '${escapeSql(registerNo)}'`;
    if (isDamaged !== '') sql += ` AND A.is_damage = '${escapeSql(isDamaged)}'`;
    if (academicYear) sql += ` AND C.academic_year = '${escapeSql(academicYear)}'`;
    if (batch) sql += ` AND C.academic_batch = '${escapeSql(batch)}'`;
    sql += ' ORDER BY A.id ASC LIMIT 500';
    rows = await prisma.$queryRawUnsafe(sql);
  }

  await logLibrarySetup(PAGE, 'View', 'Successful', `${fromDate}-${toDate}`, memberId, audit);
  const mappedRows = rows.map((row) => ({
    registerNo: row.register_no || '',
    bookId: row.book_id || '',
    checkOutDate: row.check_out_date || '',
    dueDate: row.due_date || '',
    checkInDate: row.check_in_date || '',
    resourceName: row.resource_name || '',
    authorName: row.author_name || '',
    isDamage: Number(row.is_damage) === 1,
  }));
  return {
    fromDate,
    toDate,
    issueReturn,
    registerNo,
    isDamaged,
    academicYear,
    batch,
    academicYearOptions: await loadAcademicYearOptions(),
    rows: mappedRows,
    printHtml: fields.search ? buildPrintHtml(mappedRows) : '',
  };
}

export async function saveTransactionReportSetup(payload, memberId, audit = {}) {
  return loadTransactionReportSetup(memberId, { ...payload, search: true }, audit);
}
