import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';

const PUNCH_FLAGS = `'Admin Block','Clinical Block','adm off','Admin Office','Hostel Office','Hosteloffice','Hostel','DENTALOPBIO','AZ - Clinical Block','CZ - Admin Block','AZ - Admin Block','CZ - Clinical Block','Dental-Ayush','Hostel-Office','Main Reception'`;

/** Unix seconds at local midnight — matches PHP strtotime('Y-m-d') for LOP lists. */
function dayEpoch(ms) {
  return Math.floor(ms / 1000);
}

export function tToN(time) {
  if (!time) return 0;
  const parts = String(time).split(':');
  return (Number(parts[0]) * 3600) + (Number(parts[1]) * 60) + Number(parts[2] || 0);
}

export function nToT(diff) {
  if (diff <= 0) return '00:00:00';
  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff - hours * 3600) / 60);
  const seconds = Math.floor(diff - hours * 3600 - mins * 60);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function staffIdLikeSql(sid) {
  const id = escapeSql(String(sid));
  return ` AND (A.staff_id='${id}' OR A.staff_id LIKE '${id},%' OR A.staff_id LIKE '%,${id}' OR A.staff_id LIKE '%,${id},%')`;
}

function localWeekdayFromIso(dateIso) {
  const [y, m, d] = String(dateIso).split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
}

function punchTableName(attDate) {
  const d = new Date(attDate);
  const year = d.getFullYear();
  const quarter = Math.ceil((d.getMonth() + 1) / 4);
  return `punchtimedetails_${year}${quarter}`;
}

export function callAttendanceFlag(mFlag, eFlag) {
  let flag = `${mFlag}-${eFlag}`;
  switch (mFlag) {
    case 'p': flag = '/'; break;
    case 'a': flag = 'a'; break;
    case 'le': flag = 'l'; break;
    case 'pe': flag = '/'; break;
    case 'la': flag = '/'; break;
    case 'H': case 'h': flag = 'h'; break;
    case '': flag = '-'; break;
    default: break;
  }
  switch (eFlag) {
    case 'p': flag += '\\'; break;
    case 'a': flag += 'a'; break;
    case 'le': flag += 'l'; break;
    case 'pe': flag += '\\'; break;
    case 'la': flag += '\\'; break;
    case 'H': case 'h': flag += 'h'; break;
    case '': flag += '-'; break;
    default: break;
  }
  if (flag === '/\\') return 'X';
  if (flag === 'aa') return 'a';
  if (flag === 'll') return 'l';
  if (flag === 'lala') return 'la';
  if (flag === 'pp') return 'p';
  if (flag === 'hh') return 'h';
  if (flag === '--') return '-';
  return flag;
}

export function callAttendanceReport(mFlag, eFlag) {
  let flag = `${mFlag}-${eFlag}`;
  switch (mFlag) {
    case 'p': flag = '/'; break;
    case 'a': flag = 'a'; break;
    case 'le': flag = 'le'; break;
    case 'pe': flag = 'p'; break;
    case 'la': flag = 'la'; break;
    case 'H': case 'h': flag = 'h'; break;
    case '': flag = '-'; break;
    default: break;
  }
  switch (eFlag) {
    case 'p': flag += '\\'; break;
    case 'a': flag += 'a'; break;
    case 'le': flag += 'le'; break;
    case 'pe': flag += 'p'; break;
    case 'la': flag += 'la'; break;
    case 'H': case 'h': flag += 'h'; break;
    case '': flag += '-'; break;
    default: break;
  }
  if (flag === '/\\') return 'X';
  if (flag === 'aa') return 'a';
  if (flag === 'lele') return 'le';
  if (flag === 'lala') return 'la';
  if (flag === 'pp') return 'p';
  if (flag === 'hh') return 'h';
  if (flag === '--') return '-';
  return flag;
}

