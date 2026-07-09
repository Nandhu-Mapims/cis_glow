import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { formatDateDisplay, logHostelSetup, toIsoDate } from '../setupAudit.js';

const PAGE = 'hostel_student_report.php';

export async function loadPassReportSetup(memberId, fields = {}, audit = {}) {
  const fromDate = toIsoDate(fields.fromDate) || new Date().toISOString().slice(0, 10);
  const toDate = toIsoDate(fields.toDate) || fromDate;
  const status = String(fields.status || '').trim();

  let sql = `SELECT A.id, A.pass_type, A.student_id, A.from_date, A.to_date, A.status, A.comments,
    B.register_no, B.student_name, B.student_initial
    FROM hostel_pass_request AS A
    LEFT JOIN student_profile_tb AS B ON A.student_id = B.id AND B.del = 1
    WHERE A.del = 1 AND DATE(A.from_date) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'`;
  if (status !== '') sql += ` AND A.status = '${escapeSql(status)}'`;
  sql += ' ORDER BY A.from_date DESC LIMIT 500';

  const rows = await prisma.$queryRawUnsafe(sql);
  await logHostelSetup(PAGE, 'View', 'Successful', `${fromDate}-${toDate}`, memberId, audit);
  return {
    fromDate,
    toDate,
    status,
    rows: rows.map((r) => ({
      id: r.id,
      passType: r.pass_type,
      registerNo: r.register_no,
      studentName: `${r.student_initial || ''} ${r.student_name || ''}`.trim(),
      fromDate: formatDateDisplay(r.from_date),
      toDate: formatDateDisplay(r.to_date),
      status: r.status,
      comments: r.comments,
    })),
  };
}

export async function savePassReportSetup(payload, memberId, audit = {}) {
  return loadPassReportSetup(memberId, payload, audit);
}
