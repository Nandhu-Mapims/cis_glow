import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { formatIndianMoney, parseDisplayDate, titleCaseName } from './feeHelpers.js';

export async function buildDashboardDrilldownReport(payload) {
  const course = String(payload.course || '');
  const ayear = String(payload.ayear || '');
  const atype = String(payload.atype || 'regular');
  const cyear = String(payload.cyear || '');
  const cdate = parseDisplayDate(payload.cdate);
  const ctype = String(payload.ctype || 'regular');

  if (!course || !ayear || !cyear) {
    return { error: 'course, ayear and cyear are required for drill-down' };
  }

  const courseRows = await prisma.$queryRawUnsafe(
    `SELECT id, degree_name FROM basic_setup_course_tb WHERE del = 1 AND course_name = '${escapeSql(course)}' LIMIT 1`,
  );
  if (!courseRows.length) return { error: 'Course not found' };

  const courseId = courseRows[0].id;
  const students = await prisma.$queryRawUnsafe(
    `SELECT A.register_no, A.student_name, A.student_initial
     FROM student_profile_tb AS A
     INNER JOIN student_academic_tb AS B ON A.id = B.s_id
     WHERE A.del = 1 AND B.del = 1 AND A.course_id = '${escapeSql(courseId)}'
       AND B.course_id = '${escapeSql(courseId)}' AND B.academic_year = '${escapeSql(ayear)}'
       AND B.current_year = '${escapeSql(cyear)}' AND B.academic_batch = '${escapeSql(atype)}'
     ORDER BY A.register_no ASC`,
  );

  const feeTotalRows = await prisma.$queryRawUnsafe(
    `SELECT COALESCE(SUM(fee_amount), 0) AS total FROM fee_name_master
     WHERE del = 1 AND course_id = '${escapeSql(courseId)}' AND class_year = '${escapeSql(cyear)}'`,
  );
  const configuredFee = Number(feeTotalRows[0]?.total || 0);

  let html = `<h4>${courseRows[0].degree_name} — Year ${cyear} (${atype})</h4>
<table class="table table-bordered"><thead><tr bgcolor="#CCC">
<th>#</th><th>Roll No</th><th>Name</th><th>Configured</th><th>Paid</th><th>Pending</th>
</tr></thead><tbody>`;

  let idx = 0;
  for (const stu of students) {
    const paidRows = await prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM(fee_amount), 0) AS total FROM student_fee
       WHERE del = 1 AND register_no = '${escapeSql(stu.register_no)}'
         AND course_id = '${escapeSql(courseId)}' AND class_year = '${escapeSql(cyear)}'
         AND academic_year = '${escapeSql(ayear)}' AND academic_batch = '${escapeSql(atype)}'
         AND DATE(paid_date) <= '${escapeSql(cdate)}'`,
    );
    const paid = Number(paidRows[0]?.total || 0);
    const pending = Math.max(configuredFee - paid, 0);
    html += `<tr>
      <td>${idx + 1}</td>
      <td>${stu.register_no}</td>
      <td>${titleCaseName(stu.student_name, stu.student_initial)}</td>
      <td align="right">${formatIndianMoney(configuredFee)}</td>
      <td align="right">${formatIndianMoney(paid)}</td>
      <td align="right">${formatIndianMoney(pending)}</td>
    </tr>`;
    idx += 1;
  }

  if (!students.length) {
    html += '<tr><td colspan="6" class="text-muted">No students for the selected filters.</td></tr>';
  }
  html += '</tbody></table>';

  return { html, studentCount: students.length, filters: { course, ayear, atype, cyear, cdate, ctype } };
}
