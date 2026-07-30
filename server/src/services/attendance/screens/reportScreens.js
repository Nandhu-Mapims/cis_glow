import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import {
  calDefaulterPending,
  callAttendanceReport,
  getAttendance,
  getAvailableLeave,
  getLPTime,
  modifiedAttendance,
} from '../staffAttendanceCore.js';
import { formatDateDisplay, logStaffAttSetup, toIsoDate } from '../setupAudit.js';
import {
  buildMonthOptions,
  categoryFilterSql,
  htmlTable,
  loadDepartments,
  loadStaffCategories,
  loadStaffProfileById,
  parseDateRange,
} from '../staffAttendanceShared.js';

function shouldGenerateReport(fields) {
  return Boolean(fields.Submit || fields.submit || fields.action === 'search' || fields.action === 'generate');
}

function normalizeCategories(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((v) => String(v).trim()).filter(Boolean);
}

function parseFromMonth(value) {
  if (!value) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const raw = String(value).trim();
  if (/^\d{2}-\d{4}$/.test(raw)) {
    const [mm, yyyy] = raw.split('-');
    return `${yyyy}-${mm}`;
  }
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  const parsed = toIsoDate(raw);
  return parsed ? parsed.slice(0, 7) : new Date().toISOString().slice(0, 7);
}

