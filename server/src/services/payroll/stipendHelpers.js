import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { formatPayrollMonthLabel, toSqlDate } from './payrollHelpers.js';

const ATT_MONTH_FROM = '2018-04-01';

let generatedMonthOptionsCache = null;
let generatedMonthOptionsCacheAt = 0;
const GENERATED_MONTH_CACHE_MS = 60_000;

export async function loadStipendOpenPayrollMonthOptions() {
  const rows = [];
  const now = new Date();
  const from = new Date(`${ATT_MONTH_FROM}T00:00:00`);
  let current = new Date(now.getFullYear(), now.getMonth(), 1);

  while (current >= from) {
    const monthSql = toSqlDate(current);
    const closed = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS cnt FROM stipend_payroll_log
       WHERE del = 1 AND payroll_month = '${escapeSql(monthSql)}'
         AND payroll_complete = 1`,
    );
    if (Number(closed[0]?.cnt) === 0) {
      const m = current.getMonth() + 1;
      const y = current.getFullYear();
      rows.push({
        value: `${String(m).padStart(2, '0')}-${y}`,
        monthSql,
        label: formatPayrollMonthLabel(monthSql),
      });
    }
    current = new Date(current.getFullYear(), current.getMonth() - 1, 1);
  }
  return rows;
}

export async function loadStipendStudentsGrid(category, payrollMonthSql) {
  const parts = String(category || '').split('_');
  const courseName = parts[0];
  const currentYear = parts[1];
  const acYear = parts[2];
  if (!courseName || !currentYear || !acYear || !payrollMonthSql) return [];

  if (courseName === 'ug') {
    return prisma.$queryRawUnsafe(
      `SELECT B.id, A.register_no, B.student_title, B.student_name, B.student_initial
       FROM student_academic_tb AS A
       INNER JOIN student_profile_tb AS B ON A.register_no = B.register_no
       WHERE A.del = 1 AND B.del = 1
         AND A.course_id = (SELECT id FROM basic_setup_course_tb WHERE course_name='U.G' AND del=1 LIMIT 1)
         AND A.academic_year = '${escapeSql(acYear)}'
         AND A.current_year = '${escapeSql(currentYear)}'
         AND (CAST(B.releaving_date AS CHAR) = '0000-00-00' OR B.releaving_date > '${escapeSql(payrollMonthSql)}')
       ORDER BY A.register_no ASC`,
    );
  }

  if (courseName === 'pg') {
    const courseRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM basic_setup_course_tb WHERE course_name='P.G' AND del=1`,
    );
    const courseFilter = courseRows.map((r) => `A.course_id='${r.id}'`).join(' OR ');
    if (!courseFilter) return [];
    return prisma.$queryRawUnsafe(
      `SELECT B.id, A.register_no, B.student_title, B.student_name, B.student_initial
       FROM student_academic_tb AS A
       INNER JOIN student_profile_tb AS B ON A.register_no = B.register_no
       WHERE A.del = 1 AND B.del = 1
         AND A.academic_year = '${escapeSql(acYear)}'
         AND A.current_year = '${escapeSql(currentYear)}'
         AND (${courseFilter})
         AND (CAST(B.releaving_date AS CHAR) = '0000-00-00' OR B.releaving_date > '${escapeSql(payrollMonthSql)}')
       ORDER BY A.register_no ASC`,
    );
  }

  return [];
}

