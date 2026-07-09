import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { internAuthentication } from '../dashboard/widgetAuth.js';
import {
  bulkLoadMachineFiltersForRooms,
  bulkLoadPunchesByRollDate,
  callStudentAttendanceFlag,
  computeIAttendance,
  getStudentLPTime,
  listContainsRegister,
  manualListsFromRows,
  modifiedStudentAttendanceSync,
} from './pgAttendanceCore.js';
import { escapeHtml, logStudentAtt } from './studentAttendanceShared.js';
import { formatDateDisplay, toIsoDate } from './setupAudit.js';

const ATT_EOS = 2016;

function internStatementAcademicYears(setupYear, yearOfStart, extraYears = []) {
  const floor = Math.max(Number(yearOfStart) || ATT_EOS, ATT_EOS);
  const base = parseInt(String(setupYear || '').split('-')[0], 10);
  const years = new Set();
  if (base) {
    for (let i = base; i >= floor; i -= 1) {
      years.add(`${i}-${i + 1}`);
    }
  }
  for (const year of extraYears) {
    const start = parseInt(String(year || '').split('-')[0], 10);
    if (year && start >= floor) years.add(String(year));
  }
  return [...years].sort((a, b) => parseInt(b.split('-')[0], 10) - parseInt(a.split('-')[0], 10));
}

