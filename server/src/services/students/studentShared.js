import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/index.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { getStudentCourseOptions } from './studentCourses.js';

/** Active (not discontinued) students — CAST avoids Prisma errors on 0000-00-00 dates. */
export function studentActiveSql(alias = '') {
  const col = alias ? `${alias}.releaving_date` : 'releaving_date';
  return `(CAST(${col} AS CHAR) LIKE '0000-00-00%' OR CAST(${col} AS CHAR) > DATE_FORMAT(NOW(), '%Y-%m-%d'))`;
}

export const ACTIVE = studentActiveSql();

/** Columns for student search/report filters (excludes raw releaving_date). */
export const STUDENT_FILTER_SELECT = `
  id, admission_no, academic_year, register_no, student_name, student_initial, course_id,
  door_no, street, post, taluk, district, state, pincode, mobile_no, father_mobile_1,
  student_photo`;

export const STUDENT_FILTER_SELECT_A = STUDENT_FILTER_SELECT
  .split(',')
  .map((col) => `A.${col.trim()}`)
  .join(', ');

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatStudentName(row) {
  const initial = row.student_initial ? `. ${String(row.student_initial).trim()}` : '';
  return `${row.student_name || ''}${initial}`.trim();
}

const ALUMNI_FILTER_SELECT = `
  id, alumni_regno, alumni_name, alumni_email, alumni_mobile, alumni_address,
  alumni_course, alumni_dept, alumni_yop, alumni_pgd, alumni_cp, alumni_ws,
  alumni_gender, alumni_file,
  IF(CAST(alumni_dob AS CHAR) LIKE '0000-00-00%', NULL, CAST(alumni_dob AS CHAR)) AS alumni_dob`;

function mapStudentToAlumniRow(student) {
  const deptName = String(student.department_name || '').trim();
  const dept = deptName && deptName !== '-' ? ` - ${deptName}` : '';
  return {
    alumni_regno: student.register_no,
    alumni_name: formatStudentName(student),
    alumni_email: student.personal_email || '',
    alumni_mobile: student.mobile_no || '',
    alumni_address: '',
    alumni_course: student.degree_name ? `${student.degree_name}${dept}`.trim() : (student.course_name || ''),
    alumni_dept: String(student.course_id || ''),
    alumni_yop: student.academic_year || '',
    alumni_file: '',
    alumni_dob: student.student_dob || '',
    fromStudentProfile: true,
  };
}