export async function loadStipendAcademicYears() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ug_academic_year, uga_academic_year, pg_academic_year
     FROM basic_setup_tb WHERE del = 1 LIMIT 1`,
  );
  return rows[0] || { ug_academic_year: '', pg_academic_year: '' };
}

export async function loadStipendCategoryOptions(selected = []) {
  const ac = await loadStipendAcademicYears();
  const ugYear = ac.ug_academic_year || '';
  const pgYear = ac.pg_academic_year || '';
  const selectedSet = new Set((Array.isArray(selected) ? selected : [selected]).map(String));

  const options = [];
  options.push({
    group: `UG ${ugYear}`,
    items: [{ value: `ug_5_${ugYear}`, label: 'CRRI', selected: selectedSet.has(`ug_5_${ugYear}`) }],
  });

  const pgItems = [
    { value: `pg_1_${pgYear}`, label: 'I Year-PG' },
    { value: `pg_2_${pgYear}`, label: 'II Year-PG' },
    { value: `pg_3_${pgYear}`, label: 'III Year-PG' },
  ].map((item) => ({ ...item, selected: selectedSet.has(item.value) }));

  options.push({ group: `PG ${pgYear}`, items: pgItems });
  return options;
}

const PG_YEAR_LABELS = {
  1: 'I Year-PG',
  2: 'II Year-PG',
  3: 'III Year-PG',
};

export function formatStipendPayrollTypeLabel(payrollType) {
  const parts = String(payrollType || '').split('_');
  const courseName = parts[0];
  const currentYear = parts[1];
  const acYear = parts[2];
  if (courseName === 'ug' && currentYear === '5') return 'CRRI';
  if (courseName === 'pg' && PG_YEAR_LABELS[currentYear]) return PG_YEAR_LABELS[currentYear];
  return payrollType;
}

/** Statement/report screens — categories from payroll log for the selected month when available. */
export async function loadStipendCategoryOptionsForMonth(payrollMonthSql = '', selected = []) {
  const monthSql = payrollMonthSql ? toSqlDate(payrollMonthSql) : '';
  const selectedSet = new Set((Array.isArray(selected) ? selected : [selected]).map(String));

  if (monthSql && !monthSql.startsWith('0000')) {
    const logTypes = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT payroll_type
       FROM stipend_payroll_log
       WHERE del = 1 AND payroll_month = '${escapeSql(monthSql)}'
       ORDER BY payroll_type ASC`,
    );
    if (logTypes.length) {
      const groups = new Map();
      for (const row of logTypes) {
        const payrollType = String(row.payroll_type || '').trim();
        if (!payrollType) continue;
        const parts = payrollType.split('_');
        const courseName = parts[0];
        const acYear = parts[2] || '';
        const group = courseName === 'ug' ? `UG ${acYear}` : `PG ${acYear}`;
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push({
          value: payrollType,
          label: formatStipendPayrollTypeLabel(payrollType),
          selected: selectedSet.has(payrollType),
        });
      }
      return Array.from(groups.entries()).map(([group, items]) => ({ group, items }));
    }
  }

  return loadStipendCategoryOptions(selected);
}

export async function buildStipendCourseFilterSql(courseName) {
  if (courseName === 'ug') {
    const courseRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM basic_setup_course_tb WHERE course_name='U.G' AND del=1 LIMIT 1`,
    );
    const courseId = courseRows[0]?.id;
    return courseId ? ` AND A.course_id='${escapeSql(String(courseId))}'` : '';
  }
  if (courseName === 'pg') {
    const courseRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM basic_setup_course_tb WHERE course_name='P.G' AND del=1`,
    );
    const courseFilter = courseRows.map((r) => `A.course_id='${escapeSql(String(r.id))}'`).join(' OR ');
    return courseFilter ? ` AND (${courseFilter})` : '';
  }
  return '';
}

