import { prisma } from '../../../config/prisma.js';
import { basicSetupCourseSelect } from '../../../utils/legacySelects.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { convertNYear } from '../../fees/feeHelpers.js';
import { logExamSetup } from '../setup/setupAudit.js';
import {
  loadReportExamOptions,
  resolveExamContext,
} from '../setup/examSetupShared.js';
import { loadAttendanceBannerUrl } from '../../attendance/studentAttendanceShared.js';

const PAGE = 'term_exam_sch_print.php';

const BATCH_STR = {
  1: 'A',
  2: 'B',
  3: 'C',
  4: 'D',
  5: 'E',
  6: 'F',
  7: 'G',
  8: 'H',
  9: 'I',
  10: 'J',
  11: 'K',
  12: 'L',
  '1,2': 'A,B',
  '3,4': 'C,D',
  '1,3': 'A,C',
  '2,4': 'B,D',
};

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function batchLabel(raw) {
  const key = String(raw ?? '').trim();
  if (!key) return '';
  return BATCH_STR[key] || key;
}

function formatLegacyDate(dateValue) {
  const raw = String(dateValue ?? '').slice(0, 10);
  if (!raw) return '';
  const [year, month, day] = raw.split('-').map(Number);
  if (!year || !month || !day) return raw;
  return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
}

function formatDayShort(dateValue) {
  const raw = String(dateValue ?? '').slice(0, 10);
  if (!raw) return '';
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3);
}

function sessionLabel(session, passType, sessionFn, sessionAn) {
  if (session === 'FN') {
    return passType === 'Clinical' ? '08:30 am to 12:30 pm' : (sessionFn || 'FN');
  }
  return sessionAn || 'AN';
}

function sharedScheduleWhere(ctx, courseId, semester, catFilter) {
  return `A.del=1 AND B.del=1 AND C.del=1
    AND A.academic_year='${escapeSql(ctx.academicYear)}'
    AND A.current_year='${semester}'
    AND A.academic_type='${escapeSql(ctx.academicType)}'
    AND A.course_id='${courseId}'
    AND A.exam_name='${ctx.examSetupId}'
    AND C.academic_year='${escapeSql(ctx.academicYear)}'
    AND C.course_id='${courseId}'
    AND C.semester_no='${semester}'
    AND C.subject_enable=1
    AND ${catFilter}`;
}