async function fetchStudentsAsAlumniRows(registerNos) {
  if (!registerNos.length) return [];
  const clause = registerNos.map((r) => `A.register_no='${escapeSql(r)}'`).join(' OR ');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.register_no, A.student_name, A.student_initial, A.course_id, A.academic_year,
            A.mobile_no, A.personal_email,
            IF(CAST(A.student_dob AS CHAR) LIKE '0000-00-00%', NULL, CAST(A.student_dob AS CHAR)) AS student_dob,
            B.degree_name, B.department_name, B.course_name
     FROM student_profile_tb AS A
     LEFT JOIN basic_setup_course_tb AS B ON B.id = A.course_id AND B.del = 1
     WHERE A.del = 1 AND (${clause})
     ORDER BY A.register_no ASC`,
  );
  return rows.map(mapStudentToAlumniRow);
}

export function wrapReportHtml(title, body) {
  return `<div class="report-print"><h4 class="text-center">${escapeHtml(title)}</h4>${body}</div>`;
}

export function tableHtml(headers, rows) {
  const th = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const trs = rows.map((row, i) => {
    const cells = row.map((c) => `<td>${c}</td>`).join('');
    return `<tr class="cis-table-hover"><td>${i + 1}</td>${cells}</tr>`;
  }).join('');
  return `<table class="table table-bordered table-sm"><thead><tr><th>S.No</th>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

export async function loadAcademicYears() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT academic_year FROM student_academic_tb
     WHERE del = 1 AND academic_year != '' ORDER BY academic_year DESC`,
  );
  return rows.map((r) => r.academic_year);
}

export async function loadBasicSetup() {
  return prisma.basic_setup_tb.findFirst({ where: { del: 1 } });
}

export async function loadCourseRows() {
  return prisma.$queryRawUnsafe(
    `SELECT id, course_name, degree_name, department_name, course_duration, full_part_time
     FROM basic_setup_course_tb WHERE del = 1 ORDER BY c_order ASC`,
  );
}

export async function studentIdCardPhotoUrl(registerNo) {
  const reg = String(registerNo || '').trim();
  if (!reg) return null;
  const base = path.join(config.legacyFilesPath, 'student_idcard');
  for (const name of [`${reg.toUpperCase()}.png`, `${reg.toUpperCase()}.JPG`, `${reg}.png`, `${reg}.jpg`]) {
    try {
      await fs.access(path.join(base, name));
      return `/legacy/files/student_idcard/${name}`;
    } catch {
      // try next
    }
  }
  return null;
}

export async function alumniPhotoUrl(registerNo, alumniFile) {
  const reg = String(registerNo || '').trim();
  const file = String(alumniFile || '').trim().replace(/%20/g, ' ');
  if (file) {
    const alumniPaths = [
      path.join(config.legacyFilesPath, 'alumni', 'alumni_photos', file),
      path.join(config.legacyCisPath, 'alumni', 'alumni_photos', file),
    ];
    for (const alumniPath of alumniPaths) {
      try {
        await fs.access(alumniPath);
        if (alumniPath.startsWith(path.resolve(config.legacyFilesPath))) {
          return `/legacy/files/alumni/alumni_photos/${encodeURIComponent(file).replace(/%20/g, '%20')}`;
        }
        return `/legacy/alumni/alumni_photos/${encodeURIComponent(file).replace(/%20/g, '%20')}`;
      } catch {
        // try next path
      }
    }
  }
  return studentIdCardPhotoUrl(reg);
}

export async function getAlumniCourseOptions() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.id, A.course_name, A.degree_name, A.department_name, A.full_part_time, B.alumni_yop
     FROM basic_setup_course_tb AS A
     INNER JOIN alumni_tb AS B ON B.alumni_dept = A.id
     WHERE A.del = 1 AND B.del = 1
     ORDER BY A.c_order ASC, B.alumni_yop DESC`,
  );
  const byCourse = new Map();
  for (const row of rows) {
    if (!byCourse.has(row.id)) {
      const dept = row.department_name && row.department_name !== '-'
        ? ` - ${row.department_name}`
        : '';
      const ft = row.full_part_time === 'Full Time' ? 'FT' : 'PT';
      byCourse.set(row.id, {
        id: row.id,
        courseName: row.course_name,
        degreeName: row.degree_name,
        label: `${row.degree_name}${dept} | ${ft}`,
        batchOptions: [],
      });
    }
    const course = byCourse.get(row.id);
    const value = `${row.id}___${row.alumni_yop}`;
    if (!course.batchOptions.some((b) => b.value === value)) {
      course.batchOptions.push({
        value,
        label: `${course.label} | ${row.alumni_yop}`,
      });
    }
  }
  return [...byCourse.values()];
}

export async function resolveAlumniFilter(fields) {
  const by = fields.search_by || fields.searchBy || 'roll_no';
  const input = String(
    fields.search_input || fields.searchInput || fields.find || '',
  ).trim();
  const course = String(fields.search_course || fields.searchCourse || '').trim();

  if (by === 'roll_no' && input) {
    const rolls = input.split(',').map((s) => s.trim()).filter(Boolean);
    if (!rolls.length) return [];
    const clause = rolls.map((r) => `alumni_regno='${escapeSql(r)}'`).join(' OR ');
    const alumniRows = await prisma.$queryRawUnsafe(
      `SELECT ${ALUMNI_FILTER_SELECT}
       FROM alumni_tb WHERE del = 1 AND (${clause}) ORDER BY alumni_regno ASC`,
    );
    const found = new Set(alumniRows.map((row) => String(row.alumni_regno || '').trim()));
    const missing = rolls.filter((roll) => !found.has(roll));
    if (!missing.length) return alumniRows;
    const studentRows = await fetchStudentsAsAlumniRows(missing);
    return [...alumniRows, ...studentRows].sort((a, b) => String(a.alumni_regno).localeCompare(String(b.alumni_regno)));
  }

  if (by === 'batch' && course) {
    const [courseId, yop] = course.split('___');
    if (!courseId || !yop) return [];
    return prisma.$queryRawUnsafe(
      `SELECT ${ALUMNI_FILTER_SELECT}
       FROM alumni_tb WHERE del = 1
       AND alumni_dept='${escapeSql(courseId)}' AND alumni_yop='${escapeSql(yop)}'
       ORDER BY alumni_regno ASC`,
    );
  }

  return [];
}

