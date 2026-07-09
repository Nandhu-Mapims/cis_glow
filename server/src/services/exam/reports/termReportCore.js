import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { logExamSetup } from '../setup/setupAudit.js';
import {
  buildPrintHeader,
  loadBatchRollNumbers,
  loadCourseSemesterOptions,
  loadReportExamOptions,
  loadScheduledSubjects,
  loadStudentsByRollNumbers,
  parseCourseSemesterKey,
  resolveExamContext,
} from '../setup/examSetupShared.js';

const PAGE = 'term_report.php';

function buildSubjectHeaders(subjects, ctx) {
  const multi = ctx.examTmark > 1;
  const header1 = [];
  const header2 = [];
  const allow = {};

  for (const sub of subjects) {
    allow[sub.subjectId] = {};
    if (multi) {
      let colspan = 0;
      if (ctx.examInternal && sub.internalMax > 0) {
        allow[sub.subjectId].I = true;
        header2.push(`<th class="text-center"><small>I<br>${sub.internalMax}</small></th>`);
        colspan += 1;
      }
      if (ctx.examViva && sub.vivaMax > 0) {
        allow[sub.subjectId].V = true;
        header2.push(`<th class="text-center"><small>V<br>${sub.vivaMax}</small></th>`);
        colspan += 1;
      }
      if (ctx.examExternal && sub.externalMax > 0) {
        allow[sub.subjectId].E = true;
        const cat = sub.categoryName ? sub.categoryName[0] : 'E';
        header2.push(`<th class="text-center"><small>${cat}<br>${sub.externalMax}</small></th>`);
        colspan += 1;
      }
      const parts = Object.keys(allow[sub.subjectId]).length;
      if (parts > 1) {
        header2.push(`<th class="text-center"><small>#T<br>${sub.internalMax + sub.vivaMax + sub.externalMax}</small></th>`);
        colspan += 1;
      }
      header1.push(`<th${colspan ? ` colspan="${colspan}"` : ''}>${sub.subjectId}</th>`);
    } else {
      if (ctx.examInternal && sub.internalMax > 0) allow[sub.subjectId].I = true;
      if (ctx.examViva && sub.vivaMax > 0) allow[sub.subjectId].V = true;
      if (ctx.examExternal && sub.externalMax > 0) allow[sub.subjectId].E = true;
      header1.push(`<th><div class="att_vtext">${sub.subjectId}</div></th>`);
    }
  }
  return { header1: header1.join(''), header2: header2.join(''), allow, multi };
}

export async function buildTermReportHtml(ctx, courseSel) {
  const subjects = await loadScheduledSubjects(ctx, courseSel.courseId, courseSel.semester);
  const { header1, header2, allow, multi } = buildSubjectHeaders(subjects, ctx);
  const rolls = await loadBatchRollNumbers(
    courseSel.courseId, ctx.academicYear, courseSel.semester, ctx.academicType,
  );
  const students = await loadStudentsByRollNumbers(rolls);

  let body = '';
  let counter = 0;
  for (const stu of students) {
    body += `<tr><td>${counter + 1}</td><td>${stu.registerNo}</td><td>${stu.uregisterNo}</td><td nowrap>${stu.name}</td>`;
    for (const sub of subjects) {
      const marks = await prisma.cia_marks_tb.findFirst({
        where: {
          del: 1,
          exam_name: String(ctx.examSetupId),
          course_id: String(courseSel.courseId),
          academic_year: ctx.academicYear,
          current_year: String(courseSel.semester),
          academic_type: ctx.academicType,
          subject_id: sub.subjectId,
          register_no: stu.registerNo,
        },
      });
      const i = marks?.i_marks ?? '';
      const v = marks?.v_marks ?? '';
      const e = marks?.e_marks ?? '';
      const t = marks?.t_marks ?? '';
      if (multi) {
        if (allow[sub.subjectId]?.I) body += `<td class="text-end" style="background:#F4F4F4">${i}</td>`;
        if (allow[sub.subjectId]?.V) body += `<td class="text-end" style="background:#E4E4E4">${v}</td>`;
        if (allow[sub.subjectId]?.E) body += `<td class="text-end" style="background:#D4D4D4">${e}</td>`;
        if (Object.keys(allow[sub.subjectId] || {}).length > 1) body += `<td class="text-end">${t}</td>`;
      } else {
        body += `<td class="text-end">${t || i || v || e}</td>`;
      }
    }
    body += '</tr>';
    counter += 1;
  }

  const courseGroup = await prisma.basic_setup_course_tb.findFirst({
    where: { del: 1, id: courseSel.courseId },
  });
  const courseLabel = courseGroup
    ? `${courseGroup.degree_name} | ${courseGroup.department_short_name || ''} | ${ctx.academicYear}`
    : ctx.academicYear;

  return `${buildPrintHeader(ctx.examNameLabel, ctx.academicYear)}
    <h4>${courseLabel} | ${ctx.academicYear} - ${ctx.academicType}</h4>
    <table class="table table-bordered table-sm" id="att_report_span">
      <thead><tr class="table-secondary">
        <th rowspan="${header2 ? 2 : 1}">#</th>
        <th rowspan="${header2 ? 2 : 1}">Roll No</th>
        <th rowspan="${header2 ? 2 : 1}">Reg No</th>
        <th rowspan="${header2 ? 2 : 1}">Student Name</th>
        ${header1}
      </tr>${header2 ? `<tr class="table-secondary">${header2}</tr>` : ''}</thead>
      <tbody>${body}</tbody>
    </table>`;
}

export async function loadTermReport(memberId, fields = {}, audit = {}) {
  const examOptions = await loadReportExamOptions();
  const examId = String(fields.exam_name || '').trim();
  const ctx = examId ? await resolveExamContext(examId) : null;
  const courseGroups = ctx
    ? await loadCourseSemesterOptions(ctx.courseName, ctx.academicYear, ctx.academicType)
    : [];
  const courseKey = String(fields.course_name || '').trim();
  const courseSel = parseCourseSemesterKey(courseKey);
  let reportHtml = '';

  if (ctx && courseSel && (fields.action === 'go' || fields.Submit === 'Update')) {
    reportHtml = await buildTermReportHtml(ctx, courseSel);
  }

  await logExamSetup(PAGE, 'View', 'Successful', examId, memberId, audit);
  return { examOptions, examId, ctx, courseGroups, courseKey, courseSel, reportHtml };
}

export async function saveTermReport() {
  return loadTermReport('', { action: 'go' });
}
