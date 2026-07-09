import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { fmtDateExpr } from './certificateShared.js';

const PAGE = 'certificate_approve.php';
const PAGE_SIZE = 20;
const STATUS_LABELS = ['Pending', 'Approved', 'Rejected'];

const SUBJECT_FIELDS = [
  'Anatomy', 'Phy_Bio_chemistry', 'Histology', 'Patho_Microbiology', 'Pharmacology',
  'Dental_Materials', 'Pre_clinical_Endo', 'Pre_clinical_Prostho', 'General_Medicine',
  'General_Surgery', 'Oral_Pathology', 'OMR', 'Pedo', 'Ortho', 'Perio', 'Prostho', 'Endo',
  'DMFS', 'PHD',
];

const RECEIPT_LIST_COLS = `
  R.id, R.application_no, ${fmtDateExpr('R.application_date', 'application_date')},
  COALESCE(NULLIF(R.register_no, ''), S.register_no) AS register_no,
  R.apply_for, R.status,
  SC.name AS certificate_name,
  S.student_name, S.student_initial, S.student_title, S.academic_year,
  C.degree_name, C.department_short_name
`;

const RECEIPT_DETAIL_COLS = `
  ${RECEIPT_LIST_COLS},
  R.application_fee, R.apply_reason, R.comments,
  R.year_of_completion, R.exam_month, R.exam_year, R.conduct_char
`;

const APPROVE_FROM = `
  FROM certificate_receipt_tb AS R
  INNER JOIN student_profile_tb AS S ON S.del = 1 AND S.id = R.student_id
  LEFT JOIN basic_setup_course_tb AS C ON C.del = 1 AND C.id = S.course_id
  LEFT JOIN cer_subcategory_tb AS SC ON SC.id = R.apply_for AND SC.del = 1
`;

function formatStudentName(row) {
  const title = row.student_title ? `${row.student_title}. ` : '';
  const name = `${row.student_initial || ''} ${row.student_name || ''}`.trim();
  return `${title}${name}`.trim();
}

function formatCourseLabel(row) {
  const degree = row.degree_name || '';
  const dept = row.department_short_name ? ` - ${row.department_short_name}` : '';
  return `${degree}${dept}`.trim();
}

function mapListRow(row) {
  const status = Number(row.status || 0);
  const studentName = formatStudentName(row);
  const courseLabel = formatCourseLabel(row);
  return {
    id: Number(row.id),
    applicationNo: Number(row.application_no),
    receiptLabel: `CR${row.application_no}`,
    applicationDate: row.application_date || '',
    registerNo: row.register_no || '',
    academicYear: row.academic_year || '',
    applyFor: row.apply_for || '',
    applyForName: row.certificate_name || row.apply_for || '',
    status,
    statusLabel: STATUS_LABELS[status] || STATUS_LABELS[0],
    studentName,
    courseLabel,
    studentLine: [row.register_no, courseLabel, row.academic_year].filter(Boolean).join(' | '),
  };
}

function mapDetailRow(row) {
  const subjects = {};
  for (const field of SUBJECT_FIELDS) {
    subjects[`${field}_attempts`] = row[`${field}_attempts`] || '';
    subjects[`${field}_passing`] = row[`${field}_passing`] || '';
  }
  return {
    ...mapListRow(row),
    applicationFee: row.application_fee || '',
    applyReason: row.apply_reason || '',
    comments: row.comments || '',
    yearOfCompletion: row.year_of_completion || '',
    examMonth: row.exam_month || '',
    examYear: row.exam_year || '',
    conductChar: row.conduct_char || '',
    ...subjects,
  };
}

function buildApproveWhere(fields = {}) {
  const status = fields.status !== undefined && fields.status !== '' ? Number(fields.status) : 0;
  const fromDate = fields.fromDate ? String(fields.fromDate).slice(0, 10) : '';
  const toDate = fields.toDate ? String(fields.toDate).slice(0, 10) : '';
  const search = fields.search ? String(fields.search).trim() : '';

  let where = 'WHERE R.del = 1';
  if (!Number.isNaN(status)) where += ` AND R.status = ${status}`;
  if (fromDate) {
    where += ` AND R.application_date >= '${escapeSql(fromDate)}' AND R.application_date > '1000-01-01'`;
  }
  if (toDate) {
    where += ` AND R.application_date <= '${escapeSql(toDate)}' AND R.application_date > '1000-01-01'`;
  }
  if (search) {
    const term = escapeSql(search);
    where += ` AND (S.register_no = '${term}' OR SC.name LIKE '%${term}%')`;
  }

  return {
    where,
    filters: {
      status: String(status),
      fromDate,
      toDate,
      search,
      page: Math.max(1, Number(fields.page) || 1),
    },
  };
}

