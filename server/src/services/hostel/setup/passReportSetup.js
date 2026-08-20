import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { formatDateDisplay, logHostelSetup, toIsoDate } from '../setupAudit.js';

const PAGE = 'hostel_student_report.php';

const STATUS_LABEL = ['Pending', 'Approved', 'Rejected'];

function normalizeList(value, fallback) {
  const list = Array.isArray(value) ? value : (value ? [value] : []);
  const cleaned = list.map((v) => String(v).trim()).filter(Boolean);
  return cleaned.length ? cleaned : fallback;
}

export async function loadPassReportSetup(memberId, fields = {}, audit = {}) {
  const fromDate = toIsoDate(fields.fromDate) || new Date().toISOString().slice(0, 10);
  const toDate = toIsoDate(fields.toDate) || fromDate;
  const passTypes = normalizeList(fields.passType, ['home', 'out']).filter((v) => v === 'home' || v === 'out');
  const statuses = normalizeList(fields.status, ['p', '1', '2'])
    .map((v) => (v === 'p' ? '0' : v))
    .filter((v) => ['0', '1', '2'].includes(v));
  const registerNo = String(fields.registerNo || '').trim();

  let sql = `SELECT A.id, A.pass_type, A.student_id, A.from_date, A.to_date, A.status, A.comments, A.parent_status,
    B.register_no, B.student_name, B.student_initial
    FROM hostel_pass_request AS A
    LEFT JOIN student_profile_tb AS B ON A.student_id = B.id AND B.del = 1
    WHERE A.del = 1 AND DATE(A.from_date) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'`;
  if (passTypes.length) sql += ` AND A.pass_type IN (${passTypes.map((v) => `'${escapeSql(v)}'`).join(',')})`;
  if (statuses.length) sql += ` AND A.status IN (${statuses.map((v) => `'${escapeSql(v)}'`).join(',')})`;
  if (registerNo) sql += ` AND B.register_no LIKE '%${escapeSql(registerNo.toUpperCase())}%'`;
  sql += ' ORDER BY A.from_date DESC LIMIT 500';

  const rows = await prisma.$queryRawUnsafe(sql);
  await logHostelSetup(PAGE, 'View', 'Successful', `${fromDate}-${toDate}`, memberId, audit);
  return {
    fromDate,
    toDate,
    passType: passTypes,
    status: statuses.map((v) => (v === '0' ? 'p' : v)),
    registerNo,
    rows: rows.map((r) => ({
      id: r.id,
      passType: r.pass_type,
      registerNo: r.register_no,
      studentName: `${r.student_initial || ''} ${r.student_name || ''}`.trim(),
      fromDate: formatDateDisplay(r.from_date),
      toDate: formatDateDisplay(r.to_date),
      status: STATUS_LABEL[Number(r.status)] || 'Pending',
      parentStatus: STATUS_LABEL[Number(r.parent_status)] || 'Pending',
      comments: r.comments,
    })),
  };
}

export async function savePassReportSetup(payload, memberId, audit = {}) {
  return loadPassReportSetup(memberId, payload, audit);
}