async function loadInternStatementExtraYears() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT academic_year FROM internship_timetable
     WHERE del = 1 AND current_year = '5'
     UNION
     SELECT DISTINCT academic_year FROM basic_setup_academic
     WHERE del = 1 AND course_name = 'U.G'`,
  );
  return rows.map((row) => row.academic_year).filter(Boolean);
}

export function defaultInternStatementDates() {
  const to = new Date();
  to.setDate(to.getDate() - 1);
  const from = new Date(to);
  from.setMonth(from.getMonth() - 1);
  return {
    from_date: formatDateDisplay(from.toISOString().slice(0, 10)),
    to_date: formatDateDisplay(to.toISOString().slice(0, 10)),
  };
}

export async function buildInternStatementCategoryOptions() {
  const setup = await prisma.basic_setup_tb.findFirst({
    where: { del: 1 },
    select: { ug_academic_year: true, uga_academic_year: true },
  });
  const extraYears = await loadInternStatementExtraYears();
  const courses = await prisma.$queryRawUnsafe(
    `SELECT id, degree_name, department_name, year_of_start
     FROM basic_setup_course_tb
     WHERE del = 1 AND course_name = 'U.G'
     ORDER BY c_order ASC`,
  );
  const options = [];
  for (const course of courses) {
    const dept = course.department_name && course.department_name !== '-'
      ? ` - ${course.department_name}`
      : '';
    const yearFloor = Math.max(Number(course.year_of_start) || ATT_EOS, ATT_EOS);
    for (const [academicType, setupYear, groupLabel] of [
      ['regular', setup?.ug_academic_year, 'Regular Batch CRRI'],
      ['additional', setup?.uga_academic_year, 'Additional Batch CRRI'],
    ]) {
      if (!setupYear) continue;
      for (const academicYear of internStatementAcademicYears(setupYear, yearFloor, extraYears)) {
        options.push({
          value: `${course.id}___${academicYear}___${academicType}`,
          label: `${course.degree_name}${dept} | ${academicYear}`,
          groupLabel,
        });
      }
    }
  }
  return options;
}

function categoryFilter(categoryKey) {
  const [courseId, academicYear, academicType] = String(categoryKey || '').split('___');
  if (!courseId || !academicYear || !academicType) return '';
  return ` AND (course_id='${escapeSql(courseId)}' AND academic_year='${escapeSql(academicYear)}' AND academic_type='${escapeSql(academicType)}' AND current_year='5')`;
}

function dateOverlapSql(fromIso, toIso) {
  return `((from_date >= '${escapeSql(fromIso)}' AND to_date <= '${escapeSql(toIso)}')
    OR (from_date <= '${escapeSql(fromIso)}' AND to_date >= '${escapeSql(toIso)}')
    OR (from_date <= '${escapeSql(fromIso)}' AND to_date >= '${escapeSql(fromIso)}' AND to_date <= '${escapeSql(toIso)}')
    OR (from_date >= '${escapeSql(fromIso)}' AND from_date <= '${escapeSql(toIso)}' AND to_date >= '${escapeSql(toIso)}'))`;
}

export async function resolveInternStatementRollList(memberId, categoryKey, fromDate, toDate) {
  const baseFilter = categoryFilter(categoryKey);
  if (!baseFilter) return '';

  const fromIso = toIsoDate(fromDate);
  const toIso = toIsoDate(toDate);
  if (!fromIso || !toIso) return '';

  let batchFilter = baseFilter;
  const deptAuth = await internAuthentication(memberId, 'department');
  if (deptAuth) {
    const timetableRows = await prisma.$queryRawUnsafe(
      `SELECT batch_no, course_id, academic_year, academic_type
       FROM internship_timetable
       WHERE del = 1 ${baseFilter} ${deptAuth}
         AND ${dateOverlapSql(fromIso, toIso)}`,
    );
    if (!timetableRows.length) return '';
    const clauses = timetableRows.map((row) => (
      `(course_id='${escapeSql(String(row.course_id))}' AND academic_year='${escapeSql(String(row.academic_year))}'
        AND academic_type='${escapeSql(String(row.academic_type))}' AND current_year='5'
        AND batch_no='${escapeSql(String(row.batch_no))}')`
    ));
    batchFilter = ` AND (${clauses.join(' OR ')})`;
  }

  const batchRows = await prisma.$queryRawUnsafe(
    `SELECT roll_no FROM basic_subject_batch_tb WHERE del = 1 ${batchFilter}`,
  );
  const rolls = new Set();
  for (const row of batchRows) {
    for (const part of String(row.roll_no || '').split(',')) {
      const trimmed = part.trim();
      if (trimmed) rolls.add(trimmed);
    }
  }
  return [...rolls].join(',');
}

function formatRangeTitle(fromDate, toDate) {
  const fromMs = new Date(`${toIsoDate(fromDate)}T12:00:00`).getTime();
  const toMs = new Date(`${toIsoDate(toDate)}T12:00:00`).getTime();
  const fmtMonthYear = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const fmtShort = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short' });
  if (new Date(fromMs).getMonth() === new Date(toMs).getMonth()
    && new Date(fromMs).getFullYear() === new Date(toMs).getFullYear()) {
    return fmtMonthYear(fromMs);
  }
  if (new Date(fromMs).getFullYear() === new Date(toMs).getFullYear()) {
    return `${fmtShort(fromMs)} - ${fmtMonthYear(toMs)}`;
  }
  return `${fmtShort(fromMs)} ${new Date(fromMs).getFullYear()} - ${fmtShort(toMs)} ${new Date(toMs).getFullYear()}`;
}

function formatAddressLine(value, suffix = ',<br>') {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.endsWith(',') ? `${text}<br>` : `${text}${suffix}`;
}

function formatStudentAddress(row) {
  const studentName = formatStudentName(row);
  const gender = String(row.student_gender || '').toLowerCase();
  const parentPrefix = row.father_name
    ? (gender === 'female' ? `D/O. ${escapeHtml(row.father_name)},<br>` : `S/O. ${escapeHtml(row.father_name)},<br>`)
    : '';
  const mobile = row.father_mobile_1 ? `<br>M: ${escapeHtml(row.father_mobile_1)}` : '';

  let address = '';
  if (row.door_no) {
    address += String(row.door_no).trim().endsWith(',')
      ? `${escapeHtml(row.door_no)} `
      : `${escapeHtml(row.door_no)}, `;
  }
  address += formatAddressLine(row.street);
  address += formatAddressLine(row.post);
  address += formatAddressLine(row.taluk);
  address += formatAddressLine(row.district);
  if (row.state) address += formatAddressLine(row.state, ',<br>');
  address = address.replace(/,<br>$/, '').replace(/<br>$/, '');
  if (row.pincode && address) address += ` - ${escapeHtml(row.pincode)}.`;
  else if (row.pincode) address = `${escapeHtml(row.pincode)}.`;

  return `<strong>${escapeHtml(studentName)}</strong><br>${parentPrefix}${address}${mobile}`;
}

function formatStudentName(row) {
  const title = row.student_title ? `${row.student_title}.` : '';
  return `${title}${row.student_name || ''} ${row.student_initial || ''}`.trim();
}

async function resolveInternStudentProfile(registerOrUreg) {
  const key = escapeSql(String(registerOrUreg || '').trim());
  if (!key) return null;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, student_title, student_name, student_initial, register_no, uregister_no,
            father_name, father_mobile_1, student_gender, door_no, street, post, taluk, district, state, pincode
     FROM student_profile_tb
     WHERE del = 1 AND (register_no = '${key}' OR uregister_no = '${key}')
     LIMIT 1`,
  );
  return rows[0] || null;
}

