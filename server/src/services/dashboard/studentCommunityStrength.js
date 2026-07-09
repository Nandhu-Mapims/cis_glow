import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';

function num(val) {
  return Number(val) || 0;
}

/**
 * Legacy student_community_strength.php — community category matrix by course.
 */
export async function loadCommunityStrengthReport(memberId, audit = {}) {
  const setup = await prisma.basic_setup_tb.findFirst({ where: { del: 1 } });
  const classAcademicYearRef = setup?.ug_academic_year || '';
  const diSemesterEnable = num(setup?.di_semester_enable) || 1;
  const academicDate = new Date().toISOString().slice(0, 10);
  const d = escapeSql(academicDate);

  const communityRows = await prisma.$queryRawUnsafe(
    `SELECT id, category_name FROM master_setup
     WHERE category = 'Community' AND del != 0 ORDER BY category_order ASC`,
  );
  const communities = communityRows.map((r) => ({
    id: String(r.id),
    name: r.category_name || '',
  }));

  const courseTypes = ['U.G', 'P.G'];
  const overallCommunityCount = {};
  const communityFlags = {};
  let overallStrength = 0;
  let bodyRows = '';

  for (const courseType of courseTypes) {
    bodyRows += `<tr bgcolor="#F8F8F8"><td colspan="${communities.length + 2}" align="left" height="30"><strong>${courseType} Courses</strong></td></tr>`;

    const courses = await prisma.$queryRawUnsafe(
      `SELECT id, degree_name, department_name, semester_per_year, course_duration, total_semester
       FROM basic_setup_course_tb WHERE del = 1 AND course_name = '${escapeSql(courseType)}' ORDER BY c_order ASC`,
    );

    let courseTypeTotal = 0;
    const courseTypeCommunityTotals = {};
    let cCounter = 0;
    const refStart = Number(String(classAcademicYearRef).split('-')[0]) || 0;

    for (const course of courses) {
      let degreeName = course.degree_name || '';
      let dept = course.department_name || '';
      if (dept.trim() && dept.trim() !== '-') dept = ` - ${dept}`;
      else dept = '';
      const courseLabel = `${degreeName}${dept}`;
      const pSemesterPerYear = num(course.semester_per_year);
      const pCourseDuration = num(course.course_duration);

      const communityCounts = {};
      let strength = 0;

      for (let com = 0; com < communities.length; com += 1) {
        const community = communities[com];
        communityFlags[com] = 1;
        const countRows = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) AS cnt FROM student_profile_tb
           WHERE del = 1 AND course_id = '${escapeSql(String(course.id))}'
             AND (releaving_date = '0000-00-00' OR releaving_date > '${d}')
             AND student_community = '${escapeSql(community.id)}'`,
        );
        const cnt = num(countRows[0]?.cnt);
        communityCounts[com] = cnt;
        courseTypeCommunityTotals[com] = (courseTypeCommunityTotals[com] || 0) + cnt;
        overallCommunityCount[com] = (overallCommunityCount[com] || 0) + cnt;
        strength += cnt;
      }

      courseTypeTotal += strength;
      const bgcolor = cCounter % 2 === 0 ? ' bgcolor="#FFFFFF"' : ' bgcolor="#F4F4F4"';
      cCounter += 1;

      bodyRows += `<tr${bgcolor}><td nowrap height="30">${courseLabel}</td>`;
      for (let com = 0; com < communities.length; com += 1) {
        if (communityFlags[com]) {
          bodyRows += `<td nowrap align="right">${communityCounts[com] || 0}</td>`;
        }
      }
      bodyRows += `<td align="right">${strength}</td></tr>`;
    }

    overallStrength += courseTypeTotal;
    if (cCounter > 1) {
      bodyRows += `<tr><td height="30" nowrap style="border-top:solid 2px #999999; border-bottom:solid 1px #999999;">${courseType} Total</td>`;
      for (let com = 0; com < communities.length; com += 1) {
        if (communityFlags[com]) {
          bodyRows += `<td align="right" nowrap style="border-top:solid 2px #999999; border-bottom:solid 1px #999999; padding-right:7px;">${courseTypeCommunityTotals[com] || 0}</td>`;
        }
      }
      bodyRows += `<td align="right" style="border-top:solid 2px #999999; border-bottom:solid 1px #999999; padding-right:7px;">${courseTypeTotal}</td></tr>`;
    }
  }

  bodyRows += `<tr bgcolor="#F8F8F8"><td height="30" nowrap style="border-bottom:solid 1px #999999;"><strong>Total</strong></td>`;
  for (let com = 0; com < communities.length; com += 1) {
    if (communityFlags[com]) {
      bodyRows += `<td align="right" nowrap style="border-bottom:solid 1px #999999; padding-right:7px;"><strong>${overallCommunityCount[com] || 0}</strong></td>`;
    }
  }
  bodyRows += `<td align="right" style="border-bottom:solid 1px #999999; padding-right:7px;"><strong>${overallStrength}</strong></td></tr>`;

  let headerCols = '';
  for (let com = 0; com < communities.length; com += 1) {
    if (communityFlags[com]) {
      headerCols += `<th width="7%" bgcolor="#CCCCCC" align="center">${communities[com].name}</th>`;
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
    title: 'Community Strength',
    legacy: 'student_community_strength.php',
    referenceYear: classAcademicYearRef,
    overallStrength,
    communities: communities.map((c) => c.name),
    tableHtml,
  };
}
