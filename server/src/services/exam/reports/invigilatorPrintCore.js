import { prisma } from '../../../config/prisma.js';
import { basicSetupCourseSelect } from '../../../utils/legacySelects.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { convertNYear } from '../../fees/feeHelpers.js';
import { loadAttendanceBannerUrl } from '../../attendance/studentAttendanceShared.js';
import { logExamSetup } from '../setup/setupAudit.js';
import {
  loadReportExamOptions,
  resolveExamContext,
} from '../setup/examSetupShared.js';

const PAGE = 'term_exam_Inviliga_sch_print.php';

const TERMINAL_WORDS = {
  1: 'First Terminal',
  2: 'Second Terminal',
  3: 'Third Terminal',
  4: 'Fourth Terminal',
  5: 'University',
};

const NOTE_HTML = `<div style="font-size: 15px;text-align: left;"><strong>Note:</strong><br>
* No Exchange of Invigilation duties permitted. No Leave / Week off is strictly permitted on the day of invigilation.<br>
* Invigilators have to report 30 minutes before commencement of exams to the examination hall</div>`;

const SIGNATURE_HTML = `<br>
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family: bookman antique;text-align: center;padding: 20px;height: 150px;">
<tr>
<td nowrap="nowrap" valign="bottom">
<p style="font-family: bookman antique;font-size: 15px;text-align: center;padding-bottom: 50px;"><strong>Examination Committee<br></strong>Member Sectratary</p>
</td>
<td nowrap="nowrap" valign="bottom">
<p style="font-family: bookman antique;font-size: 15px;text-align: right;padding-right: 150px;padding-bottom: 50px;"><strong>Principal</strong></p>
</td>
</tr>
</table>`;

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatLegacyDate(dateValue) {
  const raw = String(dateValue ?? '').slice(0, 10);
  if (!raw) return '';
  const [year, month, day] = raw.split('-').map(Number);
  if (!year || !month || !day) return raw;
  return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
}

function formatDayLabel(dateValue) {
  const raw = String(dateValue ?? '').slice(0, 10);
  if (!raw) return '';
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { weekday: 'long' }).slice(0, 12);
}

function sessionTimeLabel(session, sessionFn, sessionAn) {
  return session === 'FN' ? (sessionFn || 'FN') : (sessionAn || 'AN');
}

function resolveSessionType(fields) {
  return fields.a_session_type === 'Afternoon' ? 'AN' : 'FN';
}

async function loadStaffOrderClause() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT GROUP_CONCAT(s_order SEPARATOR \', \') AS staff_order FROM staff_order LIMIT 1',
  );
  const order = String(rows[0]?.staff_order || '').trim().replace(/,\s*$/, '');
  if (!order) return ' ORDER BY staff_name ASC, staff_initial ASC';
  return ` ORDER BY FIELD(id, ${order})`;
}

async function loadInvigilatorNameMap() {
  const orderClause = await loadStaffOrderClause();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_name, staff_initial, staff_title FROM staff_profile_tb
     WHERE del=1 AND job_category=255 AND (releaving_date='0000-00-00' OR releaving_date > DATE(NOW()))
     ${orderClause}`,
  );
  const map = {};
  for (const row of rows) {
    const name = [row.staff_title, row.staff_name, row.staff_initial]
      .filter(Boolean)
      .join(' ')
      .trim();
    map[String(row.id)] = name;
  }
  return map;
}

function invigilatorNames(rawIds, invigilatorMap) {
  const ids = String(rawIds || '').split(',').map((v) => v.trim()).filter(Boolean);
  return ids
    .map((id) => invigilatorMap[id])
    .filter(Boolean)
    .join('<br>');
}

async function loadStudentCount(courseId, academicYear, currentYear, academicType) {
  const [row] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(A.id) AS cnt
     FROM student_profile_tb AS A
     INNER JOIN student_academic_tb AS B ON A.id=B.s_id
     WHERE A.del=1 AND B.del=1
       AND A.course_id='${escapeSql(String(courseId))}'
       AND B.course_id='${escapeSql(String(courseId))}'
       AND B.academic_year='${escapeSql(academicYear)}'
       AND B.current_year='${currentYear}'
       AND B.academic_batch='${escapeSql(academicType)}'`,
  );
  return Number(row?.cnt) || 0;
}