async function resolveInternStudentProfiles(registerOrUregs) {
  const keys = [...new Set(registerOrUregs.map((value) => String(value || '').trim()).filter(Boolean))];
  const byKey = new Map();
  if (!keys.length) return byKey;

  const inList = keys.map((key) => `'${escapeSql(key)}'`).join(',');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, student_title, student_name, student_initial, register_no, uregister_no,
            father_name, father_mobile_1, student_gender, door_no, street, post, taluk, district, state, pincode
     FROM student_profile_tb
     WHERE del = 1 AND (register_no IN (${inList}) OR uregister_no IN (${inList}))`,
  );
  for (const row of rows) {
    byKey.set(String(row.register_no), row);
    if (row.uregister_no) byKey.set(String(row.uregister_no), row);
  }
  return byKey;
}

function dateInInclusiveRange(dateIso, fromValue, toValue) {
  const date = String(dateIso).slice(0, 10);
  const from = String(fromValue).slice(0, 10);
  const to = String(toValue).slice(0, 10);
  return date >= from && date <= to;
}

function buildInternRosterByStudentDate(rosterRows, registerSet, fromIso, toIso) {
  const internRosterByStudentDate = new Map();
  const rangeStart = new Date(`${fromIso}T00:00:00`).getTime();
  const rangeEnd = new Date(`${toIso}T00:00:00`).getTime();

  for (const row of rosterRows) {
    const rowFrom = new Date(`${String(row.from_date).slice(0, 10)}T00:00:00`).getTime();
    const rowTo = new Date(`${String(row.to_date).slice(0, 10)}T00:00:00`).getTime();
    const start = Math.max(rangeStart, rowFrom);
    const end = Math.min(rangeEnd, rowTo);
    if (start > end) continue;

    const slot = {
      department: row.department,
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
        if (!internRosterByStudentDate.has(key)) internRosterByStudentDate.set(key, []);
        internRosterByStudentDate.get(key).push(slot);
      }
    }
  }
  return internRosterByStudentDate;
}

const INTERN_CARD_CONCURRENCY = 16;

function rollMatchSql(registerNo) {
  const r = escapeSql(String(registerNo));
  return `(roll_no='${r}' OR roll_no LIKE '${r},%' OR roll_no LIKE '%,${r}' OR roll_no LIKE '%,${r},%')`;
}

async function bulkGetIBatches(registerNos, categoryKey) {
  const map = new Map();
  if (!registerNos.length) return map;

  const categoryParts = String(categoryKey || '').split('___');
  let categorySql = '';
  if (categoryParts.length === 3 && categoryParts.every(Boolean)) {
    const [courseId, academicYear, academicType] = categoryParts;
    categorySql = ` AND course_id='${escapeSql(courseId)}'
      AND academic_year='${escapeSql(academicYear)}'
      AND academic_type='${escapeSql(academicType)}'`;
  }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT course_id, academic_year, current_year, academic_type, batch_no, roll_no
     FROM basic_subject_batch_tb
     WHERE del = 1 AND current_year = '5' ${categorySql}
       AND (${registerNos.map(rollMatchSql).join(' OR ')})`,
  );

  for (const registerNo of registerNos) {
    for (const row of rows) {
      if (listContainsRegister(row.roll_no, registerNo)) {
        map.set(registerNo, row);
        break;
      }
    }
  }
  return map;
}

