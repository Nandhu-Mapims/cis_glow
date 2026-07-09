import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import {
  callStudentAttendanceFlag,
  getIAttendance,
  getIBatch,
  getPGAttendance,
  getStudentLPTime,
  modifiedStudentAttendance,
} from '../attendance/pgAttendanceCore.js';

/** Legacy stipend_payroll_att_report_more.php daily cell HTML. */
export function buildStipendAttendanceDayCell(attendanceStatus) {
  let acmd = '';
  if (
    attendanceStatus.m === 'la' || attendanceStatus.m === 'pe'
    || attendanceStatus.e === 'la' || attendanceStatus.e === 'pe'
  ) {
    if (attendanceStatus.m === attendanceStatus.e) {
      acmd += `${String(attendanceStatus.m).toUpperCase().slice(0, 1)}${String(attendanceStatus.m).slice(1)}, `;
    } else {
      if (attendanceStatus.m === 'la' || attendanceStatus.m === 'pe') {
        acmd += `F:${String(attendanceStatus.m).charAt(0).toUpperCase()}${String(attendanceStatus.m).slice(1)},`;
      }
      if (attendanceStatus.e === 'la' || attendanceStatus.e === 'pe') {
        acmd += `A:${String(attendanceStatus.e).charAt(0).toUpperCase()}${String(attendanceStatus.e).slice(1)},`;
      }
    }
    acmd = acmd.replace(/,$/, '');
  }
  if (attendanceStatus.msinfo) acmd = attendanceStatus.msinfo;

  let attStatus = callStudentAttendanceFlag(attendanceStatus.m, attendanceStatus.e);
  let abg = '';
  if ((attStatus === '-' && String(attendanceStatus.s).toLowerCase() === 'h') || String(attStatus).toLowerCase() === 'h') {
    attStatus = 'H';
    abg = ' bgcolor="#F8BBCA"';
  }

  const infoHtml = acmd ? `<small style="font-size:8px;" class="hide_abinfo"><br>${acmd}</small>` : '';
  return `<td${abg} title="${attendanceStatus.st || ''}" align="center">${attStatus}${infoHtml}</td>`;
}

function eachDateIso(fromIso, toIso) {
  const dates = [];
  for (
    let ts = new Date(`${fromIso}T12:00:00`);
    ts <= new Date(`${toIso}T12:00:00`);
    ts.setDate(ts.getDate() + 1)
  ) {
    dates.push(ts.toISOString().slice(0, 10));
  }
  return dates;
}

function accumulateSessionHalf(attendanceStatus, session, totals) {
  const value = attendanceStatus[session];
  const opt = attendanceStatus.attopt?.[session];
  if (value === 'la') totals.late += 1;
  if (value === 'pe') totals.permission += 1;
  if (value === 'a') totals.absent += 0.5;
  else if (value === 'le' && opt === 'cl') totals.cl += 0.5;
  else if (value === 'le' && opt === 'el') totals.el += 0.5;
  else if (value === 'p' && opt === 'od') totals.od += 0.5;
  else if (value !== 'h' && value) totals.present += 0.5;
  if (String(value).toLowerCase() !== 'h') totals.working += 0.5;
}

function accumulateDay(attendanceStatus, totals, finalAttStatement, dateIso) {
  accumulateSessionHalf(attendanceStatus, 'm', totals);
  accumulateSessionHalf(attendanceStatus, 'e', totals);
  totals.permission += Number(attendanceStatus.pe || 0);
  finalAttStatement.att[dateIso] = attendanceStatus.m && attendanceStatus.e
    ? `${attendanceStatus.m}-${attendanceStatus.e}`
    : '';
  finalAttStatement.cmd[dateIso] = attendanceStatus.msinfo || '';
}

/**
 * Legacy stipend_generate_payroll_more.php — month totals via getIAttendance/getPGAttendance
 * and modifiedAttendance(..., rtype=1), not student_iatt_tb list scans.
 * Intern vs PG path is chosen per student from academic current_year (5 = CRRI).
 */
