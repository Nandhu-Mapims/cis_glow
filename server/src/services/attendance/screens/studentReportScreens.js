import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { convertNYear } from '../../fees/feeHelpers.js';
import { formatDateDisplay, toIsoDate } from '../setupAudit.js';
import {
  buildPgReportCourseOptions,
  generatePgAttendanceReportBatch,
  loadPgReportAcademicYears,
  setupPgAttendanceReport,
} from '../pgAttendanceReportCore.js';
import {
  escapeHtml,
  htmlTable,
  loadAttendanceBannerUrl,
  loadHolidayDates,
  loadInternDepartments,
  logStudentAtt,
  parseDateRange,
  wrapReportHtml,
} from '../studentAttendanceShared.js';

function punchTableName(dateStr) {
  return `punchtimedetails_${dateStr.slice(0, 4)}${Math.ceil(Number(dateStr.slice(5, 7)) / 4)}`;
}

function punchTablesForRange(fromDate, toDate) {
  const tables = new Set();
  for (
    let ts = new Date(`${fromDate}T00:00:00`);
    ts <= new Date(`${toDate}T00:00:00`);
    ts.setDate(ts.getDate() + 1)
  ) {
    tables.add(punchTableName(ts.toISOString().slice(0, 10)));
  }
  return [...tables];
}

function formatSqlDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function toSqlDateTime(value, endOfDay = false) {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    const [datePart, timePart] = raw.split('T');
    const [hh, mm] = timePart.split(':');
    return `${datePart} ${hh}:${mm}:00`;
  }
  const iso = toIsoDate(raw);
  if (!iso) return null;
  return endOfDay ? `${iso} 23:59:59` : `${iso} 00:00:00`;
}

function formatDateTimeDisplay(value) {
  const raw = String(value || '');
  if (!raw || raw.startsWith('0000-00-00')) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  let hours = d.getHours() % 12;
  if (hours === 0) hours = 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'pm' : 'am';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()} ${hours}:${minutes}:${seconds} ${ampm}`;
}

function buildTktnoFilter(rollRef) {
  const rolls = String(rollRef || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (!rolls.length) return '';
  const clauses = rolls.map((roll) => `tktno LIKE '${escapeSql(roll)}'`).join(' OR ');
  return ` AND (${clauses})`;
}

async function loadStudentNameMap(tktnos) {
  const map = new Map();
  const keys = [...new Set((tktnos || []).filter(Boolean))];
  if (!keys.length) return map;

  const registerNos = new Set();
  for (const ticket of keys) {
    registerNos.add(String(ticket));
    registerNos.add(String(ticket).replace(/^0+/, '') || String(ticket));
  }
  const inList = [...registerNos].map((registerNo) => `'${escapeSql(registerNo)}'`).join(',');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT register_no, student_name, student_initial
     FROM student_profile_tb WHERE del = 1 AND register_no IN (${inList})`,
  );
  for (const row of rows) {
    const name = `${row.student_name || ''} ${row.student_initial || ''}`.trim();
    map.set(String(row.register_no), name);
  }
  return map;
}

function resolveStudentName(studentMap, tktno) {
  const ticket = String(tktno || '');
  const trimmed = ticket.replace(/^0+/, '') || ticket;
  return studentMap.get(ticket) || studentMap.get(trimmed) || null;
}