async function buildTheoryInvigilatorHtml(ctx, course, sessionType, invigilatorMap, examNameId) {
  const dateRows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT CAST(A.exam_date AS CHAR) AS exam_date, A.exam_session
     FROM cia_schedule_tb AS A
     INNER JOIN basic_subject_marks_tb AS B ON A.subject_id=B.subject_id
     WHERE A.del=1 AND B.del=1
       AND A.academic_year='${escapeSql(ctx.academicYear)}'
       AND A.academic_type='${escapeSql(ctx.academicType)}'
       AND B.subject_category=4
       AND A.course_id='${course.id}'
       AND A.exam_name='${ctx.examSetupId}'
       AND A.exam_session='${escapeSql(sessionType)}'
     ORDER BY A.exam_date ASC`,
  );
  if (!dateRows.length) return '';

  const terminalLabel = TERMINAL_WORDS[Number(examNameId)] || 'Terminal';
  let html = `<h4 style="text-align:center;line-height:25px;">${escapeHtml(terminalLabel)} Examination Invigilation Schedule</h4>`;
  html += `<table width="100%" border="0" cellspacing="0" cellpadding="5" class="table table-bordered" id="mySampleTable">
    <thead><tr bgcolor="#CCCCCC">
      <th width="40%" style="vertical-align: middle;">Subject</th>
      <th width="10%" style="vertical-align: middle;">No of Candidates</th>
      <th width="25%" style="vertical-align: middle;">Invigilator Staff Name</th>
      <th width="25%" style="vertical-align: middle;">Signature</th>
    </tr></thead><tbody>`;

  for (const dateRow of dateRows) {
    const dateKey = String(dateRow.exam_date).slice(0, 10);
    const timeLabel = sessionTimeLabel(dateRow.exam_session, ctx.sessionFn, ctx.sessionAn);
    html += `<tr>
      <td colspan="4" style="font-size:15px;height: 40px;text-align:center;vertical-align: middle;font-weight: bold;">
        Exam Date : ${escapeHtml(formatLegacyDate(dateKey))} / ${escapeHtml(formatDayLabel(dateKey))}
        - Session: ${escapeHtml(dateRow.exam_session || sessionType)} Time:${escapeHtml(timeLabel)}
      </td>
    </tr>`;

    const subjectRows = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT C.subject_name, B.subject_category, A.current_year, A.invigilator
       FROM cia_schedule_tb AS A
       INNER JOIN basic_subject_marks_tb AS B ON A.subject_id=B.subject_id
       INNER JOIN basic_setup_subject_tb AS C ON C.id=B.rid
       WHERE A.del=1 AND B.del=1
         AND A.academic_year='${escapeSql(ctx.academicYear)}'
         AND A.academic_type='${escapeSql(ctx.academicType)}'
         AND A.exam_date='${escapeSql(dateKey)}'
         AND B.subject_category=4
         AND A.course_id='${course.id}'
         AND A.exam_name='${ctx.examSetupId}'
         AND C.del=1
         AND C.academic_year='${escapeSql(ctx.academicYear)}'
         AND C.course_id='${course.id}'
         AND C.subject_enable=1
         AND A.exam_session='${escapeSql(sessionType)}'
       ORDER BY A.exam_session DESC`,
    );

    for (const sub of subjectRows) {
      const studentCount = await loadStudentCount(
        course.id,
        ctx.academicYear,
        sub.current_year,
        ctx.academicType,
      );
      const invNames = invigilatorNames(sub.invigilator, invigilatorMap);
      html += `<tr>
        <td style="vertical-align: middle;padding-left: 15px;">
          <strong>${escapeHtml(convertNYear(Number(sub.current_year), course.course_name))} Year </strong>
          - ${escapeHtml(sub.subject_name || '')}
        </td>
        <td style="vertical-align: middle;text-align: center;">${studentCount}</td>
        <td>${invNames}</td>
        <td></td>
      </tr>`;
    }
  }

  html += '</tbody></table>';
  return html;
}

export async function buildInvigilatorPrintHtml(ctx, passType, sessionType, invigilatorMap, examNameId) {
  const courses = await prisma.basic_setup_course_tb.findMany({
    where: { del: 1, course_name: ctx.courseName },
    orderBy: { course_name: 'asc' },
    select: basicSetupCourseSelect,
  });

  let body = '';
  for (const course of courses) {
    body += '<div class="col-sm-12"><section>';
    if (passType === 'Theory') {
      body += await buildTheoryInvigilatorHtml(ctx, course, sessionType, invigilatorMap, examNameId);
    }
    body += `${NOTE_HTML}${SIGNATURE_HTML}</section></div>`;
  }

  return body;
}

export async function loadInvigilatorPrint(memberId, fields = {}, audit = {}) {
  const examOptions = await loadReportExamOptions();
  const examId = String(fields.exam_name || '').trim();
  const passType = fields.a_pass_type === 'Clinical' ? 'Clinical' : 'Theory';
  const sessionType = resolveSessionType(fields);
  const ctx = examId ? await resolveExamContext(examId) : null;

  let reportHtml = '';
  let bannerUrl = '';
  let printMeta = null;

  if (ctx) {
    const setup = await prisma.cia_setup.findFirst({
      where: { del: 1, id: ctx.examSetupId },
      select: { exam_name: true, session_fn: true, session_an: true },
    });
    const enrichedCtx = {
      ...ctx,
      sessionFn: setup?.session_fn || '',
      sessionAn: setup?.session_an || '',
    };
    const invigilatorMap = await loadInvigilatorNameMap();
    reportHtml = await buildInvigilatorPrintHtml(
      enrichedCtx,
      passType,
      sessionType,
      invigilatorMap,
      setup?.exam_name,
    );
    bannerUrl = await loadAttendanceBannerUrl();
    const batchLabel = ctx.academicType === 'additional' ? 'Additional' : 'Regular';
    printMeta = {
      title: `${ctx.courseName} - ${batchLabel} Batch - ${ctx.academicYear}`,
      subtitleLine1: '',
      dateRange: '',
    };
  }

  await logExamSetup(PAGE, 'View', 'Successful', examId, memberId, audit);
  return {
    examOptions,
    examId,
    passType,
    sessionType: fields.a_session_type === 'Afternoon' ? 'Afternoon' : 'Forenoon',
    ctx,
    reportHtml,
    bannerUrl,
    printMeta,
  };
}

export async function saveInvigilatorPrint() {
  return { success: false, message: 'Report is view only' };
}