export async function getLPTime(attCategory) {
  const cat = escapeSql(String(attCategory || '1'));
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, yearly_leave, minimum_leave, max_leave, max_od, yearly_el, max_el, min_el,
            od_type, leave_apply_days, defaulter_apply, academic_start, payroll_start,
            minimum_permission, minimum_late, day_type,
            CAST(late_time AS CHAR) AS late_time,
            CAST(permission_time AS CHAR) AS permission_time
     FROM basic_setup_payroll_tb
     WHERE id = (CASE WHEN (SELECT COUNT(id) FROM basic_setup_payroll_tb WHERE id='${cat}' AND del=1) > 0
       THEN '${cat}' ELSE '1' END) LIMIT 1`,
  );
  const row = rows[0] || {};
  const pyid = row.id ?? 1;

  const graceRows = await prisma.$queryRawUnsafe(
    `SELECT grace_time, CAST(from_date AS CHAR) AS from_date, CAST(to_date AS CHAR) AS to_date
     FROM basic_setup_payroll_graceperiod
     WHERE del = 1 AND id = '${escapeSql(String(pyid))}'
     LIMIT 1`,
  );
  const graceRow = graceRows[0] || {};

  const latePermission = {
    pyid,
    max_leave: row.max_leave,
    max_od: row.max_od,
    yearly_el: row.yearly_el,
    max_el: row.max_el,
    min_el: row.min_el,
    od_type: row.od_type,
    leave_apply: row.leave_apply_days,
    defaulter_apply: row.defaulter_apply,
    academic_start: row.academic_start,
    payroll_start: row.payroll_start,
    min_permission: row.minimum_permission,
    min_late: row.minimum_late,
    grace: (Number(graceRow.grace_time) || 0) * 60,
    gfdate: graceRow.from_date,
    gtdate: graceRow.to_date,
    late: tToN(row.late_time),
    permission: tToN(row.permission_time),
    o: row,
  };
  return latePermission;
}

async function getBiomericAtt(sid, staffId, attDate, latePermission, attendanceTime) {
  const morStartAttTime = attendanceTime[1];
  const eveEndAttTime = attendanceTime[2];
  let morStartAttStr = tToN(morStartAttTime);
  const eveEndAttStr = tToN(eveEndAttTime);
  const totalAttStr = eveEndAttStr - morStartAttStr;
  const staffId1 = `0${staffId}`;
  let mFlag = '';
  let eFlag = '';
  const bioResults = { mt: '', et: '', mpu: '', epu: '', m: '', e: '' };

  if (totalAttStr > 0) {
    const halfAttStr = totalAttStr / 2;
    const eveStartAttStr = eveEndAttStr - halfAttStr;
    let fromAttPunch = '';
    let toAttPunch = '';
    let session1Id = '';
    const tbl = punchTableName(attDate);
    const d = escapeSql(attDate);
    const sId = escapeSql(staffId);
    const sId1 = escapeSql(staffId1);

    const inRows = await prisma.$queryRawUnsafe(
      `SELECT id, p_date, flag FROM ${tbl}
       WHERE (tktno='${sId}' OR tktno='${sId1}') AND DATE(p_date)='${d}'
         AND flag IN (${PUNCH_FLAGS}) ORDER BY p_date ASC LIMIT 1`,
    );
    if (inRows.length) {
      session1Id = inRows[0].id;
      fromAttPunch = inRows[0].p_date;
      bioResults.mpu = inRows[0].flag;
    }
    if (session1Id) {
      const fattStr = new Date(fromAttPunch);
      fattStr.setSeconds(fattStr.getSeconds() + 600);
      const fattIso = fattStr.toISOString().slice(0, 19).replace('T', ' ');
      const outRows = await prisma.$queryRawUnsafe(
        `SELECT p_date, flag FROM ${tbl}
         WHERE (tktno='${sId}' OR tktno='${sId1}') AND id != '${Number(session1Id)}'
           AND DATE(p_date)='${d}' AND p_date >= '${escapeSql(fattIso)}'
           AND flag IN (${PUNCH_FLAGS}) ORDER BY p_date DESC LIMIT 1`,
      );
      if (outRows.length) {
        toAttPunch = outRows[0].p_date;
        bioResults.epu = outRows[0].flag;
      }
    }

    const ffdate = fromAttPunch ? String(fromAttPunch).slice(0, 10) : attDate;
    const pyid = escapeSql(String(latePermission.pyid));
    const graceRows = await prisma.$queryRawUnsafe(
      `SELECT grace_time FROM basic_setup_payroll_graceperiod
       WHERE del=1 AND from_date <= '${escapeSql(ffdate)}' AND to_date >= '${escapeSql(ffdate)}'
         AND (payroll_id LIKE '${pyid},%' OR payroll_id LIKE '%,${pyid},%' OR payroll_id LIKE '%,${pyid}' OR payroll_id='${pyid}')
       ORDER BY from_date DESC LIMIT 1`,
    );
    const graceTime = (Number(graceRows[0]?.grace_time) || 0) * 60;
    morStartAttStr += graceTime;

    if (fromAttPunch && toAttPunch) {
      const fromAttPunchStr = tToN(new Date(fromAttPunch).toTimeString().slice(0, 8));
      const toAttPunchStr = tToN(new Date(toAttPunch).toTimeString().slice(0, 8));
      if (fromAttPunchStr <= morStartAttStr) mFlag = 'p';
      else if (fromAttPunchStr <= morStartAttStr + latePermission.late) mFlag = 'la';
      else if (fromAttPunchStr <= morStartAttStr + latePermission.permission) mFlag = 'pe';

      if (fromAttPunchStr <= eveStartAttStr && toAttPunchStr >= eveEndAttStr) eFlag = 'p';
      else if (fromAttPunchStr <= eveStartAttStr && toAttPunchStr >= eveEndAttStr - latePermission.late) eFlag = 'la';
      else if (fromAttPunchStr <= eveStartAttStr && toAttPunchStr >= eveEndAttStr - latePermission.permission) eFlag = 'pe';
    } else if (fromAttPunch) {
      const fromAttPunchStr = tToN(new Date(fromAttPunch).toTimeString().slice(0, 8));
      if (fromAttPunchStr <= morStartAttStr) mFlag = 'p';
      else if (fromAttPunchStr <= morStartAttStr + latePermission.late) mFlag = 'la';
      else if (fromAttPunchStr <= morStartAttStr + latePermission.permission) mFlag = 'pe';
    }
    if (fromAttPunch) {
      bioResults.mt = new Date(fromAttPunch).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    if (toAttPunch) {
      bioResults.et = new Date(toAttPunch).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
  }

  if (!mFlag) mFlag = 'a';
  if (!eFlag) eFlag = 'a';
  bioResults.m = mFlag;
  bioResults.e = eFlag;
  return bioResults;
}

async function getManualAtt(sid, staffId, attDate, totalDays) {
  let mTotalCounter = 0;
  let eTotalCounter = 0;
  let mFlag = '';
  let eFlag = '';
  const d = escapeSql(attDate);
  const sId = escapeSql(staffId);

  const processSession = async (pTimeFilter, sessionKey) => {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT academic_events, staff_id FROM staff_calendar_tb
       WHERE del=1 AND from_academic_date <= '${d}' AND to_academic_date >= '${d}' AND (${pTimeFilter})
       ORDER BY FIELD(p_time, ${pTimeFilter.includes('Morning') ? "'Morning','Full Day'" : "'Evening','Full Day'"})`,
    );
    for (const row of rows) {
      // Legacy staff_calendar_tb.staff_id lists carry stray whitespace / CR-LF
      // between comma-separated ids (e.g. "...,30408,\r\n30365,..."). PHP's loose
      // in_array() matches these via numeric coercion; trim so membership matches too.
      const scalStaffArray = String(row.staff_id || '').split(',').map((x) => x.trim());
      if (!scalStaffArray.includes(String(staffId).trim())) continue;
      const eventRows = await prisma.$queryRawUnsafe(
        `SELECT event_option FROM basic_event_tb WHERE del=1 AND event_name='${escapeSql(String(row.academic_events).replace(/\\/g, ''))}' ORDER BY id LIMIT 1`,
      );
      const opt = eventRows[0]?.event_option;
      let flag = '';
      let counterDelta = 0;
      if (opt === 'Holiday') { flag = 'H'; counterDelta = -0.5; }
      else if (opt === 'Present') { flag = 'p'; counterDelta = 0.5; }
      else if (opt === 'Late') { flag = 'la'; counterDelta = 0.5; }
      else if (opt === 'Permission') { flag = 'pe'; counterDelta = 0.5; }
      else if (opt === 'Absent') { flag = 'a'; counterDelta = 0.5; }
      if (sessionKey === 'm') { mFlag = flag; mTotalCounter += counterDelta; }
      else { eFlag = flag; eTotalCounter += counterDelta; }
      return true;
    }
    return false;
  };

  await processSession(`p_time='Morning' OR p_time='Full Day'`, 'm');
  await processSession(`p_time='Evening' OR p_time='Full Day'`, 'e');

  if (mTotalCounter < 0 && totalDays.m > 0) totalDays.m = 0;
  else if ((!totalDays.m || totalDays.m === 0) && mTotalCounter > 0) totalDays.m = mTotalCounter;

  if (eTotalCounter < 0 && totalDays.e > 0) totalDays.e = 0;
  else if ((!totalDays.e || totalDays.e === 0) && eTotalCounter > 0) totalDays.e = eTotalCounter;

  return { m: mFlag, e: eFlag, tc: (totalDays.m || 0) + (totalDays.e || 0) };
}

