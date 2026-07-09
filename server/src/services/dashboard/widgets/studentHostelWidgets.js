import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { normalizeTimeStr } from './dashboardShared.js';

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

const HOSTEL_BASE_JOIN = `
  FROM student_profile_tb AS sp
  INNER JOIN student_academic_tb AS sa ON sp.id = sa.s_id
  INNER JOIN student_hostel_tb AS sh ON sp.id = sh.s_id
  INNER JOIN basic_setup_course_tb AS bc ON sp.course_id = bc.id`;

function punchTableName(attDate) {
  const dt = new Date(attDate);
  const year = dt.getFullYear();
  const quarter = Math.ceil((dt.getMonth() + 1) / 4);
  return `punchtimedetails_${year}${quarter}`;
}

function formatSyncTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const hours = d.getHours() % 12 || 12;
  const ampm = d.getHours() >= 12 ? 'pm' : 'am';
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(hours)}:${pad(d.getMinutes())} ${ampm}`;
}

function buildAcyearSearch(refCourseName, academicYears) {
  if (refCourseName === 'U.G') {
    return {
      regular: academicYears['U.G']?.regular,
      additional: academicYears['U.G']?.additional,
    };
  }
  return { regular: academicYears[refCourseName]?.regular };
}

function buildAcyearOrClause(academicYears, courseNames) {
  const parts = [];
  for (const courseRow of courseNames) {
    const refCourseName = courseRow.course_name;
    const acyearSearch = buildAcyearSearch(refCourseName, academicYears);
    for (const [abatch, ayear] of Object.entries(acyearSearch)) {
      if (!ayear) continue;
      parts.push(
        `(bc.course_name = '${escapeSql(refCourseName)}'`
        + ` AND sa.academic_batch = '${escapeSql(abatch)}'`
        + ` AND sa.academic_year = '${escapeSql(String(ayear))}')`,
      );
    }
  }
  return parts.length ? parts.join(' OR ') : '1 = 0';
}

function hostelStudentWhere(academicDate) {
  const d = escapeSql(academicDate);
  return `sp.del = 1
    AND (sp.releaving_date = '0000-00-00' OR sp.releaving_date > '${d}')
    AND sa.del = 1
    AND sh.del = 1
    AND (sh.to_month = '0000-00-00' OR sh.to_month > '${d}')`;
}

async function loadCourseNames() {
  return prisma.$queryRawUnsafe(
    `SELECT DISTINCT course_name FROM basic_setup_course_tb WHERE del = 1 ORDER BY c_order ASC`,
  );
}

async function loadDegrees(refCourseName) {
  return prisma.$queryRawUnsafe(
    `SELECT id, course_duration FROM basic_setup_course_tb
     WHERE course_name = '${escapeSql(refCourseName)}' AND del = 1
     ORDER BY course_name ASC`,
  );
}

async function loadHostelAttConfig() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT out_from, out_to, in_from, in_to FROM basic_setup_hostelatt WHERE del = 1 AND id = '1' LIMIT 1`,
  );
  return rows[0] || {};
}

function hasTimeWindow(from, to) {
  const f = normalizeTimeStr(from);
  const t = normalizeTimeStr(to);
  return Boolean(f && t && f !== '00:00:00' && t !== '00:00:00');
}

function datetimeRange(academicDate, from, to) {
  const f = normalizeTimeStr(from);
  const t = normalizeTimeStr(to);
  if (!f || !t) return null;
  return {
    from: `${escapeSql(academicDate)} ${escapeSql(f)}`,
    to: `${escapeSql(academicDate)} ${escapeSql(t)}`,
  };
}

function strengthKey(courseName, currentYear, gender) {
  return `${courseName}|${currentYear}|${gender}`;
}

function detailBucketKey(courseName, currentYear, bucket) {
  return `${courseName}|${currentYear}|${bucket}`;
}

function detailCourseKey(courseName, currentYear, courseId) {
  return `${courseName}|${currentYear}|${courseId}`;
}

