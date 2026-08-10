import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { convertNYear } from '../../fees/feeHelpers.js';
import { logLibrarySetup, toIsoDate } from '../setupAudit.js';

// Legacy: lib_attendance_report.php (CISFLOW/library-module.md §13).
const PAGE = 'lib_attendance_report.php';
const DEBOUNCE_SECONDS = 600;

function defaultDateRange() {
  const today = new Date();
  const from = new Date(today);
  from.setMonth(from.getMonth() - 1);
  from.setDate(from.getDate() + 1);
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: today.toISOString().slice(0, 10),
  };
}

function eachDay(fromDate, toDate) {
  const days = [];
  const end = new Date(`${toDate}T00:00:00Z`).getTime();
  for (let cur = new Date(`${fromDate}T00:00:00Z`).getTime(); cur <= end; cur += 86400000) {
    days.push(new Date(cur).toISOString().slice(0, 10));
  }
  return days;
}

function dayHeaderLabel(isoDay) {
  const d = new Date(`${isoDay}T00:00:00Z`);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(d.getUTCFullYear()).slice(-2);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  return `${dd}-${mm}-${yy} | ${weekday}`;
}

/** HH:MM:SS, matching legacy converttime(). */
function formatDuration(totalSeconds) {
  const secs = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(secs / 3600);
  const mins = Math.floor((secs - hours * 3600) / 60);
  const seconds = secs - hours * 3600 - mins * 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(mins)}:${pad(seconds)}`;
}

// mysql2 returns DATETIME columns with their raw stored wall-clock value in
// the Date object's UTC fields (it does not apply a timezone conversion),
// but this process runs in Asia/Kolkata — formatting with the default local
// timezone would silently add +5:30 on top of the already-correct value.
// Force UTC so the displayed clock time matches what's actually in the DB.
function formatClock(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' }).toLowerCase();
}

/** Mirrors getLibAtt(): pairs consecutive `library_attendance` punches into
 * in/out sessions for one person on one day, collapsing any two punches
 * within 600s of each other into a single "bounce" event. A person needs
 * MORE THAN ONE qualifying punch that day (`counter>1`) for the day to count
 * as "punched" at all — a lone stray punch contributes nothing. This is the
 * third, distinct In/Out interpretation flagged in the doc (10-min debounce +
 * pairing) — implemented here exactly as this screen's section describes,
 * not the running odd/even counter or mod(sno,2) tricks used elsewhere. */
function pairPunches(punchDates) {
  let counter = 0;
  let totalSeconds = 0;
  let previousTime = null;
  let latAttTime = null;
  const spans = [];

  for (const pDate of punchDates) {
    const t = pDate.getTime();
    if (latAttTime === null || (t - latAttTime) / 1000 > DEBOUNCE_SECONDS) {
      latAttTime = t;
      if (counter % 2 === 0) {
        previousTime = pDate;
      } else if (previousTime) {
        totalSeconds += (t - previousTime.getTime()) / 1000;
        spans.push(`${formatClock(previousTime)} to ${formatClock(pDate)}`);
        previousTime = null;
      }
      counter += 1;
    }
  }

  return { totalSeconds, counter, spanLabel: spans.join(',') };
}

async function loadCourseYearOptions() {
  const setupRows = await prisma.$queryRawUnsafe(
    'SELECT ug_academic_year, pg_academic_year FROM basic_setup_tb WHERE del = 1 LIMIT 1',
  );
  const academicYearByCourseName = {
    'U.G': setupRows[0]?.ug_academic_year || '',
    'P.G': setupRows[0]?.pg_academic_year || '',
  };

  // Explicit column list — `SELECT *` pulls updated_dt, which legacy rows can
  // have as a zero date (0000-00-00 00:00:00); Prisma's raw-query DateTime
  // decoding throws on that (CLAUDE.md zero-date rule), so only select what's needed.
  const courses = await prisma.$queryRawUnsafe(
    `SELECT id, course_name, degree_name, department_name, course_duration
     FROM basic_setup_course_tb WHERE del = 1 ORDER BY c_order ASC`,
  );

  const options = [];
  for (const course of courses) {
    const courseId = String(course.id);
    const courseName = course.course_name;
    const acYear = academicYearByCourseName[courseName] || '';
    const degreeName = String(course.degree_name || '').trim();
    let departmentName = String(course.department_name || '').trim();
    departmentName = departmentName && departmentName !== '-' ? ` - ${departmentName}` : '';
    const duration = Number(course.course_duration) || 0;

    const regularGroup = `${degreeName}${departmentName} | ${acYear}${courseName === 'U.G' ? ' | Regular' : ''}`;
    for (let year = 1; year <= duration; year += 1) {
      const yearLabel = convertNYear(year);
      options.push({
        value: `${courseId}___${acYear}___${year}___regular`,
        label: `${yearLabel} Year`,
        group: regularGroup,
        courseId,
        courseName,
        academicYear: acYear,
        yearNumber: year,
        academicType: 'regular',
        sname: `${yearLabel} - ${degreeName}${departmentName}`,
      });
    }

    if (courseName === 'U.G') {
      const additionalGroup = `${degreeName}${departmentName} | ${acYear} | Additional`;
      for (let year = 1; year <= duration; year += 1) {
        const yearLabel = convertNYear(year);
        options.push({
          value: `${courseId}___${acYear}___${year}___additional`,
          label: `${yearLabel} Year`,
          group: additionalGroup,
          courseId,
          courseName,
          academicYear: acYear,
          yearNumber: year,
          academicType: 'additional',
          sname: `${yearLabel} - ${degreeName}${departmentName}`,
        });
      }
    }
  }
  return options;
}

function parseSelectedKeys(selectedKeys, options) {
  const byValue = new Map(options.map((o) => [o.value, o]));
  const out = [];
  const seen = new Set();
  for (const key of selectedKeys) {
    const opt = byValue.get(key);
    if (opt && !seen.has(key)) {
      seen.add(key);
      out.push(opt);
    }
  }
  return out;
}

async function loadGroupAttendance(option, days, fromDate, toDate) {
  const rosterRows = await prisma.$queryRawUnsafe(
    `SELECT GROUP_CONCAT(register_no SEPARATOR ',') AS regs FROM student_academic_tb
     WHERE del = 1 AND course_id = '${escapeSql(option.courseId)}'
       AND academic_year = '${escapeSql(option.academicYear)}'
       AND academic_batch = '${escapeSql(option.academicType)}'
       AND current_year = '${escapeSql(String(option.yearNumber))}'`,
  );
  const regsStr = rosterRows[0]?.regs || '';
  if (!regsStr) return { label: option.sname, rows: [] };

  const registerNos = [...new Set(regsStr.split(',').map((s) => s.trim()).filter(Boolean))];
  if (!registerNos.length) return { label: option.sname, rows: [] };

  const inClause = registerNos.map((r) => `'${escapeSql(r)}'`).join(',');

  const students = await prisma.$queryRawUnsafe(
    `SELECT register_no, student_title, student_name, student_initial FROM student_profile_tb
     WHERE del = 1 AND register_no IN (${inClause})`,
  );
  const studentByReg = new Map(students.map((s) => [s.register_no, s]));

  // Day key computed in SQL (DATE_FORMAT), not by re-parsing the returned
  // DateTime in JS with toISOString() — that re-parse crosses a UTC boundary
  // and mis-buckets rows near midnight in IST (the same class of bug already
  // fixed in entryReportSetup.js's dateKey()).
  const punchRows = await prisma.$queryRawUnsafe(
    `SELECT tktno, p_date, DATE_FORMAT(p_date, '%Y-%m-%d') AS day_key FROM library_attendance
     WHERE tktno IN (${inClause}) AND DATE(p_date) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'
     ORDER BY tktno ASC, p_date ASC`,
  );
  const punchesByRegDay = new Map();
  for (const row of punchRows) {
    const key = `${row.tktno}|${row.day_key}`;
    if (!punchesByRegDay.has(key)) punchesByRegDay.set(key, []);
    punchesByRegDay.get(key).push(new Date(row.p_date));
  }

  const rows = [];
  for (const regNo of registerNos) {
    const student = studentByReg.get(regNo);
    const title = student?.student_title ? `${student.student_title}. ` : '';
    const name = student
      ? `${title}${[student.student_name, student.student_initial].filter(Boolean).join(' ')}`.trim()
      : regNo;

    let pcount = 0;
    let ptotal = 0;
    const perDay = [];
    for (const day of days) {
      const punches = punchesByRegDay.get(`${regNo}|${day}`) || [];
      const { totalSeconds, counter, spanLabel } = pairPunches(punches);
      if (counter > 1) {
        pcount += 1;
        ptotal += totalSeconds;
        perDay.push(spanLabel);
      } else {
        perDay.push('-');
      }
    }

    const hasDuration = ptotal > 0;
    rows.push({
      registerNo: regNo,
      name,
      perDay,
      totalDays: days.length,
      punchedDays: pcount,
      time: hasDuration ? formatDuration(ptotal) : '',
      avg: hasDuration ? formatDuration(Math.floor(ptotal / pcount)) : '',
      ptotal,
    });
  }

  return { label: option.sname, rows };
}

export async function loadAttReportSetup(memberId, fields = {}, audit = {}) {
  const courseYearOptions = await loadCourseYearOptions();

  const rawKeys = fields.courseKeys || fields.selectedKeys || fields.course_name || [];
  const selectedKeys = Array.isArray(rawKeys) ? rawKeys : [rawKeys].filter(Boolean);
  const selected = parseSelectedKeys(selectedKeys, courseYearOptions);

  let { fromDate, toDate } = defaultDateRange();
  const fFrom = toIsoDate(fields.fromDate);
  const fTo = toIsoDate(fields.toDate);
  if (fFrom && fTo) {
    fromDate = fFrom;
    toDate = fTo;
  }

  const showEmpty = fields.showEmpty === true || fields.showEmpty === 1 || fields.showEmpty === '1';
  const generate = Boolean(fields.load) && Boolean(fromDate) && Boolean(toDate) && selected.length > 0;

  const days = eachDay(fromDate, toDate);
  const dayHeaders = days.map((d) => ({ date: d, label: dayHeaderLabel(d) }));

  let groups = [];
  if (generate) {
    const rawGroups = await Promise.all(selected.map((opt) => loadGroupAttendance(opt, days, fromDate, toDate)));
    groups = rawGroups.map((g) => {
      const filtered = showEmpty ? g.rows : g.rows.filter((r) => r.ptotal > 0);
      // krsort() by total punched seconds, descending; ties keep roster order (stable sort).
      filtered.sort((a, b) => b.ptotal - a.ptotal);
      const rows = filtered.map((r, idx) => ({ sn: idx + 1, ...r }));
      return { label: g.label, rows };
    });
  }

  await logLibrarySetup(
    PAGE,
    fields.load ? 'Generate' : 'View',
    'Successful',
    `${selectedKeys.join(',')} __ ${fromDate} __ ${toDate} __ ${showEmpty ? 1 : 0}`,
    memberId,
    audit,
  );

  return {
    fromDate,
    toDate,
    showEmpty,
    courseYearOptions,
    selectedKeys: selected.map((o) => o.value),
    days: dayHeaders,
    totalDays: days.length,
    generated: generate,
    groups,
  };
}

export async function saveAttReportSetup(payload, memberId, audit = {}) {
  return loadAttReportSetup(memberId, { ...payload, load: true }, audit);
}