export async function getAttendance(sid, staffId, attDate, latePermission, attType = '', sharedContext = {}) {
  const scheduleType = latePermission.o?.day_type;
  let scheduleWorking = 1;
  if (Number(scheduleType) === 1) {
    const checkRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM staff_att_working WHERE del=1 AND att_date='${escapeSql(attDate)}' AND staff_id='${escapeSql(String(sid))}' LIMIT 1`,
    );
    if (!checkRows.length) scheduleWorking = 0;
  }

  const attendanceDay = localWeekdayFromIso(attDate);
  const staffLike = staffIdLikeSql(sid);
  let attendanceStatus = ['', '', ''];
  let calRows = sharedContext.calendarRow !== undefined
    ? (sharedContext.calendarRow ? [sharedContext.calendarRow] : [])
    : await prisma.$queryRawUnsafe(
      `SELECT academic_events, comments, academic_category FROM calendar_tb WHERE academic_date='${escapeSql(attDate)}' AND del=1 LIMIT 1`,
    );
  if (!calRows.length && sharedContext.calendarRow === undefined) {
    calRows = await prisma.$queryRawUnsafe(
      `SELECT academic_events, comments, '' AS academic_category
       FROM academic_calender_tb WHERE academic_date='${escapeSql(attDate)}' AND del=1 LIMIT 1`,
    );
  }
  const academicEvents1 = calRows[0]?.academic_events || '';
  const academicComments = calRows[0]?.comments || '';
  const academicCategory = calRows[0]?.academic_category || '';
  const academicEvents = String(academicEvents1).toLowerCase().slice(0, 7);

  let categoryContain = 1;
  if (academicCategory) {
    const jobCategory = sharedContext.jobCategory !== undefined
      ? sharedContext.jobCategory
      : (await prisma.$queryRawUnsafe(`SELECT job_category FROM staff_profile_tb WHERE id='${escapeSql(String(sid))}' LIMIT 1`))[0]?.job_category;
    const cats = String(academicCategory).split(',,,');
    categoryContain = cats.includes(String(jobCategory)) ? 1 : 0;
  }

  let academicEventsStr = '';
  if (academicEvents === 'holiday' && categoryContain === 1) {
    const parts = String(academicEvents1).split('-');
    academicEventsStr = parts[0]?.slice(0, 1) || '';
    if (parts[1]) academicEventsStr += parts[1].slice(0, 1);
  }

  const transportIn = await prisma.$queryRawUnsafe(
    `SELECT CAST(arrival_time AS CHAR) AS arrival_time FROM staff_att_transport_tb WHERE attendance_date='${escapeSql(attDate)}'
       AND (arrival_staff='${escapeSql(staffId)}' OR arrival_staff LIKE '${escapeSql(staffId)},%' OR arrival_staff LIKE '%,${escapeSql(staffId)}' OR arrival_staff LIKE '%,${escapeSql(staffId)},%')
       AND arrival_time != '00:00:00' AND del=1 LIMIT 1`,
  );
  const transportOut = await prisma.$queryRawUnsafe(
    `SELECT CAST(departure_time AS CHAR) AS departure_time FROM staff_att_transport_tb WHERE attendance_date='${escapeSql(attDate)}'
       AND (departure_staff='${escapeSql(staffId)}' OR departure_staff LIKE '${escapeSql(staffId)},%' OR departure_staff LIKE '%,${escapeSql(staffId)}' OR departure_staff LIKE '%,${escapeSql(staffId)},%')
       AND departure_time != '00:00:00' AND del=1 LIMIT 1`,
  );
  let transFtime = transportIn[0]?.arrival_time && transportIn[0].arrival_time !== '00:00:00' ? transportIn[0].arrival_time : '';
  let transTtime = transportOut[0]?.departure_time && transportOut[0].departure_time !== '00:00:00' ? transportOut[0].departure_time : '';

  const hrCheck = await prisma.$queryRawUnsafe(
    `SELECT B.id FROM staff_hroster AS A INNER JOIN staff_hroster_config AS B ON A.ref_id=B.id
     WHERE A.del=1 ${staffLike} AND B.del=1 AND B.from_date <= '${escapeSql(attDate)}' AND B.to_date >= '${escapeSql(attDate)}' LIMIT 1`,
  );

  let fromTime = '';
  let toTime = '';

  const applyScheduleRows = async (sql) => {
    const rows = await prisma.$queryRawUnsafe(sql);
    let hstatus = 0;
    for (const row of rows) {
      let ftime = row.from_time;
      let ttime = row.to_time;
      const attDayList = String(row.days || row[2] || '').toLowerCase().split(',');
      if (attDayList.includes(attendanceDay)) {
        if (transFtime) ftime = transFtime;
        if (transTtime) ttime = transTtime;
        attendanceStatus = ['W', ftime, ttime];
        fromTime = ftime;
        toTime = ttime;
        hstatus = 1;
      }
    }
    if (!hstatus && rows.length) attendanceStatus[0] = 'H';
    else if (!rows.length) attendanceStatus[0] = 'H';
  };

  if (hrCheck.length) {
    await applyScheduleRows(
      `SELECT CAST(A.from_time AS CHAR) AS from_time, CAST(A.to_time AS CHAR) AS to_time,
              GROUP_CONCAT(A.days SEPARATOR ',') AS days
       FROM staff_hroster AS A INNER JOIN staff_hroster_config AS B ON A.ref_id=B.id
       WHERE A.del=1 ${staffLike} AND A.from_date <= '${escapeSql(attDate)}' AND A.to_date >= '${escapeSql(attDate)}'
         AND B.del=1 AND B.from_date <= '${escapeSql(attDate)}' AND B.to_date >= '${escapeSql(attDate)}'
       GROUP BY A.att_group ORDER BY A.att_group ASC`,
    );
  } else if (((academicEvents === 'working' && categoryContain === 1) || (academicEvents === 'holiday' && categoryContain === 0)) && scheduleWorking === 1) {
    await applyScheduleRows(
      `SELECT CAST(A.from_time AS CHAR) AS from_time, CAST(A.to_time AS CHAR) AS to_time,
              GROUP_CONCAT(A.days SEPARATOR ',') AS days
       FROM staff_att_time AS A WHERE A.del=1 ${staffLike}
         AND A.from_date <= '${escapeSql(attDate)}' AND A.to_date >= '${escapeSql(attDate)}'
       GROUP BY A.att_group ORDER BY A.att_group ASC`,
    );
  } else {
    attendanceStatus[0] = 'H';
  }

  let mFlag = '';
  let eFlag = '';
  const totalDays = { m: 0, e: 0 };
  let attResults = {};
  let mattResults = {};

  if (attendanceStatus[0] === 'W') {
    let attComp = attDate;
    const compRows = await prisma.$queryRawUnsafe(
      `SELECT CAST(from_time AS CHAR) AS from_time, CAST(to_time AS CHAR) AS to_time,
              CAST(comp_date AS CHAR) AS comp_date
       FROM staff_att_comp WHERE del=1 AND staff_id='${escapeSql(String(sid))}' AND att_date='${escapeSql(attDate)}' LIMIT 1`,
    );
    if (compRows.length) {
      fromTime = compRows[0].from_time;
      toTime = compRows[0].to_time;
      attComp = compRows[0].comp_date;
      if (transFtime) fromTime = transFtime;
      if (transTtime) toTime = transTtime;
      attendanceStatus = ['W', fromTime, toTime];
    }
    attResults = await getBiomericAtt(sid, staffId, attComp, latePermission, attendanceStatus);
    mFlag = attResults.m;
    eFlag = attResults.e;
    totalDays.m = 0.5;
    totalDays.e = 0.5;
    mattResults = { ...totalDays, tc: 1 };
  }

  if (String(attType).toLowerCase() !== 'actual') {
    const manual = await getManualAtt(sid, staffId, attDate, totalDays);
    mattResults = manual;
    if (manual.m) mFlag = manual.m;
    if (manual.e) eFlag = manual.e;
  }

  const attStatus = (mFlag || eFlag) ? callAttendanceReport(mFlag, eFlag) : attendanceStatus[0];
  return {
    s: attStatus,
    m: mFlag,
    e: eFlag,
    total: mattResults.tc,
    mt: attResults.mt,
    et: attResults.et,
    mpu: attResults.mpu,
    epu: attResults.epu,
    cmd: academicComments,
    time: attendanceStatus,
    frmtime: fromTime,
    totime: toTime,
    swork: mattResults,
    h_str: academicEventsStr,
  };
}

const COLOR_FLAG = {
  a_a: '#61A300', a_p: '#E73400',
  le_a: '#61A300', le_p: '#FE9700',
  p_a: '#61A300', p_p: '#FE9700',
  h_a: '#61A300', h_p: '#E73400',
  la_a: '#230BBF', la_p: '#3341FF',
  pe_a: '#AD2589', pe_p: '#D2259F',
};
const LEAVE_TYPE_LIST = {
  a: 'Ab', la: 'La', pe: 'Pe', p: 'Pr', le: 'Le', cl: 'CL', od: 'OD', el: 'EL', lop: 'LOP', off: 'OFF', h: 'H',
};

function mapLeaveOpt(leaveOpt) {
  const lo = String(leaveOpt).toLowerCase();
  if (lo === 'lop') return 'a';
  if (lo === 'od') return 'p';
  if (lo === 'off') return 'h';
  return 'le';
}

function mapDefaulterOpt(leaveOpt, fallbackTime) {
  const lo = String(leaveOpt).toLowerCase();
  if (lo === 'lop') return { opt: 'a', time: '' };
  if (lo === 'od') return { opt: 'p', time: '' };
  if (lo === 'off' || lo === 'h') return { opt: 'h', time: '' };
  if (lo === 'cl' || lo === 'el') return { opt: 'le', time: '' };
  return { opt: leaveOpt, time: fallbackTime || '' };
}

async function fetchLeaveSession(stId, attDate, sessionFilter, statusSearch) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT r_session, m_att, status FROM att_leave_request_more
     WHERE del=1 AND req_date='${escapeSql(attDate)}' AND staff_id='${escapeSql(String(stId))}'
       AND (${sessionFilter}) ${statusSearch} LIMIT 1`,
  );
  return rows[0] || null;
}

