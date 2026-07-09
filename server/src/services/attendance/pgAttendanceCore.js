import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { tToN } from './staffAttendanceCore.js';

const COLOR_FLAG = {
  a_a: '#61A300', a_p: '#E73400',
  le_a: '#61A300', le_p: '#FE9700',
  p_a: '#61A300', p_p: '#FE9700',
  h_a: '#61A300', h_p: '#E73400',
  la_a: '#230BBF', la_p: '#3341FF',
  pe_a: '#AD2589', pe_p: '#D2259F',
};

const LEAVE_TYPE_LIST = {
  a: 'Ab', ab: 'Ab', la: 'La', pe: 'Pe', p: 'Pr', le: 'Le', cl: 'CL', od: 'OD', el: 'EL', lop: 'LOP', off: 'OFF', h: 'H',
};

const roomMachineCache = new Map();

/** Legacy t_to_m — hours:minutes to total minutes (no seconds). */
export function tToM(time) {
  if (!time) return 0;
  const parts = String(time).split(':');
  return (Number(parts[0]) * 60) + Number(parts[1]) + 0;
}

/** Legacy t_to_s — hours:minutes:seconds to total seconds. */
export function tToS(time) {
  if (!time) return 0;
  const parts = String(time).split(':');
  return (Number(parts[0]) * 3600) + (Number(parts[1]) * 60) + Number(parts[2] || 0);
}

export function punchTableName(attDate) {
  const d = new Date(`${String(attDate).slice(0, 10)}T12:00:00`);
  const year = d.getFullYear();
  const quarter = Math.ceil((d.getMonth() + 1) / 4);
  return `punchtimedetails_${year}${quarter}`;
}

export function listContainsRegister(listStr, registerNo) {
  const reg = String(registerNo).toLowerCase();
  return String(listStr || '').split(',').some((part) => part.trim().toLowerCase() === reg);
}

function registerLikeSql(column, registerNo) {
  const r = escapeSql(String(registerNo));
  return `(${column}='${r}' OR ${column} LIKE '${r},%' OR ${column} LIKE '%,${r}' OR ${column} LIKE '%,${r},%')`;
}

function localWeekdayFromIso(dateIso) {
  const [y, m, d] = String(dateIso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toLocaleDateString('en-US', { weekday: 'long' });
}

function formatPunchDisplay(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatTimeHms(epochMs) {
  if (!epochMs || Number.isNaN(epochMs)) return '';
  const dt = new Date(epochMs);
  return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}:${String(dt.getSeconds()).padStart(2, '0')}`;
}

function normalizeSqlTime(value) {
  if (!value) return '00:00:00';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(11, 19);
  }
  const raw = String(value).trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?/.test(raw)) {
    const parts = raw.split(':');
    return `${String(parts[0]).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}:${String(parts[2] || '0').padStart(2, '0')}`;
  }
  const dt = new Date(value);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(11, 19);
  return '00:00:00';
}

function formatSqlDateTimeFromMs(epochMs) {
  if (!epochMs || Number.isNaN(epochMs)) return '';
  return new Date(epochMs).toISOString().slice(0, 19).replace('T', ' ');
}

export async function getStudentLPTime() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id,
            CAST(permission_time AS CHAR) AS permission_time,
            CAST(late_time AS CHAR) AS late_time,
            CAST(sat_time AS CHAR) AS sat_time,
            minimum_permission, minimum_late, defaulter_apply, leave_apply_days, od_type
     FROM basic_setup_stuatt
     WHERE id = '1'
     LIMIT 1`,
  );
  return rows[0] || {};
}

function machineFilterFromRoomRow(row) {
  let machineArrayString = '';
  for (const src of [row.machine_id, row.room_name]) {
    for (const mid of String(src || '').split(',')) {
      const m = mid.trim();
      if (m) machineArrayString += ` flag='${escapeSql(m)}' OR`;
    }
  }
  return machineArrayString ? ` AND (${machineArrayString.slice(0, -2)})` : '';
}

