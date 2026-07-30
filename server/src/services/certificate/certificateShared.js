import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';

export function fmtDateExpr(col, alias) {
  const a = alias || col.split('.').pop();
  return `IF(${col}='0000-00-00' OR ${col}='0000-00-00 00:00:00','',DATE_FORMAT(${col},'%Y-%m-%d')) AS ${a}`;
}

export const CERTIFICATE_STUDENT_JOIN = `
  LEFT JOIN student_profile_tb AS S ON S.del = 1 AND S.id = R.student_id
  LEFT JOIN student_profile_tb AS S2 ON S.id IS NULL AND R.register_no != '' AND S2.del = 1 AND S2.register_no = R.register_no
`;

export const CERTIFICATE_REGISTER_NO_EXPR = `COALESCE(NULLIF(R.register_no, ''), S.register_no, S2.register_no)`;
export const CERTIFICATE_STUDENT_NAME_EXPR = 'COALESCE(S.student_name, S2.student_name)';
export const CERTIFICATE_STUDENT_INITIAL_EXPR = 'COALESCE(S.student_initial, S2.student_initial)';
export const CERTIFICATE_COURSE_JOIN = 'LEFT JOIN basic_setup_course_tb AS C ON C.del = 1 AND C.id = COALESCE(S.course_id, S2.course_id)';

// certificate_receipt_tb has many legacy-content columns (exam attempts/passing, transfer,
// training/leave dates, etc.) that are NOT NULL with no DEFAULT. Under STRICT_TRANS_TABLES
// they must be supplied explicitly on every INSERT even though only certificate_approve_more.php
// ever populates them (at approval time). Blank/zero placeholders here mirror that legacy flow.
const RECEIPT_BLANK_TEXT_COLUMNS = [
  'comments', 'req_reference', 'certificate_content',
  'Anatomy_attempts', 'Anatomy_passing',
  'Phy_Bio_chemistry_attempts', 'Phy_Bio_chemistry_passing',
  'Histology_attempts', 'Histology_passing',
  'Patho_Microbiology_attempts', 'Patho_Microbiology_passing',
  'Pharmacology_attempts', 'Pharmacology_passing',
  'Dental_Materials_attempts', 'Dental_Materials_passing',
  'Pre_clinical_Endo_attempts', 'Pre_clinical_Endo_passing',
  'Pre_clinical_Prostho_attempts', 'Pre_clinical_Prostho_passing',
  'General_Medicine_attempts', 'General_Medicine_passing',
  'General_Surgery_attempts', 'General_Surgery_passing',
  'Oral_Pathology_attempts', 'Oral_Pathology_passing',
  'OMR_attempts', 'OMR_passing',
  'Pedo_attempts', 'Pedo_passing',
  'Ortho_attempts', 'Ortho_passing',
  'Perio_attempts', 'Perio_passing',
  'Prostho_attempts', 'Prostho_passing',
  'Endo_attempts', 'Endo_passing',
  'DMFS_attempts', 'DMFS_passing',
  'PHD_attempts', 'PHD_passing',
  'year_of_completion', 'exam_month', 'exam_year',
  'leave_days', 'conduct_char', 'transfer_from', 'transfer_year',
  'mds1_attempts', 'mds2_attempts', 'mds3_attempts',
  'mds1_passing', 'mds2_passing', 'mds3_passing',
  'mds_part1_attempts', 'mds_part1_passing',
  'updated_ip', 'updated_by',
];
const RECEIPT_BLANK_DATE_COLUMNS = ['train_from_date', 'train_to_date', 'leave_from_date', 'leave_to_date'];
const RECEIPT_BLANK_INT_COLUMNS = ['transfered'];

export function receiptBlankColumnsSql() {
  const names = [...RECEIPT_BLANK_TEXT_COLUMNS, ...RECEIPT_BLANK_DATE_COLUMNS, ...RECEIPT_BLANK_INT_COLUMNS];
  const values = [
    ...RECEIPT_BLANK_TEXT_COLUMNS.map(() => `''`),
    ...RECEIPT_BLANK_DATE_COLUMNS.map(() => `'0000-00-00'`),
    ...RECEIPT_BLANK_INT_COLUMNS.map(() => '0'),
  ];
  return { columnsSql: names.join(', '), valuesSql: values.join(', ') };
}

export async function nextApplicationNo() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT COALESCE(MAX(application_no), 0) + 1 AS n FROM certificate_receipt_tb WHERE del=1',
  );
  return Number(rows[0]?.n || 1);
}

export async function lookupStudent(registerNo) {
  const reg = escapeSql(String(registerNo || '').trim().toUpperCase());
  if (!reg) return null;
  const rows = await prisma.$queryRawUnsafe(`
    SELECT A.id, A.register_no, A.student_name, A.student_initial,
      B.degree_name, B.department_name, B.id AS course_id
    FROM student_profile_tb AS A
    INNER JOIN basic_setup_course_tb AS B ON A.course_id = B.id
    WHERE A.del = 1 AND B.del = 1 AND A.register_no = '${reg}'
    LIMIT 1
  `);
  return rows[0] || null;
}

export async function loadCerCategories() {
  return prisma.$queryRawUnsafe(`
    SELECT id, name, c_order FROM cer_category_tb WHERE del = 1 ORDER BY c_order ASC, name ASC
  `);
}

export async function loadCerSubcategories(categoryId) {
  if (!categoryId) return [];
  return prisma.$queryRawUnsafe(`
    SELECT id, c_id, name, c_order, c_format, c_details
    FROM cer_subcategory_tb WHERE del = 1 AND c_id = ${Number(categoryId)}
    ORDER BY c_order ASC, name ASC
  `);
}

export function buildReasonString(applyFor, payload = {}) {
  const reasons = Array.isArray(payload.applyReason) ? payload.applyReason : [];
  let reasonString = reasons.join('^^^');
  if (payload.applyForName) {
    reasonString += (reasonString ? '^^^^^' : '') + payload.applyForName;
  }
  if (payload.otherApplyName) {
    reasonString += (reasonString ? '^^^^^' : '') + payload.otherApplyName;
  }
  const reasonLabel = reasons.join(', ');
  return { reasonString, reasonLabel };
}

export async function loadAcademicYears() {
  const rows = await prisma.$queryRawUnsafe('SELECT ug_academic_year, pg_academic_year FROM basic_setup_tb WHERE del = 1 LIMIT 1');
  const row = rows[0] || {};
  return { ug: row.ug_academic_year || '', pg: row.pg_academic_year || '' };
}

export async function loadCourses() {
  return prisma.$queryRawUnsafe(`
    SELECT id, degree_name, department_name, course_name, course_department
    FROM basic_setup_course_tb WHERE del = 1 ORDER BY c_order, degree_name, department_name
  `);
}