async function fetchDefaulterSession(stId, attDate, sessionFilter, statusSearch) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT r_session, m_att, e_att, status FROM att_defaulter_more
     WHERE del=1 AND req_date='${escapeSql(attDate)}' AND staff_id='${escapeSql(String(stId))}'
       AND (${sessionFilter}) ${statusSearch} LIMIT 1`,
  );
  return rows[0] || null;
}

export async function modifiedAttendance(stId, staffId, attCurrentDate, latePermission, attendanceStatus1, rtype = 0) {
  const statusSearch = rtype === 1 ? ' AND status = 1' : ' AND status <= 1';
  const attendanceStatus = { ...attendanceStatus1 };
  const lpDetails = {};

  if (String(attendanceStatus1.m).toLowerCase() === 'la') {
    lpDetails.m = ['la', 'la_p', 'Unauthorized', attendanceStatus1.mt];
  } else if (String(attendanceStatus1.m).toLowerCase() === 'pe') {
    lpDetails.m = ['pe', 'pe_p', 'Unauthorized', attendanceStatus1.mt];
  } else if (String(attendanceStatus1.m).toLowerCase() === 'a') {
    lpDetails.m = ['a', 'a_p', 'Unauthorized', ''];
  }
  if (String(attendanceStatus1.e).toLowerCase() === 'la') {
    lpDetails.e = ['la', 'la_p', 'Unauthorized', attendanceStatus1.et];
  } else if (String(attendanceStatus1.e).toLowerCase() === 'pe') {
    lpDetails.e = ['pe', 'pe_p', 'Unauthorized', attendanceStatus1.et];
  } else if (String(attendanceStatus1.e).toLowerCase() === 'a') {
    lpDetails.e = ['a', 'a_p', 'Unauthorized', ''];
  }

  const leaveAttStatus = {};
  const defaulterAttStatus = {};
  const permissionAttStatus = { f: 0, i: 0, gs: '', gs1: '' };
  const dayFtime = attendanceStatus1.time?.[1];
  const dayTtime = attendanceStatus1.time?.[2];
  const mattResults = {};
  const dayFromTime = dayFtime ? tToN(dayFtime) : 0;
  const dayToTime = dayTtime ? tToN(dayTtime) : 0;

  const applyLeaveRow = (row, sessionKey) => {
    if (!row) return;
    const lopt = mapLeaveOpt(row.m_att);
    const lstus = Number(row.status) === 1 ? 'a' : 'p';
    if (row.r_session === 'fullday') {
      leaveAttStatus.m = lopt;
      leaveAttStatus.e = lopt;
      leaveAttStatus.ms = [String(row.m_att).toLowerCase(), `${lopt}_${lstus}`, '', ''];
      leaveAttStatus.es = [String(row.m_att).toLowerCase(), `${lopt}_${lstus}`, '', ''];
    } else if (row.r_session === 'forenoon' && sessionKey === 'm') {
      leaveAttStatus.m = lopt;
      leaveAttStatus.ms = [String(row.m_att).toLowerCase(), `${lopt}_${lstus}`, '', ''];
    } else if (row.r_session === 'afternoon' && sessionKey === 'e') {
      leaveAttStatus.e = lopt;
      leaveAttStatus.es = [String(row.m_att).toLowerCase(), `${lopt}_${lstus}`, '', ''];
    }
  };

  applyLeaveRow(await fetchLeaveSession(stId, attCurrentDate, "r_session='fullday' OR r_session='forenoon'", statusSearch), 'm');
  applyLeaveRow(await fetchLeaveSession(stId, attCurrentDate, "r_session='fullday' OR r_session='afternoon'", statusSearch), 'e');

  const applyDefaulterRow = (row, sessionKey) => {
    if (!row) return;
    const lstus = Number(row.status) === 1 ? 'a' : 'p';
    const m = mapDefaulterOpt(row.m_att, attendanceStatus1.mt);
    const e = mapDefaulterOpt(row.e_att, attendanceStatus1.et);
    if (row.r_session === 'fullday') {
      defaulterAttStatus.m = m.opt;
      defaulterAttStatus.e = e.opt;
      defaulterAttStatus.ms = [String(row.m_att).toLowerCase(), `${m.opt}_${lstus}`, 'Unauthorized', m.time];
      defaulterAttStatus.es = [String(row.e_att).toLowerCase(), `${e.opt}_${lstus}`, 'Unauthorized', e.time];
    } else if (row.r_session === 'forenoon' && sessionKey === 'm') {
      defaulterAttStatus.m = m.opt;
      defaulterAttStatus.ms = [String(row.m_att).toLowerCase(), `${m.opt}_${lstus}`, 'Unauthorized', m.time];
    } else if (row.r_session === 'afternoon' && sessionKey === 'e') {
      defaulterAttStatus.e = e.opt;
      defaulterAttStatus.es = [String(row.e_att).toLowerCase(), `${e.opt}_${lstus}`, 'Unauthorized', e.time];
    }
  };

  applyDefaulterRow(await fetchDefaulterSession(stId, attCurrentDate, "r_session='fullday' OR r_session='forenoon'", statusSearch), 'm');
  applyDefaulterRow(await fetchDefaulterSession(stId, attCurrentDate, "r_session='fullday' OR r_session='afternoon'", statusSearch), 'e');

  const permRows = await prisma.$queryRawUnsafe(
    `SELECT from_date, to_date, status FROM att_permission_request
     WHERE del=1 AND DATE(from_date)='${escapeSql(attCurrentDate)}' AND DATE(to_date)='${escapeSql(attCurrentDate)}'
       AND staff_id='${escapeSql(String(stId))}' ${statusSearch}`,
  );
  for (const row of permRows) {
    const lstus = Number(row.status) === 1 ? 'a' : 'p';
    const statusTxt = Number(row.status) === 1 ? 'Approved' : 'Applied';
    const lFtime = tToN(new Date(row.from_date).toTimeString().slice(0, 8));
    const lTtime = tToN(new Date(row.to_date).toTimeString().slice(0, 8));
    const dateStr = `${new Date(row.from_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} to ${new Date(row.to_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    if (dayFromTime > 0 && dayToTime > 0 && dayFromTime >= lFtime && dayToTime <= lTtime) {
      permissionAttStatus.f = 1;
      permissionAttStatus.m = 'p';
      permissionAttStatus.e = 'p';
      permissionAttStatus.ms = ['pe', `p_${lstus}`, '', dateStr];
      permissionAttStatus.es = ['pe', `p_${lstus}`, '', dateStr];
    } else if (dayFromTime > 0 && dayFromTime >= lFtime && dayFromTime <= lTtime) {
      permissionAttStatus.m = 'pe';
      permissionAttStatus.ms = ['pe', `pe_${lstus}`, '', dateStr];
    } else if (dayToTime > 0 && dayToTime >= lFtime && dayToTime <= lTtime) {
      permissionAttStatus.e = 'pe';
      permissionAttStatus.es = ['pe', `pe_${lstus}`, '', dateStr];
    } else if (permissionAttStatus.f !== 1) {
      permissionAttStatus.i += 1;
      const atClr = COLOR_FLAG[`pe_${lstus}`];
      permissionAttStatus.gs += `<span style="color:${atClr}">Authorized: Pe ${dateStr} (${statusTxt})</span>, `;
      permissionAttStatus.gs1 += 'Pe, ';
    }
  }

  attendanceStatus.pe = (permissionAttStatus.f || 0) + (permissionAttStatus.i || 0);
  if (leaveAttStatus.m) {
    attendanceStatus.m = leaveAttStatus.m;
    mattResults.m = 0.5;
    lpDetails.m = leaveAttStatus.ms;
    attendanceStatus.msrc = 'lr';
  } else {
    if (defaulterAttStatus.m) {
      mattResults.m = 0.5;
      attendanceStatus.m = defaulterAttStatus.m;
      lpDetails.m = defaulterAttStatus.ms;
      attendanceStatus.msrc = 'dr';
    }
    if (attendanceStatus.m !== 'p' && attendanceStatus.m !== 'le' && permissionAttStatus.m) {
      mattResults.m = 0.5;
      attendanceStatus.m = permissionAttStatus.m;
      lpDetails.m = permissionAttStatus.ms;
      attendanceStatus.msrc = 'pr';
    }
  }

  if (leaveAttStatus.e) {
    mattResults.e = 0.5;
    attendanceStatus.e = leaveAttStatus.e;
    lpDetails.e = leaveAttStatus.es;
    attendanceStatus.esrc = 'lr';
  } else {
    if (defaulterAttStatus.e) {
      mattResults.e = 0.5;
      attendanceStatus.e = defaulterAttStatus.e;
      lpDetails.e = defaulterAttStatus.es;
      attendanceStatus.esrc = 'dr';
    }
    if (attendanceStatus.e !== 'p' && attendanceStatus.e !== 'le' && permissionAttStatus.e) {
      mattResults.e = 0.5;
      attendanceStatus.e = permissionAttStatus.e;
      lpDetails.e = permissionAttStatus.es;
      attendanceStatus.esrc = 'pr';
    }
  }

  let attTotal = 0;
  if (attendanceStatus.m !== 'h') attTotal += mattResults.m || 0;
  if (attendanceStatus.e !== 'h') attTotal += mattResults.e || 0;
  if (attendanceStatus.m === 'h' && attendanceStatus.e === 'h') attendanceStatus.total = 0;
  else if (attTotal > 0) {
    attendanceStatus.total = attTotal;
    attendanceStatus.s = 'W';
  }

  let attInfo = permissionAttStatus.gs || '';
  let attInfo1 = permissionAttStatus.gs1 || '';
  const leaveOptInfo = {};
  if (lpDetails.m?.[0] === lpDetails.e?.[0] && lpDetails.m?.[1] === lpDetails.e?.[1] && lpDetails.m?.[0]) {
    const atClr = COLOR_FLAG[lpDetails.m[1]];
    let detail = lpDetails.m[3];
    if (String(lpDetails.m[1]).endsWith('a')) detail += ' (Approved)';
    const atLvopt = LEAVE_TYPE_LIST[lpDetails.m[0]];
    attInfo += `<span style="color:${atClr}">${lpDetails.m[2] ? `${lpDetails.m[2]}: ` : ''}${atLvopt}${detail ? ` - ${detail}` : ''}</span>, `;
    attInfo1 += `${atLvopt}, `;
    leaveOptInfo.m = lpDetails.m[0];
    leaveOptInfo.e = lpDetails.m[0];
  } else {
    if (lpDetails.m?.[0]) {
      const atClr = COLOR_FLAG[lpDetails.m[1]];
      let detail = lpDetails.m[3];
      if (String(lpDetails.m[1]).endsWith('a')) detail += ' (Approved)';
      attInfo += `<span style="color:${atClr}">${lpDetails.m[2] ? `${lpDetails.m[2]}: ` : ''}FN: ${LEAVE_TYPE_LIST[lpDetails.m[0]]}${detail ? ` - ${detail}` : ''}</span>, `;
      attInfo1 += `FN:${LEAVE_TYPE_LIST[lpDetails.m[0]]}, `;
      leaveOptInfo.m = lpDetails.m[0];
    }
    if (lpDetails.e?.[0]) {
      const atClr = COLOR_FLAG[lpDetails.e[1]];
      let detail = lpDetails.e[3];
      if (String(lpDetails.e[1]).endsWith('a')) detail += ' (Approved)';
      attInfo += `<span style="color:${atClr}">${lpDetails.e[2] ? `${lpDetails.e[2]}: ` : ''}AN: ${LEAVE_TYPE_LIST[lpDetails.e[0]]}${detail ? ` - ${detail}` : ''}</span>, `;
      attInfo1 += `AN:${LEAVE_TYPE_LIST[lpDetails.e[0]]}, `;
      leaveOptInfo.e = lpDetails.e[0];
    }
  }
  if (attInfo) {
    attendanceStatus.minfo = attInfo.replace(/, $/, '');
    attendanceStatus.msinfo = attInfo1.replace(/, $/, '');
  }
  attendanceStatus.attopt = leaveOptInfo;
  return attendanceStatus;
}

export async function calDefaulterPending(stId, staffId, latePermission, fromDate, toDate, astatus = 1) {
  const attFromDate = new Date(`${fromDate}T00:00:00`);
  attFromDate.setDate(attFromDate.getDate() - 10);
  const attToDate = new Date(`${toDate}T00:00:00`);
  const statusString = astatus === 1 ? ' AND status=1 ' : ' AND status<=1 ';
  let attCurrentDate = attFromDate.toISOString().slice(0, 10);
  let previousAttendanceStatus = '';
  let attSatus = {};
  const attDefaulter = [];
  const workingDay = [];
  const lopDay = { m: [], e: [] };

  for (let m = attFromDate.getTime(); m <= attToDate.getTime(); m += 86400000) {
    attCurrentDate = new Date(m).toISOString().slice(0, 10);
    const attendanceStatus = await getAttendance(stId, staffId, attCurrentDate, latePermission);
    const pflag = {};

    const leaveM = await prisma.$queryRawUnsafe(
      `SELECT id FROM att_leave_request_more WHERE del=1 AND req_date='${escapeSql(attCurrentDate)}' AND staff_id='${escapeSql(String(stId))}' AND (r_session='fullday' OR r_session='forenoon') ${statusString} LIMIT 1`,
    );
    if (leaveM.length) { pflag.m = 1; attendanceStatus.m = 'le'; }
    const leaveE = await prisma.$queryRawUnsafe(
      `SELECT id FROM att_leave_request_more WHERE del=1 AND req_date='${escapeSql(attCurrentDate)}' AND staff_id='${escapeSql(String(stId))}' AND (r_session='fullday' OR r_session='afternoon') ${statusString} LIMIT 1`,
    );
    if (leaveE.length) { pflag.e = 1; attendanceStatus.e = 'le'; }

    const dayFtime = attendanceStatus.time?.[1];
    const dayTtime = attendanceStatus.time?.[2];
    if (dayFtime && dayTtime) {
      const dayFromTime = tToN(dayFtime);
      const dayToTime = tToN(dayTtime);
      const permissionAttStatus = {};
      const permRows = await prisma.$queryRawUnsafe(
        `SELECT from_date, to_date FROM att_permission_request WHERE del=1 AND DATE(from_date)='${escapeSql(attCurrentDate)}' AND DATE(to_date)='${escapeSql(attCurrentDate)}' AND staff_id='${escapeSql(String(stId))}' ${statusString}`,
      );
      for (const row of permRows) {
        const lFtime = tToN(new Date(row.from_date).toTimeString().slice(0, 8));
        const lTtime = tToN(new Date(row.to_date).toTimeString().slice(0, 8));
        if (dayFromTime > 0 && dayToTime > 0 && dayFromTime >= lFtime && dayToTime <= lTtime) {
          permissionAttStatus.m = 'p';
          permissionAttStatus.e = 'p';
        } else if (dayFromTime > 0 && dayFromTime >= lFtime && dayFromTime <= lTtime) {
          permissionAttStatus.m = 'p';
        } else if (dayToTime > 0 && dayToTime >= lFtime && dayToTime <= lTtime) {
          permissionAttStatus.e = 'p';
        }
      }
      if (!pflag.m && permissionAttStatus.m) attendanceStatus.m = 'p';
      if (!pflag.e && permissionAttStatus.e) attendanceStatus.e = 'p';
    }

    if (String(attendanceStatus.s).toLowerCase() !== 'h') {
      if (m !== attToDate.getTime()) workingDay.push(dayEpoch(m));
      const trackSession = (sessionVal, sessionLabel) => {
        const lower = String(sessionVal).toLowerCase();
        if (lower === previousAttendanceStatus) {
          attSatus.to = { date: attCurrentDate, session: sessionLabel };
        } else {
          if (attSatus.from) attDefaulter.push({ ...attSatus });
          previousAttendanceStatus = lower;
          attSatus = {
            from: { date: attCurrentDate, session: sessionLabel },
            to: { date: attCurrentDate, session: sessionLabel },
            type: previousAttendanceStatus,
          };
        }
      };
      trackSession(attendanceStatus.m, 'FN');
      trackSession(attendanceStatus.e, 'AN');
    }
  }

  let lastWorkingDay = attFromDate.toISOString().slice(0, 10);
  if (workingDay.length) {
    attDefaulter.push(attSatus);
    workingDay.sort((a, b) => b - a);
    const lpday = Number(latePermission.defaulter_apply) - 1;
    if (lpday >= 0 && workingDay[lpday]) {
      lastWorkingDay = new Date(workingDay[lpday] * 1000).toISOString().slice(0, 10);
    }
  }

  for (const aSatus of attDefaulter) {
    if (!aSatus.from || aSatus.type !== 'a') continue;
    if (new Date(aSatus.to.date) < new Date(lastWorkingDay)) continue;
    const rowRequest = await prisma.$queryRawUnsafe(
      `SELECT id FROM att_defaulter WHERE del=1 AND staff_id='${escapeSql(String(stId))}'
         AND from_date='${escapeSql(aSatus.from.date)}' AND to_date='${escapeSql(aSatus.to.date)}'
         AND f_session='${escapeSql(aSatus.from.session)}' AND leave_type='a' ${statusString} LIMIT 1`,
    );
    if (rowRequest.length) continue;

    const deFrom = new Date(`${aSatus.from.date}T00:00:00`);
    const deTo = new Date(`${aSatus.to.date}T00:00:00`);
    for (let dm = deFrom.getTime(); dm <= deTo.getTime(); dm += 86400000) {
      const deCurrent = new Date(dm).toISOString().slice(0, 10);
      if (dm === deFrom.getTime() && aSatus.from.session === 'FN') {
        lopDay.m.push(dayEpoch(dm));
        lopDay.e.push(dayEpoch(dm));
      } else if (dm === deFrom.getTime() && aSatus.from.session === 'AN') {
        lopDay.e.push(dayEpoch(dm));
      } else if (dm === deTo.getTime() && aSatus.to.session === 'FN') {
        lopDay.m.push(dayEpoch(dm));
      } else if (dm === deTo.getTime() && aSatus.to.session === 'AN') {
        lopDay.m.push(dayEpoch(dm));
        lopDay.e.push(dayEpoch(dm));
      } else if (dm !== deFrom.getTime() && dm !== deTo.getTime()) {
        lopDay.m.push(dayEpoch(dm));
        lopDay.e.push(dayEpoch(dm));
      }
    }
  }
  return lopDay;
}

export async function getStaffOrder() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT GROUP_CONCAT(s_order SEPARATOR \', \') AS ord FROM staff_order',
  );
  let result = String(rows[0]?.ord || '').trim();
  if (result.endsWith(',')) result = result.slice(0, -1);
  return result;
}

