import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';

export function num(val) {
  return Number(val) || 0;
}

export function punchTableName(attDate) {
  const d = new Date(attDate);
  const year = d.getFullYear();
  const quarter = Math.ceil((d.getMonth() + 1) / 4);
  return `punchtimedetails_${year}${quarter}`;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Normalize DB time (string, Date, or HH:MM) to HH:MM:SS for datetime parsing. */
export function normalizeTimeStr(timeStr) {
  if (timeStr == null || timeStr === '') return '';

  if (timeStr instanceof Date) {
    if (Number.isNaN(timeStr.getTime())) return '';
    return `${pad2(timeStr.getUTCHours())}:${pad2(timeStr.getUTCMinutes())}:${pad2(timeStr.getUTCSeconds())}`;
  }

  const raw = String(timeStr).trim();
  if (!raw || raw.startsWith('0000')) return '';

  if (raw.includes('T')) {
    const part = raw.split('T')[1] || '';
    return part.slice(0, 8);
  }

  const parts = raw.split(':');
  if (parts.length >= 2) {
    return `${pad2(parts[0])}:${pad2(parts[1])}:${pad2(parts[2] || '0')}`;
  }

  return '';
}

export function addMinutesToDatetime(dateStr, timeStr, minutes = 0) {
  const t = normalizeTimeStr(timeStr);
  if (!t || t === '00:00:00') return null;

  const dt = new Date(`${dateStr}T${t}`);
  if (Number.isNaN(dt.getTime())) return null;

  dt.setMinutes(dt.getMinutes() + minutes);
  return dt.toISOString().slice(0, 19).replace('T', ' ');
}

/** Legacy t_to_m($time) — HH:MM to minutes since midnight. */
export function tToM(time) {
  const parts = String(time || '0:0').split(':');
  return (num(parts[0]) * 60) + num(parts[1]);
}

export const YEAR_STR = {
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

export async function loadPeriodSetup(academicDate) {
  const periodDay = new Date(academicDate).toLocaleDateString('en-US', { weekday: 'long' });
  const periodDayEsc = escapeSql(periodDay);
  const tblName = punchTableName(academicDate);
  const periodDayString = ` AND (p_days = '${periodDayEsc}' OR p_days LIKE '${periodDayEsc},%' OR p_days LIKE '%,${periodDayEsc}' OR p_days LIKE '%,${periodDayEsc},%')`;

  const periodRows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT period_no, course_name, academic_year, academic_type, from_time, to_time
     FROM period_set_up
     WHERE del != 0 AND period_no != 'Break' ${periodDayString}
     ORDER BY period_no + 0 ASC`,
  );

  const sessionDetails = {};
  const periodDetails = {};
  for (const row of periodRows) {
    const periodNo = row.period_no;
    const courseName = row.course_name;
    const academicYear = row.academic_year;
    const academicType = String(row.academic_type || '').toLowerCase();
    periodDetails[periodNo] = periodNo;
    if (!sessionDetails[courseName]) sessionDetails[courseName] = {};
    if (!sessionDetails[courseName][academicYear]) sessionDetails[courseName][academicYear] = {};
    if (!sessionDetails[courseName][academicYear][academicType]) {
      sessionDetails[courseName][academicYear][academicType] = {};
    }
    sessionDetails[courseName][academicYear][academicType][periodNo] = {
      from: row.from_time,
      to: row.to_time,
    };
  }

  return { sessionDetails, periodDetails, periodDay, periodDayEsc, tblName, periodDayString };
}

export async function loadMachineArray() {
  const machineArray = {};
  const roomRows = await prisma.$queryRawUnsafe(
    `SELECT id, machine_id, room_name FROM rooms_tb WHERE del = 1`,
  );
  for (const row of roomRows) {
    const roomId = row.id;
    let machineArrayString = '';
    const addFlags = (csv) => {
      for (const mid of String(csv || '').split(',')) {
        const trimmed = mid.trim();
        if (trimmed) machineArrayString += ` flag='${escapeSql(trimmed)}' OR`;
      }
    };
    if (roomId && row.machine_id) addFlags(row.machine_id);
    if (roomId && row.room_name) addFlags(row.room_name);
    if (machineArrayString) {
      machineArray[roomId] = ` AND (${machineArrayString.slice(0, -2)})`;
    }
  }
  return machineArray;
}

export async function loadSubjectSubcatArray() {
  const subjectSubcatArray = {};
  const subcatRows = await prisma.$queryRawUnsafe(
    `SELECT id, category_name FROM subject_master
     WHERE del = 1 AND category = 'Timetable' ORDER BY category_order ASC`,
  );
  for (const row of subcatRows) {
    subjectSubcatArray[row.id] = String(row.category_name || '').toLowerCase();
  }
  return subjectSubcatArray;
}

export async function loadAcademicCalendar(academicDate) {
  const d = escapeSql(academicDate);
  const calRows = await prisma.$queryRawUnsafe(
    `SELECT academic_events, comments, course_type FROM academic_calender_tb
     WHERE academic_date = '${d}' AND del = 1 LIMIT 1`,
  );
  const cal = calRows[0] || {};
  const aAcademicEvents = String(cal.academic_events || '').toLowerCase();
  const academicClassList = cal.course_type || '';
  const academicClassArray = academicClassList ? academicClassList.split(',,,') : [];
  const academicEvents = aAcademicEvents === 'working' ? aAcademicEvents : 'holiday';
  return { academicEvents, academicClassList, academicClassArray, aAcademicEvents };
}

export async function loadDeptArray() {
  const pdepartmentArray = {};
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, category_sname FROM master_setup
     WHERE category = 'Department' AND del != 0 ORDER BY category_order ASC`,
  );
  for (const row of rows) {
    pdepartmentArray[row.id] = row.category_sname;
  }
  return pdepartmentArray;
}

export async function loadInternDeptArray() {
  const idepartmentArray = {};
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, category_sname FROM master_setup
     WHERE category = 'Internship Department' AND del != 0 ORDER BY category_order ASC`,
  );
  for (const row of rows) {
    idepartmentArray[row.id] = row.category_sname;
  }
  return idepartmentArray;
}

export async function loadStuAttSetup() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT permission_time, late_time, sat_time FROM basic_setup_stuatt WHERE id = '1' LIMIT 1`,
  );
  const row = rows[0] || {};
  return {
    lPermissionTime: tToM(row.permission_time),
    lLateTime: tToM(row.late_time),
    lSatTime: row.sat_time || '',
  };
}

export function formatSyncTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const hours = d.getHours() % 12 || 12;
  const ampm = d.getHours() >= 12 ? 'pm' : 'am';
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(hours)}:${pad(d.getMinutes())} ${ampm}`;
}