export async function bulkLoadMachineFiltersForRooms(roomIds) {
  const machineByRoom = new Map();
  const missing = [];
  for (const roomId of roomIds) {
    const key = String(roomId || '');
    if (!key) continue;
    if (roomMachineCache.has(key)) {
      machineByRoom.set(key, roomMachineCache.get(key));
    } else {
      missing.push(key);
    }
  }
  if (!missing.length) return machineByRoom;

  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, machine_id, room_name FROM rooms_tb
     WHERE del = 1 AND id IN (${missing.map((id) => `'${escapeSql(id)}'`).join(',')})`,
  );
  const found = new Set();
  for (const row of rows) {
    const key = String(row.id);
    const filter = machineFilterFromRoomRow(row);
    roomMachineCache.set(key, filter);
    machineByRoom.set(key, filter);
    found.add(key);
  }
  for (const id of missing) {
    if (!found.has(id)) {
      roomMachineCache.set(id, '');
      machineByRoom.set(id, '');
    }
  }
  return machineByRoom;
}

export async function buildMachineFilterForRoom(roomNo) {
  const key = String(roomNo || '');
  if (!key) return '';
  if (roomMachineCache.has(key)) return roomMachineCache.get(key);

  const rows = await prisma.$queryRawUnsafe(
    `SELECT machine_id, room_name FROM rooms_tb WHERE del = 1 AND id = '${escapeSql(key)}' LIMIT 1`,
  );
  const row = rows[0];
  if (!row) {
    roomMachineCache.set(key, '');
    return '';
  }

  const filter = machineFilterFromRoomRow(row);
  roomMachineCache.set(key, filter);
  return filter;
}

async function fetchPgManualLists(attDate) {
  const d = escapeSql(attDate);
  const [inRows, outRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT att_absent, att_present FROM student_pgatt_tb
       WHERE del = 1 AND academic_date = '${d}' AND att_period = 'in' LIMIT 1`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT att_absent, att_present FROM student_pgatt_tb
       WHERE del = 1 AND academic_date = '${d}' AND att_period = 'out' LIMIT 1`,
    ),
  ]);
  return manualListsFromRows(inRows[0], outRows[0]);
}

export function manualListsFromRows(inRow, outRow) {
  return {
    inAbsent: String(inRow?.att_absent || '').toLowerCase().split(','),
    inPresent: String(inRow?.att_present || '').toLowerCase().split(','),
    outAbsent: String(outRow?.att_absent || '').toLowerCase().split(','),
    outPresent: String(outRow?.att_present || '').toLowerCase().split(','),
  };
}

export function punchTablesForRange(fromIso, toIso) {
  const tables = new Set();
  for (
    let ts = new Date(`${fromIso}T00:00:00`);
    ts <= new Date(`${toIso}T00:00:00`);
    ts.setDate(ts.getDate() + 1)
  ) {
    tables.add(punchTableName(ts.toISOString().slice(0, 10)));
  }
  return [...tables];
}

export async function bulkLoadPunchesByRollDate(registerNos, fromIso, toIso) {
  const punchesByRollDate = new Map();
  if (!registerNos.length) return punchesByRollDate;

  const rollIn = registerNos.map((r) => `'${escapeSql(r)}'`).join(',');
  const tables = punchTablesForRange(fromIso, toIso);
  const punchRows = await Promise.all(tables.map((tbl) => prisma.$queryRawUnsafe(
    `SELECT tktno, flag, p_date FROM ${tbl}
     WHERE DATE(p_date) >= '${escapeSql(fromIso)}' AND DATE(p_date) <= '${escapeSql(toIso)}'
       AND tktno IN (${rollIn})
     ORDER BY p_date ASC`,
  ).catch(() => [])));

  for (const rows of punchRows) {
    for (const punch of rows) {
      const dateIso = String(punch.p_date).slice(0, 10);
      const key = `${punch.tktno}:${dateIso}`;
      if (!punchesByRollDate.has(key)) punchesByRollDate.set(key, []);
      punchesByRollDate.get(key).push({ p_date: punch.p_date, flag: punch.flag });
    }
  }
  return punchesByRollDate;
}

function applyManualPgStatus(attendanceStatus, registerNo, lists, internInRef, internOutRef) {
  const creg = String(registerNo).toLowerCase();
  if (lists.inPresent.includes(creg)) {
    attendanceStatus.m = 'p';
    internInRef.value = 1;
  } else if (lists.inAbsent.includes(creg)) {
    attendanceStatus.m = 'a';
    internInRef.value = 1;
  }
  if (lists.outPresent.includes(creg)) {
    attendanceStatus.e = 'p';
    internOutRef.value = 1;
  } else if (lists.outAbsent.includes(creg)) {
    attendanceStatus.e = 'a';
    internOutRef.value = 1;
  }
}

function classifyInPunch(itime, fPresent, fLate, fPermission) {
  if (itime <= fPresent) return 'p';
  if (itime <= fLate) return 'la';
  if (itime <= fPermission) return 'pe';
  return 'a';
}

function classifyOutPunch(otime, tPresent, tLate, tPermission) {
  if (otime >= tPresent) return 'p';
  if (otime >= tLate) return 'la';
  if (otime >= tPermission) return 'pe';
  return 'a';
}

function machineFlagsFromFilter(machineId) {
  if (!machineId) return null;
  const flags = new Set();
  const re = /flag='([^']+)'/g;
  let match = re.exec(machineId);
  while (match) {
    flags.add(match[1]);
    match = re.exec(machineId);
  }
  return flags.size ? flags : null;
}

function punchMatchesMachine(punch, flagSet) {
  if (!flagSet) return true;
  return flagSet.has(String(punch?.flag || ''));
}

function findPunchInFromList(punches, internInFrom, machineId) {
  if (!punches?.length) return null;
  const flagSet = machineFlagsFromFilter(machineId);
  const cutoff = new Date(internInFrom).getTime();
  let best = null;
  let bestTime = Infinity;
  for (const punch of punches) {
    if (!punchMatchesMachine(punch, flagSet)) continue;
    const time = new Date(punch.p_date).getTime();
    if (time <= cutoff && time < bestTime) {
      bestTime = time;
      best = punch.p_date;
    }
  }
  return best;
}

function findPunchOutFromList(punches, internInTo, machineId) {
  if (!punches?.length) return null;
  const flagSet = machineFlagsFromFilter(machineId);
  const cutoff = new Date(internInTo).getTime();
  let best = null;
  let bestTime = -Infinity;
  for (const punch of punches) {
    if (!punchMatchesMachine(punch, flagSet)) continue;
    const time = new Date(punch.p_date).getTime();
    if (time >= cutoff && time > bestTime) {
      bestTime = time;
      best = punch.p_date;
    }
  }
  return best;
}

function lookupPgPunch(punches, direction, boundary, machineId) {
  if (!punches) return null;
  return direction === 'in'
    ? findPunchInFromList(punches, boundary, machineId)
    : findPunchOutFromList(punches, boundary, machineId);
}

/**
 * Legacy getPGAttendance — student_attendance.php lines 230-395.
 */
export async function getPGAttendance(sId, registerNo, attDate, batchRow, latePermission, ctx = null) {
  const attCurrentDate = String(attDate).slice(0, 10);
  const bCourseId = batchRow.course_id;
  const bAcademicYear = batchRow.academic_year;
  const bCurrentYear = batchRow.current_year;
  const tblName = punchTableName(attCurrentDate);
  const periodDay = localWeekdayFromIso(attCurrentDate);

  const lPermissionTime = tToM(latePermission?.permission_time);
  const lLateTime = tToM(latePermission?.late_time);

  const cal = ctx?.calendar?.get(attCurrentDate) || (await prisma.$queryRawUnsafe(
    `SELECT academic_events, comments, course_type FROM academic_calender_tb
     WHERE academic_date = '${escapeSql(attCurrentDate)}' AND del = 1 LIMIT 1`,
  ))[0] || {};
  const academicEvents = String(cal.academic_events || '').toLowerCase().slice(0, 7);
  const academicComments = cal.comments || '';
  const academicClassArray = String(cal.course_type || '').split(',,,');
  const classContain = !cal.course_type || academicClassArray.includes('P.G');

  const attendanceStatus = { st: '' };
  let slotRows = [];

  if ((academicEvents === 'working' && classContain) || (academicEvents === 'holiday' && !classContain)) {
    const ttKey = `${bCourseId}:${bAcademicYear}:${bCurrentYear}:${periodDay}:${attCurrentDate}`;
    slotRows = ctx?.timetableByKey?.get(ttKey) || await prisma.$queryRawUnsafe(
      `SELECT from_time, to_time, room_no FROM student_pgatt_time
       WHERE del = 1 AND course_id = '${escapeSql(String(bCourseId))}'
         AND academic_year = '${escapeSql(String(bAcademicYear))}'
         AND current_year = '${escapeSql(String(bCurrentYear))}'
         AND academic_type = 'regular' AND days = '${escapeSql(periodDay)}'
         AND from_date <= '${escapeSql(attCurrentDate)}' AND to_date >= '${escapeSql(attCurrentDate)}'
       GROUP BY att_group ORDER BY att_group ASC`,
    );
  } else {
    const rosterKey = `${registerNo}:${attCurrentDate}`;
    slotRows = ctx?.rosterByStudentDate?.get(rosterKey) || await prisma.$queryRawUnsafe(
      `SELECT from_time, to_time, room_no FROM student_pgatt_roster
       WHERE del = 1 AND from_date <= '${escapeSql(attCurrentDate)}' AND to_date >= '${escapeSql(attCurrentDate)}'
         AND ${registerLikeSql('student_list', registerNo)}`,
    );
  }

  if (!slotRows.length) {
    attendanceStatus.m = 'h';
    attendanceStatus.e = 'h';
    attendanceStatus.cmd = academicComments;
    return attendanceStatus;
  }

  const internInRef = { value: 0 };
  const internOutRef = { value: 0 };
  attendanceStatus.m = 'a';
  attendanceStatus.e = 'a';
  const manualLists = ctx?.manualByDate?.get(attCurrentDate) || await fetchPgManualLists(attCurrentDate);

  for (const rowQuery of slotRows) {
    const iFromTime = rowQuery.from_time;
    const iToTime = rowQuery.to_time;
    const iRoomNo = rowQuery.room_no;

    applyManualPgStatus(attendanceStatus, registerNo, manualLists, internInRef, internOutRef);

    const machineId = ctx?.machineByRoom?.get(String(iRoomNo)) ?? await buildMachineFilterForRoom(iRoomNo);
    if (!machineId) continue;

    const fromTimeStr = normalizeSqlTime(iFromTime);
    const toTimeStr = normalizeSqlTime(iToTime);

    const fPresentTime = new Date(`${attCurrentDate}T${fromTimeStr}`).getTime();
    const fLateTime = fPresentTime + (lLateTime * 60 * 1000);
    const fPermissionTime = fPresentTime + (lPermissionTime * 60 * 1000);
    const tPresentTime = new Date(`${attCurrentDate}T${toTimeStr}`).getTime();
    const tLateTime = tPresentTime - (lLateTime * 60 * 1000);
    const tPermissionTime = tPresentTime - (lPermissionTime * 60 * 1000);

    const internInFrom = formatSqlDateTimeFromMs(fPermissionTime);
    const internInTo = formatSqlDateTimeFromMs(tPermissionTime);

    attendanceStatus.it = formatTimeHms(fPresentTime);
    attendanceStatus.tt = formatTimeHms(tPresentTime);

    if (internInRef.value === 0) {
      const dayPunches = ctx?.punchesByRollDate?.get(`${registerNo}:${attCurrentDate}`);
      let punch = lookupPgPunch(dayPunches, 'in', internInFrom, machineId);
      if (punch === null && !dayPunches) {
        const punchKey = `${registerNo}:${attCurrentDate}:in:${internInFrom}`;
        const cachedIn = ctx?.punchInByKey?.get(punchKey);
        punch = cachedIn !== undefined
          ? cachedIn
          : (await prisma.$queryRawUnsafe(
            `SELECT p_date FROM ${tblName}
             WHERE DATE(p_date) = '${escapeSql(attCurrentDate)}' AND p_date <= '${escapeSql(internInFrom)}'
               AND tktno = '${escapeSql(String(registerNo))}' ${machineId}
             ORDER BY p_date ASC LIMIT 1`,
          ))[0]?.p_date;
      }
      const itime = punch ? new Date(punch).getTime() : 0;
      if (punch && itime > 0) {
        attendanceStatus.m = classifyInPunch(itime, fPresentTime, fLateTime, fPermissionTime);
        attendanceStatus.st += `F:${formatPunchDisplay(punch)}, `;
        attendanceStatus.mt = formatPunchDisplay(punch);
      }
    }

    if (internOutRef.value === 0) {
      const dayPunches = ctx?.punchesByRollDate?.get(`${registerNo}:${attCurrentDate}`);
      let punch = lookupPgPunch(dayPunches, 'out', internInTo, machineId);
      if (punch === null && !dayPunches) {
        const punchKey = `${registerNo}:${attCurrentDate}:out:${internInTo}`;
        const cachedOut = ctx?.punchOutByKey?.get(punchKey);
        punch = cachedOut !== undefined
          ? cachedOut
          : (await prisma.$queryRawUnsafe(
            `SELECT p_date FROM ${tblName}
             WHERE DATE(p_date) = '${escapeSql(attCurrentDate)}' AND p_date >= '${escapeSql(internInTo)}'
               AND tktno = '${escapeSql(String(registerNo))}' ${machineId}
             ORDER BY p_date DESC LIMIT 1`,
          ))[0]?.p_date;
      }
      const otime = punch ? new Date(punch).getTime() : 0;
      if (punch && otime > 0) {
        attendanceStatus.e = classifyOutPunch(otime, tPresentTime, tLateTime, tPermissionTime);
        attendanceStatus.st += `A:${formatPunchDisplay(punch)}`;
        attendanceStatus.et = formatPunchDisplay(punch);
      }
    }
  }

  return attendanceStatus;
}

function mapStudentLeaveOpt(leaveOpt) {
  return String(leaveOpt).toLowerCase() === 'od' ? 'p' : 'le';
}

function mapStudentDefaulterOpt(leaveOpt, fallbackTime) {
  const lo = String(leaveOpt).toLowerCase();
  if (lo === 'ab') return { opt: 'a', time: '' };
  if (lo === 'od') return { opt: 'p', time: '' };
  return { opt: leaveOpt, time: fallbackTime || '' };
}

async function fetchStudentLeaveSession(stId, attDate, sessionFilter, statusSearch) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT r_session, m_att, status FROM stu_leave_request_more
     WHERE del = 1 AND req_date = '${escapeSql(attDate)}' AND student_id = '${escapeSql(String(stId))}'
       AND (${sessionFilter}) ${statusSearch} LIMIT 1`,
  );
  return rows[0] || null;
}

