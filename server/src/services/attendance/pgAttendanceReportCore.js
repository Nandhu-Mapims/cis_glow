import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { convertNYear } from '../fees/feeHelpers.js';
import {
  buildMachineFilterForRoom,
  callStudentAttendanceFlag,
  getPGAttendance,
  getStudentLPTime,
  manualListsFromRows,
  modifiedStudentAttendance,
  punchTableName,
} from './pgAttendanceCore.js';

/** Legacy: pg_attendance_report.php + pg_attendance_report_more.php */

const pgAttendanceCache = new Map();
const pgBatchContextCache = new Map();

function getPgSetupCacheKey(setup) {
  const meta = setup?.meta || {};
  const jobIds = (setup?.jobs || []).map((job) => job.studentId).join(',');
  return `${meta.fromIso}|${meta.toIso}|${meta.reportType}|${jobIds}`;
}

function parseDisplayDate(val) {
  if (!val) return '';
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [d, m, y] = s.split('-');
  if (d && m && y && y.length === 4) return `${y}-${m}-${d}`;
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
}

function toDisplayDateIso(iso) {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  return d && m && y ? `${d}-${m}-${y}` : String(iso || '');
}

function courseDepartmentMatches(courseDepartment, authList) {
  if (!authList.length) return true;
  const dept = String(courseDepartment || '');
  return authList.some((id) => {
    const needle = String(id).trim();
    if (!needle) return false;
    return dept === needle
      || dept.startsWith(`${needle},`)
      || dept.endsWith(`,${needle}`)
      || dept.includes(`,${needle},`);
  });
}

function formatCourseDeptLabel(course) {
  let departmentName = String(course.department_name || '').trim();
  if (departmentName && departmentName !== '-') departmentName = ` - ${departmentName}`;
  else departmentName = '';
  return `${course.degree_name}${departmentName}`;
}

function formatCourseShortName(course, currentYear) {
  const yearLabel = convertNYear(Number(currentYear), 'P.G');
  let dept = String(course.department_name || '').trim();
  if (dept && dept !== '-') dept = ` - ${dept}`;
  else dept = '';
  return `${yearLabel} - ${course.degree_name}${dept}`;
}

function parseCourseKeyParts(courseKey) {
  const parts = String(courseKey).split('___');
  return {
    courseId: parts[0],
    academicYear: parts[1],
    currentYear: parts[2],
    academicType: parts[3] || 'regular',
    courseName: parts[4] || 'P.G',
    key: parts.slice(0, 4).join('___'),
  };
}

export function parsePgCourseKeys(courseKeys = []) {
  const parsed = [];
  const seen = new Set();
  for (const raw of courseKeys) {
    const meta = parseCourseKeyParts(raw);
    if (!meta.courseId || !meta.academicYear || !meta.currentYear) continue;
    const id = `${meta.courseId}___${meta.academicYear}___${meta.currentYear}___${meta.academicType}___P.G`;
    if (seen.has(id)) continue;
    seen.add(id);
    parsed.push({
      ...meta,
      id,
      courseName: 'P.G',
    });
  }
  return parsed;
}

export async function loadPgReportAcademicYears() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT DISTINCT academic_year FROM basic_setup_subject_tb WHERE del = 1 ORDER BY academic_year DESC',
  );
  const setup = await prisma.basic_setup_tb.findFirst({
    where: { del: 1 },
    select: { pg_academic_year: true },
  });
  return {
    academicYears: rows.map((r) => r.academic_year),
    defaultAcademicYear: setup?.pg_academic_year || rows[0]?.academic_year || '',
  };
}

/**
 * Legacy pg_attendance_report.php course dropdown — P.G courses grouped by degree/department.
 */