export async function loadAlumniLookups() {
  const courses = await getAlumniCourseOptions();
  return { courses };
}

export async function resolveStudentFilter(fields) {
  const by = fields.search_by || fields.searchBy || 'roll_no';
  const input = String(fields.search_input || fields.searchInput || '').trim();
  const course = String(fields.search_course || fields.searchCourse || '').trim();

  if (by === 'roll_no' && input) {
    // Partial match (min 3 chars) rather than exact — lets staff find a student from
    // a fragment of the register no without needing to type/paste the full value.
    const rolls = input.split(',').map((s) => s.trim()).filter((s) => s.length >= 3);
    if (!rolls.length) return [];
    const clause = rolls.map((r) => `register_no LIKE '%${escapeSql(r)}%'`).join(' OR ');
    return prisma.$queryRawUnsafe(
      `SELECT ${STUDENT_FILTER_SELECT} FROM student_profile_tb WHERE del = 1 AND ${ACTIVE} AND (${clause})
       ORDER BY register_no ASC`,
    );
  }

  if (by === 'batch' && course) {
    const [courseId, admissionYear] = course.split('___');
    if (!courseId || !admissionYear) return [];
    return prisma.$queryRawUnsafe(
      `SELECT ${STUDENT_FILTER_SELECT} FROM student_profile_tb WHERE del = 1 AND ${ACTIVE}
       AND course_id='${escapeSql(courseId)}' AND academic_year='${escapeSql(admissionYear)}'
       ORDER BY register_no ASC`,
    );
  }

  if (by === 'year' && course && fields.search_year) {
    const [courseId, batch] = course.split('___');
  const year = escapeSql(fields.search_year);
    return prisma.$queryRawUnsafe(
      `SELECT ${STUDENT_FILTER_SELECT_A} FROM student_profile_tb AS A
       INNER JOIN student_academic_tb AS B ON A.id = B.s_id
       WHERE A.del = 1 AND B.del = 1 AND ${studentActiveSql('A')}
         AND A.course_id='${escapeSql(courseId)}' AND B.academic_year='${escapeSql(batch)}'
         AND B.current_year='${year}'
       ORDER BY A.register_no ASC`,
    );
  }

  return [];
}

export async function loadStudentLookups() {
  const [courses, academicYears, setup] = await Promise.all([
    getStudentCourseOptions(),
    loadAcademicYears(),
    loadBasicSetup(),
  ]);
  return {
    courses,
    academicYears,
    ugAcademicYear: setup?.ug_academic_year || '',
    pgAcademicYear: setup?.pg_academic_year || '',
  };
}

export async function loadPromotionYearPairs(fromAcademicYear) {
  if (!fromAcademicYear) return { courses: await loadCourseRows(), yearPairs: [] };
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT current_year, academic_type FROM student_academic_tb
     WHERE del = 1 AND academic_year='${escapeSql(fromAcademicYear)}'
     ORDER BY current_year ASC`,
  );
  return {
    courses: await loadCourseRows(),
    yearPairs: rows.map((r) => ({
      fromYear: String(r.current_year),
      fromType: r.academic_type || 'regular',
      toYear: String(Number(r.current_year) + 1),
      toType: r.academic_type || 'regular',
    })),
  };
}