async function buildTheorySemesterHtml(ctx, course, semester) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT C.subject_name, CAST(A.exam_date AS CHAR) AS exam_date, A.exam_session
     FROM cia_schedule_tb AS A
     INNER JOIN basic_subject_marks_tb AS B ON A.subject_id=B.subject_id
     INNER JOIN basic_setup_subject_tb AS C ON C.id=B.rid
     WHERE ${sharedScheduleWhere(ctx, course.id, semester, 'B.subject_category=4')}
     ORDER BY C.subject_order+0 ASC`,
  );
  if (!rows.length) return '';

  let html = `<h4>${escapeHtml(convertNYear(semester, course.course_name))} Year - ${escapeHtml(course.degree_name || '')}</h4>`;
  html += `<table width="100%" border="0" cellspacing="0" cellpadding="5" class="table table-bordered" id="mySampleTable">
    <thead><tr bgcolor="#CCCCCC">
      <th width="23%" nowrap>Date/Day</th>
      <th width="30%" nowrap>Time</th>
      <th width="47%" nowrap>Subject | Category</th>
    </tr></thead><tbody>`;

  for (const row of rows) {
    const dateLabel = `${formatLegacyDate(row.exam_date)} / ${formatDayShort(row.exam_date)}`;
    const timeLabel = sessionLabel(row.exam_session, 'Theory', ctx.sessionFn, ctx.sessionAn);
    html += `<tr>
      <td align="center">${escapeHtml(dateLabel)}</td>
      <td align="center">${escapeHtml(timeLabel)}</td>
      <td align="center">${escapeHtml(row.subject_name || '')}</td>
    </tr>`;
  }

  html += '</tbody></table>';
  return html;
}

async function buildClinicalSemesterHtml(ctx, course, semester) {
  const subjectRows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT B.subject_id, B.short_subject_name, B.subject_category,
            A.internal_max, A.viva_max, A.external_max
     FROM cia_schedule_tb AS A
     INNER JOIN basic_subject_marks_tb AS B ON A.subject_id=B.subject_id
     INNER JOIN basic_setup_subject_tb AS C ON C.id=B.rid
     WHERE ${sharedScheduleWhere(ctx, course.id, semester, 'B.subject_category!=4')}
     ORDER BY C.subject_order+0 ASC`,
  );
  if (!subjectRows.length) return '';

  const subjectList = subjectRows.map((row) => ({
    subjectId: row.subject_id,
    subjectName: row.short_subject_name || row.subject_id,
  }));

  const dateRows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT CAST(A.exam_date AS CHAR) AS exam_date, A.exam_session
     FROM cia_schedule_tb AS A
     INNER JOIN basic_subject_marks_tb AS B ON A.subject_id=B.subject_id
     WHERE A.del=1 AND B.del=1
       AND A.academic_year='${escapeSql(ctx.academicYear)}'
       AND B.subject_category!=4
       AND A.current_year='${semester}'
       AND A.academic_type='${escapeSql(ctx.academicType)}'
       AND A.course_id='${course.id}'
       AND A.exam_name='${ctx.examSetupId}'
     ORDER BY A.exam_date ASC`,
  );
  if (!dateRows.length) return '';

  const scheduleRows = await prisma.$queryRawUnsafe(
    `SELECT CAST(A.exam_date AS CHAR) AS exam_date, A.exam_session, A.subject_id, A.batch_no
     FROM cia_schedule_tb AS A
     INNER JOIN basic_subject_marks_tb AS B ON A.subject_id=B.subject_id
     WHERE A.del=1 AND B.del=1
       AND A.academic_year='${escapeSql(ctx.academicYear)}'
       AND B.subject_category!=4
       AND A.current_year='${semester}'
       AND A.academic_type='${escapeSql(ctx.academicType)}'
       AND A.course_id='${course.id}'
       AND A.exam_name='${ctx.examSetupId}'`,
  );
  const batchMap = new Map();
  for (const row of scheduleRows) {
    const key = `${String(row.exam_date).slice(0, 10)}|${row.exam_session}|${row.subject_id}`;
    batchMap.set(key, batchLabel(row.batch_no));
  }

  let headerCols = '';
  if (ctx.examTmark > 1) {
    for (const sub of subjectList) {
      headerCols += `<th height="15" style="width: 70px;">${escapeHtml(sub.subjectName)}</th>`;
    }
  }

  let html = `<h4>${escapeHtml(convertNYear(semester, course.course_name))} Year - ${escapeHtml(course.degree_name || '')}</h4>`;
  html += `<table border="0" cellspacing="0" cellpadding="5" class="table table-bordered" id="mySampleTable">
    <thead><tr bgcolor="#CCCCCC">
      <th width="120" nowrap>Date / Day  -  Subject</th>
      <th width="120" nowrap>Time</th>
      ${headerCols}
    </tr></thead><tbody>`;

  for (const row of dateRows) {
    const dateKey = String(row.exam_date).slice(0, 10);
    const dateLabel = `${formatLegacyDate(dateKey)} / ${formatDayShort(dateKey)}`;
    const timeLabel = sessionLabel(row.exam_session, 'Clinical', ctx.sessionFn, ctx.sessionAn);
    html += `<tr>
      <td align="center">${escapeHtml(dateLabel)}</td>
      <td align="center">${escapeHtml(timeLabel)}</td>`;

    if (ctx.examTmark > 1) {
      for (const sub of subjectList) {
        const cell = batchMap.get(`${dateKey}|${row.exam_session}|${sub.subjectId}`) || '';
        html += `<td align="center">${escapeHtml(cell)}</td>`;
      }
    }

    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

const SIGNATURE_HTML = `<br>
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family: bookman antique;padding: 20px;height: 150px;">
<tr>
<td nowrap="nowrap" valign="bottom">
<p style="font-family: bookman antique;font-size: 15px;text-align: center;padding-bottom: 50px;"><strong>Member Secretary</strong></p>
</td>
<td nowrap="nowrap" valign="bottom">
<p style="font-family: bookman antique;font-size: 15px;text-align: center;padding-bottom: 50px;"><strong>Principal</strong></p>
</td>
</tr>
</table>`;

export async function buildSchedulePrintHtml(ctx, passType) {
  const examCat = passType === 'Clinical' ? 'Clinical' : 'Theory';
  const academicTypeLabel = ctx.academicType === 'additional' ? 'Additional' : 'regular';

  const courses = await prisma.basic_setup_course_tb.findMany({
    where: { del: 1, course_name: ctx.courseName },
    orderBy: { course_name: 'asc' },
    select: basicSetupCourseSelect,
  });

  let body = `<table border="0" cellspacing="0" cellpadding="5" class="table" id="total_con"><tr><td valign="top">
<div><h4 style="padding-top: 20px;text-align: center;">Terminal Exam : ${escapeHtml(ctx.academicYear)}<br>${escapeHtml(ctx.examNameLabel)} - ${escapeHtml(examCat)} - ${escapeHtml(academicTypeLabel)}</h4></div>`;

  for (const course of courses) {
    const totalSem = Number(course.total_semester) || Number(course.course_duration) || 0;
    for (let semester = 1; semester <= totalSem; semester += 1) {
      const section = passType === 'Clinical'
        ? await buildClinicalSemesterHtml(ctx, course, semester)
        : await buildTheorySemesterHtml(ctx, course, semester);
      if (!section) continue;
      body += `<div class="col-sm-12"><section>${section}</section></div>`;
    }
    body += SIGNATURE_HTML;
  }

  body += '</td></tr></table>';
  return body;
}

export async function loadSchedulePrint(memberId, fields = {}, audit = {}) {
  const examOptions = await loadReportExamOptions();
  const examId = String(fields.exam_name || '').trim();
  const passType = fields.a_pass_type === 'Clinical' ? 'Clinical' : 'Theory';
  const ctx = examId ? await resolveExamContext(examId) : null;

  let reportHtml = '';
  let bannerUrl = '';
  let printMeta = null;

  if (ctx) {
    const setup = await prisma.cia_setup.findFirst({
      where: { del: 1, id: ctx.examSetupId },
      select: { session_fn: true, session_an: true },
    });
    const enrichedCtx = {
      ...ctx,
      sessionFn: setup?.session_fn || '',
      sessionAn: setup?.session_an || '',
    };
    reportHtml = await buildSchedulePrintHtml(enrichedCtx, passType);
    bannerUrl = await loadAttendanceBannerUrl();
    printMeta = {
      title: 'Exam Schedule',
      subtitleLine1: `${ctx.examNameLabel} - ${passType}`,
      dateRange: ctx.academicYear,
    };
  }

  await logExamSetup(PAGE, 'View', 'Successful', examId, memberId, audit);
  return {
    examOptions,
    examId,
    passType,
    ctx,
    reportHtml,
    bannerUrl,
    printMeta,
  };
}

export async function saveSchedulePrint() {
  return { success: false, message: 'Report is view only' };
}