export async function loadBiometricReportScreen(memberId, fields = {}, audit = {}) {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 2 * 3600000);
  const fromSql = toSqlDateTime(fields.from_date || fields.fromDate) || formatSqlDateTime(defaultFrom);
  const toRaw = fields.to_date || fields.toDate;
  const toSql = toRaw ? toSqlDateTime(toRaw, !String(toRaw).includes('T')) : null;
  const fromDate = fromSql.slice(0, 10);
  const toDate = toSql ? toSql.slice(0, 10) : fromDate;

  let reportHtml = null;
  if (fields.Submit) {
    const rollFilter = buildTktnoFilter(fields.roll_no || fields.registerNo);
    const machineId = escapeSql(String(fields.machine_id || '').trim());
    const machineFilter = machineId ? ` AND flag='${machineId}'` : '';

    const dateParts = [`p_date >= '${escapeSql(fromSql)}'`];
    if (toSql) dateParts.push(`p_date <= '${escapeSql(toSql)}'`);
    const dateFilter = dateParts.join(' AND ');

    const tables = toSql ? punchTablesForRange(fromDate, toDate) : [punchTableName(fromDate)];
    let rows = [];
    for (const tableName of tables) {
      const chunk = await prisma.$queryRawUnsafe(
        `SELECT tktno, p_date, upload_dt, flag, sno FROM ${tableName}
         WHERE ${dateFilter}${rollFilter}${machineFilter}
         ORDER BY id ASC`,
      ).catch(() => []);
      rows = rows.concat(chunk);
    }

    rows.sort((a, b) => new Date(a.p_date) - new Date(b.p_date));
    rows = rows.slice(0, 500);

    const studentMap = await loadStudentNameMap(rows.map((row) => row.tktno));
    const tableRows = [];
    for (const row of rows) {
      const studentName = resolveStudentName(studentMap, row.tktno);
      if (!studentName) continue;
      tableRows.push([
        escapeHtml(row.tktno),
        escapeHtml(studentName),
        escapeHtml(formatDateTimeDisplay(row.p_date)),
        escapeHtml(formatDateTimeDisplay(row.upload_dt)),
        escapeHtml(row.flag || ''),
        escapeHtml(row.sno || ''),
      ]);
    }

    const body = tableRows.length
      ? htmlTable(['Roll No', 'Student Name', 'Punch Date & Time', 'Upload Date & Time', 'Machine', 'Status'], tableRows)
      : '<p class="text-danger">No data found...</p>';
    reportHtml = wrapReportHtml('Student Biometric Report', body);
  }

  await logStudentAtt('student_bio_att.php', fields.Submit ? 'Generate' : 'View', 'Successful', fromDate, memberId, audit);
  return {
    from_date: formatDateTimeDisplay(fromSql),
    to_date: toSql ? formatDateTimeDisplay(toSql) : '',
    reportHtml,
  };
}

function formatLegacyMonthDate(value) {
  const raw = String(value || '').slice(0, 10);
  if (!raw || raw.startsWith('0000')) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function buildHolidayLeaveLabel(fromDate, toDate) {
  const fromLabel = formatLegacyMonthDate(fromDate);
  const toLabel = formatLegacyMonthDate(toDate);
  if (!fromLabel) return '';
  if (!toLabel || fromLabel === toLabel) return fromLabel;
  return `${fromLabel} to ${toLabel}`;
}

function buildHolidaySignatureFooterHtml() {
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:'Bookman Old Style',serif;text-align:center;padding:20px;height:150px;">
    <tr>
      <td nowrap valign="bottom">
        <p style="font-family:'Bookman Old Style',serif;font-size:15px;text-align:center;"><strong>Prof.Dr.V.Sudhakar,MDS</strong><br><small>Principal</small></p>
      </td>
      <td nowrap valign="bottom">
        <p style="font-family:'Bookman Old Style',serif;font-size:15px;text-align:center;"><strong>Dr.T.Ramesh</strong><br><small>Correspondent</small></p>
      </td>
      <td nowrap valign="bottom">
        <p style="font-family:'Bookman Old Style',serif;font-size:15px;text-align:center;"><strong>Thirumathi V.Lakshmi</strong><br><small>Executive Trustee / Vice President</small></p>
      </td>
    </tr>
  </table>`;
}

function buildHolidayReportHtml({ letterDate, leaveLabel, rows }) {
  const bodyRows = rows.length
    ? rows.map((row, index) => `<tr>
        <td valign="middle" style="text-align:center;vertical-align:middle;">${index + 1}</td>
        <td height="45" nowrap valign="middle" style="text-align:center;vertical-align:middle;">${escapeHtml(row.date)}</td>
        <td height="45" nowrap valign="middle" style="text-align:center;vertical-align:middle;">${escapeHtml(row.holiday)}</td>
      </tr>`).join('')
    : '';

  return `<div id="form_details_panel" class="holiday-report-print">
    <p style="float:right;font-family:'Bookman Old Style',serif;font-size:16px;">Date: ${escapeHtml(formatDateDisplay(letterDate))}</p>
    <p style="clear:both;text-align:center;font-family:'Bookman Old Style',serif;font-size:18px;"><strong>List of Holidays<br>(Leave on ${escapeHtml(leaveLabel)})</strong></p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" class="table sal_note_table-bordered" style="font-family:'Bookman Old Style',serif;text-align:center;padding:20px;vertical-align:middle;">
      <thead>
        <tr bgcolor="#CCCCCC">
          <th width="10%" style="text-align:center;">#</th>
          <th width="30%" style="text-align:center;">Date</th>
          <th width="60%" style="text-align:center;">Holiday</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
    ${buildHolidaySignatureFooterHtml()}
  </div>`;
}

async function loadHolidayCategories() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, event_name FROM basic_cal_event
     WHERE del = 1 AND event_option = 'Holiday'
     ORDER BY event_name ASC`,
  );
  return rows.map((row) => ({ id: Number(row.id), name: row.event_name }));
}