async function loadApproveSummary() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT status, COUNT(*) AS c
    FROM certificate_receipt_tb
    WHERE del = 1
    GROUP BY status
  `);
  const summary = { total: 0, approved: 0, pending: 0, rejected: 0 };
  for (const row of rows) {
    const count = Number(row.c);
    summary.total += count;
    if (Number(row.status) === 0) summary.pending = count;
    if (Number(row.status) === 1) summary.approved = count;
    if (Number(row.status) === 2) summary.rejected = count;
  }
  return summary;
}

async function loadApproveReceiptList(fields = {}) {
  const { where, filters } = buildApproveWhere(fields);
  const page = filters.page;
  const offset = (page - 1) * PAGE_SIZE;

  const [countRows, rows] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT COUNT(*) AS total ${APPROVE_FROM} ${where}`),
    prisma.$queryRawUnsafe(`
      SELECT ${RECEIPT_LIST_COLS}
      ${APPROVE_FROM}
      ${where}
      ORDER BY R.created_dt DESC
      LIMIT ${offset}, ${PAGE_SIZE}
    `),
  ]);

  const total = Number(countRows[0]?.total || 0);
  const from = total ? offset + 1 : 0;
  const to = Math.min(offset + PAGE_SIZE, total);

  return {
    filters,
    receipts: rows.map(mapListRow),
    pagination: { page, pageSize: PAGE_SIZE, total, from, to },
  };
}

async function loadApproveReceiptDetail(receiptId) {
  const id = Number(receiptId);
  if (!id) return null;
  const rows = await prisma.$queryRawUnsafe(`
    SELECT ${RECEIPT_DETAIL_COLS}
    ${APPROVE_FROM}
    WHERE R.del = 1 AND R.id = ${id}
    LIMIT 1
  `);
  return rows[0] ? mapDetailRow(rows[0]) : null;
}

export async function loadCertificateApprove(memberId, fields = {}, audit = {}) {
  const receiptId = fields.receiptId ? Number(fields.receiptId) : null;
  const [list, summary, selectedReceipt] = await Promise.all([
    loadApproveReceiptList(fields),
    loadApproveSummary(),
    receiptId ? loadApproveReceiptDetail(receiptId) : Promise.resolve(null),
  ]);

  await logModulePage(PAGE, 'View', 'Successful', list.filters.search, memberId, audit);
  return {
    success: true,
    ...list,
    summary,
    selectedReceipt,
  };
}

export async function saveCertificateApprove(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);
  const id = Number(payload.id);
  if (!id) return { success: false, message: 'Receipt id required.' };

  const sets = [
    `status = ${Number(payload.status ?? 1)}`,
    `comments = '${escapeSql(String(payload.comments || ''))}'`,
    `year_of_completion = '${escapeSql(String(payload.yearOfCompletion || ''))}'`,
    `exam_month = '${escapeSql(String(payload.examMonth || ''))}'`,
    `exam_year = '${escapeSql(String(payload.examYear || ''))}'`,
    `conduct_char = '${escapeSql(String(payload.conductChar || ''))}'`,
    `generated_date = CURDATE()`,
    `updated_dt = NOW()`,
    `updated_by = '${escapeSql(memberId)}'`,
    `updated_ip = '${escapeSql(update.updated_ip)}'`,
  ];

  for (const field of SUBJECT_FIELDS) {
    const attempts = payload[`${field}_attempts`];
    const passing = payload[`${field}_passing`];
    if (attempts !== undefined) sets.push(`${field}_attempts = '${escapeSql(String(attempts))}'`);
    if (passing !== undefined) sets.push(`${field}_passing = '${escapeSql(String(passing))}'`);
  }

  await prisma.$executeRawUnsafe(`
    UPDATE certificate_receipt_tb SET ${sets.join(', ')} WHERE id = ${id} AND del = 1
  `);

  await logModulePage(PAGE, 'Update', 'Successful', String(payload.applicationNo || id), memberId, audit);
  const [list, summary] = await Promise.all([
    loadApproveReceiptList(payload.filters || {}),
    loadApproveSummary(),
  ]);

  const status = Number(payload.status ?? 1);
  const message = status === 2
    ? 'Certificate request rejected.'
    : status === 0
      ? 'Certificate request set to pending.'
      : 'Certificate approved.';

  return {
    success: true,
    message,
    ...list,
    summary,
    selectedReceipt: null,
  };
}