async function loadPgAuthDepartments(memberId) {
  if (!memberId) return [];
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.dept_pg
     FROM dept_authentication AS A
     INNER JOIN web_account_setup AS B ON A.user_id = B.id
     WHERE A.del = 1 AND B.del = 1 AND B.member_id = '${escapeSql(memberId)}'
     LIMIT 1`,
  );
  const csv = rows[0]?.dept_pg ? String(rows[0].dept_pg) : '';
  return csv ? csv.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

export async function buildPgReportCourseOptions(academicYear, memberId) {
  const { academicYears, defaultAcademicYear } = await loadPgReportAcademicYears();
  const year = academicYear || defaultAcademicYear;
  const authList = await loadPgAuthDepartments(memberId);

  const courseRows = await prisma.$queryRawUnsafe(
    `SELECT id, course_name, degree_name, department_name, course_duration, course_department
     FROM basic_setup_course_tb
     WHERE del = 1 AND course_name = 'P.G'
     ORDER BY c_order ASC`,
  );

  const courseGroups = [];
  const courseMeta = {};

  for (const course of courseRows) {
    if (!courseDepartmentMatches(course.course_department, authList)) continue;
    const duration = Number(course.course_duration) || 1;
    const groupLabel = `${formatCourseDeptLabel(course)} | ${year}`;
    const options = [];
    for (let cyear = 1; cyear <= duration; cyear += 1) {
      const cyearLabel = convertNYear(cyear, 'P.G');
      const value = `${course.id}___${year}___${cyear}___regular`;
      options.push({ value, label: `${cyearLabel} Year` });
      courseMeta[`${value}___P.G`] = {
        id: `${value}___P.G`,
        name: `${cyearLabel} Year ${formatCourseDeptLabel(course)}`,
        sname: formatCourseShortName(course, cyear),
        year,
        courseId: String(course.id),
        academicYear: year,
        currentYear: String(cyear),
        academicType: 'regular',
      };
    }
    if (options.length) courseGroups.push({ groupLabel, options });
  }

  return {
    academicYears,
    defaultAcademicYear,
    selectedAcademicYear: year,
    courseGroups,
    courseMeta,
  };
}

async function getCachedPgAttendance(sId, registerNo, attDate, batchRow, latePermission, clearCache, ctx = null) {
  const cacheKey = `${sId}:${attDate}`;
  if (!clearCache && pgAttendanceCache.has(cacheKey)) {
    return pgAttendanceCache.get(cacheKey);
  }
  const raw = await getPGAttendance(sId, registerNo, attDate, batchRow, latePermission, ctx);
  const modified = await modifiedStudentAttendance(
    sId,
    registerNo,
    attDate,
    batchRow,
    latePermission,
    raw,
    1,
    ctx,
  );
  const entry = { raw, modified };
  pgAttendanceCache.set(cacheKey, entry);
  return entry;
}

function accumulateSessionHalf(attendanceStatus, session, totals, monthly) {
  const v = attendanceStatus[session];
  const opt = attendanceStatus.attopt?.[session];
  if (v === 'la') totals.late += 1;
  if (v === 'pe') totals.permission += 1;
  if (v === 'a') totals.absent += 0.5;
  else if (v === 'le' && opt === 'cl') totals.cl += 0.5;
  else if (v === 'le' && opt === 'el') totals.el += 0.5;
  else if (v === 'p' && opt === 'od') totals.od += 0.5;
  else if (v !== 'h' && v) totals.present += 0.5;
  if (String(v).toLowerCase() !== 'h') totals.working += 0.5;

  if (monthly) {
    if (v === 'a') { /* absent only */ }
    else if (v === 'le' && (opt === 'cl' || opt === 'el')) { /* counted in % via cl/el */ }
    else if (v === 'p' && opt === 'od') { /* counted in % via od */ }
    else if (v !== 'h' && v) monthly.present += 0.5;
    if (String(v).toLowerCase() !== 'h') monthly.working += 0.5;
  }
}

function accumulateSessionTotals(attendanceStatus, totals, monthly = null) {
  accumulateSessionHalf(attendanceStatus, 'm', totals, monthly);
  accumulateSessionHalf(attendanceStatus, 'e', totals, monthly);
  totals.permission += Number(attendanceStatus.pe || 0);
}

function buildMonthlyCell(attendanceStatus) {
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

function newTotals() {
  return {
    days: 0,
    working: 0,
    present: 0,
    absent: 0,
    late: 0,
    permission: 0,
    cl: 0,
    el: 0,
    od: 0,
  };
}

function formatStudentName(student) {
  const title = String(student.student_title || '').trim();
  const prefix = title ? `${title}. ` : '';
  return `${prefix}${String(student.student_name || '').trim()} ${String(student.student_initial || '').trim()}`.trim();
}

/**
 * One student row — legacy pg_attendance_report_more.php.
 */
export async function buildStudentRowHtml(
  student,
  courseKey,
  fromDate,
  toDate,
  reportType,
  clearCache = false,
  hideAbinfo = false,
  options = {},
) {
  const fromIso = parseDisplayDate(fromDate);
  const toIso = parseDisplayDate(toDate);
  if (!student?.id || !fromIso || !toIso) return '';

  const meta = parseCourseKeyParts(courseKey);
  const batchRow = {
    course_id: meta.courseId,
    academic_year: meta.academicYear,
    current_year: meta.currentYear,
    academic_type: meta.academicType,
  };
  const latePermission = options.latePermission || await getStudentLPTime();
  const ctx = options.ctx || null;
  const registerNo = student.register_no;
  const sno = student.sno ?? student.counter ?? '';

  let body = `<tr>
<td>${sno}</td>
<td>${registerNo}</td>
<td nowrap>${formatStudentName(student)}</td>`;

  const totals = newTotals();
  const fromTs = Math.floor(new Date(`${fromIso}T00:00:00`).getTime() / 1000);
  const toTs = Math.floor(new Date(`${toIso}T00:00:00`).getTime() / 1000);

  if (reportType === 'Overall') {
    let monthStart = new Date(`${fromIso.slice(0, 7)}-01T00:00:00`);
    const monthEnd = new Date(`${toIso.slice(0, 7)}-01T00:00:00`);
    while (monthStart <= monthEnd) {
      const monthIso = monthStart.toISOString().slice(0, 10);
      const isFirstMonth = monthStart.getFullYear() === new Date(`${fromIso}T00:00:00`).getFullYear()
        && monthStart.getMonth() === new Date(`${fromIso}T00:00:00`).getMonth();
      const isLastMonth = monthStart.getFullYear() === new Date(`${toIso}T00:00:00`).getFullYear()
        && monthStart.getMonth() === new Date(`${toIso}T00:00:00`).getMonth();

      const monthFromIso = isFirstMonth ? fromIso : `${monthIso.slice(0, 7)}-01`;
      const monthToIso = isLastMonth
        ? toIso
        : new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).toISOString().slice(0, 10);

      const monthFromTs = Math.floor(new Date(`${monthFromIso}T00:00:00`).getTime() / 1000);
      const monthToTs = Math.floor(new Date(`${monthToIso}T00:00:00`).getTime() / 1000);
      const monthTotals = { present: 0, working: 0 };
      const monthDates = [];
      for (let ts = monthFromTs; ts <= monthToTs; ts += 86400) {
        monthDates.push(new Date(ts * 1000).toISOString().slice(0, 10));
      }
      const monthEntries = await Promise.all(monthDates.map((attDate) => getCachedPgAttendance(
        student.id, registerNo, attDate, batchRow, latePermission, clearCache, ctx,
      )));

      monthDates.forEach((attDate, index) => {
        const { modified } = monthEntries[index];
        totals.days += 1;
        accumulateSessionTotals(modified, totals, monthTotals);
      });

      body += `<td align="right">${monthTotals.present}<small>/${monthTotals.working}</small></td>`;
      monthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    }
  } else {
    const dates = [];
    for (let ts = fromTs; ts <= toTs; ts += 86400) {
      dates.push(new Date(ts * 1000).toISOString().slice(0, 10));
    }
    const entries = await Promise.all(dates.map((attDate) => getCachedPgAttendance(
      student.id, registerNo, attDate, batchRow, latePermission, clearCache, ctx,
    )));

    dates.forEach((attDate, index) => {
      const { modified } = entries[index];
      totals.days += 1;
      accumulateSessionTotals(modified, totals);
      body += buildMonthlyCell(modified);
    });
  }

  const pct = totals.working > 0
    ? Math.round(((totals.present + totals.cl + totals.el + totals.od) / totals.working) * 100)
    : 0;

  body += `
<td align="right">${totals.days}</td>
<td align="right">${totals.working}</td>
<td align="right">${totals.present}</td>
<td align="right">${totals.absent}</td>
<td align="right">${totals.late}</td>
<td align="right">${totals.permission}</td>
<td align="right">${pct}</td>
</tr>`;
  return body;
}

function buildTableHeader(fromIso, toIso, reportType, tableId = 0) {
  let header = `<table border="0" cellpadding="5" cellspacing="0" class="table table-bordered" id="payroll_${tableId}">
<thead><tr>
<th height="100" width="30">S.No</th>
<th width="100" nowrap>Roll No</th>
<th width="200">Student Name</th>`;

  if (reportType === 'Overall') {
    let m = new Date(`${fromIso.slice(0, 7)}-01T00:00:00`);
    const end = new Date(`${toIso.slice(0, 7)}-01T00:00:00`);
    while (m <= end) {
      header += `<th width="20" nowrap><div class="att_vtext">${m.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div></th>`;
      m = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    }
  } else {
    const fromTs = Math.floor(new Date(`${fromIso}T00:00:00`).getTime() / 1000);
    const toTs = Math.floor(new Date(`${toIso}T00:00:00`).getTime() / 1000);
    for (let ts = fromTs; ts <= toTs; ts += 86400) {
      const d = new Date(ts * 1000);
      const label = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getFullYear()).slice(-2)} | ${d.toLocaleDateString('en-US', { weekday: 'short' })}`;
      header += `<th width="20" nowrap><div class="att_vtext">${label}</div></th>`;
    }
  }

  header += `<th width="40">T.D</th>
<th width="40">W.D</th>
<th width="40">Pr</th>
<th width="40">Ab</th>
<th width="40">La</th>
<th width="40">Pe</th>
<th width="40">%</th>
</tr></thead><tbody>`;
  return header;
}

