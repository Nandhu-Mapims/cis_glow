import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { convertNYear } from '../../fees/feeHelpers.js';
import { studAuthentication, pgAuthentication, internAuthentication } from '../widgetAuth.js';
import {
  num,
  addMinutesToDatetime,
  normalizeTimeStr,
  loadPeriodSetup,
  loadMachineArray,
  loadSubjectSubcatArray,
  loadAcademicCalendar,
  loadDeptArray,
  loadInternDeptArray,
  loadStuAttSetup,
  formatSyncTime,
} from './dashboardShared.js';

function initDeptBucket() {
  return {
    in: 0,
    out: 0,
    total: 0,
    mla: 0,
    mpe: 0,
    mab: 0,
    m_l_ap: 0,
    m_l_apr: 0,
    ela: 0,
    epe: 0,
    eab: 0,
    e_l_ap: 0,
    e_l_apr: 0,
    pr_tot: 0,
    pe_tot_apply: 0,
    pe_tot_approve: 0,
    of_tot_apply: 0,
    of_tot_approve: 0,
  };
}

function initTotalLp() {
  return {
    mla: 0,
    mpe: 0,
    mab: 0,
    m_l_ap: 0,
    m_l_apr: 0,
    ela: 0,
    epe: 0,
    eab: 0,
    e_l_ap: 0,
    e_l_apr: 0,
    pr_tot: 0,
    pe_tot_apply: 0,
    pe_tot_approve: 0,
    of_tot_apply: 0,
    of_tot_approve: 0,
  };
}

function initLpBucket() {
  return {
    mp: 0,
    mla: 0,
    mpe: 0,
    ep: 0,
    ela: 0,
    epe: 0,
    m_l_ap: 0,
    m_l_apr: 0,
    e_l_ap: 0,
    e_l_apr: 0,
    pr: { personal: { apply: 0, approve: 0 }, official: { apply: 0, approve: 0 } },
  };
}

function mergeLpIntoTotal(totalLp, lp, inTot, clockIn, clockOut) {
  totalLp.mla += num(lp.mla);
  totalLp.mpe += num(lp.mpe);
  totalLp.mab += inTot - clockIn;
  totalLp.m_l_ap += num(lp.m_l_ap);
  totalLp.m_l_apr += num(lp.m_l_apr);
  totalLp.ela += num(lp.ela);
  totalLp.epe += num(lp.epe);
  totalLp.eab += inTot - clockOut;
  totalLp.e_l_ap += num(lp.e_l_ap);
  totalLp.e_l_apr += num(lp.e_l_apr);
  totalLp.pr_tot += num(lp.pr?.personal?.apply) + num(lp.pr?.official?.apply);
  totalLp.pe_tot_apply += num(lp.pr?.personal?.apply);
  totalLp.pe_tot_approve += num(lp.pr?.personal?.approve);
  totalLp.of_tot_apply += num(lp.pr?.official?.apply);
  totalLp.of_tot_approve += num(lp.pr?.official?.approve);
}

function mergeIntoDept(deptBucket, lp, clockIn, clockOut, inTot) {
  deptBucket.in += clockIn;
  deptBucket.out += clockOut;
  deptBucket.total += inTot;
  deptBucket.mla += num(lp.mla);
  deptBucket.mpe += num(lp.mpe);
  deptBucket.mab += inTot - clockIn;
  deptBucket.m_l_ap += num(lp.m_l_ap);
  deptBucket.m_l_apr += num(lp.m_l_apr);
  deptBucket.ela += num(lp.ela);
  deptBucket.epe += num(lp.epe);
  deptBucket.eab += inTot - clockOut;
  deptBucket.e_l_ap += num(lp.e_l_ap);
  deptBucket.e_l_apr += num(lp.e_l_apr);
  deptBucket.pr_tot += num(lp.pr?.personal?.apply) + num(lp.pr?.official?.apply);
  deptBucket.pe_tot_apply += num(lp.pr?.personal?.apply);
  deptBucket.pe_tot_approve += num(lp.pr?.personal?.approve);
  deptBucket.of_tot_apply += num(lp.pr?.official?.apply);
  deptBucket.of_tot_approve += num(lp.pr?.official?.approve);
}

function buildRegNoFilters(studentRegno) {
  const regNoList = {};
  const regNoCount = {};
  if (!studentRegno) return { regNoList, regNoCount, studentRegnoList: [] };

  const studentRegnoList = String(studentRegno).split(',');
  const regNoTmp = studentRegnoList.map((r) => escapeSql(r.trim())).join("' OR tktno='");
  if (regNoTmp.replace(/' OR tktno='/g, '').trim()) {
    regNoList.all = ` AND (tktno='${regNoTmp}')`;
    regNoCount.all = studentRegnoList.length;
  }
  return { regNoList, regNoCount, studentRegnoList };
}

function timestampFromDateTime(dateStr, timeStr, addMinutes = 0) {
  const t = String(timeStr || '').trim();
  if (!t || t === '00:00:00') return NaN;
  const dt = new Date(`${dateStr}T${t}`);
  if (Number.isNaN(dt.getTime())) return NaN;
  dt.setMinutes(dt.getMinutes() + addMinutes);
  return Math.floor(dt.getTime() / 1000);
}