function monthDayRange(fromMonth) {
  const [y, m] = fromMonth.split('-').map(Number);
  const fromDate = `${fromMonth}-01`;
  const monthEnd = new Date(y, m, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = monthEnd > today ? today : monthEnd;
  const days = [];
  for (let cur = new Date(fromDate); cur <= end; cur.setDate(cur.getDate() + 1)) {
    days.push(cur.toISOString().slice(0, 10));
  }
  return {
    fromDate,
    toDate: end.toISOString().slice(0, 10),
    days,
  };
}

function initDayAggregate() {
  return { total: 0, present: 0, absent: 0, late: 0, permission: 0 };
}

function tallySession(dayAgg, flag) {
  const f = String(flag || '').toLowerCase();
  if (!f || f === 'h') return;
  dayAgg.total += 0.5;
  if (f === 'la') dayAgg.late += 1;
  else if (f === 'pe') dayAgg.permission += 1;
  else if (f === 'a' || f === 'le') dayAgg.absent += 1;
  else dayAgg.present += 1;
}

function aggregateAttendanceDay(dayAgg, att) {
  let mFlag = att.m;
  let eFlag = att.e;
  if (String(att.s).toLowerCase() === 'h') {
    mFlag = 'h';
    eFlag = 'h';
  }
  if (mFlag !== 'h') tallySession(dayAgg, mFlag);
  if (eFlag !== 'h' && eFlag && mFlag !== eFlag) tallySession(dayAgg, eFlag);
}

async function buildAttChartAggregates(staffRows, days, variant, audit) {
  if (!days.length || !staffRows.length) return [];

  const calendarByDate = new Map();
  if (days.length) {
    const daySql = days.map((d) => `'${escapeSql(d)}'`).join(',');
    const calRows = await prisma.$queryRawUnsafe(
      `SELECT CAST(academic_date AS CHAR) AS academic_date, academic_events, comments, academic_category
       FROM calendar_tb WHERE academic_date IN (${daySql}) AND del=1`,
    );
    for (const row of calRows) {
      calendarByDate.set(String(row.academic_date).slice(0, 10), row);
    }
  }

  const lpCache = new Map();
  const uniqueCategories = [...new Set(staffRows.map((s) => String(s.att_category || '1')))];
  await Promise.all(uniqueCategories.map(async (cat) => {
    lpCache.set(cat, await getLPTime(cat));
  }));

  const dailyAgg = Object.fromEntries(days.map((dt) => [dt, initDayAggregate()]));
  const batchSize = audit.skipLog ? 5 : 8;

  for (let i = 0; i < staffRows.length; i += batchSize) {
    const batch = staffRows.slice(i, i + batchSize);
    await Promise.all(batch.map(async (s) => {
      const lp = lpCache.get(String(s.att_category || '1'));
      for (const dt of days) {
        let att = await getAttendance(s.id, s.staff_id, dt, lp, '', {
          calendarRow: calendarByDate.get(dt) || null,
          jobCategory: s.job_category,
        });
        if (variant === 'modified' || variant === 'combined') {
          att = await modifiedAttendance(s.id, s.staff_id, dt, lp, att, 1);
        }
        aggregateAttendanceDay(dailyAgg[dt], att);
      }
    }));
  }

  return days
    .map((dt) => {
      const agg = dailyAgg[dt];
      if (!agg?.total) return null;
      const dayNum = String(new Date(dt).getDate()).padStart(2, '0');
      const weekday = new Date(dt).toLocaleDateString('en-US', { weekday: 'short' });
      return {
        date: dt,
        day: dayNum,
        weekday,
        present: agg.present,
        absent: agg.absent,
        late: agg.late,
        permission: agg.permission,
        staffCount: agg.total,
      };
    })
    .filter(Boolean);
}

async function computeStaffAttendanceCounts(s, lp, fromDate, toDate) {
  let present = 0; let absent = 0; let late = 0; let permission = 0;
  for (let m = new Date(fromDate).getTime(); m <= new Date(toDate).getTime(); m += 86400000) {
    const d = new Date(m).toISOString().slice(0, 10);
    const att = await getAttendance(s.id, s.staff_id, d, lp);
    const flag = callAttendanceReport(att.m, att.e);
    if (flag === 'X' || flag === 'p' || flag === '/') present += 1;
    else if (flag === 'a') absent += 1;
    if (att.late) late += 1;
    if (att.permission) permission += 1;
  }
  return [s.staff_id, `${s.staff_initial || ''} ${s.staff_name || ''}`.trim(), present, absent, late, permission];
}

export async function loadAttendanceReportScreen(memberId, fields = {}, audit = {}) {
  const { fromDate, toDate } = parseDateRange(fields);
  const categories = fields.search_category || [];
  let catSql = categoryFilterSql(categories);
  if (!categories.length) catSql = '';

  const bodyRows = [];
  if (shouldGenerateReport(fields)) {
    const staffRows = await prisma.$queryRawUnsafe(
      `SELECT id, staff_id, staff_name, staff_initial, att_category FROM staff_profile_tb AS A
       WHERE del=1 AND (releaving_date > '${escapeSql(fromDate)}' OR releaving_date='0000-00-00')${catSql}
       ORDER BY staff_id ASC LIMIT ${audit.skipLog ? 10 : 300}`,
    );

    // Each staff-day needs its own attendance computation (multiple raw
    // queries apiece) — done one staff at a time this was ~90ms/staff-day,
    // so 300 staff x a month blew well past any request timeout. Cache
    // getLPTime per category (shared by most staff) and batch staff
    // concurrently (same width as buildAttChartAggregates) to stay under
    // the shared Prisma pool's connection_limit=10.
    const lpCache = new Map();
    const uniqueCategories = [...new Set(staffRows.map((s) => String(s.att_category || '1')))];
    await Promise.all(uniqueCategories.map(async (cat) => {
      lpCache.set(cat, await getLPTime(cat));
    }));

    const batchSize = audit.skipLog ? 5 : 8;
    for (let i = 0; i < staffRows.length; i += batchSize) {
      const batch = staffRows.slice(i, i + batchSize);
      const results = await Promise.all(batch.map((s) => computeStaffAttendanceCounts(
        s,
        lpCache.get(String(s.att_category || '1')),
        fromDate,
        toDate,
      )));
      bodyRows.push(...results);
    }
  }

  await logStaffAttSetup('staff_attendance_report.php', fields.Submit ? 'Generate' : 'View', 'Successful', fromDate, memberId, audit);
  return {
    from_date: formatDateDisplay(fromDate),
    to_date: formatDateDisplay(toDate),
    search_category: categories,
    categories: await loadStaffCategories(),
    reportHtml: htmlTable(['Staff ID', 'Name', 'Present', 'Absent', 'Late', 'Permission'], bodyRows),
  };
}

export async function loadTeachingMonthReportScreen(memberId, fields = {}, audit = {}) {
  const { fromDate, toDate } = parseDateRange(fields);
  const categories = fields.search_category || [];
  const catSql = categories.length ? categoryFilterSql(categories) : '';

  const staffRows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id, staff_name, staff_initial, att_category FROM staff_profile_tb AS A
     WHERE del=1 AND (releaving_date > '${escapeSql(fromDate)}' OR releaving_date='0000-00-00')${catSql}
     ORDER BY staff_id ASC LIMIT 100`,
  );

  await logStaffAttSetup('teaching_staff_att_report.php', 'View', 'Successful', fromDate, memberId, audit);
  return {
    from_date: formatDateDisplay(fromDate),
    to_date: formatDateDisplay(toDate),
    report_type: fields.report_type || 'Monthly',
    search_category: categories,
    categories: await loadStaffCategories(),
    staffList: staffRows.map((s) => ({ id: Number(s.id), staffId: s.staff_id, name: s.staff_name })),
    reportHtml: '<p class="text-muted">Select staff and use Generate to load rows (or call /more endpoint per staff).</p>',
  };
}

export async function teachingMonthReportMore(fields = {}) {
  const staffRowId = Number(fields.staff_row_id || fields.sid);
  const { fromDate, toDate } = parseDateRange(fields);
  const profile = await loadStaffProfileById(staffRowId);
  if (!profile) return { error: 'Staff not found' };

  const lp = await getLPTime(profile.att_category);
  let present = 0; let absent = 0; let late = 0; let lop = 0;
  for (let m = new Date(fromDate).getTime(); m <= new Date(toDate).getTime(); m += 86400000) {
    const d = new Date(m).toISOString().slice(0, 10);
    const att1 = await getAttendance(profile.id, profile.staff_id, d, lp);
    const att = await modifiedAttendance(profile.id, profile.staff_id, d, lp, att1, 1);
    const lopDay = await calDefaulterPending(profile.id, profile.staff_id, d, toDate, lp, 1);
    const flag = callAttendanceReport(att.m, att.e);
    if (flag === 'X' || flag === 'p') present += 1;
    else if (flag === 'a') absent += 1;
    if (att.late) late += 1;
    if (lopDay.m?.length || lopDay.e?.length) lop += 1;
  }

  const rowHtml = `<tr><td>${profile.staff_id}</td><td>${profile.staff_name}</td><td>${present}</td><td>${absent}</td><td>${late}</td><td>${lop}</td></tr>`;
  return { rowHtml, present, absent, late, lop };
}

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** ISO weekday (Mon=1..Sun=7) — matches PHP date('N'). */
function isoWeekday(dateIso) {
  const [y, mo, d] = String(dateIso).split('-').map(Number);
  const js = new Date(y, mo - 1, d, 12, 0, 0).getDay();
  return js === 0 ? 7 : js;
}

function emptyWeekdayBucket() {
  return { total: 0, present: 0, absent: 0, per: 0, late: 0 };
}

/** Ports staff_yearly_report.php's per-staff attendance summary: header,
 * summary cards, a Mo-Su weekly breakdown, consecutive-absence buckets, an
 * OD/defaulter/approval box, and a full day-by-day grid. The legacy PHP
 * accumulates several of these counters in more than one place per day
 * (e.g. permission is added once per session AND again as a day total) —
 * here each counter is sourced from a single authoritative field instead of
 * replicating the double-counting, since the underlying per-session
 * attendance resolution (getAttendance/modifiedAttendance) is already a
 * faithful port and is reused as-is. */
export async function loadYearlyReportScreen(memberId, fields = {}, audit = {}) {
  const staffId = String(fields.staff_id || '').trim();
  const { fromDate, toDate } = parseDateRange(fields);
  if (!staffId || !shouldGenerateReport(fields)) {
    return { staff_id: staffId, from_date: formatDateDisplay(fromDate), to_date: formatDateDisplay(toDate), days: [] };
  }

  // SELECT * pulls in legacy zero-date columns (e.g. quarters_date =
  // '0000-00-00') that Prisma's query engine can't parse as a DateTime —
  // select only the columns this screen actually needs.
  const profile = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id, staff_name, staff_initial, staff_title, job_category, att_category
     FROM staff_profile_tb WHERE del=1 AND staff_id='${escapeSql(staffId)}' LIMIT 1`,
  );
  if (!profile[0]) return { error: 'Staff not found' };
  const s = profile[0];

  const desgRows = await prisma.$queryRawUnsafe(`
    SELECT DES.name AS designation, DEPT.name AS department
    FROM staff_designation_tb AS SD
    LEFT JOIN staff_desg_master AS DES ON DES.id = SD.designation AND DES.del=1
    LEFT JOIN staff_dept_master AS DEPT ON DEPT.id = SD.department AND DEPT.del=1
    WHERE SD.del=1 AND SD.is_academic=1 AND SD.staff_id=${Number(s.id)}
      AND SD.from_date<='${escapeSql(fromDate)}' AND (SD.to_date>='${escapeSql(fromDate)}' OR SD.to_date='0000-00-00')
    ORDER BY SD.id ASC LIMIT 1
  `);
  let designation = desgRows[0]?.designation || '';
  const department = desgRows[0]?.department || '';
  if (!designation && s.job_category) {
    const catRows = await prisma.$queryRawUnsafe(
      `SELECT category_name FROM edu_setup_tb WHERE category='Category' AND id='${escapeSql(String(s.job_category))}' LIMIT 1`,
    );
    designation = catRows[0]?.category_name || '';
  }

  const lp = await getLPTime(s.att_category);
  const lopList = await calDefaulterPending(s.id, s.staff_id, lp, fromDate, toDate, 1);
  const lopM = new Set(lopList.m);
  const lopE = new Set(lopList.e);

  const weekday = {};
  for (let i = 1; i <= 7; i += 1) weekday[i] = emptyWeekdayBucket();

  const totals = {
    totalDays: 0, working: 0, present: 0, absent: 0, cl: 0, el: 0, od: 0, permission: 0, late: 0,
    reqFromLeave: 0, reqFromDefaulter: 0, reqPostDefaulter: 0, reqPostPermission: 0,
  };
  const leaveStreaks = { 0.5: 0, 1: 0, 1.5: 0, 2: 0, 3: 0 };
  let streak = 0;
  const bumpStreak = () => {
    if (streak <= 0) return;
    const bucket = streak > 2 ? 3 : streak;
    leaveStreaks[bucket] = (leaveStreaks[bucket] || 0) + 1;
    streak = 0;
  };

  const days = [];

  for (let m = new Date(fromDate).getTime(); m <= new Date(toDate).getTime(); m += 86400000) {
    // `m` is UTC-midnight (matches the rest of this file's date-string
    // convention), but calDefaulterPending's lopDay.m/e epochs are keyed on
    // local-midnight timestamps (its own internal loop parses `${d}T00:00:00`
    // with no 'Z', which JS treats as local time) — recompute the epoch the
    // same way it does so the lopM/lopE lookups below actually match.
    const cur = new Date(m).toISOString().slice(0, 10);
    const cday = isoWeekday(cur);
    const epoch = Math.floor(new Date(`${cur}T00:00:00`).getTime() / 1000);
    totals.totalDays += 1;

    const att1 = await getAttendance(s.id, s.staff_id, cur, lp);
    const att = await modifiedAttendance(s.id, s.staff_id, cur, lp, att1, 1);

    let msinfo = att.msinfo || '';
    let mPresent = 0;
    let ePresent = 0;
    const isHoliday = String(att.s).toLowerCase() === 'h';
    if (isHoliday) {
      att.m = 'h';
      att.e = 'h';
      mPresent = 1;
      ePresent = 1;
      msinfo = att.h_str || msinfo || 'HW';
    }

    if (lopM.has(epoch) && lopE.has(epoch)) msinfo = 'Ab';
    else if (lopM.has(epoch)) msinfo = 'FN:Ab';
    else if (lopE.has(epoch)) msinfo = 'AN:Ab';

    // Morning (FN) session
    if (lopM.has(epoch)) {
      att.m = 'a';
      totals.absent += 0.5; totals.working += 0.5;
      weekday[cday].absent += 0.5; weekday[cday].total += 0.5;
    } else {
      if (att.m === 'la') { totals.late += 1; weekday[cday].late += 1; }
      if (att.attopt?.m === 'od') { totals.od += 0.5; }
      else if (att.m === 'le' && att.attopt?.m === 'cl') { totals.cl += 0.5; }
      else if (att.m === 'le' && att.attopt?.m === 'el') { totals.el += 0.5; }
      else if (att.m === 'a') { totals.absent += 0.5; weekday[cday].absent += 0.5; }
      else if (att.m !== 'h' && att.m !== 'le') { totals.present += 0.5; weekday[cday].present += 0.5; mPresent = 1; }
      if (att.m !== 'h') { totals.working += 0.5; weekday[cday].total += 0.5; }
      if (att.msrc === 'lr') totals.reqFromLeave += 0.5;
      else if (att.msrc === 'dr') totals.reqFromDefaulter += 0.5;
      if (att.m === 'a' && att.msrc === 'dr') totals.reqPostDefaulter += 0.5;
      else if (att.m === 'pe' && att.msrc === 'dr') totals.reqPostPermission += 1;
    }

    // Afternoon (AN) session
    if (lopE.has(epoch)) {
      att.e = 'a';
      totals.absent += 0.5; totals.working += 0.5;
      weekday[cday].absent += 0.5; weekday[cday].total += 0.5;
    } else {
      if (att.e === 'la') { totals.late += 1; weekday[cday].late += 1; }
      if (att.attopt?.e === 'od') { totals.od += 0.5; }
      else if (att.e === 'le' && att.attopt?.e === 'cl') { totals.cl += 0.5; }
      else if (att.e === 'le' && att.attopt?.e === 'el') { totals.el += 0.5; }
      else if (att.e === 'a') { totals.absent += 0.5; weekday[cday].absent += 0.5; }
      else if (att.e !== 'h' && att.e !== 'le') { totals.present += 0.5; weekday[cday].present += 0.5; ePresent = 1; }
      if (att.e !== 'h') { totals.working += 0.5; weekday[cday].total += 0.5; }
      if (att.esrc === 'lr') totals.reqFromLeave += 0.5;
      else if (att.esrc === 'dr') totals.reqFromDefaulter += 0.5;
      if (att.e === 'a' && att.esrc === 'dr') totals.reqPostDefaulter += 0.5;
      else if (att.e === 'pe' && att.esrc === 'dr') totals.reqPostPermission += 1;
    }

    if (mPresent === 0) streak += 0.5; else bumpStreak();
    if (ePresent === 0) streak += 0.5; else bumpStreak();

    totals.permission += att.pe || 0;
    weekday[cday].per += att.pe || 0;

    const status = callAttendanceReport(att.m, att.e).toUpperCase();
    days.push({
      date: cur,
      display: formatDateDisplay(cur),
      weekday: WEEKDAY_LABELS[cday - 1],
      status,
      mFlag: att.m || '',
      eFlag: att.e || '',
      isHoliday,
      detail: msinfo || '',
    });
  }
  bumpStreak();

  await logStaffAttSetup('staff_yearly_report.php', 'Generate', 'Successful', staffId, memberId, audit);
  return {
    staff_id: staffId,
    from_date: formatDateDisplay(fromDate),
    to_date: formatDateDisplay(toDate),
    staff: {
      staffId: s.staff_id,
      name: `${s.staff_title || ''} ${s.staff_name || ''} ${s.staff_initial || ''}`.replace(/\s+/g, ' ').trim(),
      designation,
      department,
    },
    summary: {
      totalDays: totals.totalDays,
      workingDays: totals.working,
      present: totals.present,
    },
    weekly: {
      labels: WEEKDAY_LABELS,
      working: { total: totals.working, byDay: WEEKDAY_LABELS.map((_, i) => weekday[i + 1].total) },
      present: { total: totals.present, byDay: WEEKDAY_LABELS.map((_, i) => weekday[i + 1].present) },
      leave: { total: totals.cl + totals.el + totals.absent, byDay: WEEKDAY_LABELS.map((_, i) => weekday[i + 1].absent) },
      permission: { total: totals.permission, byDay: WEEKDAY_LABELS.map((_, i) => weekday[i + 1].per) },
      late: { total: totals.late, byDay: WEEKDAY_LABELS.map((_, i) => weekday[i + 1].late) },
    },
    leaveStreaks: {
      '0.5': leaveStreaks[0.5] || 0,
      '1': leaveStreaks[1] || 0,
      '1.5': leaveStreaks[1.5] || 0,
      '2': leaveStreaks[2] || 0,
      '>2': leaveStreaks[3] || 0,
    },
    approvals: {
      od: totals.od,
      defaulter: totals.reqFromDefaulter,
      preApprovalLeave: totals.reqFromLeave,
      preApprovalPermission: totals.permission,
      postApprovalDefaulter: totals.reqPostDefaulter,
      postApprovalPermission: totals.reqPostPermission,
    },
    days,
  };
}