export async function loadHolidayReportScreen(memberId, fields = {}, audit = {}) {
  const categories = await loadHolidayCategories();
  const { fromDate, toDate } = parseDateRange(fields);
  const letterDate = toIsoDate(fields.letter_date || fields.letterDate) || fromDate;
  const category = String(fields.category || '').trim();
  const generate = Boolean(fields.Submit === 'Generate' || fields.generate);

  if (!generate) {
    await logStudentAtt('holiday_report.php', 'View', 'Successful', '', memberId, audit);
    return {
      from_date: formatDateDisplay(fromDate),
      to_date: formatDateDisplay(toDate),
      letter_date: formatDateDisplay(letterDate),
      category,
      categories,
      reportHtml: null,
    };
  }

  let where = `del = 1 AND CAST(academic_date AS CHAR) NOT LIKE '0000-%'
    AND academic_date BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'`;
  if (category) {
    where += ` AND academic_events = '${escapeSql(category)}'`;
  } else {
    where += " AND academic_events LIKE 'Holiday%'";
  }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT CAST(academic_date AS CHAR) AS academic_date, academic_events, comments
     FROM academic_calender_tb WHERE ${where} ORDER BY academic_date ASC LIMIT 500`,
  );

  const tableRows = rows.map((row) => ({
    date: formatLegacyMonthDate(row.academic_date),
    holiday: row.comments || row.academic_events || '',
  }));

  const reportHtml = buildHolidayReportHtml({
    letterDate,
    leaveLabel: buildHolidayLeaveLabel(fromDate, toDate),
    rows: tableRows,
  });

  await logStudentAtt('holiday_report.php', 'Generate', 'Successful', fromDate, memberId, audit);
  return {
    from_date: formatDateDisplay(fromDate),
    to_date: formatDateDisplay(toDate),
    letter_date: formatDateDisplay(letterDate),
    category,
    categories,
    reportHtml,
  };
}

export async function loadUgAttReportScreen(memberId, fields = {}, audit = {}) {
  const studentRef = String(fields.student_id || fields.studentId || '').trim();
  if (!fields.Submit && !studentRef) {
    await logStudentAtt('attendance_ug_report.php', 'View', 'Successful', '', memberId, audit);
    return { reportHtml: null, student_id: '' };
  }
  if (!studentRef) {
    return { error: 'Student ID (register number) is required' };
  }

  const profile = await prisma.$queryRawUnsafe(
    `SELECT id, register_no, student_name, student_initial, course_id
     FROM student_profile_tb WHERE del = 1 AND register_no = '${escapeSql(studentRef)}' LIMIT 1`,
  );
  if (!profile.length) {
    await logStudentAtt('attendance_ug_report.php', 'Generate', 'Unsuccessful', studentRef, memberId, audit);
    return {
      student_id: studentRef,
      reportHtml: wrapReportHtml('UG Attendance Report', '<p>Student not found.</p>'),
    };
  }

  const student = profile[0];
  const registerNo = String(student.register_no).toLowerCase();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT CAST(academic_date AS CHAR) AS academic_date, att_period, att_present, att_absent
     FROM student_att_tb WHERE del = 1 AND course_id = '${escapeSql(String(student.course_id))}'
     ORDER BY academic_date DESC, att_period ASC LIMIT 500`,
  );

  const tableRows = [];
  for (const row of rows) {
    const presentList = String(row.att_present || '').toLowerCase().split(',').map((v) => v.trim());
    const absentList = String(row.att_absent || '').toLowerCase().split(',').map((v) => v.trim());
    let status = '';
    if (presentList.includes(registerNo)) status = 'Present';
    else if (absentList.includes(registerNo)) status = 'Absent';
    else continue;

    tableRows.push([
      escapeHtml(formatDateDisplay(row.academic_date)),
      escapeHtml(row.att_period),
      escapeHtml(status),
      escapeHtml(status === 'Present' ? registerNo : ''),
      escapeHtml(status === 'Absent' ? registerNo : ''),
    ]);
  }

  const title = `${student.student_name || ''} ${student.student_initial || ''}`.trim();
  const name = `${title} (${student.register_no})`.trim();
  await logStudentAtt('attendance_ug_report.php', 'Generate', 'Successful', studentRef, memberId, audit);
  return {
    student_id: studentRef,
    reportHtml: wrapReportHtml(
      `UG Attendance — ${escapeHtml(name)}`,
      htmlTable(['Date', 'Period', 'Status', 'Present', 'Absent'], tableRows),
    ),
  };
}