async function processClockLp({
  academicDate,
  d,
  tblName,
  machineId,
  regNoList,
  regNoList1,
  fromTimeStr,
  toTimeStr,
  lLateTime,
  lPermissionTime,
  fillRegNo,
}) {
  const lp = initLpBucket();
  let clockIn = 0;
  let clockOut = 0;

  const fPresentTime = timestampFromDateTime(academicDate, fromTimeStr);
  const fLateTime = timestampFromDateTime(academicDate, fromTimeStr, lLateTime);
  const fPermissionTime = timestampFromDateTime(academicDate, fromTimeStr, lPermissionTime);
  const tPresentTime = timestampFromDateTime(academicDate, toTimeStr);
  const tLateTime = timestampFromDateTime(academicDate, toTimeStr, -lLateTime);
  const tPermissionTime = timestampFromDateTime(academicDate, toTimeStr, -lPermissionTime);

  if (
    Number.isNaN(fPermissionTime)
    || Number.isNaN(tPermissionTime)
    || Number.isNaN(fPresentTime)
    || Number.isNaN(tPresentTime)
  ) {
    return { clockIn, clockOut, lp };
  }

  const pgInFrom = new Date(fPermissionTime * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const pgInTo = new Date(tPermissionTime * 1000).toISOString().slice(0, 19).replace('T', ' ');

  if (machineId && regNoList) {
    const inRows = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT tktno, p_date FROM ${tblName}
       WHERE DATE(p_date) = '${d}' AND p_date <= '${pgInFrom}' ${machineId} ${regNoList}
       ORDER BY p_date ASC`,
    );
    for (const irow of inRows) {
      const tktno = irow.tktno;
      const tdate = Math.floor(new Date(irow.p_date).getTime() / 1000);
      if (!fillRegNo.m.includes(tktno)) {
        clockIn += 1;
        fillRegNo.m.push(tktno);
        if (tdate <= fPresentTime) lp.mp += 1;
        else if (tdate <= fLateTime) lp.mla += 1;
        else if (tdate <= fPermissionTime) lp.mpe += 1;
      }
    }

    const outRows = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT tktno, p_date FROM ${tblName}
       WHERE DATE(p_date) = '${d}' AND p_date >= '${pgInTo}' ${machineId} ${regNoList}
       ORDER BY p_date ASC`,
    );
    for (const irow of outRows) {
      const tktno = irow.tktno;
      const tdate = Math.floor(new Date(irow.p_date).getTime() / 1000);
      if (!fillRegNo.e.includes(tktno)) {
        fillRegNo.e.push(tktno);
        clockOut += 1;
        if (tdate >= tPresentTime) lp.ep += 1;
        else if (tdate >= tLateTime) lp.ela += 1;
        else if (tdate >= tPermissionTime) lp.epe += 1;
      }
    }
  }

  if (regNoList1) {
    const fnLeaveRows = await prisma.$queryRawUnsafe(
      `SELECT A.status, A.id FROM stu_leave_request_more AS A
       INNER JOIN student_profile_tb AS B ON A.student_id = B.id
       WHERE A.del = 1 AND A.req_date = '${d}'
         AND (A.r_session = 'fullday' OR A.r_session = 'forenoon')
         AND A.status <= 1 AND B.del = 1 ${regNoList1}`,
    );
    for (const irow of fnLeaveRows) {
      lp.m_l_ap += 1;
      if (num(irow.status) === 1) lp.m_l_apr += 1;
    }

    const anLeaveRows = await prisma.$queryRawUnsafe(
      `SELECT A.status, A.id FROM stu_leave_request_more AS A
       INNER JOIN student_profile_tb AS B ON A.student_id = B.id
       WHERE A.del = 1 AND A.req_date = '${d}'
         AND (A.r_session = 'fullday' OR A.r_session = 'afternoon')
         AND A.status <= 1 AND B.del = 1 ${regNoList1}`,
    );
    for (const irow of anLeaveRows) {
      lp.e_l_ap += 1;
      if (num(irow.status) === 1) lp.e_l_apr += 1;
    }

    const permRows = await prisma.$queryRawUnsafe(
      `SELECT A.status, A.p_type FROM stu_permission_request AS A
       INNER JOIN student_profile_tb AS B ON A.student_id = B.id
       WHERE A.del = 1 AND DATE(A.from_date) = '${d}' AND A.status <= 1 AND B.del = 1 ${regNoList1}`,
    );
    for (const rowL of permRows) {
      const pType = rowL.p_type;
      if (pType) {
        if (!lp.pr[pType]) lp.pr[pType] = { apply: 0, approve: 0 };
        lp.pr[pType].apply += 1;
        if (num(rowL.status) === 1) lp.pr[pType].approve += 1;
      }
    }
  }

  return { lp, clockIn, clockOut };
}

