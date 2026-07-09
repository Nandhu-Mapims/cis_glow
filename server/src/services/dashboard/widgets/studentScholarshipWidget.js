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

async function countScholarship({ d, courseId, ay, batch, cx, filter }) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(A.id) AS cnt
     FROM student_profile_tb AS A
     INNER JOIN student_academic_tb AS B ON A.id = B.s_id
     WHERE A.del = 1 AND A.course_id = '${escapeSql(String(courseId))}'
       AND (A.releaving_date = '0000-00-00' OR A.releaving_date > '${d}')
       AND B.del = 1 AND B.academic_year = '${ay}' AND B.academic_batch = '${batch}'
       AND B.current_year = '${cx}' ${filter}`,
  );
  return num(rows[0]?.cnt);
}

/**
 * Legacy dashboard_more.php student_academic($current_date, $academic_year_array)
 */
export async function renderStudentScholarship({ academicDate, academicYears }) {
  const d = escapeSql(academicDate);
  const totalStudent = { s: 0, b: 0, m: 0, f: 0, t: 0 };
  let finalCourseDetails = '';

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

        for (let cx = 1; cx <= courseDuration; cx += 1) {
          if (!totalStudentYear[cx]) {
            totalStudentYear[cx] = { s: 0, b: 0, m: 0, f: 0, t: 0 };
          }

          const scstCount = await countScholarship({
            d,
            courseId,
            ay,
            batch,
            cx,
            filter: "AND A.scholar_ship = '1' AND A.caste_scholar_ship = 'scst'",
          });
          const bcCount = await countScholarship({
            d,
            courseId,
            ay,
            batch,
            cx,
            filter: "AND A.scholar_ship = '1' AND A.caste_scholar_ship = 'bc'",
          });
          const mbcCount = await countScholarship({
            d,
            courseId,
            ay,
            batch,
            cx,
            filter: "AND A.scholar_ship = '1' AND A.caste_scholar_ship = 'mbc'",
          });
          const fgCount = await countScholarship({
            d,
            courseId,
            ay,
            batch,
            cx,
            filter: "AND A.first_graduate = '1'",
          });

          totalStudentYear[cx].s += scstCount;
          totalStudentYear[cx].b += bcCount;
          totalStudentYear[cx].m += mbcCount;
          totalStudentYear[cx].f += fgCount;
          totalStudentYear[cx].t += scstCount + bcCount + mbcCount + fgCount;
        }
      }
    }

    let finalCtemp1 = '';
    const courseTotal = { s: 0, b: 0, m: 0, f: 0, t: 0 };

    for (const [cx, cstrength] of Object.entries(totalStudentYear)) {
      finalCtemp1 += `<tr class="td_bottom_border">
        <td height="20"><small>${YEAR_STR[cx] || ''} Year</small></td>
        <td  style="text-align:right; padding-right:15px;" bgcolor="#F4F4F4"><span class="cinfo"  onclick="callstudent1('${refCourseName}','${cx}','${academicDate}','t')">${num(cstrength.t)}</span></td>
        <td  style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudent1('${refCourseName}','${cx}','${academicDate}','s')">${num(cstrength.s)}</span></td>
        <td  style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudent1('${refCourseName}','${cx}','${academicDate}','b')">${num(cstrength.b)}</span></td>
        <td  style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudent1('${refCourseName}','${cx}','${academicDate}','m')">${num(cstrength.m)}</span></td>
        <td  style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudent1('${refCourseName}','${cx}','${academicDate}','f')">${num(cstrength.f)}</span></td>
        </tr>`;

      courseTotal.s += cstrength.s;
      courseTotal.b += cstrength.b;
      courseTotal.m += cstrength.m;
      courseTotal.f += cstrength.f;
      courseTotal.t += cstrength.t;

      totalStudent.s += cstrength.s;
      totalStudent.b += cstrength.b;
      totalStudent.m += cstrength.m;
      totalStudent.f += cstrength.f;
      totalStudent.t += cstrength.t;
    }

    finalCourseDetails += `<tr class="td_bottom_border" bgcolor="#F4F4F4">
    <td  ><p class="class_name" style="padding-left:10px;">${refCourseName}</p></td>
    <td  style="text-align:right; padding-right:15px;" bgcolor="#F4F4F4"><p class="class_name cinfo"  onclick="callstudent1('${refCourseName}','','${academicDate}','t')"><strong>${num(courseTotal.t)}</strong></p></td>
    <td  style="text-align:right; padding-right:15px;"><p class="class_name cinfo"  onclick="callstudent1('${refCourseName}','','${academicDate}','s')"><strong>${num(courseTotal.s)}</strong></p></td>
    <td  style="text-align:right; padding-right:15px;"><p class="class_name cinfo"  onclick="callstudent1('${refCourseName}','','${academicDate}','b')"><strong>${num(courseTotal.b)}</strong></p></td>
    <td  style="text-align:right; padding-right:15px;"><p class="class_name cinfo"  onclick="callstudent1('${refCourseName}','','${academicDate}','m')"><strong>${num(courseTotal.m)}</strong></p></td>
    <td  style="text-align:right; padding-right:15px;"><p class="class_name cinfo"  onclick="callstudent1('${refCourseName}','','${academicDate}','f')"><strong>${num(courseTotal.f)}</strong></p></td>
    </tr>${finalCtemp1}`;
  }

  return `
<div class="col-sm-4 dashboard-container">
  <section class="panel">
      <div class="revenue-head">
          <span>
              <i class="icon-bar-chart"></i>
          </span>
          <h3>Scholarship</h3>
      </div>
<div class="dashboard-panel"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered">
<tr class="td_head_color">
      <th width="130"  ><p class="staff_period">Year</p></th>
  <th width="55"  align="center" ><p class="staff_period" title="Total">#T</p></th>
      <th width="55"  align="center"><p class="staff_period" >#SC/ST</p></th>
  <th width="55"  align="center" ><p class="staff_period"  >#BC</p></th>
  <th width="55"  align="center" ><p class="staff_period" >#MBC</p></th>
  <th width="55"  align="center" ><p class="staff_period" >#1<sup>st</sup>Grad.</p></th>
      </tr>
      <tr class="td_bottom_border" bgcolor="#EEEEEE">
      <td  ><p class="class_name" style="padding-left:10px;" bgcolor="#F4F4F4">  <strong>Total</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>${num(totalStudent.t)}</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>${num(totalStudent.s)}</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>${num(totalStudent.b)}</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>${num(totalStudent.m)}</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>${num(totalStudent.f)}</strong></p></td>
      </tr>
        ${finalCourseDetails} </table></div></section>
</div>`;
}