async function loadStudentsForCourse(meta) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT A.register_no, B.id, B.student_name, B.student_initial, B.student_title
     FROM student_academic_tb AS A
     INNER JOIN student_profile_tb AS B ON B.register_no = A.register_no AND B.del = 1
     WHERE A.del = 1 AND A.course_id = '${escapeSql(meta.courseId)}'
       AND A.academic_year = '${escapeSql(meta.academicYear)}'
       AND A.academic_batch = '${escapeSql(meta.academicType)}'
       AND A.current_year = '${escapeSql(meta.currentYear)}'
     ORDER BY A.register_no ASC`,
  );
  const seen = new Set();
  const students = [];
  for (const row of rows) {
    const reg = String(row.register_no || '').trim();
    if (!reg || seen.has(reg)) continue;
    seen.add(reg);
    students.push({
      id: row.id,
      register_no: reg,
      student_name: row.student_name,
      student_initial: row.student_initial,
      student_title: row.student_title,
    });
  }
  return students;
}

/**
 * Full PG attendance report HTML for selected courses and date range.
 */
export async function generatePgAttendanceReportHtml({
  courseKeys = [],
  fromDate,
  toDate,
  reportType = 'Monthly',
  clearCache = false,
  hideAbinfo = false,
  memberId = '',
}) {
  void memberId;
  if (clearCache) pgAttendanceCache.clear();

  const fromIso = parseDisplayDate(fromDate);
  const toIso = parseDisplayDate(toDate);
  const normalizedType = reportType === 'Overall' ? 'Overall' : 'Monthly';
  const courses = parsePgCourseKeys(courseKeys);

  if (!courses.length || !fromIso || !toIso) {
    return { error: 'courseKeys, fromDate, and toDate are required' };
  }

  const styleBlock = `<style>
