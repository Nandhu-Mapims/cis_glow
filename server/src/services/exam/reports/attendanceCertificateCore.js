import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { basicSetupCourseSelect } from '../../../utils/legacySelects.js';
import { logExamSetup } from '../setup/setupAudit.js';
import {
  loadActiveExamOptions,
  loadCourseSemesterOptions,
  loadSubjectCategories,
  parseCourseSemesterKey,
  resolveExamContext,
} from '../setup/examSetupShared.js';

const PAGE = 'term_exam_att_certificate.php';

const CERTIFICATE_STYLES = `<style>
#total_con { height:1010px; width:780px; padding:210px 25px 0 35px; page-break-after:always; }
#total_address { height:500px; width:360px; padding-top:162px; padding-left:250px; page-break-after:always; }
.header_card { font-size:22px; padding:25px; text-align:center; text-decoration:underline; font-weight:bold; padding-left:55px; }
.app_content { font-family:Book Antiqua,serif; font-size:18px; padding:8px 0; line-height:45px; }
.app_content_rotate { font-family:Book Antiqua,serif; font-size:20px; padding-left:25px; padding-bottom:8px; line-height:30px; transform:rotate(270deg); }
</style>`;

async function loadCertificateSubjects(ctx, courseId, semester) {
  const categories = await loadSubjectCategories();

  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT B.subject_id, B.subject_name, B.subject_category
     FROM cia_schedule_tb AS A
     INNER JOIN basic_subject_marks_tb AS B ON A.subject_id = B.subject_id
     INNER JOIN basic_setup_subject_tb AS C ON C.id = B.rid
     WHERE A.del=1 AND B.del=1 AND A.academic_year='${escapeSql(ctx.academicYear)}'
       AND A.current_year='${semester}' AND A.academic_type='${escapeSql(ctx.academicType)}'
       AND A.course_id='${courseId}' AND A.exam_name='${ctx.examSetupId}'
       AND C.del=1 AND C.academic_year='${escapeSql(ctx.academicYear)}'
       AND C.course_id='${courseId}' AND C.semester_no='${semester}' AND C.subject_enable=1
     ORDER BY C.subject_order ASC, B.subject_id ASC`,
  );

  const flagged = [];
  for (const row of rows) {
    const subjectId = String(row.subject_id);
    const countRows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS cnt FROM cia_att_examiners_tb
       WHERE del=1 AND exam_name='${escapeSql(String(ctx.examSetupId))}'
         AND course_id='${courseId}' AND academic_year='${escapeSql(ctx.academicYear)}'
         AND current_year='${semester}' AND academic_type='${escapeSql(ctx.academicType)}'
         AND subject_id='${escapeSql(subjectId)}'`,
    );
    flagged.push({
      subjectId,
      subjectName: String(row.subject_name || subjectId),
      categoryName: categories[Number(row.subject_category)] || '',
      hasExaminers: Number(countRows?.[0]?.cnt || 0) > 0,
    });
  }
  return flagged;
}