export async function loadAttChartScreen(memberId, fields = {}, variant = 'actual', audit = {}) {
  const fromMonth = parseFromMonth(fields.from_month);
  const categories = normalizeCategories(fields.search_category);
  const { fromDate, toDate, days } = monthDayRange(fromMonth);
  const categoryList = await loadStaffCategories();

  let dayRows = [];
  let infoMessage = 'Select at least one category and month, then click Generate.';

  if (shouldGenerateReport(fields)) {
    if (!categories.length) {
      infoMessage = 'Select at least one staff category.';
    } else if (!days.length) {
      infoMessage = 'No days available for the selected month.';
    } else {
      const catSql = categoryFilterSql(categories);
      const staffRows = await prisma.$queryRawUnsafe(
        `SELECT A.id, A.staff_id, A.staff_name, A.staff_initial, A.att_category, A.job_category
         FROM staff_profile_tb AS A
         WHERE A.del=1
           AND (CAST(A.releaving_date AS CHAR) > '${escapeSql(fromDate)}'
             OR A.releaving_date='0000-00-00'
             OR CAST(A.releaving_date AS CHAR)='')
           ${catSql}
         ORDER BY A.staff_id ASC
         LIMIT ${audit.skipLog ? 8 : 120}`,
      );
      dayRows = await buildAttChartAggregates(staffRows, days, variant, audit);
      infoMessage = dayRows.length
        ? null
        : 'No attendance data found for the selected category and month.';
    }
  }

  const variantTitle = { actual: 'Actual', modified: 'Modified', combined: 'Combined' }[variant] || 'Actual';
  const monthLabel = new Date(`${fromMonth}-01`).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const pageMap = { actual: 'staff_att_chart.php', modified: 'staff_att_chart_modified.php', combined: 'staff_att_chart_combine.php' };
  await logStaffAttSetup(pageMap[variant] || pageMap.actual, fields.Submit ? 'Generate' : 'View', 'Successful', fromMonth, memberId, audit);

  const tableRows = dayRows.map((row) => [
    `${row.day} (${row.weekday})`,
    row.present,
    row.absent,
    row.late,
    row.permission,
  ]);

  return {
    from_month: fromMonth,
    from_date: formatDateDisplay(fromDate),
    to_date: formatDateDisplay(toDate),
    search_category: categories,
    categories: categoryList,
    monthOptions: buildMonthOptions(),
    variant,
    dayRows,
    reportHtml: tableRows.length
      ? htmlTable(['Day', 'Present', 'Absent/Leave', 'Late', 'Permission'], tableRows)
      : '',
    infoMessage,
    title: dayRows.length ? `${variantTitle} Attendance Chart — ${monthLabel}` : '',
    rowCount: dayRows.length,
  };
}

