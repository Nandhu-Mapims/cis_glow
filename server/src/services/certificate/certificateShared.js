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