async function fetchStudentDefaulterSession(stId, attDate, sessionFilter, statusSearch) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT r_session, m_att, e_att, status FROM stu_att_defaulter_more
     WHERE del = 1 AND req_date = '${escapeSql(attDate)}' AND student_id = '${escapeSql(String(stId))}'
       AND (${sessionFilter}) ${statusSearch} LIMIT 1`,
  );
  return rows[0] || null;
}

/**
 * In-memory path for batch intern cards (no DB). Use via modifiedStudentAttendance when ctx.prefetched.
 */
export function modifiedStudentAttendanceSync(
  stId,
  registerNo,
  attDate,
  batchRow,
  latePermission,
  attendanceStatus1,
  rtype = 0,
  ctx = null,
) {
  void registerNo;
  void batchRow;
  void latePermission;
  void rtype;

  const attendanceStatus = { ...attendanceStatus1, st: attendanceStatus1.st || '' };
  const lpDetails = {};
  const leaveAttStatus = {};
  const defaulterAttStatus = {};
  const permissionAttStatus = { f: 0, i: 0, gs: '', gs1: '' };
  const mattResults = {};

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

  const dayFromTime = attendanceStatus1.it ? tToS(attendanceStatus1.it) : 0;
  const dayToTime = attendanceStatus1.tt ? tToS(attendanceStatus1.tt) : 0;
  const attCurrentDate = String(attDate).slice(0, 10);

  const applyLeaveRow = (row, sessionKey) => {
    if (!row) return;
    const lopt = mapStudentLeaveOpt(row.m_att);
    const lstus = Number(row.status) === 1 ? 'a' : 'p';
    if (row.r_session === 'fullday') {
      leaveAttStatus.m = lopt;
      leaveAttStatus.e = lopt;
      leaveAttStatus.ms = [String(row.m_att).toLowerCase(), `${lopt}_${lstus}`, '', ''];
      leaveAttStatus.es = [String(row.m_att).toLowerCase(), `${lopt}_${lstus}`, '', ''];
    } else if (row.r_session === 'forenoon' && sessionKey === 'm') {
      leaveAttStatus.m = lopt;
      leaveAttStatus.ms = [String(row.m_att).toLowerCase(), `${lopt}_${lstus}`, '', ''];
    } else if (row.r_session === 'afternoon' && sessionKey === 'e' && !leaveAttStatus.e) {
      leaveAttStatus.e = lopt;
      leaveAttStatus.es = [String(row.m_att).toLowerCase(), `${lopt}_${lstus}`, '', ''];
    } else if (row.r_session === 'fullday' && sessionKey === 'e') {
      if (!leaveAttStatus.m) {
        leaveAttStatus.m = lopt;
        leaveAttStatus.ms = [String(row.m_att).toLowerCase(), `${lopt}_${lstus}`, '', ''];
      }
      if (!leaveAttStatus.e) {
        leaveAttStatus.e = lopt;
        leaveAttStatus.es = [String(row.m_att).toLowerCase(), `${lopt}_${lstus}`, '', ''];
      }
    }
  };

  const applyDefaulterRow = (row, sessionKey) => {
    if (!row) return;
    const lstus = Number(row.status) === 1 ? 'a' : 'p';
    const m = mapStudentDefaulterOpt(row.m_att, attendanceStatus1.mt);
    const e = mapStudentDefaulterOpt(row.e_att, attendanceStatus1.et);
    if (row.r_session === 'fullday') {
      defaulterAttStatus.m = m.opt;
      defaulterAttStatus.e = e.opt;
      defaulterAttStatus.ms = [String(row.m_att).toLowerCase(), `${m.opt}_${lstus}`, 'Unauthorized', m.time];
      defaulterAttStatus.es = [String(row.e_att).toLowerCase(), `${e.opt}_${lstus}`, 'Unauthorized', e.time];
    } else if (row.r_session === 'forenoon' && sessionKey === 'm') {
      defaulterAttStatus.m = m.opt;
      defaulterAttStatus.ms = [String(row.m_att).toLowerCase(), `${m.opt}_${lstus}`, 'Unauthorized', m.time];
    } else if (row.r_session === 'afternoon' && sessionKey === 'e' && !defaulterAttStatus.e) {
      defaulterAttStatus.e = e.opt;
      defaulterAttStatus.es = [String(row.e_att).toLowerCase(), `${e.opt}_${lstus}`, 'Unauthorized', e.time];
    } else if (row.r_session === 'fullday' && sessionKey === 'e') {
      if (!defaulterAttStatus.m) {
        defaulterAttStatus.m = m.opt;
        defaulterAttStatus.ms = [String(row.m_att).toLowerCase(), `${m.opt}_${lstus}`, 'Unauthorized', m.time];
      }
      if (!defaulterAttStatus.e) {
        defaulterAttStatus.e = e.opt;
        defaulterAttStatus.es = [String(row.e_att).toLowerCase(), `${e.opt}_${lstus}`, 'Unauthorized', e.time];
      }
    }
  };

  const leaveKey = `${stId}:${attCurrentDate}`;
  const leaveBucket = ctx?.leaves?.get(leaveKey);

  const pickLeaveFromBucket = (sessionFilter) => {
    if (!leaveBucket) return null;
    if (sessionFilter.includes('forenoon') && leaveBucket.forenoon) return leaveBucket.forenoon;
    if (sessionFilter.includes('afternoon') && leaveBucket.afternoon) return leaveBucket.afternoon;
    if (leaveBucket.fullday) return leaveBucket.fullday;
    return null;
  };

  applyLeaveRow(pickLeaveFromBucket("r_session='fullday' OR r_session='forenoon'"), 'm');
  applyLeaveRow(pickLeaveFromBucket("r_session='fullday' OR r_session='afternoon'"), 'e');

  const defaulterBucket = ctx?.defaulters?.get(leaveKey);
  const pickDefaulterFromBucket = (sessionFilter) => {
    if (!defaulterBucket) return null;
    if (sessionFilter.includes('forenoon') && defaulterBucket.forenoon) return defaulterBucket.forenoon;
    if (sessionFilter.includes('afternoon') && defaulterBucket.afternoon) return defaulterBucket.afternoon;
    if (defaulterBucket.fullday) return defaulterBucket.fullday;
    return null;
  };
  applyDefaulterRow(pickDefaulterFromBucket("r_session='fullday' OR r_session='forenoon'"), 'm');
  applyDefaulterRow(pickDefaulterFromBucket("r_session='fullday' OR r_session='afternoon'"), 'e');

  const permRows = ctx?.permissions?.get(leaveKey) || [];
  for (const row of permRows) {
    const lstus = Number(row.status) === 1 ? 'a' : 'p';
    const statusTxt = Number(row.status) === 1 ? 'Approved' : 'Applied';
    const lFtime = tToN(new Date(row.from_date).toTimeString().slice(0, 8));
    const lTtime = tToN(new Date(row.to_date).toTimeString().slice(0, 8));
    const dateStr = `${formatPunchDisplay(row.from_date)} to ${formatPunchDisplay(row.to_date)}`;
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

  return finalizeModifiedStudentAttendance(
    attendanceStatus,
    lpDetails,
    leaveAttStatus,
    defaulterAttStatus,
    permissionAttStatus,
    mattResults,
  );
}

function finalizeModifiedStudentAttendance(
  attendanceStatus,
  lpDetails,
  leaveAttStatus,
  defaulterAttStatus,
  permissionAttStatus,
  mattResults,
) {
  attendanceStatus.pe = (permissionAttStatus.f || 0) + (permissionAttStatus.i || 0);

  if (leaveAttStatus.m) {
    attendanceStatus.m = leaveAttStatus.m;
    mattResults.m = 0.5;
    lpDetails.m = leaveAttStatus.ms;
  } else {
    if (defaulterAttStatus.m) {
      mattResults.m = 0.5;
      attendanceStatus.m = defaulterAttStatus.m;
      lpDetails.m = defaulterAttStatus.ms;
    }
    if (attendanceStatus.m !== 'p' && attendanceStatus.m !== 'le' && permissionAttStatus.m) {
      mattResults.m = 0.5;
      attendanceStatus.m = permissionAttStatus.m;
      lpDetails.m = permissionAttStatus.ms;
    }
  }

  if (leaveAttStatus.e) {
    mattResults.e = 0.5;
    attendanceStatus.e = leaveAttStatus.e;
    lpDetails.e = leaveAttStatus.es;
  } else {
    if (defaulterAttStatus.e) {
      mattResults.e = 0.5;
      attendanceStatus.e = defaulterAttStatus.e;
      lpDetails.e = defaulterAttStatus.es;
    }
    if (attendanceStatus.e !== 'p' && attendanceStatus.e !== 'le' && permissionAttStatus.e) {
      mattResults.e = 0.5;
      attendanceStatus.e = permissionAttStatus.e;
      lpDetails.e = permissionAttStatus.es;
    }
  }

  let attTotal = 0;
  if (attendanceStatus.m !== 'h') attTotal += mattResults.m || 0;
  if (attendanceStatus.e !== 'h') attTotal += mattResults.e || 0;
  if (attendanceStatus.m === 'h' && attendanceStatus.e === 'h') {
    attendanceStatus.total = 0;
  } else if (attTotal > 0) {
    attendanceStatus.total = attTotal;
    attendanceStatus.s = 'W';
  }

  let attInfo = permissionAttStatus.gs || '';
  let attInfo1 = permissionAttStatus.gs1 || '';
  const leaveOptInfo = {};

  if (
    lpDetails.m?.[0] === lpDetails.e?.[0]
    && lpDetails.m?.[1] === lpDetails.e?.[1]
    && lpDetails.m?.[2] === lpDetails.e?.[2]
    && lpDetails.m?.[3] === lpDetails.e?.[3]
    && lpDetails.m?.[0]
  ) {
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

/**
 * Legacy modifiedAttendance for students — student_attendance.php lines 563-1014.
 */
export async function modifiedStudentAttendance(
  stId,
  registerNo,
  attDate,
  batchRow,
  latePermission,
  attendanceStatus1,
  rtype = 0,
  ctx = null,
) {
  if (ctx?.prefetched) {
    return modifiedStudentAttendanceSync(
      stId, registerNo, attDate, batchRow, latePermission, attendanceStatus1, rtype, ctx,
    );
  }

  void registerNo;
  void batchRow;
  void latePermission;

  const statusSearch = rtype === 1 ? ' AND status = 1' : ' AND status <= 1';
  const attendanceStatus = { ...attendanceStatus1, st: attendanceStatus1.st || '' };
  const lpDetails = {};
  const leaveAttStatus = {};
  const defaulterAttStatus = {};
  const permissionAttStatus = { f: 0, i: 0, gs: '', gs1: '' };
  const mattResults = {};

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

  const dayFromTime = attendanceStatus1.it ? tToS(attendanceStatus1.it) : 0;
  const dayToTime = attendanceStatus1.tt ? tToS(attendanceStatus1.tt) : 0;
  const attCurrentDate = String(attDate).slice(0, 10);

  const applyLeaveRow = (row, sessionKey) => {
    if (!row) return;
    const lopt = mapStudentLeaveOpt(row.m_att);
    const lstus = Number(row.status) === 1 ? 'a' : 'p';
    if (row.r_session === 'fullday') {
      leaveAttStatus.m = lopt;
      leaveAttStatus.e = lopt;
      leaveAttStatus.ms = [String(row.m_att).toLowerCase(), `${lopt}_${lstus}`, '', ''];
      leaveAttStatus.es = [String(row.m_att).toLowerCase(), `${lopt}_${lstus}`, '', ''];
    } else if (row.r_session === 'forenoon' && sessionKey === 'm') {
      leaveAttStatus.m = lopt;
      leaveAttStatus.ms = [String(row.m_att).toLowerCase(), `${lopt}_${lstus}`, '', ''];
    } else if (row.r_session === 'afternoon' && sessionKey === 'e' && !leaveAttStatus.e) {
      leaveAttStatus.e = lopt;
      leaveAttStatus.es = [String(row.m_att).toLowerCase(), `${lopt}_${lstus}`, '', ''];
    } else if (row.r_session === 'fullday' && sessionKey === 'e') {
      if (!leaveAttStatus.m) {
        leaveAttStatus.m = lopt;
        leaveAttStatus.ms = [String(row.m_att).toLowerCase(), `${lopt}_${lstus}`, '', ''];
      }
      if (!leaveAttStatus.e) {
        leaveAttStatus.e = lopt;
        leaveAttStatus.es = [String(row.m_att).toLowerCase(), `${lopt}_${lstus}`, '', ''];
      }
    }
  };

  const applyDefaulterRow = (row, sessionKey) => {
    if (!row) return;
    const lstus = Number(row.status) === 1 ? 'a' : 'p';
    const m = mapStudentDefaulterOpt(row.m_att, attendanceStatus1.mt);
    const e = mapStudentDefaulterOpt(row.e_att, attendanceStatus1.et);
    if (row.r_session === 'fullday') {
      defaulterAttStatus.m = m.opt;
      defaulterAttStatus.e = e.opt;
      defaulterAttStatus.ms = [String(row.m_att).toLowerCase(), `${m.opt}_${lstus}`, 'Unauthorized', m.time];
      defaulterAttStatus.es = [String(row.e_att).toLowerCase(), `${e.opt}_${lstus}`, 'Unauthorized', e.time];
    } else if (row.r_session === 'forenoon' && sessionKey === 'm') {
      defaulterAttStatus.m = m.opt;
      defaulterAttStatus.ms = [String(row.m_att).toLowerCase(), `${m.opt}_${lstus}`, 'Unauthorized', m.time];
    } else if (row.r_session === 'afternoon' && sessionKey === 'e' && !defaulterAttStatus.e) {
      defaulterAttStatus.e = e.opt;
      defaulterAttStatus.es = [String(row.e_att).toLowerCase(), `${e.opt}_${lstus}`, 'Unauthorized', e.time];
    } else if (row.r_session === 'fullday' && sessionKey === 'e') {
      if (!defaulterAttStatus.m) {
        defaulterAttStatus.m = m.opt;
        defaulterAttStatus.ms = [String(row.m_att).toLowerCase(), `${m.opt}_${lstus}`, 'Unauthorized', m.time];
      }
      if (!defaulterAttStatus.e) {
        defaulterAttStatus.e = e.opt;
        defaulterAttStatus.es = [String(row.e_att).toLowerCase(), `${e.opt}_${lstus}`, 'Unauthorized', e.time];
      }
    }
  };

  const leaveKey = `${stId}:${attCurrentDate}`;
  const leaveBucket = ctx?.leaves?.get(leaveKey);

  const pickLeaveFromBucket = (sessionFilter) => {
    if (!leaveBucket) return null;
    if (sessionFilter.includes('forenoon') && leaveBucket.forenoon) return leaveBucket.forenoon;
    if (sessionFilter.includes('afternoon') && leaveBucket.afternoon) return leaveBucket.afternoon;
    if (leaveBucket.fullday) return leaveBucket.fullday;
    return null;
  };

  const pickLeave = (sessionFilter) => {
    if (!leaveBucket) {
      return fetchStudentLeaveSession(stId, attCurrentDate, sessionFilter, statusSearch);
    }
    return pickLeaveFromBucket(sessionFilter);
  };

  applyLeaveRow(await pickLeave("r_session='fullday' OR r_session='forenoon'"), 'm');
  applyLeaveRow(await pickLeave("r_session='fullday' OR r_session='afternoon'"), 'e');

  const defaulterBucket = ctx?.defaulters?.get(leaveKey);
  const pickDefaulter = (sessionFilter) => {
    if (!defaulterBucket) {
      return fetchStudentDefaulterSession(stId, attCurrentDate, sessionFilter, statusSearch);
    }
    if (sessionFilter.includes('forenoon') && defaulterBucket.forenoon) return defaulterBucket.forenoon;
    if (sessionFilter.includes('afternoon') && defaulterBucket.afternoon) return defaulterBucket.afternoon;
    if (defaulterBucket.fullday) return defaulterBucket.fullday;
    return null;
  };

  applyDefaulterRow(await pickDefaulter("r_session='fullday' OR r_session='forenoon'"), 'm');
  applyDefaulterRow(await pickDefaulter("r_session='fullday' OR r_session='afternoon'"), 'e');

  const permRows = ctx?.permissions?.has?.(leaveKey)
    ? (ctx.permissions.get(leaveKey) || [])
    : await prisma.$queryRawUnsafe(
      `SELECT from_date, to_date, status FROM stu_permission_request
       WHERE del = 1 AND DATE(from_date) = '${escapeSql(attCurrentDate)}' AND DATE(to_date) = '${escapeSql(attCurrentDate)}'
         AND student_id = '${escapeSql(String(stId))}' ${statusSearch}`,
    );
  for (const row of permRows) {
    const lstus = Number(row.status) === 1 ? 'a' : 'p';
    const statusTxt = Number(row.status) === 1 ? 'Approved' : 'Applied';
    const lFtime = tToN(new Date(row.from_date).toTimeString().slice(0, 8));
    const lTtime = tToN(new Date(row.to_date).toTimeString().slice(0, 8));
    const dateStr = `${formatPunchDisplay(row.from_date)} to ${formatPunchDisplay(row.to_date)}`;
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

  return finalizeModifiedStudentAttendance(
    attendanceStatus,
    lpDetails,
    leaveAttStatus,
    defaulterAttStatus,
    permissionAttStatus,
    mattResults,
  );
}

/** Legacy call_attendance_flag — maps leave to display char `l`. */
export function callStudentAttendanceFlag(mFlag, eFlag) {
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

async function fetchInternManualLists(attDate) {
  const d = escapeSql(attDate);
  const [inRows, outRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT att_absent, att_present FROM student_iatt_tb
       WHERE del = 1 AND academic_date = '${d}' AND att_period = 'in' LIMIT 1`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT att_absent, att_present FROM student_iatt_tb
       WHERE del = 1 AND academic_date = '${d}' AND att_period = 'out' LIMIT 1`,
    ),
  ]);
  return manualListsFromRows(inRows[0], outRows[0]);
}

/** Legacy getIBatch — student_attendance.php; optional categoryKey scopes to selected CRRI batch. */
export async function getIBatch(registerNo, categoryKey = null) {
  const reg = escapeSql(String(registerNo));
  const rollFilter = registerLikeSql('roll_no', registerNo);
  const categoryParts = String(categoryKey || '').split('___');
  if (categoryParts.length === 3 && categoryParts.every(Boolean)) {
    const [courseId, academicYear, academicType] = categoryParts;
    const scoped = await prisma.$queryRawUnsafe(
      `SELECT course_id, academic_year, current_year, academic_type, batch_no
       FROM basic_subject_batch_tb
       WHERE del = 1 AND ${rollFilter}
         AND current_year = '5'
         AND course_id = '${escapeSql(courseId)}'
         AND academic_year = '${escapeSql(academicYear)}'
         AND academic_type = '${escapeSql(academicType)}'
       LIMIT 1`,
    );
    return scoped[0] || null;
  }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT course_id, academic_year, current_year, academic_type, batch_no
     FROM basic_subject_batch_tb
     WHERE del = 1 AND ${rollFilter}
       AND current_year = '5'
     ORDER BY academic_year DESC
     LIMIT 1`,
  );
  return rows[0] || null;
}

