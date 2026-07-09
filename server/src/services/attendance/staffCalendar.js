import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import {
  callAttendanceFlag,
  calDefaulterPending,
  fetchPunchInOut,
  getAttendance,
  getLPTime,
  modifiedAttendance,
} from './staffAttendanceCore.js';

function formatMonthLabel(fromDate, toDate, payrollStart) {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  if (Number(payrollStart) === 1) {
    return from.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  if (from.getMonth() === 11) {
    return `${from.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${to.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  }
  return `${from.toLocaleDateString('en-US', { month: 'short' })} - ${to.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
}

function payrollMonthRange(latePermission, fromDate, toDate) {
  const currentDate = new Date();
  const payrollStart = Number(latePermission.payroll_start) || 1;
  let clMonth;
  let clMonthLast;
  const currentDay = currentDate.getDate();

  if (payrollStart === 1) {
    clMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), payrollStart);
    clMonthLast = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  } else if (currentDay >= payrollStart) {
    clMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), payrollStart);
    clMonthLast = new Date(clMonth);
    clMonthLast.setMonth(clMonthLast.getMonth() + 1);
    clMonthLast.setDate(clMonthLast.getDate() - 1);
  } else {
    clMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, payrollStart);
    clMonthLast = new Date(clMonth);
    clMonthLast.setMonth(clMonthLast.getMonth() + 1);
    clMonthLast.setDate(clMonthLast.getDate() - 1);
  }

  let reqFrom = fromDate || clMonth.toISOString().slice(0, 10);
  let reqTo = toDate || clMonthLast.toISOString().slice(0, 10);

  const shiftMonth = (iso, delta) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setMonth(d.getMonth() + delta);
    return d.toISOString().slice(0, 10);
  };

  const preFrom = shiftMonth(reqFrom, -1);
  const preTo = payrollStart === 1
    ? new Date(new Date(`${shiftMonth(reqFrom, -1)}T00:00:00`).getFullYear(), new Date(`${shiftMonth(reqFrom, -1)}T00:00:00`).getMonth() + 1, 0).toISOString().slice(0, 10)
    : shiftMonth(reqTo, -1);
  const nextFrom = shiftMonth(reqFrom, 1);
  const nextTo = payrollStart === 1
    ? new Date(new Date(`${shiftMonth(reqFrom, 1)}T00:00:00`).getFullYear(), new Date(`${shiftMonth(reqFrom, 1)}T00:00:00`).getMonth() + 1, 0).toISOString().slice(0, 10)
    : shiftMonth(reqTo, 1);

  return {
    reqFrom,
    reqTo,
    preFrom,
    preTo,
    nextFrom,
    nextTo,
    currentMonth: formatMonthLabel(reqFrom, reqTo, payrollStart),
    preMonth: formatMonthLabel(preFrom, preTo, payrollStart),
    nextMonth: formatMonthLabel(nextFrom, nextTo, payrollStart),
    payrollStart,
  };
}