async function buildUgAttendanceRows({
  academicDate,
  d,
  tblName,
  periodDayEsc,
  periodDetails,
  sessionDetails,
  machineArray,
  subjectSubcatArray,
  studentAuthFilter,
  academicYears,
  academicEvents,
  academicClassList,
  academicClassArray,
}) {
  const classAttendanceDetails = { regular: '', additional: '' };
  const academicYearRef = academicYears['U.G']?.regular;
  const dateUnix = Math.floor(new Date(academicDate).getTime() / 1000);

  const courseRows = await prisma.$queryRawUnsafe(
    `SELECT id, course_name, degree_name, department_short_name, course_duration
     FROM basic_setup_course_tb WHERE del = 1 ORDER BY degree_name ASC`,
  );

  for (const rowSection of courseRows) {
    const cId = rowSection.id;
    const refCourseName = rowSection.course_name;
    let degreeName = rowSection.degree_name ?? '';
    let departmentShortName = rowSection.department_short_name ?? '';
    let courseDuration = num(rowSection.course_duration);

    let classContain = 0;
    if (!academicClassList || academicClassArray.includes(refCourseName)) classContain = 1;
    if (
      (academicEvents === 'working' && classContain === 1)
      || (academicEvents === 'holiday' && classContain === 0)
    ) {
      classContain = 1;
    } else {
      classContain = 0;
    }

    if (departmentShortName.trim() && departmentShortName.trim() !== '-') {
      departmentShortName = ` - ${departmentShortName}`;
    } else {
      departmentShortName = '';
    }

    if (refCourseName !== 'U.G' || classContain !== 1) continue;

    courseDuration -= 1;
    const ugYears = academicYears['U.G'] || {};
    const ayRef = escapeSql(String(academicYearRef || ''));

    for (const [abatch, acadYearRef] of Object.entries(ugYears)) {
      const batch = escapeSql(abatch);

      for (let cx = 1; cx <= courseDuration; cx += 1) {
        const stuRows = await prisma.$queryRawUnsafe(
          `SELECT COUNT(A.id) AS cnt, GROUP_CONCAT(A.register_no SEPARATOR ',') AS regnos
           FROM student_profile_tb AS A
           INNER JOIN student_academic_tb AS B ON A.id = B.s_id
           WHERE A.del = 1 AND A.course_id = '${escapeSql(String(cId))}'
             AND (A.releaving_date = '0000-00-00' OR A.releaving_date > '${d}')
             AND B.del = 1 AND B.academic_year = '${ayRef}'
             AND B.current_year = '${cx}' AND B.academic_batch = '${batch}'`,
        );
        const stuCount = num(stuRows[0]?.cnt);
        const { regNoList, regNoCount } = buildRegNoFilters(stuRows[0]?.regnos);

        const batchRows = await prisma.$queryRawUnsafe(
          `SELECT roll_no, batch_no FROM basic_subject_batch_tb
           WHERE course_id = '${escapeSql(String(cId))}'
             AND academic_year = '${ayRef}' AND current_year = '${cx}'
             AND academic_type = '${batch}' AND del = 1`,
        );
        for (const rowBatch of batchRows) {
          const rollNo = rowBatch.roll_no;
          const batchNo = rowBatch.batch_no;
          if (!rollNo) continue;
          const studentRegnoList = String(rollNo).split(',');
          const regNoTmp = studentRegnoList.map((r) => escapeSql(r.trim())).join("' OR tktno='");
          if (regNoTmp.replace(/' OR tktno='/g, '').trim()) {
            regNoList[batchNo] = ` AND (tktno='${regNoTmp}')`;
            regNoCount[batchNo] = studentRegnoList.length;
          }
        }

        let rowHtml = `<tr> <td ><p class="class_name">${convertNYear(cx, refCourseName)} ${degreeName}${departmentShortName}</p></td> `;
        if (!studentAuthFilter) {
          rowHtml += `<td ><p class="class_name">${stuCount}</p></td>`;
        }

        const allocatedPeriods = {};

        for (const period of Object.values(periodDetails)) {
          const periodEsc = escapeSql(String(period));
          const ttRows = await prisma.$queryRawUnsafe(
            `SELECT A.id, A.subject_id, A.batch_no, A.staff_id, B.room_no, B.subject_id,
                    B.subject_name, B.s_batch, B.subject_category
             FROM timetable_tb_new AS A
             INNER JOIN basic_subject_tt_tb AS B ON A.subject_id = B.id
             WHERE A.del = 1 AND A.course_id = '${escapeSql(String(cId))}'
               AND A.academic_year = '${ayRef}' AND A.current_year = '${cx}'
               AND A.academic_type = '${batch}' AND A.t_day = '${periodDayEsc}'
               AND A.period = '${periodEsc}'
               AND A.from_date <= '${d}'
               AND (A.to_date >= '${d}' OR A.to_date = '0000-00-00')
               AND B.del = 1 ${studentAuthFilter}
             ORDER BY A.id ASC`,
          );

          let totalAttended = '-';
          let totalStuCount = 0;

          if (ttRows.length > 0) {
            totalAttended = 0;
            for (const rowTt of ttRows) {
              const ttSubid = rowTt.subject_id;
              const ttBatchTemp = rowTt.batch_no;
              const ttRoomNo = rowTt.room_no;
              const ttSubjectBatch = rowTt.s_batch;
              const ttScat = rowTt.subject_category;
              const ttSubjectCat = subjectSubcatArray[ttScat];

              const sessFrom = sessionDetails[refCourseName]?.[cx]?.[abatch]?.[period]?.from;
              const sessTo = sessionDetails[refCourseName]?.[cx]?.[abatch]?.[period]?.to;
              if (!sessFrom || !sessTo) continue;

              const fromTime = addMinutesToDatetime(academicDate, sessFrom, -10);
              const toNorm = normalizeTimeStr(sessTo);
              if (!fromTime || !toNorm) continue;
              const toTime = `${academicDate} ${toNorm}`;

              const ttBatchNoList = String(ttBatchTemp || '').split(',');
              for (const ttBatchNo of ttBatchNoList) {
                let regSearchStr = regNoList.all;
                if (num(ttSubjectBatch) === 1) {
                  regSearchStr = regNoList[ttBatchNo];
                  totalStuCount += num(regNoCount[ttBatchNo]);
                } else {
                  totalStuCount = num(regNoCount.all);
                }

                const machineId = machineArray[ttRoomNo];
                if (allocatedPeriods[period]?.includes(regSearchStr)) continue;
                if (!allocatedPeriods[period]) allocatedPeriods[period] = [];
                allocatedPeriods[period].push(regSearchStr);

                let ttExamId = '';
                if (ttSubjectCat === 'e-learning') {
                  const examRows = await prisma.$queryRawUnsafe(
                    `SELECT id FROM activity_task_tb
                     WHERE exam_date = '${d}' AND academic_year = '${ayRef}'
                       AND course_type = '${batch}' AND course_id = '${escapeSql(String(cId))}'
                       AND current_year = '${cx}' AND exam_period = '${periodEsc}'
                       AND subject_id = '${escapeSql(String(ttSubid))}'
                     LIMIT 1`,
                  );
                  ttExamId = examRows[0]?.id;
                }

                if (ttExamId && regSearchStr) {
                  const rnolist = regSearchStr.replace(/tktno=/g, 'register_no=');
                  const ansRows = await prisma.$queryRawUnsafe(
                    `SELECT id FROM activity_answer_tb
                     WHERE del = 1 AND exam_id = '${escapeSql(String(ttExamId))}' ${rnolist}`,
                  );
                  totalAttended += ansRows.length;
                }

                if (machineId && regSearchStr) {
                  const punchRows = await prisma.$queryRawUnsafe(
                    `SELECT DISTINCT tktno FROM ${tblName}
                     WHERE DATE(p_date) = '${d}'
                       AND p_date >= '${fromTime}' AND p_date <= '${toTime}'
                       ${machineId} ${regSearchStr}`,
                  );
                  totalAttended += punchRows.length;
                }
              }
            }
          }

          if (totalAttended === '-') {
            rowHtml += `<td><p class="no_right">${totalAttended}</p></td>`;
          } else {
            let stuCountSuffix = '';
            if (studentAuthFilter) {
              if (totalStuCount > num(regNoCount.all)) {
                totalStuCount = num(regNoCount.all);
              }
              stuCountSuffix = `<small> /${totalStuCount}<small>`;
            }
            rowHtml += `<td nowrap><p class="no_right cinfo" onclick="call_stuattendance('${cId}','${academicYearRef}','${cx}','${dateUnix}','${period}' ,'${abatch}' )">${totalAttended}${stuCountSuffix}</p></td>`;
          }
        }

        rowHtml += '</tr>';
        classAttendanceDetails[abatch] += rowHtml;
      }
    }
  }

  return classAttendanceDetails;
}