function buildInternTimetableByKey(ttRows, calendar, dates) {
  const internTimetableByKey = new Map();
  const batchKeys = new Set(
    ttRows.map((row) => `${row.course_id}:${row.academic_year}:${row.current_year}:${row.academic_type}:${row.batch_no}`),
  );

  for (const dateIso of dates) {
    const cal = calendar.get(dateIso) || {};
    const academicEvents = String(cal.academic_events || '').toLowerCase().slice(0, 7);
    const classContain = !cal.course_type || String(cal.course_type).split(',,,').includes('Int');
    const useTimetable = (academicEvents === 'working' && classContain)
      || (academicEvents === 'holiday' && !classContain);
    if (!useTimetable) continue;

    for (const batchKey of batchKeys) {
      internTimetableByKey.set(`${batchKey}:${dateIso}`, []);
    }

    for (const row of ttRows) {
      if (!dateInInclusiveRange(dateIso, row.from_date, row.to_date)) continue;
      const ttKey = `${row.course_id}:${row.academic_year}:${row.current_year}:${row.academic_type}:${row.batch_no}:${dateIso}`;
      if (!internTimetableByKey.has(ttKey)) internTimetableByKey.set(ttKey, []);
      internTimetableByKey.get(ttKey).push({
        department: row.department,
        from_time: row.from_time,
        to_time: row.to_time,
        room_no: row.room_no,
      });
    }
  }
  return internTimetableByKey;
}

async function buildInternAttPrefetchCtx(categoryKey, fromIso, toIso, registerNos, studentIds) {
  const dates = eachDateIso(fromIso, toIso);
  const [courseId, academicYear, academicType] = String(categoryKey || '').split('___');
  const registerSet = new Set(registerNos);
  const categorySql = courseId && academicYear && academicType
    ? ` AND course_id = '${escapeSql(courseId)}'
        AND academic_year = '${escapeSql(academicYear)}'
        AND academic_type = '${escapeSql(academicType)}'
        AND current_year = '5'`
    : '';

  const [
    calRows,
    manualRows,
    ttRows,
    rosterRows,
    leaveRows,
    defaulterRows,
    permRows,
    deptRows,
    punchesByRollDate,
  ] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT CAST(academic_date AS CHAR) AS academic_date, academic_events, comments, course_type
       FROM academic_calender_tb WHERE del = 1
         AND academic_date >= '${escapeSql(fromIso)}' AND academic_date <= '${escapeSql(toIso)}'`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT CAST(academic_date AS CHAR) AS academic_date, att_period, att_present, att_absent
       FROM student_iatt_tb WHERE del = 1
         AND academic_date >= '${escapeSql(fromIso)}' AND academic_date <= '${escapeSql(toIso)}'`,
    ),
    categorySql ? prisma.$queryRawUnsafe(
      `SELECT department, from_time, to_time, room_no, batch_no, course_id, academic_year, current_year, academic_type,
              CAST(from_date AS CHAR) AS from_date, CAST(to_date AS CHAR) AS to_date
       FROM internship_timetable WHERE del = 1 ${categorySql}
         AND from_date <= '${escapeSql(toIso)}' AND to_date >= '${escapeSql(fromIso)}'`,
    ) : [],
    prisma.$queryRawUnsafe(
      `SELECT department, from_time, to_time, room_no, student_list,
              CAST(from_date AS CHAR) AS from_date, CAST(to_date AS CHAR) AS to_date
       FROM internship_att_roster WHERE del = 1
         AND from_date <= '${escapeSql(toIso)}' AND to_date >= '${escapeSql(fromIso)}'`,
    ),
    studentIds.length ? prisma.$queryRawUnsafe(
      `SELECT student_id, CAST(req_date AS CHAR) AS req_date, r_session, m_att, status
       FROM stu_leave_request_more WHERE del = 1 AND status <= 1
         AND req_date >= '${escapeSql(fromIso)}' AND req_date <= '${escapeSql(toIso)}'
         AND student_id IN (${studentIds.map((id) => `'${escapeSql(id)}'`).join(',')})`,
    ) : [],
    studentIds.length ? prisma.$queryRawUnsafe(
      `SELECT student_id, CAST(req_date AS CHAR) AS req_date, r_session, m_att, e_att, status
       FROM stu_att_defaulter_more WHERE del = 1 AND status <= 1
         AND req_date >= '${escapeSql(fromIso)}' AND req_date <= '${escapeSql(toIso)}'
         AND student_id IN (${studentIds.map((id) => `'${escapeSql(id)}'`).join(',')})`,
    ) : [],
    studentIds.length ? prisma.$queryRawUnsafe(
      `SELECT student_id, from_date, to_date, status
       FROM stu_permission_request WHERE del = 1 AND status <= 1
         AND DATE(from_date) >= '${escapeSql(fromIso)}' AND DATE(to_date) <= '${escapeSql(toIso)}'
         AND student_id IN (${studentIds.map((id) => `'${escapeSql(id)}'`).join(',')})`,
    ) : [],
    prisma.$queryRawUnsafe(
      `SELECT id, category_name FROM master_setup WHERE del = 1`,
    ),
    bulkLoadPunchesByRollDate(registerNos, fromIso, toIso),
  ]);

  const calendar = new Map();
  for (const row of calRows) calendar.set(String(row.academic_date).slice(0, 10), row);

  const internManualByDate = new Map();
  const manualGrouped = new Map();
  for (const row of manualRows) {
    const dateIso = String(row.academic_date).slice(0, 10);
    if (!manualGrouped.has(dateIso)) manualGrouped.set(dateIso, { in: null, out: null });
    const bucket = manualGrouped.get(dateIso);
    if (row.att_period === 'in') bucket.in = row;
    if (row.att_period === 'out') bucket.out = row;
  }
  for (const [dateIso, bucket] of manualGrouped) {
    internManualByDate.set(dateIso, manualListsFromRows(bucket.in, bucket.out));
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
    const fromIsoDay = String(new Date(row.from_date).toISOString().slice(0, 10));
    const toIsoDay = String(new Date(row.to_date).toISOString().slice(0, 10));
    if (fromIsoDay !== toIsoDay) continue;
    const key = `${row.student_id}:${fromIsoDay}`;
    if (!permissions.has(key)) permissions.set(key, []);
    permissions.get(key).push(row);
  }

  const deptNameById = new Map(deptRows.map((row) => [String(row.id), row.category_name]));
  const internTimetableByKey = buildInternTimetableByKey(ttRows, calendar, dates);
  const internRosterByStudentDate = buildInternRosterByStudentDate(rosterRows, registerSet, fromIso, toIso);

  const roomIds = new Set();
  for (const row of [...ttRows, ...rosterRows]) {
    if (row.room_no) roomIds.add(String(row.room_no));
  }
  const machineByRoom = await bulkLoadMachineFiltersForRooms([...roomIds]);

  return {
    prefetched: true,
    calendar,
    internManualByDate,
    internTimetableByKey,
    internRosterByStudentDate,
    machineByRoom,
    leaves,
    defaulters,
    permissions,
    punchesByRollDate,
    deptNameById,
  };
}