export async function loadPgReportsAttScreen(memberId, fields = {}, audit = {}) {
  const { academicYears, defaultAcademicYear } = await loadPgReportAcademicYears();
  const academicYear = fields.academic_year || defaultAcademicYear;
  const courseData = await buildPgReportCourseOptions(academicYear, memberId);
  const courseOptions = (courseData.courseGroups || []).flatMap((group) => (
    group.options.map((opt) => ({
      ...opt,
      groupLabel: group.groupLabel,
    }))
  ));
  const { fromDate, toDate } = parseDateRange(fields);
  const selectedKeys = Array.isArray(fields.course_name)
    ? fields.course_name.filter(Boolean)
    : (fields.course_name ? [fields.course_name] : []);
  const reportType = fields.report_type === 'Overall' ? 'Overall' : 'Monthly';
  const clearCache = Boolean(fields.cleariCache || fields.clearCache);
  const hideAbinfo = Boolean(fields.hideAbinfo);

  await logStudentAtt('pg_attendance_report.php', fields.Submit ? 'Generate' : 'View', 'Successful', fromDate, memberId, audit);
  return {
    academicYears,
    academic_year: academicYear,
    courseOptions,
    course_name: selectedKeys,
    report_type: reportType,
    from_date: formatDateDisplay(fromDate),
    to_date: formatDateDisplay(toDate),
    cleariCache: clearCache,
    hideAbinfo,
    reportHtml: null,
  };
}

export async function loadInternReportsAttScreen(memberId, fields = {}, audit = {}) {
  const { fromDate, toDate } = parseDateRange(fields);
  const departments = await loadInternDepartments();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT CAST(academic_date AS CHAR) AS academic_date, att_period, att_present, att_absent
     FROM student_iatt_tb WHERE del=1
       AND academic_date BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'
     ORDER BY academic_date ASC LIMIT 500`,
  );
  const tableRows = rows.map((r) => [
    escapeHtml(formatDateDisplay(r.academic_date)),
    escapeHtml(r.att_period),
    escapeHtml(String(r.att_present || '').slice(0, 60)),
    escapeHtml(String(r.att_absent || '').slice(0, 60)),
  ]);
  await logStudentAtt('istudent_att_report.php', fields.Submit ? 'Generate' : 'View', 'Successful', fromDate, memberId, audit);
  return { departments, from_date: formatDateDisplay(fromDate), to_date: formatDateDisplay(toDate), reportHtml: wrapReportHtml('Internship Attendance Report', htmlTable(['Date', 'Period', 'Present', 'Absent'], tableRows)) };
}

export { loadInternAttStatementScreen } from '../internAttStatementCore.js';

async function buildPgPunchCourseOptions() {
  const setup = await prisma.basic_setup_tb.findFirst({
    where: { del: 1 },
    select: { pg_academic_year: true },
  });
  const courses = await prisma.$queryRawUnsafe(
    `SELECT id, degree_name, department_name, course_duration FROM basic_setup_course_tb
     WHERE del = 1 AND course_name = 'P.G' ORDER BY c_order ASC`,
  );
  const options = [];
  for (const course of courses) {
    const dept = course.department_name && course.department_name !== '-'
      ? ` - ${course.department_name}`
      : '';
    const groupLabel = `${course.degree_name}${dept} | ${setup?.pg_academic_year || ''}`;
    const shortDept = course.department_name && course.department_name !== '-'
      ? course.department_name
      : '';
    const deptSuffix = course.department_name && course.department_name !== '-'
      ? ` - ${course.department_name}`
      : '';
    const duration = Number(course.course_duration) || 1;
    for (let year = 1; year <= duration; year += 1) {
      options.push({
        value: `${course.id}___${setup?.pg_academic_year || ''}___${year}`,
        label: `Year ${year}`,
        groupLabel,
        shortLabel: `${shortDept || course.degree_name} Year ${year}`,
        groupRowLabel: `${convertNYear(year, 'P.G')}${deptSuffix}`,
      });
    }
  }
  return options;
}

function formatPunchTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const hours = String(d.getHours() % 12 || 12).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'pm' : 'am';
  return `${hours}:${minutes}${ampm}`;
}

/** Legacy pg_attendance_punch.php — local calendar date YYYY-MM-DD from punch row. */
function punchDateToLocalIso(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

function eachLocalDateIso(fromIso, toIso) {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  const dates = [];
  const cur = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  while (cur <= end) {
    dates.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`,
    );
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function normalizeRollNo(value) {
  return String(value ?? '').trim();
}