async function buildPgAttendanceData({
  academicDate,
  d,
  tblName,
  machineArray,
  lLateTime,
  lPermissionTime,
  pgAuthList,
  academicYears,
  academicEvents,
  academicClassList,
  academicClassArray,
}) {
  const pgLatePermission = { tot: 0, in: 0, out: 0 };
  const totalPgLp = initTotalLp();
  const totalPg = {};
  const academicYearRef = academicYears['P.G']?.regular;

  const courseRows = await prisma.$queryRawUnsafe(
    `SELECT id, course_name, degree_name, department_short_name, course_duration, course_department
     FROM basic_setup_course_tb WHERE del = 1 ORDER BY degree_name ASC`,
  );

  for (const rowSection of courseRows) {
    const cId = rowSection.id;
    const refCourseName = rowSection.course_name;
    const courseDuration = num(rowSection.course_duration);
    const cDepartment = rowSection.course_department;

    let classContain = 0;
    if (!academicClassList || academicClassArray.includes(refCourseName)) classContain = 1;
    if (
      (academicEvents === 'working' && classContain === 1)
      || (academicEvents === 'holiday' && classContain === 0)
    ) {
      classContain = 1;
    } else {
      classContain = 0;
    }

    if (refCourseName !== 'P.G' || !cDepartment || classContain !== 1) continue;
    if (pgAuthList.length && !pgAuthList.includes(String(cDepartment))) continue;

    const ayRef = escapeSql(String(academicYearRef || ''));

    for (let cx = 1; cx <= courseDuration; cx += 1) {
      const stuRows = await prisma.$queryRawUnsafe(
        `SELECT COUNT(A.id) AS cnt, GROUP_CONCAT(A.register_no SEPARATOR ',') AS regnos
         FROM student_profile_tb AS A
         INNER JOIN student_academic_tb AS B ON A.id = B.s_id
         WHERE A.del = 1 AND A.course_id = '${escapeSql(String(cId))}'
           AND (A.releaving_date = '0000-00-00' OR A.releaving_date > '${d}')
           AND B.del = 1 AND B.academic_year = '${ayRef}' AND B.current_year = '${cx}'`,
      );
      const studentRegno = stuRows[0]?.regnos;
      const { regNoList, studentRegnoList } = buildRegNoFilters(studentRegno);
      const regNoFilter = regNoList.all;
      const regNoList1 = regNoFilter ? regNoFilter.replace(/tktno='/g, "B.register_no='") : '';

      const hrRows = await prisma.$queryRawUnsafe(
        `SELECT from_time, to_time, room_no FROM student_pgatt_time
         WHERE del = 1 AND course_id = '${escapeSql(String(cId))}'
           AND academic_year = '${ayRef}' AND current_year = '${cx}'
           AND academic_type = 'regular' AND days = '${escapeSql(new Date(academicDate).toLocaleDateString('en-US', { weekday: 'long' }))}'
           AND from_date <= '${d}' AND to_date >= '${d}'
         GROUP BY att_group ORDER BY att_group ASC LIMIT 1`,
      );

      if (hrRows.length === 0) continue;

      const fromTime = hrRows[0].from_time;
      const toTime = hrRows[0].to_time;
      const attRoomNo = hrRows[0].room_no;
      const machineId = machineArray[attRoomNo];

      if (!regNoFilter || !machineId) continue;

      const fillRegNo = { m: [], e: [] };
      const { lp, clockIn, clockOut } = await processClockLp({
        academicDate,
        d,
        tblName,
        machineId,
        regNoList: regNoFilter,
        regNoList1,
        fromTimeStr: fromTime,
        toTimeStr: toTime,
        lLateTime,
        lPermissionTime,
        fillRegNo,
      });

      const pgTot = studentRegnoList.length;
      pgLatePermission.tot += pgTot;
      pgLatePermission.in += clockIn;
      pgLatePermission.out += clockOut;
      mergeLpIntoTotal(totalPgLp, lp, pgTot, clockIn, clockOut);

      if (!totalPg[cDepartment]) totalPg[cDepartment] = initDeptBucket();
      mergeIntoDept(totalPg[cDepartment], lp, clockIn, clockOut, pgTot);
    }
  }

  return { pgLatePermission, totalPgLp, totalPg };
}

async function buildInternAttendanceData({
  memberId,
  academicDate,
  d,
  tblName,
  machineArray,
  lLateTime,
  lPermissionTime,
  lSatTime,
  academicEvents,
  academicClassList,
  academicClassArray,
}) {
  const internSearchStr = await internAuthentication(memberId, 'department');
  const totalInternStudent = { value: 0 };
  const totalInternIn = { value: 0 };
  const totalInternOut = { value: 0 };
  const totalInternLp = initTotalLp();
  const totalIntern = {};
  const fillRegNo = { m: [], e: [] };

  let classContain = 0;
  if (!academicClassList || academicClassArray.includes('Int')) classContain = 1;
  if (
    (academicEvents === 'working' && classContain === 1)
    || (academicEvents === 'holiday' && classContain === 0)
  ) {
    classContain = 1;
  } else {
    classContain = 0;
  }

  if (classContain !== 1) {
    return {
      totalInternStudent: 0,
      totalInternIn: 0,
      totalInternOut: 0,
      totalInternLp,
      totalIntern,
    };
  }

  const ttRows = await prisma.$queryRawUnsafe(
    `SELECT course_id, academic_year, current_year, academic_type, batch_no,
            department, from_time, to_time, room_no
     FROM internship_timetable
     WHERE del = 1 AND from_date <= '${d}' AND to_date >= '${d}' ${internSearchStr}
     ORDER BY academic_year ASC`,
  );

  const isSaturday = new Date(academicDate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() === 'saturday';

  for (const rowQuery of ttRows) {
    const iCourseId = rowQuery.course_id;
    const iAcademicYear = rowQuery.academic_year;
    const iCurrentYear = rowQuery.current_year;
    const iAcademicType = rowQuery.academic_type;
    const iBatchNo = rowQuery.batch_no;
    const iDepartment = rowQuery.department;
    let iFromTime = rowQuery.from_time;
    let iToTime = rowQuery.to_time;
    const iRoomNo = rowQuery.room_no;

    if (isSaturday) iToTime = lSatTime;

    const machineId = machineArray[iRoomNo];
    const stuBatchRows = await prisma.$queryRawUnsafe(
      `SELECT roll_no FROM basic_subject_batch_tb
       WHERE del = 1 AND course_id = '${escapeSql(String(iCourseId))}'
         AND academic_year = '${escapeSql(String(iAcademicYear))}'
         AND current_year = '${escapeSql(String(iCurrentYear))}'
         AND academic_type = '${escapeSql(String(iAcademicType))}'
         AND batch_no = '${escapeSql(String(iBatchNo))}' LIMIT 1`,
    );
    const studentRegno = stuBatchRows[0]?.roll_no;
    if (!studentRegno || !machineId) continue;

    const studentRegnoList = String(studentRegno).split(',');
    const regNoTmp = studentRegnoList.map((r) => escapeSql(r.trim())).join("' OR tktno='");
    if (!regNoTmp.replace(/' OR tktno='/g, '').trim()) continue;

    const regNoList = ` AND (tktno='${regNoTmp}')`;
    const regNoList1 = regNoList.replace(/tktno='/g, "B.register_no='");

    const { lp, clockIn, clockOut } = await processClockLp({
      academicDate,
      d,
      tblName,
      machineId,
      regNoList,
      regNoList1,
      fromTimeStr: iFromTime,
      toTimeStr: iToTime,
      lLateTime,
      lPermissionTime,
      fillRegNo,
    });

    const inTot = studentRegnoList.length;
    totalInternStudent.value += inTot;
    totalInternIn.value += clockIn;
    totalInternOut.value += clockOut;
    mergeLpIntoTotal(totalInternLp, lp, inTot, clockIn, clockOut);

    if (!totalIntern[iDepartment]) totalIntern[iDepartment] = initDeptBucket();
    mergeIntoDept(totalIntern[iDepartment], lp, clockIn, clockOut, inTot);
  }

  return {
    totalInternStudent: totalInternStudent.value,
    totalInternIn: totalInternIn.value,
    totalInternOut: totalInternOut.value,
    totalInternLp,
    totalIntern,
  };
}

function buildDeptAttendanceTableRows(deptArray, totalByDept, dateUnix, academicDate, handlers) {
  let tableRows = '';
  let tableRows1 = '';
  let tableRows2 = '';

  for (const [idept, idptName] of Object.entries(deptArray)) {
    const dept = totalByDept[idept];
    if (!dept || num(dept.total) <= 0) continue;

    const { attFn, permFn } = handlers;

    tableRows += `<tr class="td_bottom_border">
    <td nowrap><p class="class_name" > &nbsp; &nbsp; ${idptName} </p></td>
    <td class="att_work_body"><p class="class_name cinfo" onclick="${attFn}('${idept}','${dateUnix}','all')"><strong>${num(dept.total)}</strong></p></td>
    <td class="att_in_body"><p class="class_name cinfo" onclick="${attFn}('${idept}','${dateUnix}','in')"><strong>${num(dept.in)}</strong></p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="${attFn}('${idept}','${dateUnix}','in late')"><strong>${num(dept.mla)}</strong></p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="${attFn}('${idept}','${dateUnix}','in permission')"><strong>${num(dept.mpe)}</strong></p></td>
    <td class="att_out_body"><p class="class_name cinfo" onclick="${attFn}('${idept}','${dateUnix}','out')"><strong>${num(dept.out)}</strong></p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="${attFn}('${idept}','${dateUnix}','out late')"><strong>${num(dept.ela)}</strong></p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="${attFn}('${idept}','${dateUnix}','out permission')"><strong>${num(dept.epe)}</strong></p></td>
    </tr>`;

    tableRows1 += `<tr class="td_bottom_border">
    <td nowrap><p class="class_name" > &nbsp; &nbsp; ${idptName} </p></td>
    <td class="att_work_body"><p class="class_name cinfo" onclick="${attFn}('${idept}','${dateUnix}','all')"><strong>${num(dept.total)}</strong></p></td>
    <td class="att_in_body"><p class="class_name cinfo" onclick="${attFn}('${idept}','${dateUnix}','Forenoon Not Showing')"><strong>${num(dept.mab)}</strong></p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="${attFn}('${idept}','${dateUnix}','Forenoon Leave')">${num(dept.m_l_ap)}</p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="${attFn}('${idept}','${dateUnix}','Forenoon Leave Approval')">${num(dept.m_l_apr)}</p></td>
    <td class="att_out_body"><p class="class_name cinfo" onclick="${attFn}('${idept}','${dateUnix}','Afternoon Not Showing')"><strong>${num(dept.eab)}</strong></p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="${attFn}('${idept}','${dateUnix}','Afternoon Leave')">${num(dept.e_l_ap)}</p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="${attFn}('${idept}','${dateUnix}','Afternoon Leave Approval')">${num(dept.e_l_apr)}</p></td>
    </tr>`;

    tableRows2 += `<tr class="td_bottom_border">
    <td nowrap><p class="class_name" > &nbsp; &nbsp; ${idptName} </p></td><td class="att_work_body"><p class="class_name cinfo" onclick="${permFn}('${idept}','${academicDate}','Personal & Official')"><strong>${num(dept.pr_tot)}</strong></p></td>
    <td class="att_in_body"><p class="class_name cinfo" onclick="${permFn}('${idept}','${academicDate}','Personal')"><strong>${num(dept.pe_tot_apply)}</strong></p></td>
    <td class="att_in_body trans"><p class="class_name cinfo" onclick="${permFn}('${idept}','${academicDate}','Personal Approve')">${num(dept.pe_tot_approve)}</p></td>
    <td class="att_out_body"><p class="class_name cinfo" onclick="${permFn}('${idept}','${academicDate}','Official')"><strong>${num(dept.of_tot_apply)}</strong></p></td>
    <td class="att_out_body trans"><p class="class_name cinfo" onclick="${permFn}('${idept}','${academicDate}','Official Approve')">${num(dept.of_tot_approve)}</p></td>
    </tr>`;
  }

  return { tableRows, tableRows1, tableRows2 };
}

function wrapDeptAttendanceTable(tableRows, totals, dateUnix, academicDate, handlers, totalLp) {
  if (!tableRows) return '';

  const { attFn, permFn, workingTotal } = handlers;
  const { tot, clockIn, clockOut } = totals;

  return `<table width="283" cellpadding="0" cellspacing="0" class="table table-bordered staff_attendance">
  <tr class="td_head_color">
    <th width="100" rowspan="2" valign="bottom"> &nbsp; Dept.</th>
    <th width="60" rowspan="2" title="Working" class="att_work_header" valign="bottom">#W</th>
    <th width="60" colspan="3" class="text-center att_in_header" height="30" >Clock In</th>
    <th width="60" colspan="3" class="text-center att_out_header" nowrap>Clock Out</th>
    </tr>
    <tr class="td_head_color">
    <th width="20" height="10" title="IN" class="att_in_header">I</th>
    <th width="20" title="Late" class="att_in_header">L</th>
    <th width="20" title="Premission" class="att_in_header">P</th>
    <th width="20" title="Out" class="att_out_header">O</th>
    <th width="20" title="Late" class="att_out_header">L</th>
    <th width="20" title="Premission" class="att_out_header">P</th>
    </tr>
    ${tableRows}<tr class="td_bottom_border" bgcolor="#F4F4F4">
    <td ><p class="class_name"> &nbsp; &nbsp; Total </p></td>
    <td class="att_work_header"><p class="class_name cinfo" onclick="${attFn}('','${dateUnix}','all')"><strong>${num(workingTotal ?? tot)}</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="${attFn}('','${dateUnix}','in')"><strong>${num(clockIn)}</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="${attFn}('','${dateUnix}','in late')"><strong>${num(totalLp.mla)}</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="${attFn}('','${dateUnix}','in permission')"><strong>${num(totalLp.mpe)}</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="${attFn}('','${dateUnix}','out')"><strong>${num(clockOut)}</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="${attFn}('','${dateUnix}','out late')"><strong>${num(totalLp.ela)}</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="${attFn}('','${dateUnix}','out permission')"><strong>${num(totalLp.epe)}</strong></p></td>
    </tr></table>`;
}

function wrapLeaveAbsentTable(tableRows1, totals, dateUnix, handlers, totalLp) {
  if (!tableRows1) return '';

  const { attFn, workingTotal } = handlers;
  const { tot } = totals;

  return `<table width="283" cellpadding="0" cellspacing="0" class="table table-bordered staff_attendance">
  <tr class="td_head_color">
    <th width="40" rowspan="2"> &nbsp; Dept.</th>
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
    </tr>${tableRows1}<tr class="td_bottom_border" bgcolor="#F4F4F4">
    <td ><p class="class_name"> Total </p></td>
    <td class="att_work_header"><p class="class_name cinfo"onclick="${attFn}('','${dateUnix}','all')"><strong>${num(workingTotal ?? tot)}</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="${attFn}('','${dateUnix}','Forenoon Not Showing')"><strong>${num(totalLp.mab)}</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="${attFn}('','${dateUnix}','Forenoon Leave')"><strong>${num(totalLp.m_l_ap)}</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="${attFn}('','${dateUnix}','Forenoon Leave Approval')"><strong>${num(totalLp.m_l_apr)}</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="${attFn}('','${dateUnix}','Afternoon Not Showing')"><strong>${num(totalLp.eab)}</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="${attFn}('','${dateUnix}','Afternoon Leave')"><strong>${num(totalLp.e_l_ap)}</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="${attFn}('','${dateUnix}','Afternoon Leave Approval')"><strong>${num(totalLp.e_l_apr)}</strong></p></td>
    </tr>
     </table>`;
}

function wrapPermissionTable(tableRows2, academicDate, handlers, totalLp, useInternTotalHandlers = false) {
  if (!tableRows2) return '';

  const { permFn } = handlers;
  const personalApplyHandler = useInternTotalHandlers ? 'callinternpermission' : permFn;
  const personalApproveHandler = permFn;
  const officialApplyHandler = useInternTotalHandlers ? 'callinternpermission' : permFn;

  return `<table width="283" cellpadding="0" cellspacing="0" class="table table-bordered staff_attendance">
<tr class="td_head_color">
  <th width="40" rowspan="2"> &nbsp; Dept.</th>
  <th width="30" rowspan="2" title="Total" class="att_work_header">#T</th>
  <th colspan="2" class="text-center att_in_header" height="10" >Personal</th>
  <th colspan="2" class="text-center att_out_header">Official</th>
  </tr>
  <tr class="td_head_color">
  <th width="20" height="10" title="Apply" class="att_in_header">A</th>
  <th width="20" title="Waiting for Approval" class="att_in_header">A</th>
  <th width="20" title="Apply" class="att_out_header">A</th>
  <th width="20" title="Waiting for Approval" class="att_out_header">A</th>
  </tr>${tableRows2}
  <tr class="td_bottom_border" bgcolor="#F4F4F4">
<td nowrap><p class="class_name" > Total </p></td>
<td class="att_work_header"><p class="class_name cinfo" onclick="${permFn}('','${academicDate}','Personal & Official')"><strong>${num(totalLp.pr_tot)}</strong></p></td>
<td class="att_in_header ar"><p class="class_name cinfo" onclick="${personalApplyHandler}('','${academicDate}','Personal')"><strong>${num(totalLp.pe_tot_apply)}</strong></p></td>
<td class="att_in_header ar"><p class="class_name cinfo" onclick="${personalApproveHandler}('','${academicDate}','Personal Approve')">${num(totalLp.pe_tot_approve)}</p></td>
<td class="att_out_header ar"><p class="class_name cinfo" onclick="${officialApplyHandler}('','${academicDate}','Official')"><strong>${num(totalLp.of_tot_apply)}</strong></p></td>
<td class="att_out_header ar"><p class="class_name cinfo" onclick="${personalApproveHandler}('','${academicDate}','Official Approve')">${num(totalLp.of_tot_approve)}</p></td>
</tr>
</table>`;
}

function buildUgWidgetHtml(title, classRows, periodDetails, studentAuthFilter) {
  let header = `<div class="col-sm-4 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span>
          <i class="icon-user-following"></i>
      </span>
      <h3>${title}</h3>
  </div>


  <div class="dashboard-panel">
  <table width="283" cellpadding="0" cellspacing="0" class="table table-bordered">
<tr class="td_head_color">
      <th width="100" ><p class="staff_period">Course</p></th>`;

  if (!studentAuthFilter) {
    header += '<th width="25" ><p class="staff_period">#T</p></th>';
  }

  for (const period of Object.values(periodDetails)) {
    header += `<th width="25" ><p class="staff_period">${period}</p></th>`;
  }

  header += `
    </tr>
    ${classRows}
  </table></div></section>
</div>`;

  return header;
}

/**
 * Legacy dashboard_more.php attendance_details()
 * Returns array indices 0-9 matching PHP $attendance_details structure.
 */
export async function buildStudentAttendanceWidgets({ memberId, academicDate, academicYears }) {
  const d = escapeSql(academicDate);
  const dateUnix = Math.floor(new Date(academicDate).getTime() / 1000);

  const [
    periodSetup,
    machineArray,
    subjectSubcatArray,
    calendar,
    pdepartmentArray,
    idepartmentArray,
    stuAttSetup,
    studentAuthFilter,
    pgAuth,
  ] = await Promise.all([
    loadPeriodSetup(academicDate),
    loadMachineArray(),
    loadSubjectSubcatArray(),
    loadAcademicCalendar(academicDate),
    loadDeptArray(),
    loadInternDeptArray(),
    loadStuAttSetup(),
    studAuthentication(memberId, 'B.department'),
    pgAuthentication(memberId),
  ]);

  const { sessionDetails, periodDetails, periodDayEsc, tblName } = periodSetup;
  const { academicEvents, academicClassList, academicClassArray } = calendar;
  const { lPermissionTime, lLateTime, lSatTime } = stuAttSetup;
  const [, pgAuthList] = pgAuth;

  const classAttendanceDetails = await buildUgAttendanceRows({
    academicDate,
    d,
    tblName,
    periodDayEsc,
    periodDetails,
    sessionDetails,
    machineArray,
    subjectSubcatArray,
    studentAuthFilter,
    academicYears,
    academicEvents,
    academicClassList,
    academicClassArray,
  });

  const { pgLatePermission, totalPgLp, totalPg } = await buildPgAttendanceData({
    academicDate,
    d,
    tblName,
    machineArray,
    lLateTime,
    lPermissionTime,
    pgAuthList,
    academicYears,
    academicEvents,
    academicClassList,
    academicClassArray,
  });

  const {
    totalInternStudent,
    totalInternIn,
    totalInternOut,
    totalInternLp,
    totalIntern,
  } = await buildInternAttendanceData({
    memberId,
    academicDate,
    d,
    tblName,
    machineArray,
    lLateTime,
    lPermissionTime,
    lSatTime,
    academicEvents,
    academicClassList,
    academicClassArray,
  });

  const pgDeptRows = buildDeptAttendanceTableRows(
    pdepartmentArray,
    totalPg,
    dateUnix,
    academicDate,
    { attFn: 'call_pgatt', permFn: 'callpgpermission' },
  );
  const internDeptRows = buildDeptAttendanceTableRows(
    idepartmentArray,
    totalIntern,
    dateUnix,
    academicDate,
    { attFn: 'call_internatt', permFn: 'callinternpermission' },
  );

  let pgAttendanceDetails = '';
  let pgAttendanceDetails1 = '';
  let pgAttendanceDetails2 = '';

  if (num(pgLatePermission.tot) > 0) {
    pgAttendanceDetails = wrapDeptAttendanceTable(
      pgDeptRows.tableRows,
      { tot: pgLatePermission.tot, clockIn: pgLatePermission.in, clockOut: pgLatePermission.out },
      dateUnix,
      academicDate,
      { attFn: 'call_pgatt', permFn: 'callpgpermission' },
      totalPgLp,
    );
    pgAttendanceDetails1 = wrapLeaveAbsentTable(
      pgDeptRows.tableRows1,
      { tot: pgLatePermission.tot },
      dateUnix,
      { attFn: 'call_pgatt', workingTotal: pgLatePermission.tot },
      totalPgLp,
    );
    pgAttendanceDetails2 = wrapPermissionTable(
      pgDeptRows.tableRows2,
      academicDate,
      { permFn: 'callpgpermission' },
      totalPgLp,
      true,
    );
  }

  let internAttendanceDetails = wrapDeptAttendanceTable(
    internDeptRows.tableRows,
    { tot: totalInternStudent, clockIn: totalInternIn, clockOut: totalInternOut, workingTotal: totalInternStudent },
    dateUnix,
    academicDate,
    { attFn: 'call_internatt', permFn: 'callinternpermission' },
    totalInternLp,
  );
  let internAttendanceDetails1 = wrapLeaveAbsentTable(
    internDeptRows.tableRows1,
    { tot: totalInternStudent, workingTotal: totalInternStudent },
    dateUnix,
    { attFn: 'call_internatt' },
    totalInternLp,
  );
  let internAttendanceDetails2 = wrapPermissionTable(
    internDeptRows.tableRows2,
    academicDate,
    { permFn: 'callinternpermission' },
    totalInternLp,
    false,
  );

  const lastSyncRows = await prisma.$queryRawUnsafe(
    `SELECT upload_dt FROM ${tblName} ORDER BY upload_dt DESC LIMIT 1`,
  );
  const lastSync = formatSyncTime(lastSyncRows[0]?.upload_dt);

  const widgets = [];

  widgets[0] = `  <div class="col-sm-4 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span>
          <i class="icon-bar-chart"></i>
      </span>
      <h3>Internship Attendance</h3>
  </div>
  <div class="dashboard-panel no-padding">
  <div class="weather-bg">
      <div class="panel-body">
          <div class="row">
              <div class="col-xs-6">
                Clock IN
                <div class="degree cinfo" onclick="call_internatt('','${dateUnix}','in')">
                      ${num(totalInternIn)}
                </div>
              </div>
              <div class="col-xs-6 border-left">
                Clock Out
                <div class="degree cinfo" onclick="call_internatt('','${dateUnix}','out')">
                      ${num(totalInternOut)}
                </div>
              </div>
          </div>
      </div>
  </div>
  
 <footer class="weather-category cinfo"  onclick="call_internatt('','${dateUnix}','all')">
      <ul>
          <li>
              of ${num(totalInternStudent)}
              <small style="font-size:11px; color:#333; line-height:30px;"> <br> Last sync: ${lastSync}</small>
          </li>
      </ul>
  </footer>
   </div>
  </section>
</div>`;

  widgets[1] = `<div class="col-sm-4 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span>
          <i class="icon-calendar"></i>
      </span>
      <h3>Internship Attendance (Batch)</h3>
  </div>
  <div class="dashboard-panel no-padding">
  ${internAttendanceDetails}

   </div>
  </section>
</div>`;

  widgets[2] = buildUgWidgetHtml(
    'U.G Attendance (Reg.)',
    classAttendanceDetails.regular || '',
    periodDetails,
    studentAuthFilter,
  );

  widgets[3] = `
<div class="col-sm-4 dashboard-container">
  <section class="panel">
      <div class="revenue-head">
          <span>
              <i class="icon-user-unfollow"></i>
          </span>
          <h3>Internship Leave/Absent</h3>
      </div>
<div class="dashboard-panel no-padding">${internAttendanceDetails1}</div></section> </div>`;

  widgets[4] = `
<div class="col-sm-4 dashboard-container">
  <section class="panel">
      <div class="revenue-head">
          <span>
              <i class="icon-user-unfollow"></i>
          </span>
          <h3>Internship Permission</h3>
      </div>
<div class="dashboard-panel no-padding">${internAttendanceDetails2}</div></section> </div>`;

  widgets[5] = `  <div class="col-sm-4 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span>
          <i class="icon-bar-chart"></i>
      </span>
      <h3>P.G Attendance</h3>
  </div>
  <div class="dashboard-panel no-padding">
  <div class="weather-bg">
      <div class="panel-body">
          <div class="row">
              <div class="col-xs-6">
                Clock IN
                <div class="degree cinfo" onclick="call_pgatt('','${dateUnix}','in')">
                      ${num(pgLatePermission.in)}
                </div>
              </div>
              <div class="col-xs-6 border-left">
                Clock Out
                <div class="degree cinfo" onclick="call_pgatt('','${dateUnix}','out')">
                      ${num(pgLatePermission.out)}
                </div>
              </div>
          </div>
      </div>
  </div>
  <footer class="weather-category cinfo"  onclick="call_pgatt('','${dateUnix}','all')">
      <ul>
          <li>
              of ${num(pgLatePermission.tot)} 
          </li>
      </ul>
  </footer>
   </div>
  </section>
</div>`;

  widgets[6] = `<div class="col-sm-4 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span>
          <i class="icon-calendar"></i>
      </span>
      <h3>P.G Attendance (Dept.)</h3>
  </div>
  <div class="dashboard-panel no-padding">
  ${pgAttendanceDetails}

   </div>
  </section>
</div>`;

  widgets[7] = `
<div class="col-sm-4 dashboard-container">
  <section class="panel">
      <div class="revenue-head">
          <span>
              <i class="icon-user-unfollow"></i>
          </span>
          <h3>P.G Leave/Absent</h3>
      </div>
<div class="dashboard-panel no-padding">${pgAttendanceDetails1}</div></section> </div>`;

  widgets[8] = `
<div class="col-sm-4 dashboard-container">
  <section class="panel">
      <div class="revenue-head">
          <span>
              <i class="icon-user-unfollow"></i>
          </span>
          <h3>P.G Permission</h3>
      </div>
<div class="dashboard-panel no-padding">${pgAttendanceDetails2}</div></section> </div>`;

  widgets[9] = buildUgWidgetHtml(
    'U.G Attendance (Add.)',
    classAttendanceDetails.additional || '',
    periodDetails,
    studentAuthFilter,
  );

  return widgets;
}