function resolveDepartmentNames(deptIds, deptNameById) {
  const names = [];
  const seen = new Set();
  for (const id of deptIds) {
    const key = String(id || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const name = deptNameById?.get(key);
    if (name) names.push(name);
  }
  return names.join(', ');
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

function buildCalendarHtml(dateRows) {
  let calendar = '<table cellpadding="0" cellspacing="0" border="0" class="table table-bordered intern-att-calendar" width="100%">';
  calendar += '<thead><tr class="calendar-row" bgcolor="#f4f4f4"><th>Sunday</th><th width="14.28%">Monday</th><th width="14.28%">Tuesday</th><th width="14.28%">Wednesday</th><th width="14.28%">Thursday</th><th width="14.28%">Friday</th><th width="14.28%">Saturday</th></tr></thead><tbody>';
  let presentDay = new Date(`${dateRows[0]?.date}T12:00:00`).getDay();
  let daysInWeek = 1;
  calendar += '<tr class="calendar-row">';

  for (let j = 0; j < presentDay; j += 1) {
    calendar += '<td class="calendar-day-np" style="height:70px;">&nbsp;</td>';
    daysInWeek += 1;
  }

  for (const day of dateRows) {
    const bg = day.isHoliday ? ' bgcolor="#F8BBCA"' : '';
    let eventHtml = '';
    if (day.eventNoteHtml) {
      eventHtml = `<p class="event_name">${day.eventNoteHtml}</p>`;
    } else if (day.eventNote) {
      eventHtml = `<p class="event_name">${escapeHtml(day.eventNote)}</p>`;
    }
    calendar += `<td class="calendar-day" style="height:70px;"${bg}><div class="calendar-day-inner">`;
    calendar += `<p class="day-number">${escapeHtml(day.label)}</p>`;
    calendar += `<p class="event">${escapeHtml(day.status)}</p>${eventHtml}`;
    calendar += '</div></td>';

    if (presentDay === 6) {
      calendar += '</tr><tr class="calendar-row">';
      presentDay = -1;
      daysInWeek = 0;
    }
    daysInWeek += 1;
    presentDay += 1;
  }

  if (daysInWeek < 8) {
    for (let x = 1; x <= (8 - daysInWeek); x += 1) {
      calendar += '<td class="calendar-day-np" style="height:70px;">&nbsp;</td>';
    }
  }
  calendar += '</tr></tbody></table>';
  return calendar;
}

function renderInternAttCardHtml(profile, internalRegisterNo, batchRow, fromDate, toDate, attMessage, ctx) {
  const fromIso = toIsoDate(fromDate);
  const toIso = toIsoDate(toDate);
  const latePermission = ctx.latePermission;
  const totals = { late: 0, per: 0, absent: 0, leave: 0, present: 0, total: 0 };
  const deptList = [];
  const todayIso = new Date().toISOString().slice(0, 10);
  const dateRows = [];

  for (const dateIso of eachDateIso(fromIso, toIso)) {
    const raw = computeIAttendance(profile.id, internalRegisterNo, dateIso, batchRow, latePermission, ctx);
    const attendance = modifiedStudentAttendanceSync(
      profile.id,
      internalRegisterNo,
      dateIso,
      batchRow,
      latePermission,
      raw,
      0,
      ctx,
    );
    if (attendance.dept) deptList.push(attendance.dept);

    let status = '';
    let eventNote = '';
    let eventNoteHtml = '';
    let isHoliday = false;
    if (dateIso > todayIso) {
      status = '';
    } else {
      if (attendance.m === 'la') totals.late += 1;
      else if (attendance.m === 'pe') totals.per += 1;
      if (attendance.m === 'a') totals.absent += 0.5;
      else if (attendance.m === 'le') totals.leave += 0.5;
      else if (attendance.m !== 'h') totals.present += 0.5;
      if (attendance.m !== 'h') totals.total += 0.5;

      if (attendance.e === 'la') totals.late += 1;
      else if (attendance.e === 'pe') totals.per += 1;
      if (attendance.e === 'a') totals.absent += 0.5;
      else if (attendance.e === 'le') totals.leave += 0.5;
      else if (attendance.e !== 'h') totals.present += 0.5;
      if (attendance.e !== 'h') totals.total += 0.5;

      totals.per += Number(attendance.pe || 0);

      status = callStudentAttendanceFlag(attendance.m, attendance.e);
      if (attendance.minfo) {
        eventNoteHtml = String(attendance.minfo).replace(/Unauthorized:/g, '');
      }

      if (status === '-' && String(attendance.s).toLowerCase() === 'h') {
        isHoliday = true;
        status = 'h';
        eventNoteHtml = '';
        eventNote = attendance.cmd ? String(attendance.cmd) : 'Weekly Off';
      } else if (attendance.m === 'h' || attendance.e === 'h') {
        isHoliday = true;
        if (!eventNoteHtml && !eventNote) {
          eventNote = attendance.cmd ? String(attendance.cmd) : (status === 'h' ? 'Weekly Off' : '');
        }
      }
    }

    const dayDate = new Date(`${dateIso}T12:00:00`);
    const label = dateRows.length === 0 || dayDate.getDate() === 1
      ? dayDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      : String(dayDate.getDate()).padStart(2, '0');
    dateRows.push({
      date: dateIso,
      label,
      status: status.toUpperCase(),
      eventNote,
      eventNoteHtml,
      isHoliday,
    });
  }

  const departmentDetails = resolveDepartmentNames(deptList, ctx.deptNameById);
  const rangeTitle = formatRangeTitle(fromDate, toDate);
  const rangeDetail = `${formatDateDisplay(fromIso)} to ${formatDateDisplay(toIso)}`;
  const studentName = formatStudentName(profile);
  const displayReg = profile.uregister_no || profile.register_no;
  const address = formatStudentAddress(profile);
  const messageHtml = attMessage
    ? `<div class="att_message">${escapeHtml(attMessage).replace(/\r?\n/g, '<br />')}</div>`
    : '<div class="att_message"></div>';
  const calendar = buildCalendarHtml(dateRows);

  return `
<div class="container intern-att-card">
  <div class="pheader">
    <div class="title_div">
      <p class="top_heading">CRRI Internship Attendance</p>
      <p class="top_content">${escapeHtml(rangeTitle)}</p>
    </div>
  </div>
  <div class="pbody">
    <table width="100%" border="0"><tbody><tr><td valign="top">
      <p class="student_name">${escapeHtml(studentName)}</p>
      <p class="class_name">R.No: <strong>${escapeHtml(displayReg)}</strong></p>
      <p class="class_name">Department: <strong>${escapeHtml(departmentDetails)}</strong></p>
      <p class="class_name">Date: <strong>${escapeHtml(rangeDetail)}</strong></p>
    </td></tr></tbody></table>
    ${messageHtml}
    <table class="table table-bordered total_leave" width="100%"><tr>
      <td width="10%" height="35" nowrap class="att_title">Working Days</td>
      <td width="6%" class="att_tvalue"><strong>${totals.total}</strong></td>
      <td width="10%" class="att_title">Present</td>
      <td width="6%" class="att_tvalue"><strong>${totals.present}</strong></td>
      <td width="10%" class="att_title">Leave</td>
      <td width="6%" class="att_tvalue"><strong>${totals.leave}</strong></td>
      <td width="10%" class="att_title">Absent</td>
      <td width="6%" class="att_tvalue"><strong>${totals.absent}</strong></td>
      <td width="10%" class="att_title">Late</td>
      <td width="6%" class="att_tvalue"><strong>${totals.late}</strong></td>
      <td width="10%" class="att_title">Permission</td>
      <td width="6%" class="att_tvalue"><strong>${totals.per}</strong></td>
    </tr></table>
    ${calendar}
    <p class="note_content">
      <strong>Note:</strong> &nbsp; <strong>X</strong> Present | <strong>/</strong> Forenoon Present |
      <strong>\\</strong> Afternoon Present | <strong>FN</strong> Forenoon | <strong>AN</strong> Afternoon |
      <strong>L</strong> Leave | <strong>A</strong> Absent | <strong>H</strong> Holiday |
      <strong>Pr</strong> Present | <strong>Ab</strong> Absent | <strong>Le</strong> Leave |
      <strong>OD</strong> On Duty | <strong>Pe</strong> Permission | <strong>La</strong> Late
    </p>
  </div>
  <div class="pfooter">
    <table align="center" width="100%" cellspacing="0" cellpadding="0" border="0"><tbody><tr>
      <td style="padding-left:23px;" align="left" width="53%" valign="top">
        <div class="title_div" style="margin-top:50px;padding:0;">
          <p class="top_heading">CRRI Internship Attendance</p>
          <p class="top_content">${escapeHtml(rangeTitle)}</p>
        </div>
        <div style="margin-top:100px;width:100%;float:left;">
          <p class="footer_company"><strong>From<br>Adhiparasakthi Dental College &amp; Hospital</strong><br>
          GST Road, Melmaruvathur - 603319.<br>Ph: 044 - 2752 8082 &amp; 83.<br>https://www.apdch.edu.in</p>
        </div>
      </td>
      <td align="left" width="47%" valign="top">
        <table width="100%" border="0"><tbody>
          <tr><td height="50"><div style="margin:30px 30px 0 0;float:right;border:dashed 1px #999;width:55px;height:65px;line-height:65px;font-size:11px;color:#999;text-align:center;"> Stamp </div></td></tr>
          <tr><td><div style="margin-top:50px;"><p class="student_address"><strong>To</strong><br>${address}</p></div></td></tr>
        </tbody></table>
      </td>
    </tr>
    <tr><td colspan="2" align="left" valign="top" style="padding-left:23px;">
      <p class="footer_message"> Knowledge coming from experience is more important than knowledge coming from education alone. - Amma</p>
    </td></tr></tbody></table>
  </div>
</div>`;
}

async function buildInternAttCardsHtmlBatch(rollInputs, fromDate, toDate, attMessage = '', categoryKey = '') {
  const fromIso = toIsoDate(fromDate);
  const toIso = toIsoDate(toDate);
  const rolls = [...new Set(String(rollInputs || '').split(',').map((part) => part.trim()).filter(Boolean))];
  if (!rolls.length || !fromIso || !toIso) return '';

  const profilesByKey = await resolveInternStudentProfiles(rolls);
  const internalRegs = [];
  const jobs = [];
  for (const roll of rolls) {
    const profile = profilesByKey.get(roll);
    if (!profile) {
      jobs.push({ roll, error: `Student not found for ${roll}.` });
      continue;
    }
    const internalRegisterNo = String(profile.register_no);
    internalRegs.push(internalRegisterNo);
    jobs.push({ roll, profile, internalRegisterNo, batchRow: null });
  }

  const batchByReg = await bulkGetIBatches([...new Set(internalRegs)], categoryKey);
  for (const job of jobs) {
    if (job.error) continue;
    const batchRow = batchByReg.get(job.internalRegisterNo);
    if (!batchRow) {
      job.error = `Batch not found for ${job.internalRegisterNo} in the selected category.`;
      job.batchRow = null;
    } else {
      job.batchRow = batchRow;
    }
  }

  const validJobs = jobs.filter((job) => job.profile && job.batchRow);
  const registerNos = [...new Set(validJobs.map((job) => job.internalRegisterNo))];
  const studentIds = [...new Set(validJobs.map((job) => String(job.profile.id)))];
  const latePermission = await getStudentLPTime();
  const prefetch = await buildInternAttPrefetchCtx(categoryKey, fromIso, toIso, registerNos, studentIds);
  const ctx = { ...prefetch, latePermission };

  let html = '';
  for (const job of jobs) {
    if (job.error) html += `<p>${escapeHtml(job.error)}</p>`;
  }

  const cardJobs = jobs.filter((job) => job.profile && job.batchRow);
  for (let i = 0; i < cardJobs.length; i += INTERN_CARD_CONCURRENCY) {
    const slice = cardJobs.slice(i, i + INTERN_CARD_CONCURRENCY);
    const parts = slice.map((job) => renderInternAttCardHtml(
      job.profile,
      job.internalRegisterNo,
      job.batchRow,
      fromDate,
      toDate,
      attMessage,
      ctx,
    ));
    html += parts.join('');
  }
  return html;
}

export async function buildInternAttCardHtml(
  registerNo,
  fromDate,
  toDate,
  attMessage = '',
  categoryKey = '',
) {
  return buildInternAttCardsHtmlBatch(registerNo, fromDate, toDate, attMessage, categoryKey);
}

export async function loadInternAttStatementScreen(memberId, fields = {}, audit = {}) {
  const defaults = defaultInternStatementDates();

  if (fields.resolve_rolls) {
    const rollList = await resolveInternStatementRollList(
      memberId,
      fields.search_category || fields.category,
      fields.from_date,
      fields.to_date,
    );
    await logStudentAtt('istudent_att_card.php', 'View', 'Successful', 'resolve', memberId, audit);
    return {
      categoryOptions: await buildInternStatementCategoryOptions(),
      from_date: fields.from_date || defaults.from_date,
      to_date: fields.to_date || defaults.to_date,
      search_category: fields.search_category || fields.category || '',
      roll_list: rollList,
      att_message: fields.att_message || '',
    };
  }

  if (fields.generate_cards) {
    const cardsHtml = await buildInternAttCardsHtmlBatch(
      fields.roll_list || '',
      fields.from_date,
      fields.to_date,
      fields.att_message || '',
      fields.search_category || fields.category || '',
    );
    await logStudentAtt('istudent_att_card.php', 'Generate', 'Successful', String(fields.roll_list || ''), memberId, audit);
    return { cardsHtml };
  }

  if (fields.card_register_no) {
    const cardHtml = await buildInternAttCardHtml(
      fields.card_register_no,
      fields.from_date,
      fields.to_date,
      fields.att_message || '',
      fields.search_category || fields.category || '',
    );
    await logStudentAtt('istudent_att_card.php', 'Generate', 'Successful', String(fields.card_register_no), memberId, audit);
    return { cardHtml };
  }

  await logStudentAtt('istudent_att_card.php', 'View', 'Successful', '', memberId, audit);
  return {
    categoryOptions: await buildInternStatementCategoryOptions(),
    from_date: fields.from_date || defaults.from_date,
    to_date: fields.to_date || defaults.to_date,
    search_category: fields.search_category || '',
    roll_list: fields.roll_list || '',
    att_message: fields.att_message || '',
    cardsHtml: '',
  };
}