function formatLegacyDate(value) {
  const text = String(value || '').slice(0, 10);
  if (!text || text.startsWith('0000-00-00')) return '';
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function splitWorkingAddress(working) {
  const parts = String(working || '').split(',').map((p) => p.trim()).filter(Boolean);
  return {
    line1: parts[0] ? `${parts[0]}<br>` : '',
    line2: parts[1] ? `${parts[1]}<br>` : '',
    line3: parts[2] ? `${parts[2]}<br>` : '',
    line4: parts[2] ? `${parts[2]}<br>` : '',
  };
}

async function loadExamDateRange(ctx, courseId, semester, subjectId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT MIN(CAST(exam_date AS CHAR)) AS minDate, MAX(CAST(exam_date AS CHAR)) AS maxDate
     FROM cia_schedule_tb
     WHERE del=1 AND academic_year='${escapeSql(ctx.academicYear)}'
       AND current_year='${semester}' AND academic_type='${escapeSql(ctx.academicType)}'
       AND course_id='${courseId}' AND exam_name='${ctx.examSetupId}'
       AND subject_id='${escapeSql(subjectId)}'`,
  );
  const minDate = formatLegacyDate(rows?.[0]?.minDate);
  const maxDate = formatLegacyDate(rows?.[0]?.maxDate);
  if (!minDate && !maxDate) return { dates: '', tdate: '' };
  if (minDate === maxDate) return { dates: `on ${maxDate}`, tdate: maxDate };
  return { dates: `from ${minDate} to ${maxDate}`, tdate: maxDate };
}

function buildCertificateHtml({
  examiner,
  subjectName,
  academicYear,
  semester,
  degreeName,
  dateRange,
}) {
  const yearWords = ['', 'First', 'Second', 'Third', 'Final'];
  const yearLabel = yearWords[Number(semester)] || String(semester);
  const addr = splitWorkingAddress(examiner.extWorking);

  return `<div id="total_con">
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td valign="bottom"><p class="app_content">Ref:APDCH/Attn_Cert/${subjectName}/${academicYear}/${examiner.id}</p></td>
        <td valign="bottom" style="text-align:right"><p class="app_content"><strong>Date:</strong> ${dateRange.tdate}</p></td>
      </tr>
    </table>
    <div class="header_card" nowrap="nowrap">ATTENDANCE CERTIFICATE</div>
    <p class="app_content" style="text-align:justify;text-indent:50px;">
      This is to certify that ${examiner.extName} ${examiner.extDesig}, Department of ${subjectName}, ${examiner.extWorking}, as an External Examiner, conducted the Tamil Nadu Dr.M.G.R Medical University Oral / Practical Examination in the subject of ${subjectName} for ${yearLabel} Year ${degreeName} students ${dateRange.dates} at our Institution.
    </p>
    <br><br>
    <p class="app_content" style="text-align:right;padding-right:90px;"><strong>Principal</strong></p>
  </div>
  <div id="total_address">
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr><td><p class="app_content_rotate">To<br><strong>${examiner.extName}</strong><br>${examiner.extDesig}<br>${addr.line1} ${addr.line2} ${addr.line3} ${addr.line4}</p></td></tr>
    </table>
  </div>`;
}

export async function loadExamAttendanceCertificate(memberId, fields = {}, audit = {}) {
  const examOptions = await loadActiveExamOptions();
  const examId = String(fields.exam_name || '').trim();
  const ctx = examId ? await resolveExamContext(examId) : null;
  const courseGroups = ctx
    ? await loadCourseSemesterOptions(ctx.courseName, ctx.academicYear, ctx.academicType)
    : [];
  const courseKey = String(fields.course_name || '').trim();
  const courseSel = parseCourseSemesterKey(courseKey);
  const subjectId = String(fields.subject_name || '').trim();

  let subjects = [];
  let reportHtml = '';
  let infoMessage = '';

  if (ctx && courseSel) {
    subjects = await loadCertificateSubjects(ctx, courseSel.courseId, courseSel.semester);
  }

  if (ctx && courseSel && subjectId && fields.action === 'go') {
    const course = await prisma.basic_setup_course_tb.findFirst({
      where: { del: 1, id: courseSel.courseId },
      select: basicSetupCourseSelect,
    });
    const degreeName = course?.degree_name || '';
    const subject = subjects.find((s) => s.subjectId === subjectId);
    const subjectName = subject?.subjectName || subjectId;
    const dateRange = await loadExamDateRange(
      ctx,
      courseSel.courseId,
      String(courseSel.semester),
      subjectId,
    );

    const examinerRows = await prisma.$queryRawUnsafe(
      `SELECT id, ext_name, ext_desig, ext_working
       FROM cia_att_examiners_tb
       WHERE del=1 AND exam_name='${escapeSql(String(ctx.examSetupId))}'
         AND course_id='${courseSel.courseId}'
         AND academic_year='${escapeSql(ctx.academicYear)}'
         AND current_year='${courseSel.semester}'
         AND academic_type='${escapeSql(ctx.academicType)}'
         AND subject_id='${escapeSql(subjectId)}'`,
    );

    if (!examinerRows.length) {
      infoMessage = 'No examiners found for this subject. Add examiner details in Exam Examiners, then return here to print certificates.';
    } else {
      reportHtml = `${CERTIFICATE_STYLES}${examinerRows.map((row) => buildCertificateHtml({
        examiner: {
          id: row.id,
          extName: row.ext_name || '',
          extDesig: row.ext_desig || '',
          extWorking: row.ext_working || '',
        },
        subjectName,
        academicYear: ctx.academicYear,
        semester: courseSel.semester,
        degreeName,
        dateRange,
      })).join('')}`;
    }
  }

  await logExamSetup(PAGE, 'View', 'Successful', examId, memberId, audit);
  return {
    examOptions,
    examId,
    ctx,
    courseGroups,
    courseKey,
    courseSel,
    subjects,
    subjectId,
    reportHtml,
    infoMessage,
  };
}

export async function saveExamAttendanceCertificate() {
  return { success: false, message: 'Report is view only' };
}