/**
 * Legacy getIAttendance — student_attendance.php lines 49-226.
 * When ctx.prefetched is set, runs fully in-memory (no DB).
 */
export function computeIAttendance(sId, registerNo, attDate, batchRow, latePermission, ctx = null) {
  void sId;
  if (!batchRow || !ctx?.prefetched) {
    return { m: 'h', e: 'h', cmd: '' };
  }

  const attCurrentDate = String(attDate).slice(0, 10);
  const bCourseId = batchRow.course_id;
  const bAcademicYear = batchRow.academic_year;
  const bCurrentYear = batchRow.current_year;
  const bAcademicType = batchRow.academic_type;
  const bBatchNo = batchRow.batch_no;

  const lPermissionTime = tToM(latePermission?.permission_time);
  const lLateTime = tToM(latePermission?.late_time);
  const lSatTime = latePermission?.sat_time;

  const calRow = ctx.calendar.get(attCurrentDate) || {};
  const academicEvents = String(calRow.academic_events || '').toLowerCase().slice(0, 7);
  const academicComments = calRow.comments || '';
  const academicClassArray = String(calRow.course_type || '').split(',,,');
  const classContain = !calRow.course_type || academicClassArray.includes('Int');

  const attendanceStatus = { st: '' };
  let slotRows = [];

  if ((academicEvents === 'working' && classContain) || (academicEvents === 'holiday' && !classContain)) {
    const ttKey = `${bCourseId}:${bAcademicYear}:${bCurrentYear}:${bAcademicType}:${bBatchNo}:${attCurrentDate}`;
    slotRows = ctx.internTimetableByKey.get(ttKey) || [];
  } else {
    const rosterKey = `${registerNo}:${attCurrentDate}`;
    slotRows = ctx.internRosterByStudentDate.get(rosterKey) || [];
  }

  if (!slotRows.length) {
    attendanceStatus.m = 'h';
    attendanceStatus.e = 'h';
    attendanceStatus.cmd = academicComments;
    return attendanceStatus;
  }

  const internInRef = { value: 0 };
  const internOutRef = { value: 0 };
  attendanceStatus.m = 'a';
  attendanceStatus.e = 'a';
  const manualLists = ctx.internManualByDate.get(attCurrentDate) || manualListsFromRows(null, null);
  const isSaturday = localWeekdayFromIso(attCurrentDate).toLowerCase() === 'saturday';

  for (const rowQuery of slotRows) {
    attendanceStatus.dept = rowQuery.department;
    let iFromTime = rowQuery.from_time;
    let iToTime = rowQuery.to_time;
    if (isSaturday && lSatTime) {
      iToTime = lSatTime;
    }
    const iRoomNo = rowQuery.room_no;

    applyManualPgStatus(attendanceStatus, registerNo, manualLists, internInRef, internOutRef);

    const machineId = ctx.machineByRoom.get(String(iRoomNo)) || '';
    if (!machineId) continue;

    const fromTimeStr = normalizeSqlTime(iFromTime);
    const toTimeStr = normalizeSqlTime(iToTime);

    const fPresentTime = new Date(`${attCurrentDate}T${fromTimeStr}`).getTime();
    const fLateTime = fPresentTime + (lLateTime * 60 * 1000);
    const fPermissionTime = fPresentTime + (lPermissionTime * 60 * 1000);
    const tPresentTime = new Date(`${attCurrentDate}T${toTimeStr}`).getTime();
    const tLateTime = tPresentTime - (lLateTime * 60 * 1000);
    const tPermissionTime = tPresentTime - (lPermissionTime * 60 * 1000);

    const internInFrom = formatSqlDateTimeFromMs(fPermissionTime);
    const internInTo = formatSqlDateTimeFromMs(tPermissionTime);

    attendanceStatus.it = formatTimeHms(fPresentTime);
    attendanceStatus.tt = formatTimeHms(tPresentTime);

    if (internInRef.value === 0) {
      const dayPunches = ctx.punchesByRollDate.get(`${registerNo}:${attCurrentDate}`);
      const punch = lookupPgPunch(dayPunches, 'in', internInFrom, machineId);
      const itime = punch ? new Date(punch).getTime() : 0;
      if (punch && itime > 0) {
        attendanceStatus.m = classifyInPunch(itime, fPresentTime, fLateTime, fPermissionTime);
        attendanceStatus.st += `F:${formatPunchDisplay(punch)}, `;
        attendanceStatus.mt = formatPunchDisplay(punch);
      }
    }

    if (internOutRef.value === 0) {
      const dayPunches = ctx.punchesByRollDate.get(`${registerNo}:${attCurrentDate}`);
      const punch = lookupPgPunch(dayPunches, 'out', internInTo, machineId);
      const otime = punch ? new Date(punch).getTime() : 0;
      if (punch && otime > 0) {
        attendanceStatus.e = classifyOutPunch(otime, tPresentTime, tLateTime, tPermissionTime);
        attendanceStatus.st += `A:${formatPunchDisplay(punch)}`;
        attendanceStatus.et = formatPunchDisplay(punch);
      }
    }
  }

  return attendanceStatus;
}

