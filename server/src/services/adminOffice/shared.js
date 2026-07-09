import { prisma } from '../../config/prisma.js';
import { staffDeptMasterSelect } from '../../utils/legacySelects.js';
import { escapeSql } from '../../utils/sqlSafe.js';

export async function loadDepartmentOptions() {
  const rows = await prisma.staff_dept_master.findMany({
    where: { del: 1 },
    orderBy: { d_order: 'asc' },
    select: staffDeptMasterSelect,
  });
  return rows.map((r) => ({ value: String(r.id), label: r.name }));
}

export async function loadDepartmentMap() {
  const rows = await prisma.staff_dept_master.findMany({
    where: { del: 1 },
    select: staffDeptMasterSelect,
  });
  return Object.fromEntries(rows.map((r) => [String(r.id), r.name]));
}

export async function loadAcademicYearRef() {
  const setup = await prisma.basic_setup_tb.findFirst({
    where: { del: 1, id: 1 },
    select: { ug_academic_year: true },
  });
  return setup?.ug_academic_year || '';
}

export async function resolveParticipantNames(ids, eventFor) {
  const idList = String(ids || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!idList.length) return { names: '', errors: [] };

  const names = [];
  const errors = [];
  for (const id of idList) {
    if (eventFor === 'student') {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT A.student_name, A.student_initial, A.academic_year,
               B.degree_name, B.department_short_name
        FROM student_profile_tb AS A
        INNER JOIN basic_setup_course_tb AS B ON A.course_id = B.id
        WHERE A.register_no='${escapeSql(id)}' AND A.del=1 AND B.del=1
        LIMIT 1`);
      const row = rows[0];
      if (row) {
        const yr = String(row.academic_year || '');
        const shortYr = yr.length >= 9 ? `${yr.slice(2, 5)}${yr.slice(7, 9)}` : yr;
        const dept = row.department_short_name ? `-${row.department_short_name}` : '';
        names.push(`${row.student_name} ${row.student_initial || ''} (${row.degree_name || ''}${dept}, ${shortYr})`);
      } else {
        errors.push(`${id} is an invalid admission number`);
      }
    } else {
      const row = await prisma.staff_profile_tb.findFirst({
        where: { del: 1, staff_id: id },
        select: { staff_name: true, staff_initial: true },
      });
      if (row?.staff_name) {
        names.push(`${row.staff_name} ${row.staff_initial || ''} (Staff)`);
      } else {
        errors.push(`${id} is an invalid staff id`);
      }
    }
  }
  return { names: names.join(',\n'), errors };
}