function diffYears(fromDate, toDate) {
  const d1 = new Date(fromDate);
  const d2 = new Date(toDate);
  let years = d1.getFullYear() - d2.getFullYear();
  const m = d1.getMonth() - d2.getMonth();
  if (m < 0 || (m === 0 && d1.getDate() < d2.getDate())) years -= 1;
  return Math.max(0, years);
}

function diffMonthsInclusive(fromDate, toDate) {
  const d1 = new Date(fromDate);
  const d2 = new Date(toDate);
  return (d1.getFullYear() - d2.getFullYear()) * 12 + (d1.getMonth() - d2.getMonth()) + 1;
}

export async function getAvailableLeave(stId, clMonth, latePermission, exceptDate = '', exceptId = []) {
  const currentDate = toIsoDate(clMonth) || new Date().toISOString().slice(0, 10);
  const currentYear = new Date(currentDate).getFullYear();
  const currentDay = new Date(currentDate).getDate();
  const lp = { ...latePermission };
  if (!lp.academic_start) lp.academic_start = '01-01';
  if (!lp.payroll_start) lp.payroll_start = '01';

  let clMonthStart;
  let clMonthLast;
  if (currentDay >= Number(lp.payroll_start)) {
    clMonthStart = `${currentDate.slice(0, 7)}-${String(lp.payroll_start).padStart(2, '0')}`;
    const d = new Date(clMonthStart);
    d.setMonth(d.getMonth() + 1);
    d.setDate(d.getDate() - 1);
    clMonthLast = d.toISOString().slice(0, 10);
  } else {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    clMonthStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lp.payroll_start).padStart(2, '0')}`;
    const d2 = new Date(clMonthStart);
    d2.setMonth(d2.getMonth() + 1);
    d2.setDate(d2.getDate() - 1);
    clMonthLast = d2.toISOString().slice(0, 10);
  }

  const joinRows = await prisma.$queryRawUnsafe(
    `SELECT IF(joined_date='0000-00-00', '', CAST(joined_date AS CHAR)) AS joined_date
     FROM staff_profile_tb WHERE del=1 AND id='${escapeSql(String(stId))}' LIMIT 1`,
  );
  let joinedDate = joinRows[0]?.joined_date || '2016-01-01';
  if (!joinedDate) joinedDate = '2016-01-01';

  const academicStartTmp = `${currentYear}-${lp.academic_start}`;
  let academicStart = new Date(academicStartTmp) <= new Date(currentDate)
    ? academicStartTmp
    : new Date(new Date(academicStartTmp).setFullYear(currentYear - 1)).toISOString().slice(0, 10);

  if (new Date(joinedDate) > new Date(academicStart)) {
    const jd = new Date(joinedDate);
    academicStart = `${jd.getFullYear()}-${String(jd.getMonth() + 1).padStart(2, '0')}-${String(new Date(academicStart).getDate()).padStart(2, '0')}`;
  }

  const elYears = diffYears(new Date(), joinedDate);
  const yearlyEl = lp.o?.yearly_el ?? lp.yearly_el;
  const monthlyLeave = lp.o?.monthly_leave ?? lp.monthly_leave ?? lp.o?.minimum_leave;
  const maxOd = lp.o?.max_od ?? lp.max_od;

  let availableEl = 'Unlimited';
  if (yearlyEl !== '-1' && yearlyEl != null) {
    if (elYears >= 1) availableEl = Number(yearlyEl);
    else if (elYears === 0) availableEl = 0;
  }

  const actualStart = new Date(joinedDate) > new Date(academicStart) ? joinedDate : academicStart;
  const totalMonths = diffMonthsInclusive(clMonthLast, actualStart);
  let availableCl = monthlyLeave !== '-1' && monthlyLeave != null ? totalMonths * Number(monthlyLeave) : 'Unlimited';
  let availableOd = maxOd !== '-1' && maxOd != null ? Number(maxOd) : 'Unlimited';

  const compRows = await prisma.$queryRawUnsafe(
    `SELECT comp_cl, comp_el, comp_od FROM staff_att_cl WHERE del=1 AND staff_id='${escapeSql(String(stId))}' LIMIT 1`,
  );
  const mCl = compRows[0]?.comp_cl ?? '';
  const mEl = compRows[0]?.comp_el ?? '';
  const mOd = compRows[0]?.comp_od ?? '';

  const availableBreak = new Date(`2025-01-${String(lp.payroll_start).padStart(2, '0')}`);
  availableBreak.setDate(availableBreak.getDate() - 1);
  const availableBreakEl = `2025-03-${String(lp.payroll_start).padStart(2, '0')}`;

  if (yearlyEl !== '-1' && mEl !== '') {
    const elDiffBreak = diffYears(new Date(availableBreakEl), joinedDate);
    if (elDiffBreak >= 1) {
      const mElAvailable = Number(yearlyEl) - Number(mEl);
      if (mElAvailable <= availableEl) availableEl = Number(availableEl) - mElAvailable;
    }
  }

  if (new Date(academicStart) <= availableBreak) {
    if (monthlyLeave !== '-1' && mCl !== '') {
      const breakMonths = diffMonthsInclusive(availableBreak.toISOString().slice(0, 10), academicStart);
      availableCl = ((totalMonths - breakMonths) * Number(monthlyLeave)) + Number(mCl);
    }
    if (maxOd !== '-1' && mOd !== '') availableOd = Number(mOd);
  }

  const leaveExcept = exceptId[0] ? ` AND request_id!='${escapeSql(String(exceptId[0]))}'` : '';
  const defaulterExcept = exceptId[1] ? ` AND request_id!='${escapeSql(String(exceptId[1]))}'` : '';
  const sid = escapeSql(String(stId));
  const acStart = escapeSql(academicStart);
  const clEnd = escapeSql(clMonthLast);
  const clStart = escapeSql(clMonthStart);

  if (availableEl !== 'Unlimited') {
    const elLr = await prisma.$queryRawUnsafe(
      `SELECT IFNULL(SUM(el_days),0) AS s FROM att_leave_request_more WHERE del=1 AND req_date>='${acStart}' AND req_date<='${clEnd}' AND staff_id='${sid}' AND status<=1${leaveExcept}`,
    );
    const elDf = await prisma.$queryRawUnsafe(
      `SELECT IFNULL(SUM(el_days),0) AS s FROM att_defaulter_more WHERE del=1 AND req_date>='${acStart}' AND req_date<='${clEnd}' AND staff_id='${sid}' AND status<=1${defaulterExcept}`,
    );
    availableEl = Number(availableEl) - Number(elLr[0]?.s || 0) - Number(elDf[0]?.s || 0);
  }

  const lrDate = new Date(currentDate) < new Date(clMonthLast) ? currentDate : clMonthLast;
  const offRoster = await prisma.$queryRawUnsafe(
    `SELECT IFNULL(SUM(total_working),0) AS s FROM staff_hroster WHERE del=1 AND from_date>='2016-10-21' AND off_cal=1 AND to_date<='${escapeSql(lrDate)}' AND (staff_id='${sid}' OR staff_id LIKE '%,${sid}' OR staff_id LIKE '${sid},%' OR staff_id LIKE '%,${sid},%')`,
  );
  let availableOff = Number(offRoster[0]?.s || 0);
  const offLr = await prisma.$queryRawUnsafe(
    `SELECT IFNULL(SUM(off_days),0) AS s FROM att_leave_request_more WHERE del=1 AND req_date<='${clEnd}' AND staff_id='${sid}' AND status<=1${leaveExcept}`,
  );
  const offDf = await prisma.$queryRawUnsafe(
    `SELECT IFNULL(SUM(off_days),0) AS s FROM att_defaulter_more WHERE del=1 AND req_date<='${clEnd}' AND staff_id='${sid}' AND status<=1${defaulterExcept}`,
  );
  availableOff -= Number(offLr[0]?.s || 0) + Number(offDf[0]?.s || 0);

  const clOdLr = await prisma.$queryRawUnsafe(
    `SELECT IFNULL(SUM(cl_days),0) AS cl, IFNULL(SUM(od_days),0) AS od FROM att_leave_request_more WHERE del=1 AND req_date>='${acStart}' AND req_date<='${clEnd}' AND staff_id='${sid}' AND status<=1${leaveExcept}`,
  );
  const clOdDf = await prisma.$queryRawUnsafe(
    `SELECT IFNULL(SUM(cl_days),0) AS cl, IFNULL(SUM(od_days),0) AS od FROM att_defaulter_more WHERE del=1 AND req_date>='${acStart}' AND req_date<='${clEnd}' AND staff_id='${sid}' AND status<=1${defaulterExcept}`,
  );
  if (availableCl !== 'Unlimited') {
    availableCl = Number(availableCl) - Number(clOdLr[0]?.cl || 0) - Number(clOdDf[0]?.cl || 0);
  }
  if (availableOd !== 'Unlimited') {
    availableOd = Number(availableOd) - Number(clOdLr[0]?.od || 0) - Number(clOdDf[0]?.od || 0);
  }

  const mLr = await prisma.$queryRawUnsafe(
    `SELECT IFNULL(SUM(cl_days),0) AS cl, IFNULL(SUM(el_days),0) AS el, IFNULL(SUM(od_days),0) AS od, IFNULL(SUM(off_days),0) AS off
     FROM att_leave_request_more WHERE del=1 AND req_date>='${clStart}' AND req_date<='${clEnd}' AND staff_id='${sid}' AND status<=1${leaveExcept}`,
  );
  const mDf = await prisma.$queryRawUnsafe(
    `SELECT IFNULL(SUM(cl_days),0) AS cl, IFNULL(SUM(el_days),0) AS el, IFNULL(SUM(od_days),0) AS od, IFNULL(SUM(off_days),0) AS off
     FROM att_defaulter_more WHERE del=1 AND req_date>='${clStart}' AND req_date<='${clEnd}' AND staff_id='${sid}' AND status<=1${defaulterExcept}`,
  );

  const clamp = (v) => (v < 0 ? 0 : v);
  return {
    a_cl: clamp(availableCl === 'Unlimited' ? availableCl : Number(availableCl)),
    a_el: clamp(availableEl === 'Unlimited' ? availableEl : Number(availableEl)),
    a_od: clamp(availableOd === 'Unlimited' ? availableOd : Number(availableOd)),
    a_off: clamp(availableOff),
    m_cl: Number(mLr[0]?.cl || 0) + Number(mDf[0]?.cl || 0),
    m_el: Number(mLr[0]?.el || 0) + Number(mDf[0]?.el || 0),
    m_od: Number(mLr[0]?.od || 0) + Number(mDf[0]?.od || 0),
    m_off: Number(mLr[0]?.off || 0) + Number(mDf[0]?.off || 0),
  };
}

function toIsoDate(value) {
  if (!value) return null;
  if (/^\d{2}-\d{2}-\d{4}$/.test(String(value))) {
    const [dd, mm, yyyy] = String(value).split('-');
    return `${yyyy}-${mm}-${dd}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export async function fetchPunchInOut(staffId, curDate) {
  const staffId1 = `0${staffId}`;
  const tbl = punchTableName(curDate);
  const d = escapeSql(curDate);
  const sId = escapeSql(staffId);
  const sId1 = escapeSql(staffId1);
  let fromAttPunch = '';
  let toAttPunch = '';
  let fromFlag = '';
  let toFlag = '';
  let session1Id = '';

  const inRows = await prisma.$queryRawUnsafe(
    `SELECT id, p_date, flag FROM ${tbl}
     WHERE (tktno='${sId}' OR tktno='${sId1}') AND p_date LIKE '${d}%'
       AND flag IN (${PUNCH_FLAGS}) ORDER BY p_date ASC LIMIT 1`,
  );
  if (inRows.length) {
    session1Id = inRows[0].id;
    fromAttPunch = inRows[0].p_date;
    fromFlag = inRows[0].flag;
  }
  if (session1Id) {
    const fattStr = new Date(fromAttPunch);
    fattStr.setSeconds(fattStr.getSeconds() + 600);
    const fattIso = fattStr.toISOString().slice(0, 19).replace('T', ' ');
    const outRows = await prisma.$queryRawUnsafe(
      `SELECT p_date, flag FROM ${tbl}
       WHERE (tktno='${sId}' OR tktno='${sId1}') AND id != '${Number(session1Id)}'
         AND p_date LIKE '${d}%' AND p_date >= '${escapeSql(fattIso)}'
         AND flag IN (${PUNCH_FLAGS}) ORDER BY p_date DESC LIMIT 1`,
    );
    if (outRows.length) {
      toAttPunch = outRows[0].p_date;
      toFlag = outRows[0].flag;
    }
  }
  return { fromAttPunch, toAttPunch, fromFlag, toFlag };
}