export async function getIAttendance(sId, registerNo, attDate, batchRow, latePermission, ctx = null) {
  if (ctx?.prefetched) {
    return computeIAttendance(sId, registerNo, attDate, batchRow, latePermission, ctx);
  }

  void sId;
  if (!batchRow) {
    return { m: 'h', e: 'h', cmd: '' };
  }

  const attCurrentDate = String(attDate).slice(0, 10);
  const bCourseId = batchRow.course_id;
  const bAcademicYear = batchRow.academic_year;
  const bCurrentYear = batchRow.current_year;
  const bAcademicType = batchRow.academic_type;
  const bBatchNo = batchRow.batch_no;
  const tblName = punchTableName(attCurrentDate);

  const lPermissionTime = tToM(latePermission?.permission_time);
  const lLateTime = tToM(latePermission?.late_time);
  const lSatTime = latePermission?.sat_time;

  const cal = ctx?.calendar?.get(attCurrentDate) || (await prisma.$queryRawUnsafe(
    `SELECT academic_events, comments, course_type FROM academic_calender_tb
     WHERE academic_date = '${escapeSql(attCurrentDate)}' AND del = 1 LIMIT 1`,
  ))[0] || {};
  const academicEvents = String(cal.academic_events || '').toLowerCase().slice(0, 7);
  const academicComments = cal.comments || '';
  const academicClassArray = String(cal.course_type || '').split(',,,');
  const classContain = !cal.course_type || academicClassArray.includes('Int');

  const attendanceStatus = { st: '' };
  let slotRows = [];

  if ((academicEvents === 'working' && classContain) || (academicEvents === 'holiday' && !classContain)) {
    const ttKey = `${bCourseId}:${bAcademicYear}:${bCurrentYear}:${bAcademicType}:${bBatchNo}:${attCurrentDate}`;
    slotRows = ctx?.internTimetableByKey?.get(ttKey) || await prisma.$queryRawUnsafe(
      `SELECT department, from_time, to_time, room_no FROM internship_timetable
       WHERE del = 1 AND course_id = '${escapeSql(String(bCourseId))}'
         AND academic_year = '${escapeSql(String(bAcademicYear))}'
         AND current_year = '${escapeSql(String(bCurrentYear))}'
         AND academic_type = '${escapeSql(String(bAcademicType))}'
         AND batch_no = '${escapeSql(String(bBatchNo))}'
         AND from_date <= '${escapeSql(attCurrentDate)}' AND to_date >= '${escapeSql(attCurrentDate)}'`,
    );
  } else {
    const rosterKey = `${registerNo}:${attCurrentDate}`;
    slotRows = ctx?.internRosterByStudentDate?.get(rosterKey) || await prisma.$queryRawUnsafe(
      `SELECT department, from_time, to_time, room_no FROM internship_att_roster
       WHERE del = 1 AND from_date <= '${escapeSql(attCurrentDate)}' AND to_date >= '${escapeSql(attCurrentDate)}'
         AND ${registerLikeSql('student_list', registerNo)}`,
    );
  }

  if (!slotRows.length) {
    attendanceStatus.m = 'h';
    attendanceStatus.e = 'h';
    attendanceStatus.cmd = academicComments;
    return attendanceStatus;
  }

  const internInRef = { value: 0 };
  const internOutRef = { value: 0 };
  attendanceStatus.m = 'a';
  attendanceStatus.e = 'a';
  const manualLists = ctx?.internManualByDate?.get(attCurrentDate) || await fetchInternManualLists(attCurrentDate);
  const isSaturday = localWeekdayFromIso(attCurrentDate).toLowerCase() === 'saturday';

  for (const rowQuery of slotRows) {
    attendanceStatus.dept = rowQuery.department;
    let iFromTime = rowQuery.from_time;
    let iToTime = rowQuery.to_time;
    if (isSaturday && lSatTime) {
      iToTime = lSatTime;
    }
    const iRoomNo = rowQuery.room_no;

    applyManualPgStatus(attendanceStatus, registerNo, manualLists, internInRef, internOutRef);

    const machineId = ctx?.machineByRoom?.get(String(iRoomNo)) ?? await buildMachineFilterForRoom(iRoomNo);
    if (!machineId) continue;

    const fromTimeStr = normalizeSqlTime(iFromTime);
    const toTimeStr = normalizeSqlTime(iToTime);

    const fPresentTime = new Date(`${attCurrentDate}T${fromTimeStr}`).getTime();
    const fLateTime = fPresentTime + (lLateTime * 60 * 1000);
    const fPermissionTime = fPresentTime + (lPermissionTime * 60 * 1000);
    const tPresentTime = new Date(`${attCurrentDate}T${toTimeStr}`).getTime();
    const tLateTime = tPresentTime - (lLateTime * 60 * 1000);
    const tPermissionTime = tPresentTime - (lPermissionTime * 60 * 1000);

    const internInFrom = formatSqlDateTimeFromMs(fPermissionTime);
    const internInTo = formatSqlDateTimeFromMs(tPermissionTime);

    attendanceStatus.it = formatTimeHms(fPresentTime);
    attendanceStatus.tt = formatTimeHms(tPresentTime);

    if (internInRef.value === 0) {
      const dayPunches = ctx?.punchesByRollDate?.get(`${registerNo}:${attCurrentDate}`);
      let punch = lookupPgPunch(dayPunches, 'in', internInFrom, machineId);
      if (punch === null && !dayPunches) {
        punch = (await prisma.$queryRawUnsafe(
          `SELECT p_date FROM ${tblName}
           WHERE DATE(p_date) = '${escapeSql(attCurrentDate)}' AND p_date <= '${escapeSql(internInFrom)}'
             AND tktno = '${escapeSql(String(registerNo))}' ${machineId}
           ORDER BY p_date ASC LIMIT 1`,
        ))[0]?.p_date;
      }
      const itime = punch ? new Date(punch).getTime() : 0;
      if (punch && itime > 0) {
        attendanceStatus.m = classifyInPunch(itime, fPresentTime, fLateTime, fPermissionTime);
        attendanceStatus.st += `F:${formatPunchDisplay(punch)}, `;
        attendanceStatus.mt = formatPunchDisplay(punch);
      }
    }

    if (internOutRef.value === 0) {
      const dayPunches = ctx?.punchesByRollDate?.get(`${registerNo}:${attCurrentDate}`);
      let punch = lookupPgPunch(dayPunches, 'out', internInTo, machineId);
      if (punch === null && !dayPunches) {
        punch = (await prisma.$queryRawUnsafe(
          `SELECT p_date FROM ${tblName}
           WHERE DATE(p_date) = '${escapeSql(attCurrentDate)}' AND p_date >= '${escapeSql(internInTo)}'
             AND tktno = '${escapeSql(String(registerNo))}' ${machineId}
           ORDER BY p_date DESC LIMIT 1`,
        ))[0]?.p_date;
      }
      const otime = punch ? new Date(punch).getTime() : 0;
      if (punch && otime > 0) {
        attendanceStatus.e = classifyOutPunch(otime, tPresentTime, tLateTime, tPermissionTime);
        attendanceStatus.st += `A:${formatPunchDisplay(punch)}`;
        attendanceStatus.et = formatPunchDisplay(punch);
      }
    }
  }

  return attendanceStatus;
}