async function loadHostelStrengthGrid(academicDate, academicYears) {
  const courseNames = await loadCourseNames();
  const acyearClause = buildAcyearOrClause(academicYears, courseNames);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT bc.course_name, sa.current_year, sp.student_gender, COUNT(DISTINCT sp.id) AS cnt
     ${HOSTEL_BASE_JOIN}
     WHERE ${hostelStudentWhere(academicDate)} AND (${acyearClause})
     GROUP BY bc.course_name, sa.current_year, sp.student_gender`,
  );

  const grid = new Map();
  for (const row of rows) {
    const gender = String(row.student_gender).toLowerCase() === 'female' ? 'f' : 'm';
    grid.set(strengthKey(row.course_name, num(row.current_year), gender), num(row.cnt));
  }
  return { courseNames, grid };
}

async function loadHostelDetailGrids(academicDate, academicYears, gender) {
  const g = escapeSql(gender);
  const courseNames = await loadCourseNames();
  const acyearClause = buildAcyearOrClause(academicYears, courseNames);
  const baseWhere = `${hostelStudentWhere(academicDate)} AND sp.student_gender = '${g}' AND (${acyearClause})`;

  const hostelRows = await prisma.$queryRawUnsafe(
    `SELECT bc.course_name, sa.current_year,
       CASE WHEN sp.course_id = 1 THEN 'eq1' ELSE 'gt1' END AS bucket,
       COUNT(DISTINCT sp.id) AS cnt
     ${HOSTEL_BASE_JOIN}
     WHERE ${baseWhere}
     GROUP BY bc.course_name, sa.current_year, bucket`,
  );

  const hostelGrid = new Map();
  for (const row of hostelRows) {
    hostelGrid.set(
      detailBucketKey(row.course_name, num(row.current_year), row.bucket),
      num(row.cnt),
    );
  }

  const config = await loadHostelAttConfig();
  const attOutGrid = new Map();
  const attInGrid = new Map();
  const attJoin = `${HOSTEL_BASE_JOIN}
    INNER JOIN hostel_att AS ha ON TRIM(LEADING '0' FROM sp.register_no) = TRIM(LEADING '0' FROM ha.tktno)`;

  const outRange = datetimeRange(academicDate, config.out_from, config.out_to);
  if (outRange) {
    const outRows = await prisma.$queryRawUnsafe(
      `SELECT bc.course_name, sa.current_year, sp.course_id, COUNT(DISTINCT sp.id) AS cnt
       ${attJoin}
       WHERE ${baseWhere}
         AND ha.p_date >= '${outRange.from}' AND ha.p_date <= '${outRange.to}'
       GROUP BY bc.course_name, sa.current_year, sp.course_id`,
    );
    for (const row of outRows) {
      attOutGrid.set(
        detailCourseKey(row.course_name, num(row.current_year), num(row.course_id)),
        num(row.cnt),
      );
    }
  }

  const inRange = datetimeRange(academicDate, config.in_from, config.in_to);
  if (inRange) {
    const inRows = await prisma.$queryRawUnsafe(
      `SELECT bc.course_name, sa.current_year, sp.course_id, COUNT(DISTINCT sp.id) AS cnt
       ${attJoin}
       WHERE ${baseWhere}
         AND ha.p_date >= '${inRange.from}' AND ha.p_date <= '${inRange.to}'
       GROUP BY bc.course_name, sa.current_year, sp.course_id`,
    );
    for (const row of inRows) {
      attInGrid.set(
        detailCourseKey(row.course_name, num(row.current_year), num(row.course_id)),
        num(row.cnt),
      );
    }
  }

  return { courseNames, hostelGrid, attOutGrid, attInGrid };
}

/**
 * Legacy dashboard_more.php student_hostel_details($current_date, $academic_year_array)
 * Returns [hostelHtml, maleTotal, femaleTotal].
 */
export async function buildStudentHostelWidgets({ academicDate, academicYears }) {
  const { courseNames, grid } = await loadHostelStrengthGrid(academicDate, academicYears);
  const totalStudent = { m: 0, f: 0, t: 0 };
  let finalCourseDetails = '';

  for (const courseRow of courseNames) {
    const refCourseName = courseRow.course_name;
    const degrees = await loadDegrees(refCourseName);
    if (!degrees.length) continue;

    const maxYear = Math.max(...degrees.map((d) => num(d.course_duration)));
    const totalStudentYear = {};

    for (let cx = 1; cx <= maxYear; cx += 1) {
      const mCount = num(grid.get(strengthKey(refCourseName, cx, 'm')));
      const fCount = num(grid.get(strengthKey(refCourseName, cx, 'f')));
      if (!mCount && !fCount) continue;
      totalStudentYear[cx] = { m: mCount, f: fCount, t: mCount + fCount };
    }

    let finalCtemp1 = '';
    const courseTotal = { m: 0, f: 0, t: 0 };

    for (const [cx, cstrength] of Object.entries(totalStudentYear)) {
      finalCtemp1 += `<tr class="td_bottom_border">
        <td height="20"><small>${YEAR_STR[cx] || ''} Year</small></td>
        <td  style="text-align:right; padding-right:15px;" bgcolor="#F4F4F4"><span class="cinfo"  onclick="callstudentH('${refCourseName}','${cx}','${academicDate}','t','')">${num(cstrength.t)}</span></td>
        <td  style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudentH('${refCourseName}','${cx}','${academicDate}','m','')">${num(cstrength.m)}</span></td>
        <td  style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudentH('${refCourseName}','${cx}','${academicDate}','f','')">${num(cstrength.f)}</span></td>
        </tr>`;

      courseTotal.m += cstrength.m;
      courseTotal.f += cstrength.f;
      courseTotal.t += cstrength.t;
      totalStudent.m += cstrength.m;
      totalStudent.f += cstrength.f;
      totalStudent.t += cstrength.t;
    }

    if (!courseTotal.t) continue;

    finalCourseDetails += `<tr class="td_bottom_border" bgcolor="#F4F4F4">
    <td  ><p class="class_name" style="padding-left:10px;">${refCourseName}</p></td>
    <td  style="text-align:right; padding-right:15px;" bgcolor="#F4F4F4"><p class="class_name cinfo"  onclick="callstudentH('${refCourseName}','','${academicDate}','t','')"><strong>${num(courseTotal.t)}</strong></p></td>
    <td  style="text-align:right; padding-right:15px;"><p class="class_name cinfo"  onclick="callstudentH('${refCourseName}','','${academicDate}','m','')"><strong>${num(courseTotal.m)}</strong></p></td>
    <td  style="text-align:right; padding-right:15px;"><p class="class_name cinfo"  onclick="callstudentH('${refCourseName}','','${academicDate}','f','')"><strong>${num(courseTotal.f)}</strong></p></td>
    </tr>${finalCtemp1}`;
  }

  const hostelHtml = `
<div class="col-sm-4 dashboard-container">
  <section class="panel">
      <div class="revenue-head">
          <span>
              <i class="icon-home"></i>
          </span>
          <h3>Hostel</h3>
          <span class="rev-combo pull-right">
            ${num(totalStudent.t)}
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
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>${num(totalStudent.t)}</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>${num(totalStudent.m)}</strong></p></td>
      <td  style="text-align:right; padding-right:15px;"><p class="class_name"><strong>${num(totalStudent.f)}</strong></p></td>
      </tr>
        ${finalCourseDetails} </table></div></section>
</div>`;

  return [hostelHtml, num(totalStudent.m), num(totalStudent.f)];
}

async function buildHostelAttSummary(ctx, gender, totalStudent) {
  const d = escapeSql(ctx.academicDate);
  const g = escapeSql(gender);
  const config = await loadHostelAttConfig();
  let moutCount = 0;
  let einCount = 0;

  const hostelJoin = `INNER JOIN student_hostel_tb AS B ON A.id = B.s_id
    INNER JOIN hostel_att AS C ON TRIM(LEADING '0' FROM A.register_no) = TRIM(LEADING '0' FROM C.tktno)`;
  const baseWhere = `A.del = 1 AND (A.releaving_date = '0000-00-00' OR A.releaving_date > '${d}')
    AND A.student_gender = '${g}' AND B.del = 1
    AND (B.to_month = '0000-00-00' OR B.to_month > '${d}')`;

  const outRange = datetimeRange(ctx.academicDate, config.out_from, config.out_to);
  if (outRange) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(DISTINCT(A.id)) AS cnt FROM student_profile_tb AS A
       ${hostelJoin}
       WHERE ${baseWhere} AND C.p_date >= '${outRange.from}' AND C.p_date <= '${outRange.to}'`,
    );
    moutCount = num(rows[0]?.cnt);
  }

  const inRange = datetimeRange(ctx.academicDate, config.in_from, config.in_to);
  if (inRange) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(DISTINCT(A.id)) AS cnt FROM student_profile_tb AS A
       ${hostelJoin}
       WHERE ${baseWhere} AND C.p_date >= '${inRange.from}' AND C.p_date <= '${inRange.to}'`,
    );
    einCount = num(rows[0]?.cnt);
  }

  const tblName = punchTableName(ctx.academicDate);
  let lastSync = '';
  try {
    const syncRows = await prisma.$queryRawUnsafe(
      `SELECT upload_dt FROM ${tblName} ORDER BY upload_dt DESC LIMIT 1`,
    );
    lastSync = formatSyncTime(syncRows[0]?.upload_dt);
  } catch {
    lastSync = '';
  }

  const chartTitle = gender === 'male' ? 'Gents Hostel Attendance' : 'Ladies Hostel Attendance';

  return `  <div class="col-sm-4 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span>
          <i class="icon-speedometer"></i>
      </span>
      <h3>${chartTitle}</h3>
  </div>
  <div class="dashboard-panel no-padding">
  <div class="weather-bg">
      <div class="panel-body">
          <div class="row">
              <div class="col-xs-6">
                 Out
                  <div class="degree cinfo" onclick="callhostelatt('','${ctx.academicDate}','out','${gender}')">
                      ${moutCount}
                  </div>
              </div>
              <div class="col-xs-6 border-left">
                IN
                  <div class="degree cinfo" onclick="callhostelatt('','${ctx.academicDate}','in','${gender}')">
                      ${einCount}
                  </div>
              </div>
          </div>
      </div>
  </div>
  <footer class="weather-category">
      <ul>
          <li>
              <span style="font-size:26px; line-height:50px;">of <a class="degree cinfo" onclick="callhostelatt_overall('','${ctx.academicDate}','all','${gender}')">${num(totalStudent)}</a> </span>