function formatPunchTime(punch) {
  if (!punch) return '';
  return new Date(punch).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export async function buildStaffAttendanceCalendar(payload) {
  const staffIdRef = String(payload.staffId || '').trim();
  if (!staffIdRef) return { error: 'staffId is required' };

  const staffRows = await prisma.$queryRawUnsafe(
    `SELECT A.staff_id, A.staff_name, A.staff_initial, A.staff_title, A.att_category, A.id, A.releaving_date, A.joined_date
     FROM staff_profile_tb AS A
     WHERE A.del=1 AND A.staff_id='${escapeSql(staffIdRef)}'
       AND (A.releaving_date > CURDATE() OR A.releaving_date='0000-00-00') LIMIT 1`,
  );
  if (!staffRows.length) return { error: 'Staff member not found' };

  const row = staffRows[0];
  const staffId = row.staff_id;
  const stId = row.id;
  const title = row.staff_title ? `${row.staff_title}. ` : '';
  const staffName = `${title}${row.staff_initial || ''} ${row.staff_name || ''}`.trim();
  const latePermission = await getLPTime(row.att_category);
  const range = payrollMonthRange(latePermission, payload.fromDate, payload.toDate);
  const currentDate = new Date().toISOString().slice(0, 10);

  const nextMonthLink = new Date(`${range.nextFrom}T00:00:00`) >= new Date(`${currentDate}T00:00:00`)
    ? `staff_id=${staffId}`
    : `staff_id=${staffId}&m1=${range.nextFrom}&m2=${range.nextTo}`;

  let html = `<div class="form-group p-load" id="session_ref">
    <div class="col-xs-3 text-center"><a href="individual_calendar.php?staff_id=${staffId}&m1=${range.preFrom}&m2=${range.preTo}" class="btn btn-default"> &lt; &lt; ${range.preMonth}</a></div>
    <div class="col-xs-6 text-center"><h4>${range.currentMonth}</h4></div>
    <div class="col-xs-3 text-center"><a href="individual_calendar.php?${nextMonthLink}" class="btn btn-default">${range.nextMonth} &gt; &gt;</a></div>
  </div>`;

  const lopList = latePermission.o?.day_type !== 1
    ? await calDefaulterPending(stId, staffId, latePermission, range.reqFrom, range.reqTo, 0)
    : { m: [], e: [] };

  const attFrom = new Date(`${range.reqFrom}T00:00:00`);
  const attTo = new Date(`${range.reqTo}T00:00:00`);
  let calendar = '<table cellpadding="0" cellspacing="0" border="0" class="table table-bordered">';
  calendar += '<thead><tr class="calendar-row" bgcolor="#f4f4f4"><th>Sunday</th><th width="14.28%" height="50">Monday</th><th width="14.28%">Tuesday</th><th width="14.28%">Wednesday</th><th width="14.28%">Thursday</th><th width="14.28%">Friday</th><th width="14.28%">Saturday</th></tr></thead><tbody>';
  let presentDay = attFrom.getDay();
  let daysInWeek = 1;
  calendar += '<tr class="calendar-row">';
  for (let j = 0; j < presentDay; j += 1) {
    calendar += '<td class="calendar-day-np" style="height:80px;">&nbsp;</td>';
    daysInWeek += 1;
  }

  const totalAttArray = { total: 0, present: 0, leave: 0, absent: 0, late: 0, per: 0 };
  const joinedDate = row.joined_date ? String(row.joined_date).slice(0, 10) : '0000-00-00';
  const releavingDate = row.releaving_date ? String(row.releaving_date).slice(0, 10) : '0000-00-00';

  for (let m = attFrom.getTime(); m <= attTo.getTime(); m += 86400000) {
    const curDate = new Date(m).toISOString().slice(0, 10);
    const mSec = Math.floor(m / 1000);
    const dayNo = new Date(m).getDate();
    const inService = (releavingDate === '0000-00-00' || m <= new Date(`${releavingDate}T00:00:00`).getTime())
      && (joinedDate === '0000-00-00' || m >= new Date(`${joinedDate}T00:00:00`).getTime());

    if (inService) {
      const att1 = await getAttendance(stId, staffId, curDate, latePermission);
      const attendanceStatus = await modifiedAttendance(stId, staffId, curDate, latePermission, att1, 0);
      const punch = await fetchPunchInOut(staffId, curDate);
      let inOutCmd = '';
      if (punch.fromAttPunch || punch.toAttPunch) {
        inOutCmd = `<strong>In: </strong>${formatPunchTime(punch.fromAttPunch)} - ${punch.fromFlag || ''} <br><strong>Out: </strong>${formatPunchTime(punch.toAttPunch)} - ${punch.toFlag || ''}`;
      }

      let abg = '';
      let acmd = '';
      let attStatus = attendanceStatus.s;
      if (String(attendanceStatus.s).toLowerCase() === 'h') {
        attendanceStatus.m = 'h';
        attendanceStatus.e = 'h';
        acmd = attendanceStatus.cmd ? `<p class="event_name">${attendanceStatus.cmd}</p>` : '<p class="event_name">Weekly Off</p>';
      }

      if (m > new Date(`${currentDate}T00:00:00`).getTime()) {
        attStatus = '';
      } else {
        const isHoliday = String(attendanceStatus.s || '').toLowerCase() === 'h';
        if (!isHoliday && lopList.m?.includes(mSec) && lopList.e?.includes(mSec)) {
          attendanceStatus.minfo = '<span style="color:#E73400">Unauthorized: Ab</span>';
        } else if (!isHoliday && lopList.m?.includes(mSec)) {
          attendanceStatus.minfo = '<span style="color:#E73400">Unauthorized: FN: Ab</span>';
        } else if (!isHoliday && lopList.e?.includes(mSec)) {
          attendanceStatus.minfo = '<span style="color:#E73400">Unauthorized: AN: Ab</span>';
        }

        const tally = (session, lopArr) => {
          if (!isHoliday && lopArr?.includes(mSec)) {
            attendanceStatus[session] = 'a';
            totalAttArray.absent += 0.5;
            totalAttArray.total += 0.5;
            return;
          }
          const val = attendanceStatus[session];
          if (val === 'la') totalAttArray.late += 1;
          else if (val === 'pe') totalAttArray.per += 1;
          else if (val === 'a') totalAttArray.absent += 0.5;
          else if (val === 'le') totalAttArray.leave += 0.5;
          else if (val !== 'h') totalAttArray.present += 0.5;
          if (val !== 'h') totalAttArray.total += 0.5;
        };
        tally('m', lopList.m);
        tally('e', lopList.e);
        attStatus = callAttendanceFlag(attendanceStatus.m, attendanceStatus.e);
        if (attendanceStatus.minfo) acmd = `<p class="event_name">${attendanceStatus.minfo}</p>`;
        totalAttArray.per += attendanceStatus.pe || 0;
      }

      if (attendanceStatus.m === 'h' || attendanceStatus.e === 'h') abg = ' bgcolor="#F8BBCA" ';
      calendar += `<td class="calendar-day" style="height:100px;"${abg}><div style="position:relative;height:60px;"><p class="day-number">${dayNo}</p><p class="event">${String(attStatus || '').toUpperCase()}</p>${acmd}</div><small>${inOutCmd}</small></td>`;
    } else {
      calendar += `<td class="calendar-day" style="height:80px;"><div style="position:relative;height:60px;"><p class="day-number">${dayNo} </p><p class="event"><span style="font-size:20px;">-</span></p></div></td>`;
    }

    if (presentDay === 6 && m !== attTo.getTime()) {
      calendar += '</tr><tr class="calendar-row">';
      presentDay = -1;
      daysInWeek = 0;
    }
    daysInWeek += 1;
    presentDay += 1;
  }

  if (daysInWeek < 8) {
    for (let x = 1; x <= 8 - daysInWeek; x += 1) {
      calendar += '<td class="calendar-day-np" style="height:80px;">&nbsp;</td>';
    }
  }
  calendar += '</tr></tbody></table>';

  const desigRows = await prisma.$queryRawUnsafe(
    `SELECT department, designation FROM staff_designation_tb WHERE del=1 AND staff_id='${escapeSql(String(stId))}' AND is_academic=1 ORDER BY id DESC LIMIT 1`,
  );
  let designationDetail = '';
  let departmentDetail = '';
  if (desigRows.length) {
    const deptRows = await prisma.$queryRawUnsafe('SELECT id, name FROM staff_dept_master WHERE del=1');
    const desgRows = await prisma.$queryRawUnsafe('SELECT id, name FROM staff_desg_master WHERE del=1');
    const deptMap = Object.fromEntries(deptRows.map((d) => [String(d.id), d.name]));
    const desgMap = Object.fromEntries(desgRows.map((d) => [String(d.id), d.name]));
    departmentDetail = deptMap[String(desigRows[0].department)] || '';
    designationDetail = desgMap[String(desigRows[0].designation)] || '';
  }

  html += `<h4>${staffId} - ${staffName} | ${designationDetail} - ${departmentDetail}</h4>`;
  html += `<table class="table table-bordered total_leave" style="margin:0px;"><tr>
    <td width="18%" height="35" class="text-right">Working Days</td><td width="5%" bgcolor="#f4f4f4"><strong>${totalAttArray.total}</strong></td>
    <td width="10%" class="text-right">Present</td><td width="5%" bgcolor="#f4f4f4"><strong>${totalAttArray.present}</strong></td>
    <td width="8%" class="text-right">Leave</td><td width="5%" bgcolor="#f4f4f4"><strong>${totalAttArray.leave}</strong></td>
    <td width="8%" class="text-right">Absent</td><td width="5%" bgcolor="#f4f4f4"><strong>${totalAttArray.absent}</strong></td>
    <td width="8%" class="text-right">Late</td><td width="5%" bgcolor="#f4f4f4"><strong>${totalAttArray.late}</strong></td>
    <td width="12%" class="text-right">Permission</td><td width="5%" bgcolor="#f4f4f4"><strong>${totalAttArray.per}</strong></td>
  </tr></table>${calendar}`;
  html += `<p><strong style="font-size:18px;">Note:</strong> X Present | / Forenoon Present | \\ Afternoon Present | L Leave | A Absent | H Holiday</p>`;

  return { html, staffId, staffName, range: { from: range.reqFrom, to: range.reqTo }, totals: totalAttArray };
}