function buildPgPunchReportHtml(courseOptions, selectedKeys, fromDate, toDate, studentsByKey, punchesByRollDate) {
  const dateIsoList = eachLocalDateIso(fromDate, toDate);

  const headerCells = dateIsoList.map((dateIso) => {
    const [y, m, d] = dateIso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const label = `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${String(y).slice(-2)} | ${dt.toLocaleDateString('en-US', { weekday: 'short' })}`;
    return `<th width="20" nowrap><div class="att_vtext">${label}</div></th>`;
  }).join('');

  let counter = 0;
  let body = `<div class="att_report_span pg-punch-report-table">
  <style>
    .att_report_span.pg-punch-report-table table { background: #FFF; width: 100%; border-collapse: collapse; }
    .att_report_span.pg-punch-report-table th,
    .att_report_span.pg-punch-report-table td {
      border: 1px solid #333;
      padding: 4px 5px;
      font-size: 11px;
      vertical-align: top;
    }
    .att_report_span.pg-punch-report-table .att_vtext {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      white-space: nowrap;
      font-size: 10px;
      margin: 0 auto;
      width: 20px;
    }
  </style>
  <table width="100%" border="0" cellspacing="0" cellpadding="5" class="table table-bordered">
    <thead><tr bgcolor="#CCCCCC"><th width="30" height="100">#</th><th width="200" nowrap>Student Name</th>${headerCells}</tr></thead><tbody>`;

  for (const key of selectedKeys) {
    const students = studentsByKey.get(key) || [];
    if (!students.length) continue;
    const opt = courseOptions.find((o) => o.value === key);
    body += `<tr bgcolor="#F4F4F4"><td colspan="${dateIsoList.length + 2}">${escapeHtml(opt?.groupRowLabel || opt?.shortLabel || key)}</td></tr>`;
    for (const student of students) {
      counter += 1;
      const name = `${student.student_name || ''} ${student.student_initial || ''}`.trim();
      const registerNo = normalizeRollNo(student.register_no);
      body += `<tr><td>${counter}</td><td>${escapeHtml(registerNo)}<br>${escapeHtml(name)}</td>`;
      for (const dateIso of dateIsoList) {
        const times = punchesByRollDate.get(`${registerNo}:${dateIso}`) || [];
        body += `<td>${escapeHtml(times.join(', '))}</td>`;
      }
      body += '</tr>';
    }
  }

  body += '</tbody></table></div>';
  return body;
}

function buildPgPunchPrintMeta(reportTitle, fromDate, toDate, academicYear) {
  return {
    title: String(reportTitle || 'P.G Punch Report').toUpperCase(),
    subtitleLine1: `${formatDateDisplay(fromDate)} to ${formatDateDisplay(toDate)}`,
    dateRange: academicYear ? `Academic Year: ${academicYear}` : '',
  };
}