export async function computeStudentMonthAttendance(registerNo, fromDate, toDate, acYear = '') {
  const fromIso = String(fromDate).slice(0, 10);
  const toIso = String(toDate).slice(0, 10);

  const profileRows = await prisma.$queryRawUnsafe(
    `SELECT id FROM student_profile_tb
     WHERE del = 1 AND register_no = '${escapeSql(registerNo)}' LIMIT 1`,
  );
  const studentId = profileRows[0]?.id;
  if (!studentId) {
    return emptyMonthStats(fromIso, toIso);
  }

  const acRows = await prisma.$queryRawUnsafe(
    `SELECT course_id, academic_year, current_year, academic_type
     FROM student_academic_tb
     WHERE del = 1 AND register_no = '${escapeSql(registerNo)}'
       AND academic_year = '${escapeSql(acYear)}'
     LIMIT 1`,
  );
  const ac = acRows[0];
  if (!ac) return emptyMonthStats(fromIso, toIso);

  const isUg = String(ac.current_year) === '5';
  const latePermission = await getStudentLPTime();
  let batchRow = null;

  if (isUg) {
    batchRow = await getIBatch(registerNo);
    if (!batchRow) return emptyMonthStats(fromIso, toIso);
  } else {
    batchRow = {
      course_id: ac.course_id,
      academic_year: ac.academic_year,
      current_year: ac.current_year,
      academic_type: ac.academic_type,
    };
  }

  const totals = {
    totalDays: 0,
    working: 0,
    present: 0,
    absent: 0,
    late: 0,
    permission: 0,
    cl: 0,
    el: 0,
    od: 0,
  };
  const finalAttStatement = { att: {}, cmd: {} };
  const dayAttendance = [];

  for (const dateIso of eachDateIso(fromIso, toIso)) {
    totals.totalDays += 1;
    const raw = isUg
      ? await getIAttendance(studentId, registerNo, dateIso, batchRow, latePermission)
      : await getPGAttendance(studentId, registerNo, dateIso, batchRow, latePermission);
    const attendance = await modifiedStudentAttendance(
      studentId,
      registerNo,
      dateIso,
      batchRow,
      latePermission,
      raw,
      1,
    );
    dayAttendance.push({ dateIso, attendance });
    accumulateDay(attendance, totals, finalAttStatement, dateIso);
  }

  const leave = totals.cl + totals.el + totals.od;
  const percent = totals.working > 0
    ? Math.round(((totals.present + leave) / totals.working) * 100)
    : 0;

  return {
    totalDays: totals.totalDays,
    workingDays: totals.working,
    present: totals.present,
    absent: totals.absent,
    late: totals.late,
    permission: totals.permission,
    leave,
    lop: totals.absent,
    percent,
    dayAttendance,
    attStatement: {
      ...finalAttStatement,
      total_days: totals.totalDays,
      working_days: totals.working,
      present_days: totals.present,
      leave_days: leave,
      absent_days: totals.absent,
      late_days: totals.late,
      permission_days: totals.permission,
      lop_days: totals.absent,
      att_present: percent,
      tot_cl: totals.cl,
      tot_el: totals.el,
      tot_od: totals.od,
    },
  };
}

function emptyMonthStats(fromIso, toIso) {
  const totalDays = eachDateIso(fromIso, toIso).length;
  return {
    totalDays,
    workingDays: 0,
    present: 0,
    absent: 0,
    late: 0,
    permission: 0,
    leave: 0,
    lop: 0,
    percent: 0,
    dayAttendance: [],
    attStatement: {
      att: {},
      cmd: {},
      total_days: totalDays,
      working_days: 0,
      present_days: 0,
      leave_days: 0,
      absent_days: 0,
      late_days: 0,
      permission_days: 0,
      lop_days: 0,
      att_present: 0,
      tot_cl: 0,
      tot_el: 0,
      tot_od: 0,
    },
  };
}