export async function loadAttTimeReportScreen(memberId, fields = {}, audit = {}) {
  const category = fields.search_category || 'All';
  let catSql = '';
  if (category && category !== 'All') {
    catSql = ` AND A.job_category='${escapeSql(String(category))}'`;
  }

  const staffRows = await prisma.$queryRawUnsafe(
    `SELECT A.id, A.staff_id, A.staff_name, A.att_category FROM staff_profile_tb AS A
     WHERE A.del=1 AND (A.releaving_date > DATE(NOW()) OR A.releaving_date='0000-00-00')${catSql}
     ORDER BY A.staff_id ASC LIMIT ${audit.skipLog ? 10 : 200}`,
  );

  const bodyRows = [];
  for (const s of staffRows) {
    const schedules = await prisma.$queryRawUnsafe(
      `SELECT att_group, CAST(from_time AS CHAR) AS from_time, CAST(to_time AS CHAR) AS to_time, days
       FROM staff_att_time WHERE del=1 AND staff_id='${escapeSql(String(s.id))}' LIMIT 3`,
    );
    const schedText = schedules.map((sc) => `${sc.att_group}: ${String(sc.from_time).slice(0, 5)}-${String(sc.to_time).slice(0, 5)} (${sc.days})`).join('; ');
    const lp = await getLPTime(s.att_category);
    bodyRows.push([s.staff_id, s.staff_name, schedText || '-', lp.o?.late_time || '-']);
  }

  await logStaffAttSetup('staff_att_time_report.php', fields.Submit ? 'Generate' : 'View', 'Successful', String(category), memberId, audit);
  return {
    search_category: category,
    categories: await loadStaffCategories(),
    reportHtml: htmlTable(['Staff ID', 'Name', 'Schedule', 'Late Time'], bodyRows),
  };
}