export async function loadPgPunchScreen(memberId, fields = {}, audit = {}, options = {}) {
  const legacyFile = options.legacyFile || 'pg_attendance_punch.php';
  const reportTitle = options.reportTitle || 'P.G Punch Report';
  const setup = await prisma.basic_setup_tb.findFirst({
    where: { del: 1 },
    select: { pg_academic_year: true },
  });
  const courseOptions = await buildPgPunchCourseOptions();
  const { fromDate, toDate } = parseDateRange(fields);
  const selectedKeys = Array.isArray(fields.course_name)
    ? fields.course_name.filter(Boolean)
    : (fields.course_name ? [fields.course_name] : []);

  let reportHtml = null;
  let printMeta = null;
  let bannerUrl = '';
  if (fields.Submit && selectedKeys.length) {
    const studentsByKey = new Map();
    const allRegisterNos = new Set();

    for (const key of selectedKeys) {
      const [courseId, academicYear, currentYear] = String(key).split('___');
      if (!courseId || !academicYear || !currentYear) continue;
      const students = await prisma.$queryRawUnsafe(
        `SELECT A.register_no, A.student_name, A.student_initial
         FROM student_profile_tb AS A
         INNER JOIN student_academic_tb AS B
           ON A.id = B.s_id AND A.course_id = B.course_id AND A.register_no = B.register_no
         WHERE A.del = 1 AND B.del = 1
           AND A.course_id = '${escapeSql(courseId)}'
           AND B.current_year = '${escapeSql(currentYear)}'
           AND B.academic_year = '${escapeSql(academicYear)}'
           AND (CAST(A.releaving_date AS CHAR) = '0000-00-00' OR A.releaving_date >= '${escapeSql(fromDate)}')
         ORDER BY A.register_no ASC`,
      );
      studentsByKey.set(key, students);
      for (const student of students) allRegisterNos.add(normalizeRollNo(student.register_no));
    }

    const punchesByRollDate = new Map();
    const registerNos = [...allRegisterNos].filter(Boolean);
    if (registerNos.length) {
      const rollIn = registerNos.map((r) => `'${escapeSql(r)}'`).join(',');
      for (const tbl of punchTablesForRange(fromDate, toDate)) {
        const punches = await prisma.$queryRawUnsafe(
          `SELECT tktno, CAST(p_date AS CHAR) AS p_date FROM ${tbl}
           WHERE DATE(p_date) >= '${escapeSql(fromDate)}' AND DATE(p_date) <= '${escapeSql(toDate)}'
             AND tktno IN (${rollIn})
           ORDER BY p_date ASC`,
        ).catch(() => []);
        for (const punch of punches) {
          const registerNo = normalizeRollNo(punch.tktno);
          const dateIso = punchDateToLocalIso(punch.p_date);
          if (!registerNo || !dateIso) continue;
          const mapKey = `${registerNo}:${dateIso}`;
          if (!punchesByRollDate.has(mapKey)) punchesByRollDate.set(mapKey, []);
          punchesByRollDate.get(mapKey).push(formatPunchTime(punch.p_date));
        }
      }
    }

    reportHtml = buildPgPunchReportHtml(
      courseOptions,
      selectedKeys,
      fromDate,
      toDate,
      studentsByKey,
      punchesByRollDate,
    );
    const academicYear = selectedKeys[0]?.split('___')[1] || setup?.pg_academic_year || '';
    printMeta = buildPgPunchPrintMeta(reportTitle, fromDate, toDate, academicYear);
    bannerUrl = await loadAttendanceBannerUrl();
  }

  await logStudentAtt(legacyFile, fields.Submit ? 'Generate' : 'View', 'Successful', fromDate, memberId, audit);
  return {
    courseOptions,
    course_name: selectedKeys,
    from_date: formatDateDisplay(fromDate),
    to_date: formatDateDisplay(toDate),
    reportHtml,
    printMeta,
    bannerUrl,
  };
}

export async function loadPgPunchEntryScreen(memberId, fields = {}, audit = {}) {
  return loadPgPunchScreen(memberId, fields, audit, {
    legacyFile: 'pg_attendance_punch_add.php',
    reportTitle: 'P.G Punch Entry',
  });
}