<small style="font-size:11px; color:#333; line-height:30px;"> <br> Last sync: ${lastSync}</small>
          </li>
      </ul>
  </footer>
   </div>
  </section>
</div>`;
}

/**
 * Legacy student_hostel_att_details(..., 'male', maleTotal)
 */
export async function renderGentsHostelAttendance(ctx, maleTotal) {
  return buildHostelAttSummary(ctx, 'male', maleTotal);
}

/**
 * Legacy student_hostel_att_details(..., 'female', femaleTotal)
 */
export async function renderLadiesHostelAttendance(ctx, femaleTotal) {
  return buildHostelAttSummary(ctx, 'female', femaleTotal);
}

async function buildHostelAttDetailTable(ctx, gender) {
  const { courseNames, hostelGrid, attOutGrid, attInGrid } = await loadHostelDetailGrids(
    ctx.academicDate,
    ctx.academicYears,
    gender,
  );
  const chartTitle = gender === 'male' ? 'Gents Hostel Att.' : 'Ladies Hostel Att.';
  let finalCourseDetails = '';

  for (const courseRow of courseNames) {
    const refCourseName = courseRow.course_name;
    const degrees = await loadDegrees(refCourseName);
    if (!degrees.length) continue;

    const totalStudentYears = {};

    for (const rowDegree of degrees) {
      const courseId = num(rowDegree.id);
      const courseDuration = num(rowDegree.course_duration);

      for (let cx = 1; cx <= courseDuration; cx += 1) {
        const bucket = courseId === 1 ? 'eq1' : 'gt1';
        const hCount = num(hostelGrid.get(detailBucketKey(refCourseName, cx, bucket)));
        const oCount = num(attOutGrid.get(detailCourseKey(refCourseName, cx, courseId)));
        const iCount = num(attInGrid.get(detailCourseKey(refCourseName, cx, courseId)));

        if (!totalStudentYears[cx]) {
          totalStudentYears[cx] = { h: 0, i: 0, o: 0, ia: 0, oa: 0, t: 0 };
        }
        totalStudentYears[cx].h += hCount;
        totalStudentYears[cx].i += iCount;
        totalStudentYears[cx].o += oCount;
        totalStudentYears[cx].ia += hCount - iCount;
        totalStudentYears[cx].oa += hCount - oCount;
        totalStudentYears[cx].t += iCount + oCount;
      }
    }

    let finalCtemp1 = '';
    const courseTotals = { h: 0, o: 0, i: 0, oa: 0, ia: 0, t: 0 };

    for (const [cx, cstrength] of Object.entries(totalStudentYears)) {
      if (!cstrength.h && !cstrength.o && !cstrength.i) continue;

      finalCtemp1 += `<tr class="td_bottom_border">
        <td height="20"><small>${YEAR_STR[cx] || ''} Year</small></td>
       <td class="att_work_body" style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudentHA('${refCourseName}','${cx}','${ctx.academicDate}','h','${gender}')">${num(cstrength.h)}</span></td>
        <td class="att_in_body" style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudentHA('${refCourseName}','${cx}','${ctx.academicDate}','o','${gender}')">${num(cstrength.o)}</span></td>
         <td class="att_in_body trans" style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudentHA('${refCourseName}','${cx}','${ctx.academicDate}','oa','${gender}')">${num(cstrength.oa)}</span></td>
        <td class="att_out_body" style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudentHA('${refCourseName}','${cx}','${ctx.academicDate}','i','${gender}')">${num(cstrength.i)}</span></td>
         <td class="att_out_body trans" style="text-align:right; padding-right:15px;"><span class="cinfo"  onclick="callstudentHA('${refCourseName}','${cx}','${ctx.academicDate}','ia','${gender}')">${num(cstrength.ia)}</span></td>
        </tr>`;

      courseTotals.h += cstrength.h;
      courseTotals.o += cstrength.o;
      courseTotals.i += cstrength.i;
      courseTotals.oa += cstrength.oa;
      courseTotals.ia += cstrength.ia;
      courseTotals.t += cstrength.t;
    }

    if (!courseTotals.h && !courseTotals.o && !courseTotals.i) continue;

    finalCourseDetails += `<tr class="td_bottom_border" bgcolor="#F4F4F4">
    <td  ><p class="class_name" style="padding-left:10px;">${refCourseName}</p></td>
   <td  style="text-align:right; padding-right:15px;" class="att_work_body"><p class="class_name "  ><strong>${num(courseTotals.h)}</strong></p></td>
    <td  style="text-align:right; padding-right:15px;" class="att_in_body"><p class="class_name " ><strong>${num(courseTotals.o)}</strong></p></td>
    <td  style="text-align:right; padding-right:15px;" class="att_in_body trans"><p class="class_name "  ><strong>${num(courseTotals.oa)}</strong></p></td>
    <td  style="text-align:right; padding-right:15px;" class="att_out_body"><p class="class_name "  ><strong>${num(courseTotals.i)}</strong></p></td>
    <td  style="text-align:right; padding-right:15px;" class="att_out_body trans"><p class="class_name "  ><strong>${num(courseTotals.ia)}</strong></p></td>
    </tr>${finalCtemp1}`;
  }

  return `
