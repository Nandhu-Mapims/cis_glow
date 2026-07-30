import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { staffAuthentication } from '../widgetAuth.js';
import { getAttendance, getLPTime } from '../../attendance/staffAttendanceCore.js';

function num(val) {
  return Number(val) || 0;
}

function punchTableName(attDate) {
  const d = new Date(attDate);
  const year = d.getFullYear();
  const quarter = Math.ceil((d.getMonth() + 1) / 4);
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

function initCategoryBucket(name) {
  return {
    name,
    total: 0,
    w: 0,
    in: 0,
    out: 0,
    late: 0,
    permission: 0,
    o_late: 0,
    o_permission: 0,
    f_absent: 0,
    a_absent: 0,
    f_leave: 0,
    a_leave: 0,
    f_approve: 0,
    a_approve: 0,
    la_total: 0,
  };
}

/**
 * Legacy dashboard_more.php staff_attendance($current_date)
 * Returns [summary, incampus, leaveAbsent] HTML strings.
 */
export async function buildStaffAttendanceWidgets({ memberId, academicDate }) {
  const d = escapeSql(academicDate);
  const staffFilter = await staffAuthentication(memberId, 'A.');

  const attendanceDetails = [
    '', // [0] staff_attendance summary
    `<div class="col-sm-4 dashboard-container">
    <section class="panel">
        <div class="revenue-head">
            <span>
                <i class="icon-user-following"></i>
            </span>
            <h3>Staff Attendance (Incampus)</h3>
        </div>
  <div class="dashboard-panel"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered staff_attendance">
  <tr class="td_head_color">
    <th width="40" rowspan="2">Cat.</th>
    <th width="30" rowspan="2" title="Total">#T</th>
    <th width="30" rowspan="2" title="Working" class="att_work_header">#W</th>
    <th colspan="3" class="text-center att_in_header" height="10" >Clock In</th>
    <th colspan="3" class="text-center att_out_header">Clock Out</th>
    </tr>
    <tr class="td_head_color">
    <th width="20" height="10" title="IN" class="att_in_header">I</th>
    <th width="20" title="Late" class="att_in_header">L</th>
    <th width="20" title="Premission" class="att_in_header">P</th>
    <th width="20" title="Out" class="att_out_header">O</th>
    <th width="20" title="Late" class="att_out_header">L</th>
    <th width="20" title="Premission" class="att_out_header">P</th>
    </tr>`,
    `<div class="col-sm-4 dashboard-container">
      <section class="panel">
          <div class="revenue-head">
              <span>
                  <i class="icon-user-unfollow"></i>
              </span>
              <h3>Staff Leave/Absent</h3>
          </div>
    <div class="dashboard-panel"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered staff_attendance">
    <tr class="td_head_color">
      <th width="40" rowspan="2">Cat.</th>
      <th width="30" rowspan="2" title="Total">#T</th>
      <th width="30" rowspan="2" title="Working" class="att_work_header">#W</th>
      <th colspan="3" class="text-center att_in_header" height="10" >Clock In</th>
      <th colspan="3" class="text-center att_out_header">Clock Out</th>
      </tr>
      <tr class="td_head_color">
      <th width="20" height="10" title="Not Showing" class="att_in_header">N</th>
      <th width="20" title="Leave" class="att_in_header">L</th>
      <th width="20" title="Waiting for Approval" class="att_in_header">A</th>
      <th width="20" title="Not Showing" class="att_out_header">N</th>
      <th width="20" title="Leave" class="att_out_header">L</th>
      <th width="20" title="Waiting for Approval" class="att_out_header">A</th>
      </tr>`,
  ];

  const categoryWiseAtt = {};
  const lpCache = new Map();

  const staffRows = await prisma.$queryRawUnsafe(
    `SELECT A.id, A.staff_id, A.att_category, A.job_category, B.category_sname, B.id AS cat_id
     FROM staff_profile_tb AS A
     INNER JOIN edu_setup_tb AS B ON A.job_category = B.id
     WHERE A.del = 1
       AND (A.releaving_date = '0000-00-00' OR A.releaving_date > '${d}')
       AND B.category = 'Category'
       AND B.category_name != 'hostel'
       AND B.category_name != 'Teaching Basic Science'
       AND B.category_name != 'College Support' ${staffFilter}
     ORDER BY B.category_order ASC`,
  );

  // The academic-calendar lookup inside getAttendance() is the same for every
  // staff row on this date - fetch it once here instead of once per staff
  // (getAttendance() already supports this via sharedContext, it just wasn't wired up).
  let calendarRow = (await prisma.$queryRawUnsafe(
    `SELECT academic_events, comments, academic_category FROM calendar_tb WHERE academic_date='${d}' AND del=1 LIMIT 1`,
  ))[0] ?? null;
  if (!calendarRow) {
    calendarRow = (await prisma.$queryRawUnsafe(
      `SELECT academic_events, comments, '' AS academic_category
       FROM academic_calender_tb WHERE academic_date='${d}' AND del=1 LIMIT 1`,
    ))[0] ?? null;
  }

  // getLPTime() result only depends on att_category, and there are only a
  // handful of distinct categories across all staff - resolve them once up
  // front (sequentially, cheap) so the per-staff pass below never has to
  // await a shared cache fill mid-flight.
  const distinctCategories = [...new Set(staffRows.map((row) => String(row.att_category || '1')))];
  for (const catKey of distinctCategories) {
    const sourceRow = staffRows.find((row) => String(row.att_category || '1') === catKey);
    // eslint-disable-next-line no-await-in-loop
    lpCache.set(catKey, await getLPTime(sourceRow.att_category));
  }

  // Each staff member's attendance is computed independently (getAttendance()
  // + two leave-request lookups = ~10 sequential DB round trips per person).
  // Running that fully sequentially for a few hundred staff turns into
  // thousands of round trips and tens of seconds of wall time. The work has
  // no cross-staff dependency once lpCache/calendarRow are warm, so fan it
  // out in bounded concurrent batches instead - same queries, same results,
  // just not one-at-a-time.
  const CONCURRENCY = 20;
  for (let i = 0; i < staffRows.length; i += CONCURRENCY) {
    const chunk = staffRows.slice(i, i + CONCURRENCY);
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(chunk.map(async (row) => {
      const stId = row.id;
      const staffId = row.staff_id;
      const categoryName = row.category_sname ?? '';
      const catId = row.cat_id;

      if (!categoryWiseAtt[catId]) {
        categoryWiseAtt[catId] = initCategoryBucket(categoryName);
      }
      const bucket = categoryWiseAtt[catId];
      bucket.total += 1;

      const catKey = String(row.att_category || '1');
      const latePermission = lpCache.get(catKey);
      const attendanceStatus = await getAttendance(stId, staffId, academicDate, latePermission, 'actual', {
        calendarRow,
        jobCategory: row.job_category,
      });

      let lApply = 0;
      if (attendanceStatus.s !== 'H') {
        bucket.w += 1;

        const [forenoonLeave, afternoonLeave] = await Promise.all([
          prisma.$queryRawUnsafe(
            `SELECT status, id FROM att_leave_request_more
             WHERE del = 1 AND req_date = '${d}' AND staff_id = '${escapeSql(String(stId))}'
               AND (r_session = 'fullday' OR r_session = 'forenoon') AND status <= 1
             LIMIT 1`,
          ),
          prisma.$queryRawUnsafe(
            `SELECT status, id FROM att_leave_request_more
             WHERE del = 1 AND req_date = '${d}' AND staff_id = '${escapeSql(String(stId))}'
               AND (r_session = 'fullday' OR r_session = 'afternoon') AND status <= 1
             LIMIT 1`,
          ),
        ]);
        if (forenoonLeave[0]?.id) {
          bucket.f_leave += 1;
          if (num(forenoonLeave[0].status) === 1) bucket.f_approve += 1;
          lApply += 1;
        }
        if (afternoonLeave[0]?.id) {
          bucket.a_leave += 1;
          if (num(afternoonLeave[0].status) === 1) bucket.a_approve += 1;
          lApply += 1;
        }
        if (lApply === 0) bucket.la_total += 1;
      }

      if (attendanceStatus.mt) bucket.in += 1;
      if (attendanceStatus.et) bucket.out += 1;
      if (attendanceStatus.m === 'la') bucket.late += 1;
      if (attendanceStatus.m === 'pe') bucket.permission += 1;
      if (attendanceStatus.e === 'la') bucket.o_late += 1;
      if (attendanceStatus.e === 'pe') bucket.o_permission += 1;
      if (attendanceStatus.m === 'a') bucket.f_absent += 1;
      if (attendanceStatus.e === 'a') bucket.a_absent += 1;
    }));
  }

  const totalAttArray = initCategoryBucket('');

  for (const [cid, cDetails] of Object.entries(categoryWiseAtt)) {
    totalAttArray.total += cDetails.total;
    totalAttArray.la_total += cDetails.la_total;
    totalAttArray.w += cDetails.w;
    totalAttArray.in += cDetails.in;
    totalAttArray.out += cDetails.out;
    totalAttArray.late += cDetails.late;
    totalAttArray.permission += cDetails.permission;
    totalAttArray.o_late += cDetails.o_late;
    totalAttArray.o_permission += cDetails.o_permission;
    totalAttArray.f_approve += cDetails.f_approve;
    totalAttArray.a_approve += cDetails.a_approve;
    totalAttArray.f_leave += cDetails.f_leave;
    totalAttArray.a_leave += cDetails.a_leave;

    attendanceDetails[1] += `<tr class="td_bottom_border">
    <td nowrap><p class="class_name" > ${cDetails.name} </p></td>
    <td style="text-align:right;"><p class="class_name" style="color:#666;"><strong>${cDetails.total}</strong></p></td>
    <td class="att_work_body"><p class="class_name cinfo" onclick="callstaffatt('${cid}','${academicDate}','working')"><strong>${cDetails.w}</strong></p></td>
    <td class="att_in_body"><p class="class_name cinfo" onclick="callstaffatt('${cid}','${academicDate}','in')"><strong>${num(cDetails.in)}</strong></p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="callstaffatt('${cid}','${academicDate}','late')">${num(cDetails.late)}</p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="callstaffatt('${cid}','${academicDate}','permission')">${num(cDetails.permission)}</p></td>
    <td class="att_out_body"><p class="class_name cinfo" onclick="callstaffatt('${cid}','${academicDate}','out')"><strong>${num(cDetails.out)}</strong></p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="callstaffatt('${cid}','${academicDate}','out late')">${num(cDetails.o_late)}</p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="callstaffatt('${cid}','${academicDate}','out permission')">${num(cDetails.o_permission)}</p></td>
    </tr>`;

    attendanceDetails[2] += `<tr class="td_bottom_border">
    <td nowrap><p class="class_name" > ${cDetails.name} </p></td>
    <td style="text-align:right;"><p class="class_name" style="color:#666;"><strong>${cDetails.total}</strong></p></td>
    <td class="att_work_body"><p class="class_name cinfo" onclick="callstaffatt('${cid}','${academicDate}','working')"><strong>${cDetails.w}</strong></p></td>
    <td class="att_in_body"><p class="class_name cinfo" onclick="callstaffatt('${cid}','${academicDate}','Forenoon Not Showing')"><strong>${cDetails.w - num(cDetails.in)}</strong></p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="callstaffatt('${cid}','${academicDate}','Forenoon Leave')">${num(cDetails.f_leave)}</p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="callstaffatt('${cid}','${academicDate}','Forenoon Leave Approval')">${num(cDetails.f_approve)}</p></td>
    <td class="att_out_body"><p class="class_name cinfo" onclick="callstaffatt('${cid}','${academicDate}','Afternoon Not Showing')"><strong>${cDetails.w - num(cDetails.out)}</strong></p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="callstaffatt('${cid}','${academicDate}','Afternoon Leave')">${num(cDetails.a_leave)}</p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="callstaffatt('${cid}','${academicDate}','Afternoon Leave Approval')">${num(cDetails.a_approve)}</p></td>
    </tr>`;
  }

  attendanceDetails[1] += `<tr class="td_bottom_border" bgcolor="#F4F4F4">
  <td ><p class="class_name"> Total </p></td>
  <td style="text-align:right;"><p class="class_name" style="color:#666;"><strong>${totalAttArray.total}</strong></p></td>
  <td class="att_work_header"><p class="class_name cinfo" onclick="callstaffatt('','${academicDate}','working')"><strong>${totalAttArray.w}</strong></p></td>
  <td class="att_in_header ar"><p class="class_name cinfo" onclick="callstaffatt('','${academicDate}','in')"><strong>${num(totalAttArray.in)}</strong></p></td>
  <td class="att_in_header ar"><p class="class_name cinfo" onclick="callstaffatt('','${academicDate}','late')"><strong>${num(totalAttArray.late)}</strong></p></td>
  <td class="att_in_header ar"><p class="class_name cinfo" onclick="callstaffatt('','${academicDate}','permission')"><strong>${num(totalAttArray.permission)}</strong></p></td>
  <td class="att_out_header ar"><p class="class_name cinfo" onclick="callstaffatt('','${academicDate}','out')"><strong>${num(totalAttArray.out)}</strong></p></td>
  <td class="att_out_header ar"><p class="class_name cinfo" onclick="callstaffatt('','${academicDate}','out late')"><strong>${num(totalAttArray.o_late)}</strong></p></td>
  <td class="att_out_header ar"><p class="class_name cinfo" onclick="callstaffatt('','${academicDate}','out permission')"><strong>${num(totalAttArray.o_permission)}</strong></p></td>
  </tr>`;

  attendanceDetails[2] += `<tr class="td_bottom_border" bgcolor="#F4F4F4">
  <td ><p class="class_name"> Total </p></td>
  <td style="text-align:right;"><p class="class_name" style="color:#666;"><strong>${totalAttArray.total}</strong></p></td>
  <td class="att_work_header"><p class="class_name cinfo" onclick="callstaffatt('','${academicDate}','working')"><strong>${totalAttArray.w}</strong></p></td>
  <td class="att_in_header ar"><p class="class_name cinfo" onclick="callstaffatt('','${academicDate}','Forenoon Not Showing')"><strong>${totalAttArray.w - num(totalAttArray.in)}</strong></p></td>
  <td class="att_in_header ar"><p class="class_name cinfo" onclick="callstaffatt('','${academicDate}','Forenoon Leave')"><strong>${num(totalAttArray.f_leave)}</strong></p></td>
  <td class="att_in_header ar"><p class="class_name cinfo" onclick="callstaffatt('','${academicDate}','Forenoon Leave Approval')"><strong>${num(totalAttArray.f_approve)}</strong></p></td>
  <td class="att_out_header ar"><p class="class_name cinfo" onclick="callstaffatt('','${academicDate}','Afternoon Not Showing')"><strong>${totalAttArray.w - num(totalAttArray.out)}</strong></p></td>
  <td class="att_out_header ar"><p class="class_name cinfo" onclick="callstaffatt('','${academicDate}','Afternoon Leave')"><strong>${num(totalAttArray.a_leave)}</strong></p></td>
  <td class="att_out_header ar"><p class="class_name cinfo" onclick="callstaffatt('','${academicDate}','Afternoon Leave Approval')"><strong>${num(totalAttArray.a_approve)}</strong></p></td>
  </tr>`;

  attendanceDetails[1] += ' </table></div></section> </div>';
  attendanceDetails[2] += ' </table></div></section> </div>';

  const tblName = punchTableName(academicDate);
  let lastSyncRows = [];
  try {
    lastSyncRows = await prisma.$queryRawUnsafe(
      `SELECT upload_dt FROM ${tblName} ORDER BY upload_dt DESC LIMIT 1`,
    );
  } catch (err) {
    // Punch tables are created per year+quarter as biometric syncs happen; a quarter
    // with no punch data yet (or a date outside the biometric system's history) simply
    // has no table. Treat that as "no sync recorded" instead of failing the whole widget.
    if (err?.meta?.code !== '1146') throw err; // 1146 = ER_NO_SUCH_TABLE
  }
  const lastSync = formatSyncTime(lastSyncRows[0]?.upload_dt);

  attendanceDetails[0] = `  <div class="col-sm-4 dashboard-container">
    <section class="panel">
    <div class="revenue-head">
        <span>
            <i class="icon-speedometer"></i>
        </span>
        <h3>Staff Attendance</h3>
    </div>
    <div class="dashboard-panel no-padding">
    <div class="weather-bg">
        <div class="panel-body">
            <div class="row">
                <div class="col-xs-6">
                    Clock In
                    <div class="degree cinfo" onclick="callstaffatt('','${academicDate}','in')">
                        ${totalAttArray.in}
                    </div>
                </div>
                <div class="col-xs-6 border-left">
                  Clock Out
                    <div class="degree cinfo" onclick="callstaffatt('','${academicDate}','out')">
                        ${totalAttArray.out}
                    </div>
                </div>
            </div>
        </div>
    </div>
    <footer class="weather-category">
        <ul>
            <li>
                <span style="font-size:26px; line-height:50px;">of ${num(totalAttArray.w)} | ${num(totalAttArray.la_total)}</span>
                <small style="font-size:11px; color:#333; line-height:30px;"> <br> Last sync: ${lastSync}</small>
            </li>
        </ul>
    </footer>
     </div>
    </section>
  </div>`;

  return attendanceDetails;
}
