import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';

function num(val) {
  return Number(val) || 0;
}

/**
 * Legacy student_strength_overall.php — admission-year column matrix by course.
 */
export async function loadOverallStrengthReport(memberId, audit = {}) {
  const setup = await prisma.basic_setup_tb.findFirst({ where: { del: 1 } });
  const classAcademicYearRef = setup?.ug_academic_year || '';
  const diSemesterEnable = num(setup?.di_semester_enable) || 1;
  const academicDate = new Date().toISOString().slice(0, 10);
  const d = escapeSql(academicDate);

  const yearRows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT academic_year FROM student_profile_tb WHERE del = 1 ORDER BY academic_year ASC`,
  );
  const admissionYears = yearRows.map((r) => String(r.academic_year || '')).filter(Boolean);

  const courseTypes = ['U.G', 'P.G'];
  const overallCommunityCount = {};
  const admissionYearFlags = {};
  let overallStrength = 0;
  let bodyRows = '';

  for (const courseType of courseTypes) {
    bodyRows += `<tr bgcolor="#F8F8F8"><td colspan="${admissionYears.length + 2}" align="left" height="30"><strong>${courseType} Courses</strong></td></tr>`;

    const courses = await prisma.$queryRawUnsafe(
      `SELECT id, degree_name, department_name, semester_per_year, course_duration, total_semester
       FROM basic_setup_course_tb WHERE del = 1 AND course_name = '${escapeSql(courseType)}' ORDER BY c_order ASC`,
    );

    let courseTypeTotal = 0;
    const courseTypeYearTotals = {};
    let cCounter = 0;

    for (const course of courses) {
      let degreeName = course.degree_name || '';
      let dept = course.department_name || '';
      if (dept.trim() && dept.trim() !== '-') dept = ` - ${dept}`;
      else dept = '';
      const courseLabel = `${degreeName}${dept}`;
      const pSemesterPerYear = num(course.semester_per_year);
      const pCourseDuration = num(course.course_duration);
      const pTotalSemester = num(course.total_semester);

      const yearCounts = {};
      let strength = 0;
      const refStart = Number(String(classAcademicYearRef).split('-')[0]) || 0;

      for (let com = 0; com < admissionYears.length; com += 1) {
        const admissionYear = admissionYears[com];
        const admStart = Number(String(admissionYear).split('-')[0]) || 0;
        const yearDiff = refStart - admStart;
        let regularSem = 0;

        if (yearDiff >= pCourseDuration) {
          regularSem = 0;
        } else {
          regularSem = (yearDiff * pSemesterPerYear) + (diSemesterEnable - 1);
        }

        if (regularSem !== 0) {
          admissionYearFlags[com] = 1;
          const countRows = await prisma.$queryRawUnsafe(
            `SELECT COUNT(*) AS cnt FROM student_profile_tb
             WHERE del = 1 AND course_id = '${escapeSql(String(course.id))}'
               AND (releaving_date = '0000-00-00' OR releaving_date > '${d}')
               AND academic_year = '${escapeSql(admissionYear)}'`,
          );
          const cnt = num(countRows[0]?.cnt);
          yearCounts[com] = cnt;
          courseTypeYearTotals[com] = (courseTypeYearTotals[com] || 0) + cnt;
          overallCommunityCount[com] = (overallCommunityCount[com] || 0) + cnt;
          strength += cnt;
        } else {
          yearCounts[com] = 0;
        }
      }

      courseTypeTotal += strength;
      const bgcolor = cCounter % 2 === 0 ? ' bgcolor="#FFFFFF"' : ' bgcolor="#F4F4F4"';
      cCounter += 1;

      bodyRows += `<tr${bgcolor}><td nowrap height="30">${courseLabel}</td>`;
      for (let com = 0; com < admissionYears.length; com += 1) {
        if (admissionYearFlags[com]) {
          bodyRows += `<td nowrap align="right">${yearCounts[com] || 0}</td>`;
        }
      }
      bodyRows += `<td align="right">${strength}</td></tr>`;
    }

    overallStrength += courseTypeTotal;
    if (cCounter > 1) {
      bodyRows += `<tr><td height="30" nowrap style="border-top:solid 2px #999999; border-bottom:solid 1px #999999;">${courseType} Total</td>`;
      for (let com = 0; com < admissionYears.length; com += 1) {
        if (admissionYearFlags[com]) {
          bodyRows += `<td align="right" nowrap style="border-top:solid 2px #999999; border-bottom:solid 1px #999999; padding-right:7px;">${courseTypeYearTotals[com] || 0}</td>`;
        }
      }
      bodyRows += `<td align="right" style="border-top:solid 2px #999999; border-bottom:solid 1px #999999; padding-right:7px;">${courseTypeTotal}</td></tr>`;
    }
  }

  bodyRows += `<tr bgcolor="#F8F8F8"><td height="30" nowrap style="border-bottom:solid 1px #999999;"><strong>Total</strong></td>`;
  for (let com = 0; com < admissionYears.length; com += 1) {
    if (admissionYearFlags[com]) {
      bodyRows += `<td align="right" nowrap style="border-bottom:solid 1px #999999; padding-right:7px;"><strong>${overallCommunityCount[com] || 0}</strong></td>`;
    }
  }
  bodyRows += `<td align="right" style="border-bottom:solid 1px #999999; padding-right:7px;"><strong>${overallStrength}</strong></td></tr>`;

  let headerCols = '';
  for (let com = 0; com < admissionYears.length; com += 1) {
    if (admissionYearFlags[com]) {
      headerCols += `<th width="7%" bgcolor="#CCCCCC" align="center">${admissionYears[com]}</th>`;
    }
  }

  const tableHtml = `
<table width="100%" border="0" cellpadding="5" cellspacing="0" class="table table-bordered">
<thead>
<tr>
<th width="41%" height="30" bgcolor="#CCCCCC" align="center">Course</th>
${headerCols}
<th width="10%" bgcolor="#CCCCCC" align="center">Total</th>
</tr>
</thead>
<tbody>${bodyRows}</tbody>
</table>`;

  return {
    title: 'Overall Strength',
    legacy: 'student_strength_overall.php',
    referenceYear: classAcademicYearRef,
    overallStrength,
    tableHtml,
  };
}