export async function loadAvailableLeaveScreen(memberId, fields = {}, audit = {}) {
  const fromDate = toIsoDate(fields.from_date) || new Date().toISOString().slice(0, 10);
  const deptIds = fields.search_dept || [];
  const staffCategory = fields.staff_category || '';
  let filters = `A.del=1 AND (A.releaving_date > DATE(NOW()) OR A.releaving_date='0000-00-00')`;
  if (staffCategory) filters += ` AND A.job_category='${escapeSql(String(staffCategory))}'`;
  if (deptIds.length) {
    filters += ` AND A.id IN (SELECT staff_id FROM staff_designation_tb WHERE del=1 AND department IN (${deptIds.map((d) => Number(d)).join(',')}))`;
  }

  const bodyRows = [];
  if (shouldGenerateReport(fields)) {
    const staffRows = await prisma.$queryRawUnsafe(
      `SELECT A.id, A.staff_id, A.staff_name, A.att_category FROM staff_profile_tb AS A
       WHERE ${filters} ORDER BY A.staff_id ASC LIMIT ${audit.skipLog ? 10 : 200}`,
    );

    for (const s of staffRows) {
      const lp = await getLPTime(s.att_category);
      const bal = await getAvailableLeave(s.id, fromDate, lp);
      bodyRows.push([
        s.staff_id,
        s.staff_name,
        bal.a_cl,
        bal.a_el,
        bal.a_od,
        bal.a_off,
        bal.m_cl,
        bal.m_el,
      ]);
    }
  }

  await logStaffAttSetup('available_leave.php', fields.Submit ? 'Generate' : 'View', 'Successful', fromDate, memberId, audit);
  return {
    from_date: formatDateDisplay(fromDate),
    staff_category: staffCategory,
    search_dept: deptIds,
    categories: await loadStaffCategories(),
    departments: await loadDepartments(),
    reportHtml: htmlTable(['Staff ID', 'Name', 'CL', 'EL', 'OD', 'OFF', 'M.CL', 'M.EL'], bodyRows),
  };
}
