import { prisma } from '../../../../config/prisma.js';
import { escapeSql } from '../../../../utils/sqlSafe.js';
import { logAcademicSetup } from '../../setup/setupAudit.js';
import {
  buildSubjectScheduleCourseOptions,
  parseSubjectScheduleCourseKey,
} from '../../academicSetupShared.js';
import {
  escapeHtml,
  loadStaffNameMap,
  loadTimetableCategoryMap,
  wrapReportPanel,
} from './reportShared.js';

const PAGE = 'subject_schedule_report.php';

function monthStart(val) {
  if (val && /^\d{4}-\d{2}/.test(String(val))) return `${String(val).slice(0, 7)}-01`;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function addMonths(iso, delta) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + delta);
  return d.toISOString().slice(0, 10);
}

function formatPeriodTime(fromTime, toTime) {
  const fmt = (t) => {
    if (!t || String(t) === '00:00:00') return '';
    const d = new Date(`1970-01-01T${t}`);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  };
  const f = fmt(fromTime);
  const t = fmt(toTime);
  return f && t ? `${f} - ${t}` : '';
}

export async function loadSubjectScheduleReportSetup(memberId, fields = {}, audit = {}) {
  const courseYearOptions = await buildSubjectScheduleCourseOptions();
  const selection = parseSubjectScheduleCourseKey(fields.course_name || fields.cid);
  const monthFrom = monthStart(fields.m || fields.report_month);
  const monthTo = addMonths(monthFrom, 1);
  const currentMonthLabel = new Date(monthFrom).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const preMonth = addMonths(monthFrom, -1);
  const nextMonth = addMonths(monthFrom, 1);
  let html = '';

  if (selection) {
    const course = await prisma.basic_setup_course_tb.findFirst({ where: { del: 1, id: selection.courseId } });
    const academicType = selection.academicType || 'regular';
    const categoryMap = await loadTimetableCategoryMap();
    const staffMap = await loadStaffNameMap();
    const studentRows = await prisma.student_profile_tb.findMany({ where: { del: 1 }, select: { id: true, student_title: true, student_name: true, student_initial: true } });
    const studentMap = Object.fromEntries(studentRows.map((s) => [s.id, `${s.student_title ? `${s.student_title}. ` : ''}${s.student_name || ''} ${s.student_initial || ''}`.trim()]));
    const topicRows = await prisma.$queryRawUnsafe(
      `SELECT C.id, U.name AS unit_name, C.name AS topic_name
       FROM basic_subject_new_unit AS U INNER JOIN basic_subject_new_chapter AS C ON U.id = C.u_id
       WHERE U.del = 1 AND C.del = 1 ORDER BY C.name ASC`,
    );
    const topicMap = Object.fromEntries(topicRows.map((t) => [t.id, `${t.unit_name} | ${t.topic_name}`]));
    const batchLetters = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F' };
    const periodCache = {};
    const subjectCache = {};

    let body = `<h4 class="text-center">${escapeHtml(currentMonthLabel)}</h4>
<table class="table table-bordered table-sm"><thead class="table-secondary"><tr>
<th>Day</th><th>Period</th><th>Time</th><th>Subject</th><th>Type</th><th>Room</th><th>Staff</th><th>PG</th><th>Topic</th>
</tr></thead><tbody>`;

    for (let m = new Date(monthFrom).getTime(); m <= new Date(monthTo).getTime(); m += 86400000) {
      const curDate = new Date(m).toISOString().slice(0, 10);
      const day = new Date(m).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const cal = await prisma.$queryRawUnsafe(
        `SELECT academic_events, course_type FROM academic_calender_tb WHERE academic_date = '${escapeSql(curDate)}' AND del = 1 LIMIT 1`,
      );
      const ev = String(cal[0]?.academic_events || '').toLowerCase();
      const classList = String(cal[0]?.course_type || '').split(',,,');
      const classContain = !cal[0]?.course_type || classList.includes(course?.course_name || '');
      const isWorking = (ev === 'working' && classContain) || (ev === 'holiday' && !classContain) || !cal[0];
      const rowClass = isWorking ? '' : ' class="table-secondary"';

      const ttRows = await prisma.$queryRawUnsafe(
        `SELECT DISTINCT subject_id, course_id, academic_year, current_year, academic_type, period, batch_no, id
         FROM timetable_tb_new
         WHERE del = 1 AND t_day = '${escapeSql(day)}' AND academic_type = '${escapeSql(academicType)}'
           AND course_id = '${escapeSql(String(selection.courseId))}'
           AND current_year = '${escapeSql(String(selection.semester))}'
           AND academic_year = '${escapeSql(selection.academicYear)}'
           AND from_date <= '${escapeSql(curDate)}' AND from_date != '0000-00-00'
           AND (to_date >= '${escapeSql(curDate)}' OR to_date = '0000-00-00')
         ORDER BY period ASC`,
      );

      for (const row of ttRows) {
        const pKey = `${course?.course_name}_${selection.semester}_${academicType}_${day}_${row.period}`;
        if (!periodCache[pKey]) {
          const dayEsc = escapeSql(day.charAt(0).toUpperCase() + day.slice(1));
          const pRows = await prisma.$queryRawUnsafe(
            `SELECT from_time, to_time FROM period_set_up
             WHERE del != 0 AND period_no = '${escapeSql(String(row.period))}'
               AND course_name = '${escapeSql(course?.course_name || '')}'
               AND academic_year = '${escapeSql(String(selection.semester))}'
               AND academic_type = '${escapeSql(academicType)}'
               AND (p_days = '${dayEsc}' OR p_days LIKE '${dayEsc},%' OR p_days LIKE '%,${dayEsc}' OR p_days LIKE '%,${dayEsc},%')
             LIMIT 1`,
          );
          periodCache[pKey] = formatPeriodTime(pRows[0]?.from_time, pRows[0]?.to_time);
        }

        if (!subjectCache[row.subject_id]) {
          const sub = await prisma.basic_subject_tt_tb.findFirst({ where: { del: 1, id: Number(row.subject_id) } });
          subjectCache[row.subject_id] = sub ? {
            name: sub.subject_name,
            cat: categoryMap[String(sub.subject_category)] || '',
            batch: sub.s_batch,
          } : { name: '', cat: '', batch: 0 };
        }
        const subInfo = subjectCache[row.subject_id];
        const batchSub = subInfo.cat === 'Lecture' ? '' : (batchLetters[row.batch_no] || row.batch_no || '');

        const sch = await prisma.$queryRawUnsafe(
          `SELECT staff_id, topic_id, pg_std_id FROM timetable_tb
           WHERE del = 1 AND course_id = '${escapeSql(String(row.course_id))}'
             AND academic_year = '${escapeSql(row.academic_year)}' AND current_year = '${escapeSql(String(row.current_year))}'
             AND academic_type = '${escapeSql(academicType)}' AND subject_id = '${escapeSql(String(row.subject_id))}'
             AND from_date = '${escapeSql(curDate)}' LIMIT 1`,
        );
        const schRow = sch[0] || {};

        body += `<tr${rowClass}>
          <td nowrap>${new Date(m).toLocaleDateString('en-GB')}<br>${escapeHtml(day)}</td>
          <td class="text-center">${escapeHtml(row.period)}</td>
          <td class="text-center">${escapeHtml(periodCache[pKey])}</td>
          <td>${escapeHtml(subInfo.name)}</td>
          <td class="text-center">${escapeHtml(subInfo.cat)}</td>
          <td class="text-center">${escapeHtml(batchSub)}</td>
          <td>${escapeHtml(staffMap[schRow.staff_id] || '')}</td>
          <td>${escapeHtml(studentMap[schRow.pg_std_id] || '')}</td>
          <td>${escapeHtml(topicMap[schRow.topic_id] || '')}</td>
        </tr>`;
      }
    }
    body += '</tbody></table>';
    html = wrapReportPanel(body);
  }

  await logAcademicSetup(PAGE, 'View', 'Successful', fields.course_name || '', memberId, audit);
  return {
    courseYearOptions,
    courseYearKey: fields.course_name || '',
    selection,
    reportMonth: monthFrom.slice(0, 7),
    monthFrom,
    preMonth,
    nextMonth,
    currentMonthLabel,
    html,
  };
}

export async function saveSubjectScheduleReportSetup(memberId, fields = {}, audit = {}) {
  return loadSubjectScheduleReportSetup(memberId, fields, audit);
}