.att_vtext{
  -webkit-transform: rotate(-90deg);
  -webkit-transform-origin: center bottom;
  -moz-transform: rotate(-90deg);
  -moz-transform-origin: center bottom;
  -o-transform: rotate(-90deg);
  -o-transform-origin: center bottom;
  transform: rotate(-90deg);
  transform-origin: center bottom;
  width:20px;
  font-size:10px;
  white-space: nowrap;
  margin-top:65px;
}
.hide_abinfo{display:${hideAbinfo ? 'none' : 'block'};}
</style>`;

  let html = styleBlock;
  const isSingleCourse = courses.length === 1;
  let singleCourseShort = '';
  let academicYearLabel = courses[0]?.academicYear || '';

  let tableIndex = 0;
  for (const meta of courses) {
    const course = await prisma.basic_setup_course_tb.findFirst({
      where: { id: Number(meta.courseId) },
      select: { degree_name: true, department_name: true, course_name: true },
    });
    if (!course) continue;

    const students = await loadStudentsForCourse(meta);
    if (!students.length) continue;

    const shortName = formatCourseShortName(course, meta.currentYear);
    if (isSingleCourse) singleCourseShort = shortName;
    else {
      html += `<p style="margin:5px 0;"><strong>Course:</strong> ${shortName}</p>`;
    }
    academicYearLabel = meta.academicYear;

    html += buildTableHeader(fromIso, toIso, normalizedType, tableIndex);
    let counter = 0;
    for (const student of students) {
      counter += 1;
      html += await buildStudentRowHtml(
        { ...student, sno: counter },
        meta.id,
        fromIso,
        toIso,
        normalizedType,
        clearCache,
        hideAbinfo,
      );
    }
    html += '</tbody></table>';
    tableIndex += 1;
    if (tableIndex % 3 === 0) {
      html += '<div style="width:100%;height:10px; clear:both; page-break-after:always;"> </div>';
    }
  }

  if (!html.replace(styleBlock, '').trim()) {
    return { error: 'No students found for the selected filters' };
  }

  const title = `${normalizedType} Attendance Report`;
  const subtitle = isSingleCourse
    ? `${singleCourseShort}${academicYearLabel}`
    : `Academic Year: ${academicYearLabel}`;
  const dateRange = `${toDisplayDateIso(fromIso)} to ${toDisplayDateIso(toIso)}`;

  return {
    title,
    subtitle,
    dateRange,
    reportHtml: html,
    printMeta: { title, subtitleLine1: subtitle, dateRange },
  };
}

export function clearPgAttendanceCache() {
  pgAttendanceCache.clear();
  pgBatchContextCache.clear();
}

function buildStyleBlock(hideAbinfo) {
  return `<style>
