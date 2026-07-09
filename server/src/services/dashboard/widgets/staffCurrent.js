import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { staffAuthentication } from '../widgetAuth.js';
import { convertNYear } from '../../fees/feeHelpers.js';
import {
  getAttendance,
  getLPTime,
  modifiedAttendance,
} from '../../attendance/staffAttendanceCore.js';

/**
 * Legacy dashboard_more.php staff_current($current_date, $academic_year_array, $current_time)
 */
export async function renderStaffCurrent({ memberId, academicDate, academicTime, academicYears }) {
  const d = escapeSql(academicDate);
  const time = escapeSql(academicTime || new Date().toTimeString().slice(0, 5));
  const periodDay = new Date(academicDate).toLocaleDateString('en-US', { weekday: 'long' });
  const periodDayEsc = escapeSql(periodDay);
  const periodDayString = ` AND (p_days = '${periodDayEsc}' OR p_days LIKE '${periodDayEsc},%' OR p_days LIKE '%,${periodDayEsc}' OR p_days LIKE '%,${periodDayEsc},%')`;

  const staffFilter = await staffAuthentication(memberId, '');

  const periodRows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT period_no, course_name, academic_year, academic_type, from_time, to_time
     FROM period_set_up
     WHERE del != 0 AND period_no != 'Break' AND p_combined = '0' ${periodDayString}
       AND from_time != '00:00:00' AND to_time != '00:00:00'
       AND from_time <= '${time}' AND to_time >= '${time}'
     ORDER BY academic_year + 0 ASC, period_no + 0 ASC`,
  );

  const sessionDetails = {};
  for (const row of periodRows) {
    const periodNo = row.period_no;
    const courseName = row.course_name;
    const academicYear = row.academic_year;
    const academicType = row.academic_type;
    const fromTime = row.from_time;
    const toTime = row.to_time;

    if (!sessionDetails[courseName]) sessionDetails[courseName] = {};
    if (!sessionDetails[courseName][academicYear]) sessionDetails[courseName][academicYear] = {};
    if (!sessionDetails[courseName][academicYear][academicType]) {
      sessionDetails[courseName][academicYear][academicType] = { prd: '' };
    }
    const bucket = sessionDetails[courseName][academicYear][academicType];
    bucket[periodNo] = {
      time: `${String(fromTime).slice(0, -3)} - ${String(toTime).slice(0, -3)}`,
    };
    bucket.prd += ` A.period='${escapeSql(String(periodNo))}' OR `;
  }

  const currentStaffDetails = { a: {}, le: {}, p: {} };
  const fStaffAtt = {};
  const blockDetailsArray = {};
  const lpCache = new Map();

  for (const [courseName, courseSub] of Object.entries(sessionDetails)) {
    const courses = await prisma.$queryRawUnsafe(
      `SELECT id, degree_name, department_short_name
       FROM basic_setup_course_tb
       WHERE course_name = '${escapeSql(courseName)}' AND del = 1
       ORDER BY c_order ASC`,
    );

    for (const rowCourse of courses) {
      const courseId = rowCourse.id;
      let degreeName = rowCourse.degree_name ?? '';
      let departmentName = rowCourse.department_short_name ?? '';
      const academicYearRef = academicYears[courseName]?.regular;

      if (departmentName.trim() && departmentName.trim() !== '-') {
        departmentName = `<br>${departmentName}`;
      } else {
        departmentName = '';
      }

      for (const [currentYear, academicSub] of Object.entries(courseSub)) {
        const degreeNameStr = `<strong>${convertNYear(currentYear, courseName)} ${degreeName}</strong>${departmentName}`;

        for (const [academicType, academicPeriod] of Object.entries(academicSub)) {
          if (!academicPeriod.prd) continue;

          const prdStr = ` AND (${academicPeriod.prd.slice(0, -3)})`;
          const ttRows = await prisma.$queryRawUnsafe(
            `SELECT A.staff_id, A.batch_no, A.period, B.subject_id, B.subject_name,
                    B.subject_category, B.s_batch, B.room_no
             FROM timetable_tb_new AS A
             INNER JOIN basic_subject_tt_tb AS B ON A.subject_id = B.id
             WHERE A.del = 1 AND B.del = 1 AND A.course_id = '${escapeSql(String(courseId))}'
               AND A.academic_year = '${escapeSql(String(academicYearRef || ''))}'
               AND A.current_year = '${escapeSql(String(currentYear))}'
               AND A.academic_type = '${escapeSql(academicType)}'
               AND A.t_day = '${periodDayEsc}'
               AND A.from_date <= '${d}' AND A.from_date != '0000-00-00'
               AND (A.to_date >= '${d}' OR A.to_date = '0000-00-00') ${prdStr}
             ORDER BY B.subject_id ASC`,
          );

          for (const rowTime of ttRows) {
            const tStaffId = rowTime.staff_id;
            const tSubjectName = rowTime.subject_name ?? '';
            const tRoomNo = rowTime.room_no;

            if (!blockDetailsArray[tRoomNo]) {
              const roomRows = await prisma.$queryRawUnsafe(
                `SELECT A.room_name, B.block_name
                 FROM rooms_tb AS A
                 INNER JOIN blocks_tb AS B ON A.block_id = B.id
                 WHERE A.del = 1 AND B.del = 1 AND A.id = '${escapeSql(String(tRoomNo))}'
                 LIMIT 1`,
              );
              const room = roomRows[0];
              blockDetailsArray[tRoomNo] = room
                ? `<strong>${room.room_name}</strong> | ${room.block_name}`
                : '';
            }
            const roomLabel = blockDetailsArray[tRoomNo];

            const staffIdList = String(tStaffId || '').split(',');
            const staffIdTmp = staffIdList.map((id) => escapeSql(id.trim())).join("' OR id='");
            if (!staffIdTmp.replace(/' OR id='/g, '').trim()) continue;

            const staffRows = await prisma.$queryRawUnsafe(
              `SELECT id, staff_id, staff_title, staff_name, staff_initial, att_category
               FROM staff_profile_tb
               WHERE del = 1 AND (id='${staffIdTmp}') ${staffFilter}
               ORDER BY staff_id ASC`,
            );

            for (const rowStaff of staffRows) {
              const stId = rowStaff.id;
              const staffId = rowStaff.staff_id;
              const staffName = rowStaff.staff_name ?? '';
              const staffInitial = rowStaff.staff_initial ?? '';
              const attCategory = rowStaff.att_category;
              const stLabel = `<small><strong>${staffInitial} ${staffName}</strong><br>${staffId}</small>`;

              if (!fStaffAtt[stId]) {
                const catKey = String(attCategory || '1');
                if (!lpCache.has(catKey)) {
                  lpCache.set(catKey, await getLPTime(attCategory));
                }
                const latePermission = lpCache.get(catKey);
                let attendanceStatus1 = await getAttendance(
                  stId,
                  staffId,
                  academicDate,
                  latePermission,
                );
                if (String(attendanceStatus1.s).toLowerCase() === 'h') {
                  attendanceStatus1.m = 'h';
                  attendanceStatus1.e = 'h';
                }
                const attendanceStatus = await modifiedAttendance(
                  stId,
                  staffId,
                  academicDate,
                  latePermission,
                  attendanceStatus1,
                  0,
                );

                if (attendanceStatus.m === 'h') {
                  fStaffAtt[stId] = 'h';
                } else if (
                  attendanceStatus.m === 'le'
                  || (attendanceStatus.m === 'p' && attendanceStatus.attopt?.m === 'od')
                  || (attendanceStatus.m === 'a'
                    && (attendanceStatus.msrc === 'lr' || attendanceStatus.msrc === 'dr'))
                ) {
                  fStaffAtt[stId] = 'le';
                } else if (attendanceStatus.m !== 'a') {
                  fStaffAtt[stId] = 'p';
                }
              }

              let txtColor = '';
              if (fStaffAtt[stId] === 'le') txtColor = ' style="color:#5D9800;" ';
              else if (fStaffAtt[stId] !== 'p') txtColor = ' style="color:#9F050F;" ';

              let saType = fStaffAtt[stId];
              if (!saType) saType = 'a';

              if (saType !== 'h') {
                let labelHtml = stLabel;
                if (saType === 'le') {
                  let alternativeStaff = '';
                  const taskRows = await prisma.$queryRawUnsafe(
                    `SELECT DISTINCT A.staff_id, A.staff_initial, A.staff_name, A.staff_title
                     FROM staff_profile_tb AS A
                     INNER JOIN att_leave_task AS B ON A.id = B.allocated_to
                     WHERE A.del = 1 AND B.del = 1 AND B.staff_id = '${escapeSql(String(stId))}'
                       AND B.req_date = '${d}'
                       AND B.from_time <= '${time}' AND B.to_time >= '${time}'`,
                  );
                  for (const rowTask of taskRows) {
                    const tmpName = `<small><strong>${rowTask.staff_initial} ${rowTask.staff_name}</strong><br>${rowTask.staff_id}</small>`;
                    alternativeStaff += `<br>${tmpName}`;
                  }
                  if (alternativeStaff) {
                    labelHtml = `<s>${stLabel}</s>${alternativeStaff}`;
                  }
                }
                const rowHtml = `
                      <tr >
                        <td ${txtColor}>${labelHtml}</th>
                        <td ${txtColor} nowrap><small>${degreeNameStr}</small></th>
                        <td ${txtColor}><small>${tSubjectName}</small>
                        <br><small>${roomLabel}</small> </th>
                        </tr>`;

                if (!currentStaffDetails[saType][staffId]) {
                  currentStaffDetails[saType][staffId] = rowHtml;
                } else {
                  currentStaffDetails[saType][staffId] += rowHtml;
                }
              }
            }
          }
        }
      }
    }
  }

  const sortKeys = (obj) => {
    const keys = Object.keys(obj);
    keys.sort();
    return keys.map((k) => obj[k]).join('');
  };

  return `
  <div class="col-sm-4 dashboard-container">
    <section class="panel">
        <div class="revenue-head">
            <span>
                <i class="icon-user-follow"></i>
            </span>
            <h3>Staff Current
            <div class="input-group m-bot15 pull-right col-sm-4" >
                <input class="form-control input-md" type="text"  value="${academicTime}" id="attendance_time" style="width:60px; font-size:12px; margin-top:10px" placeholder="HH:MM">
                <span class="input-group-btn" style="padding:10px 0px;" >
                  <button class="btn btn-info" type="button" onclick="callStaffCurrent()">Go</button>
                </span>
            </div></h3>
        </div>
  <div class="dashboard-panel"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered staff_attendance">
  <tr bgcolor="#F4F4F4">
    <th width="35%" height="30">Staff</th>
    <th width="10%" >Class</th>
    <th width="55%" >Subject & Class Room</th>
    </tr> ${sortKeys(currentStaffDetails.a)}${sortKeys(currentStaffDetails.le)}${sortKeys(currentStaffDetails.p)}
   </table></div></section> </div>`;
}