export async function loadStipendPayrollMonthOptions(forGenerate = false) {
  if (forGenerate) {
    const rows = [];
    const now = new Date();
    const from = new Date(`${ATT_MONTH_FROM}T00:00:00`);
    let current = new Date(now.getFullYear(), now.getMonth(), 1);

    while (current >= from) {
      const monthSql = toSqlDate(current);
      const closed = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) AS cnt FROM stipend_payroll_log
         WHERE del = 1 AND payroll_month = '${escapeSql(monthSql)}'
           AND payroll_type = 'Salary' AND payroll_complete = 1`,
      );
      if (Number(closed[0]?.cnt) === 0) {
        const partial = await prisma.$queryRawUnsafe(
          `SELECT COUNT(DISTINCT payroll_type) AS cnt FROM stipend_payroll_log
           WHERE del = 1 AND payroll_month = '${escapeSql(monthSql)}' AND payroll_complete = 1`,
        );
        const m = current.getMonth() + 1;
        const y = current.getFullYear();
        rows.push({
          value: `${String(m).padStart(2, '0')}-${y}`,
          monthSql,
          label: formatPayrollMonthLabel(monthSql),
          generated: Number(partial[0]?.cnt) > 0,
        });
      }
      current = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    }
    return rows;
  }

  const now = Date.now();
  if (generatedMonthOptionsCache && now - generatedMonthOptionsCacheAt < GENERATED_MONTH_CACHE_MS) {
    return generatedMonthOptionsCache;
  }

  const logRows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT payroll_month
     FROM stipend_payroll_log
     WHERE del = 1
     ORDER BY payroll_month DESC`,
  );
  generatedMonthOptionsCache = logRows.map((row) => ({
    value: toSqlDate(row.payroll_month),
    label: formatPayrollMonthLabel(row.payroll_month),
  }));
  generatedMonthOptionsCacheAt = Date.now();
  return generatedMonthOptionsCache;
}

export async function resolveStipendStudents(categories, payrollMonthSql, registerFilter = '') {
  const students = [];
  let registerSql = '';
  if (registerFilter) {
    const ids = registerFilter.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length) {
      registerSql = ` AND (${ids.map((id) => `A.register_no='${escapeSql(id)}'`).join(' OR ')})`;
    }
  }

  for (const course of categories) {
    const parts = String(course).split('_');
    const courseName = parts[0];
    const currentYear = parts[1];
    const acYear = parts[2];

    if (courseName === 'ug') {
      const courseRows = await prisma.$queryRawUnsafe(
        `SELECT id FROM basic_setup_course_tb WHERE course_name='U.G' AND del=1 LIMIT 1`,
      );
      const courseId = courseRows[0]?.id;
      if (!courseId) continue;
      const sqlRows = await prisma.$queryRawUnsafe(
        `SELECT A.register_no FROM student_academic_tb AS A
         INNER JOIN student_profile_tb AS B ON A.register_no = B.register_no
         WHERE A.del = 1 AND B.del = 1
           AND A.course_id = '${courseId}'
           AND A.academic_year = '${escapeSql(acYear)}'
           AND A.current_year = '${escapeSql(currentYear)}'
           AND (CAST(B.releaving_date AS CHAR) = '0000-00-00' OR B.releaving_date > '${escapeSql(payrollMonthSql)}')
           ${registerSql}
         ORDER BY A.register_no ASC`,
      );
      for (const row of sqlRows) students.push(String(row.register_no));
    }

    if (courseName === 'pg') {
      const courseRows = await prisma.$queryRawUnsafe(
        `SELECT id FROM basic_setup_course_tb WHERE course_name='P.G' AND del=1`,
      );
      const courseFilter = courseRows.map((r) => `A.course_id='${r.id}'`).join(' OR ');
      if (!courseFilter) continue;
      const sqlRows = await prisma.$queryRawUnsafe(
        `SELECT A.register_no FROM student_academic_tb AS A
         INNER JOIN student_profile_tb AS B ON A.register_no = B.register_no
         WHERE A.del = 1 AND B.del = 1
           AND A.academic_year = '${escapeSql(acYear)}'
           AND A.current_year = '${escapeSql(currentYear)}'
           AND (${courseFilter})
           AND (CAST(B.releaving_date AS CHAR) = '0000-00-00' OR B.releaving_date > '${escapeSql(payrollMonthSql)}')
           ${registerSql}
         ORDER BY A.register_no ASC`,
      );
      for (const row of sqlRows) students.push(String(row.register_no));
    }
  }

  return [...new Set(students)];
}

export function studentDisplayName(row) {
  const title = row.student_title ? `${String(row.student_title).trim()}. ` : '';
  return `${title}${String(row.student_name || '').trim()} ${String(row.student_initial || '').trim()}`.trim();
}
