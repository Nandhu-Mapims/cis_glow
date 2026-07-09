import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';

function num(val) {
  return Number(val) || 0;
}

const YEAR_STR = {
  0: '',
  1: 'I - ',
  2: 'II - ',
  3: 'III - ',
  4: 'IV - ',
  5: 'Int. - ',
  6: 'VI - ',
  7: 'VII - ',
  8: 'VIII - ',
  9: 'IX - ',
  10: 'X - ',
};

/**
 * Legacy dashboard_more.php student_details($current_date, $academic_year_array)
 * Returns [regularHtml, additionalHtml].
 */
export async function buildStudentDetailsWidgets({ academicDate, academicYears }) {
  const d = escapeSql(academicDate);
  const totalStudent = { regular: { m: 0, f: 0, t: 0 }, additional: { m: 0, f: 0, t: 0 } };
  const finalCourseDetails = { regular: '', additional: '' };

  const courseNames = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT course_name FROM basic_setup_course_tb WHERE del = 1 ORDER BY c_order ASC`,
  );

  for (const courseRow of courseNames) {
    const refCourseName = courseRow.course_name;
    let acyearSearch = {};

    if (refCourseName === 'U.G') {
      acyearSearch = {
        regular: academicYears['U.G']?.regular,
        additional: academicYears['U.G']?.additional,
      };
    } else {
      acyearSearch = { regular: academicYears[refCourseName]?.regular };
    }

    const degrees = await prisma.$queryRawUnsafe(
      `SELECT id, course_duration FROM basic_setup_course_tb
       WHERE course_name = '${escapeSql(refCourseName)}' AND del = 1
       ORDER BY course_name ASC`,
    );

    if (!degrees.length) continue;

    const totalStudentYear = {};

    for (const rowDegree of degrees) {
      const courseId = rowDegree.id;
      const courseDuration = num(rowDegree.course_duration);

      for (const [abatch, ayear] of Object.entries(acyearSearch)) {
        if (!ayear) continue;
        const ay = escapeSql(String(ayear));
        const batch = escapeSql(abatch);

        if (!totalStudentYear[abatch]) totalStudentYear[abatch] = {};

        for (let cx = 1; cx <= courseDuration; cx += 1) {
          if (!totalStudentYear[abatch][cx]) {
            totalStudentYear[abatch][cx] = { m: 0, f: 0, t: 0 };
          }

          const maleRows = await prisma.$queryRawUnsafe(
            `SELECT COUNT(A.id) AS cnt
             FROM student_profile_tb AS A
             INNER JOIN student_academic_tb AS B ON A.id = B.s_id
             WHERE A.del = 1 AND A.course_id = '${escapeSql(String(courseId))}'
               AND (A.releaving_date = '0000-00-00' OR A.releaving_date > '${d}')
               AND A.student_gender = 'Male' AND B.del = 1
               AND B.academic_year = '${ay}' AND B.academic_batch = '${batch}'
               AND B.current_year = '${cx}'`,
          );
          const femaleRows = await prisma.$queryRawUnsafe(
            `SELECT COUNT(A.id) AS cnt
             FROM student_profile_tb AS A
             INNER JOIN student_academic_tb AS B ON A.id = B.s_id
             WHERE A.del = 1 AND A.course_id = '${escapeSql(String(courseId))}'
               AND (A.releaving_date = '0000-00-00' OR A.releaving_date > '${d}')
               AND A.student_gender = 'Female' AND B.del = 1
               AND B.academic_year = '${ay}' AND B.academic_batch = '${batch}'
               AND B.current_year = '${cx}'`,
          );

          const mCount = num(maleRows[0]?.cnt);
          const fCount = num(femaleRows[0]?.cnt);
          totalStudentYear[abatch][cx].m += mCount;
          totalStudentYear[abatch][cx].f += fCount;
          totalStudentYear[abatch][cx].t += mCount + fCount;
        }
      }
    }

    const finalCtemp1 = {};
    const courseTotal = {};

    for (const [ctype, cdetails] of Object.entries(totalStudentYear)) {
      finalCtemp1[ctype] = '';
      courseTotal[ctype] = { m: 0, f: 0, t: 0 };

      for (const [cx, cstrength] of Object.entries(cdetails)) {
        finalCtemp1[ctype] += `<tr class="td_bottom_border">
        <td height="20"><small>${YEAR_STR[cx] || ''} Year</small></td>
        <td  style="text-align:right; padding-right:15px;" bgcolor="#F4F4F4"><span class="cinfo"  onclick="callstudent('${refCourseName}','${cx}','${academicDate}','t','${ctype}')">${num(cstrength.t)}</span></td>
        <td  style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudent('${refCourseName}','${cx}','${academicDate}','m','${ctype}')">${num(cstrength.m)}</span></td>
        <td  style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudent('${refCourseName}','${cx}','${academicDate}','f','${ctype}')">${num(cstrength.f)}</span></td>
        </tr>`;

        courseTotal[ctype].m += cstrength.m;
        courseTotal[ctype].f += cstrength.f;
        courseTotal[ctype].t += cstrength.t;
        totalStudent[ctype].m += cstrength.m;
        totalStudent[ctype].f += cstrength.f;
        totalStudent[ctype].t += cstrength.t;
      }
    }

    for (const ctype of Object.keys(totalStudentYear)) {
      finalCourseDetails[ctype] += `<tr class="td_bottom_border" bgcolor="#F4F4F4">
    <td  ><p class="class_name" style="padding-left:10px;">${refCourseName}</p></td>
    <td  style="text-align:right; padding-right:15px;" bgcolor="#F4F4F4"><p class="class_name cinfo"  onclick="callstudent('${refCourseName}','','${academicDate}','t','${ctype}')"><strong>${num(courseTotal[ctype]?.t)}</strong></p></td>
    <td  style="text-align:right; padding-right:15px;"><p class="class_name cinfo"  onclick="callstudent('${refCourseName}','','${academicDate}','m','${ctype}')"><strong>${num(courseTotal[ctype]?.m)}</strong></p></td>
    <td  style="text-align:right; padding-right:15px;"><p class="class_name cinfo"  onclick="callstudent('${refCourseName}','','${academicDate}','f','${ctype}')"><strong>${num(courseTotal[ctype]?.f)}</strong></p></td>
    </tr>${finalCtemp1[ctype] || ''}`;
    }
  }

  const grandTotal = num(totalStudent.regular?.t) + num(totalStudent.additional?.t);

  const regularHtml = `
<div class="col-sm-4 dashboard-container">
  <section class="panel">
      <div class="revenue-head">
          <span>
              <i class="icon-users"></i>
          </span>
          <h3>Student Details (Reg.)</h3>
          <span class="rev-combo pull-right">
            ${grandTotal}
          </span>
      </div>
<div class="dashboard-panel"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered">
<tr class="td_head_color">
      <th width="130"  ><p class="staff_period">Year</p></th>
  <th width="55"  align="center" ><p class="staff_period" title="Total">#T</p></th>
      <th width="55"  align="center"><p class="staff_period" title="Boys">#B</p></th>
  <th width="55"  align="center" ><p class="staff_period" title="Girls">#G</p></th>
      </tr>
      <tr class="td_bottom_border" bgcolor="#EEEEEE">
      <td  ><p class="class_name" style="padding-left:10px;" bgcolor="#F4F4F4">  <strong>Total</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>${num(totalStudent.regular?.t)}</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>${num(totalStudent.regular?.m)}</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>${num(totalStudent.regular?.f)}</strong></p></td>
      </tr>
        ${finalCourseDetails.regular} </table></div></section>
</div>`;

  const additionalHtml = `
<div class="col-sm-4 dashboard-container">
  <section class="panel">
      <div class="revenue-head">
          <span>
              <i class="icon-users"></i>
          </span>
          <h3>Student Details (Add.)</h3>
          <span class="rev-combo pull-right">
            ${grandTotal}
          </span>
      </div>
<div class="dashboard-panel"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered">
<tr class="td_head_color">
      <th width="130" ><p class="staff_period">Year</p></th>
  <th width="55"  align="center" ><p class="staff_period" title="Total">#T</p></th>
      <th width="55"  align="center"><p class="staff_period" title="Boys">#B</p></th>
  <th width="55"  align="center" ><p class="staff_period" title="Girls">#G</p></th>
      </tr>
      <tr class="td_bottom_border" bgcolor="#EEEEEE">
      <td ><p class="class_name" style="padding-left:10px;" bgcolor="#F4F4F4">  <strong>Total</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>${num(totalStudent.additional?.t)}</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>${num(totalStudent.additional?.m)}</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>${num(totalStudent.additional?.f)}</strong></p></td>
      </tr>
        ${finalCourseDetails.additional} </table></div></section>
</div>`;

  return [regularHtml, additionalHtml];
}