.att_vtext{
  -webkit-transform: rotate(-90deg);
  -webkit-transform-origin: center bottom;
  -moz-transform: rotate(-90deg);
  -moz-transform-origin: center bottom;
  -o-transform: rotate(-90deg);
  -o-transform-origin: center bottom;
  transform: rotate(-90deg);
  transform-origin: center bottom;
  width:20px;
  font-size:10px;
  white-space: nowrap;
  margin-top:65px;
}
.hide_abinfo{display:${hideAbinfo ? 'none' : 'block'};}
</style>`;
}

function punchTablesForRange(fromIso, toIso) {
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

async function bulkLoadPgPunchesByRollDate(registerNos, fromIso, toIso) {
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

function buildPgRosterByStudentDate(rosterRows, registerSet, fromIso, toIso) {
  const rosterByStudentDate = new Map();
  const rangeStart = new Date(`${fromIso}T00:00:00`).getTime();
  const rangeEnd = new Date(`${toIso}T00:00:00`).getTime();

  for (const row of rosterRows) {
    const rowFrom = new Date(`${String(row.from_date).slice(0, 10)}T00:00:00`).getTime();
    const rowTo = new Date(`${String(row.to_date).slice(0, 10)}T00:00:00`).getTime();
    const start = Math.max(rangeStart, rowFrom);
    const end = Math.min(rangeEnd, rowTo);
    if (start > end) continue;

    const slot = {
      from_time: row.from_time,
      to_time: row.to_time,
      room_no: row.room_no,
    };

    for (const part of String(row.student_list || '').split(',')) {
      const registerNo = part.trim();
      if (!registerNo || !registerSet.has(registerNo)) continue;
      for (let ts = start; ts <= end; ts += 86400000) {
        const dateIso = new Date(ts).toISOString().slice(0, 10);
        const key = `${registerNo}:${dateIso}`;
        if (!rosterByStudentDate.has(key)) rosterByStudentDate.set(key, []);
        rosterByStudentDate.get(key).push(slot);
      }
    }
  }
  return rosterByStudentDate;
}

async function preparePgBatchContext(jobs, meta) {
  const fromIso = meta.fromIso;
  const toIso = meta.toIso;
  const registerNos = [...new Set(jobs.map((j) => j.registerNo))];
  const studentIds = [...new Set(jobs.map((j) => String(j.studentId)))];

  const registerSet = new Set(registerNos);
  const [calendarRows, manualRows, leaveRows, defaulterRows, permRows, rosterRows, punchesByRollDate] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT CAST(academic_date AS CHAR) AS academic_date, academic_events, comments, course_type
       FROM academic_calender_tb WHERE del = 1
         AND academic_date >= '${escapeSql(fromIso)}' AND academic_date <= '${escapeSql(toIso)}'`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT CAST(academic_date AS CHAR) AS academic_date, att_period, att_present, att_absent
       FROM student_pgatt_tb WHERE del = 1
         AND academic_date >= '${escapeSql(fromIso)}' AND academic_date <= '${escapeSql(toIso)}'`,
    ),
    studentIds.length ? prisma.$queryRawUnsafe(
      `SELECT student_id, CAST(req_date AS CHAR) AS req_date, r_session, m_att, status
       FROM stu_leave_request_more WHERE del = 1 AND status = 1
         AND req_date >= '${escapeSql(fromIso)}' AND req_date <= '${escapeSql(toIso)}'
         AND student_id IN (${studentIds.map((id) => `'${escapeSql(id)}'`).join(',')})`,
    ) : [],
    studentIds.length ? prisma.$queryRawUnsafe(
      `SELECT student_id, CAST(req_date AS CHAR) AS req_date, r_session, m_att, e_att, status
       FROM stu_att_defaulter_more WHERE del = 1 AND status = 1
         AND req_date >= '${escapeSql(fromIso)}' AND req_date <= '${escapeSql(toIso)}'
         AND student_id IN (${studentIds.map((id) => `'${escapeSql(id)}'`).join(',')})`,
    ) : [],
    studentIds.length ? prisma.$queryRawUnsafe(
      `SELECT student_id, from_date, to_date, status
       FROM stu_permission_request WHERE del = 1 AND status = 1
         AND DATE(from_date) >= '${escapeSql(fromIso)}' AND DATE(to_date) <= '${escapeSql(toIso)}'
         AND student_id IN (${studentIds.map((id) => `'${escapeSql(id)}'`).join(',')})`,
    ) : [],
    registerNos.length ? prisma.$queryRawUnsafe(
      `SELECT from_time, to_time, room_no, student_list,
              CAST(from_date AS CHAR) AS from_date, CAST(to_date AS CHAR) AS to_date
       FROM student_pgatt_roster WHERE del = 1
         AND from_date <= '${escapeSql(toIso)}' AND to_date >= '${escapeSql(fromIso)}'`,
    ) : [],
    bulkLoadPgPunchesByRollDate(registerNos, fromIso, toIso),
  ]);

  const calendar = new Map();
  for (const row of calendarRows) {
    calendar.set(String(row.academic_date).slice(0, 10), row);
  }

  const manualByDate = new Map();
  const manualGrouped = new Map();
  for (const row of manualRows) {
    const d = String(row.academic_date).slice(0, 10);
    if (!manualGrouped.has(d)) manualGrouped.set(d, { in: null, out: null });
    const bucket = manualGrouped.get(d);
    if (row.att_period === 'in') bucket.in = row;
    if (row.att_period === 'out') bucket.out = row;
  }
  for (const [d, bucket] of manualGrouped) {
    manualByDate.set(d, manualListsFromRows(bucket.in, bucket.out));
  }

  const leaves = new Map();
  for (const row of leaveRows) {
    const key = `${row.student_id}:${String(row.req_date).slice(0, 10)}`;
    if (!leaves.has(key)) leaves.set(key, {});
    leaves.get(key)[row.r_session] = row;
  }

  const defaulters = new Map();
  for (const row of defaulterRows) {
    const key = `${row.student_id}:${String(row.req_date).slice(0, 10)}`;
    if (!defaulters.has(key)) defaulters.set(key, {});
    defaulters.get(key)[row.r_session] = row;
  }

  const permissions = new Map();
  for (const row of permRows) {
    const key = `${row.student_id}:${String(row.from_date).slice(0, 10)}`;
    if (!permissions.has(key)) permissions.set(key, []);
    permissions.get(key).push(row);
  }

  const courseKeys = [...new Set(jobs.map((j) => `${j.batchRow.course_id}:${j.batchRow.academic_year}:${j.batchRow.current_year}`))];
  const timetableByKey = new Map();
  const courseTimetableRows = await Promise.all(courseKeys.map((key) => {
    const [courseId, academicYear, currentYear] = key.split(':');
    return prisma.$queryRawUnsafe(
      `SELECT days, CAST(from_date AS CHAR) AS from_date, CAST(to_date AS CHAR) AS to_date,
              from_time, to_time, room_no
       FROM student_pgatt_time WHERE del = 1
         AND course_id = '${escapeSql(courseId)}'
         AND academic_year = '${escapeSql(academicYear)}'
         AND current_year = '${escapeSql(currentYear)}'
         AND academic_type = 'regular'
         AND from_date <= '${escapeSql(toIso)}' AND to_date >= '${escapeSql(fromIso)}'`,
    );
  }));
  courseKeys.forEach((key, index) => {
    const [courseId, academicYear, currentYear] = key.split(':');
    for (const row of courseTimetableRows[index] || []) {
      for (
        let ts = new Date(`${fromIso}T00:00:00`);
        ts <= new Date(`${toIso}T00:00:00`);
        ts.setDate(ts.getDate() + 1)
      ) {
        const d = ts.toISOString().slice(0, 10);
        const fd = String(row.from_date).slice(0, 10);
        const td = String(row.to_date).slice(0, 10);
        if (d < fd || d > td) continue;
        const weekday = ts.toLocaleDateString('en-US', { weekday: 'long' });
        if (weekday !== row.days) continue;
        const ttKey = `${courseId}:${academicYear}:${currentYear}:${weekday}:${d}`;
        if (!timetableByKey.has(ttKey)) timetableByKey.set(ttKey, []);
        timetableByKey.get(ttKey).push(row);
      }
    }
  });

  const machineByRoom = new Map();
  const roomIds = new Set();
  for (const slots of timetableByKey.values()) {
    for (const slot of slots) if (slot.room_no) roomIds.add(String(slot.room_no));
  }
  await Promise.all([...roomIds].map(async (roomId) => {
    machineByRoom.set(roomId, await buildMachineFilterForRoom(roomId));
  }));

  return {
    calendar,
    manualByDate,
    leaves,
    defaulters,
    permissions,
    timetableByKey,
    rosterByStudentDate: buildPgRosterByStudentDate(rosterRows, registerSet, fromIso, toIso),
    machineByRoom,
    punchesByRollDate,
    punchInByKey: new Map(),
    punchOutByKey: new Map(),
  };
}

export async function setupPgAttendanceReport(payload, memberId) {
  void memberId;
  const courseKeys = Array.isArray(payload.courseKeys || payload.course_name)
    ? (payload.courseKeys || payload.course_name).filter(Boolean)
    : [];
  const fromIso = parseDisplayDate(payload.fromDate || payload.from_date);
  const toIso = parseDisplayDate(payload.toDate || payload.to_date);
  const reportType = payload.reportType === 'Overall' || payload.report_type === 'Overall' ? 'Overall' : 'Monthly';
  const hideAbinfo = Boolean(payload.hideAbinfo);
  const courses = parsePgCourseKeys(courseKeys);

  if (!courses.length || !fromIso || !toIso) {
    return { error: 'courseKeys, fromDate, and toDate are required' };
  }

  const latePermission = await getStudentLPTime();
  const styleBlock = buildStyleBlock(hideAbinfo);
  let headerHtml = styleBlock;
  const jobs = [];
  let tableFlag = 0;
  const isSingleCourse = courses.length === 1;
  let singleCourseShort = '';
  let academicYearLabel = courses[0]?.academicYear || '';

  for (const meta of courses) {
    const course = await prisma.basic_setup_course_tb.findFirst({
      where: { id: Number(meta.courseId) },
      select: { degree_name: true, department_name: true },
    });
    if (!course) continue;

    const students = await loadStudentsForCourse(meta);
    if (!students.length) continue;

    const shortName = formatCourseShortName(course, meta.currentYear);
    if (isSingleCourse) singleCourseShort = shortName;
    else headerHtml += `<p style="margin:5px 0;"><strong>Course:</strong> ${shortName}</p>`;
    academicYearLabel = meta.academicYear;

    headerHtml += buildTableHeader(fromIso, toIso, reportType, tableFlag);
    headerHtml += '</tbody></table>';
    if ((tableFlag + 1) % 3 === 0) {
      headerHtml += '<div style="width:100%;height:10px; clear:both; page-break-after:always;"> </div>';
    }

    students.forEach((student, index) => {
      jobs.push({
        flag: String(tableFlag),
        courseKey: meta.id,
        registerNo: student.register_no,
        studentId: student.id,
        sno: index + 1,
        student,
        batchRow: {
          course_id: meta.courseId,
          academic_year: meta.academicYear,
          current_year: meta.currentYear,
          academic_type: meta.academicType,
        },
      });
    });
    tableFlag += 1;
  }

  if (!jobs.length) {
    return { error: 'No students found for the selected filters' };
  }

  const title = `${reportType} Attendance Report`;
  const subtitle = isSingleCourse
    ? `${singleCourseShort}${academicYearLabel}`
    : `Academic Year: ${academicYearLabel}`;

  return {
    headerHtml,
    jobs,
    printMeta: {
      title,
      subtitleLine1: subtitle,
      dateRange: `${toDisplayDateIso(fromIso)} to ${toDisplayDateIso(toIso)}`,
    },
    meta: {
      fromIso,
      toIso,
      reportType,
      hideAbinfo,
      latePermission,
      fmonth: Math.floor(new Date(`${fromIso}T00:00:00`).getTime() / 1000),
      tmonth: Math.floor(new Date(`${toIso}T00:00:00`).getTime() / 1000),
    },
  };
}

export async function generatePgAttendanceReportBatch(setup, offset = 0, limit = 10, clearCache = false) {
  const jobs = setup?.jobs || [];
  const meta = setup?.meta;
  if (!jobs.length || !meta) return { error: 'Report setup with jobs is required' };

  if (clearCache) {
    pgAttendanceCache.clear();
    pgBatchContextCache.clear();
  }

  const batchJobs = jobs.slice(offset, offset + limit);
  const cacheKey = getPgSetupCacheKey(setup);
  let ctx = pgBatchContextCache.get(cacheKey);
  if (!ctx) {
    ctx = await preparePgBatchContext(jobs, meta);
    pgBatchContextCache.set(cacheKey, ctx);
  }
  const rowsByFlag = {};

  const rowHtmlList = await Promise.all(batchJobs.map(async (job) => buildStudentRowHtml(
    { ...job.student, sno: job.sno },
    job.courseKey,
    meta.fromIso,
    meta.toIso,
    meta.reportType,
    clearCache,
    meta.hideAbinfo,
    { latePermission: meta.latePermission, ctx },
  )));

  batchJobs.forEach((job, index) => {
    const html = rowHtmlList[index];
    if (!html) return;
    rowsByFlag[job.flag] = (rowsByFlag[job.flag] || '') + html;
  });

  const nextOffset = offset + batchJobs.length;
  return {
    rowsByFlag,
    processed: nextOffset,
    total: jobs.length,
    truncated: nextOffset < jobs.length,
    nextOffset,
  };
}