<div class="col-sm-4 dashboard-container">
  <section class="panel">
      <div class="revenue-head">
          <span>
              <i class="icon-home"></i>
          </span>
          <h3>${chartTitle} </h3>
          <span class="rev-combo pull-right" style="display:none">
            0
          </span>
      </div>
<div class="dashboard-panel"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered">
<tr class="td_head_color">
      <th width="130" rowspan="2" ><p class="staff_period">Year</p></th>
   <th  class="att_work_header" width="55" rowspan="2" align="right"><p class="staff_period" title="Total">#Total</p></th>
      <th class="att_in_header" width="55" colspan="2" align="right"><p class="staff_period" title="Out">#Out</p></th>
  <th class="att_out_header" width="55" colspan="2"   align="right" ><p class="staff_period" title="In">#In</p></th>
      </tr>
      <tr class="td_head_color">
  <th width="20" height="10" title="Out Punch" class="att_in_header">Pre</th>
  <th width="20" title="Out NoPunch" class="att_in_header">Ab</th>
  <th width="20" title="In Punch" class="att_out_header">Pre</th>
  <th width="20" title="In NoPunch" class="att_out_header">Ab</th>
  </tr>
        ${finalCourseDetails} </table></div></section>
</div>`;
}

/**
 * Legacy student_hostel_details_att(..., 'male', maleTotal)
 */
export async function renderStudentGhostel(ctx, _maleTotal) {
  return buildHostelAttDetailTable(ctx, 'male');
}

/**
 * Legacy student_hostel_details_att(..., 'female', femaleTotal)
 */
export async function renderStudentLhostel(ctx, _femaleTotal) {
  return buildHostelAttDetailTable(ctx, 'female');
}
