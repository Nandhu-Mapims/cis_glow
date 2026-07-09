import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { logExamSetup } from '../setup/setupAudit.js';
import {
  buildPrintHeader,
  loadBatchRollNumbers,
  loadReportExamOptions,
  loadScheduledSubjects,
  loadStudentsByRollNumbers,
  parseCourseSemesterKey,
  resolveExamContext,
} from '../setup/examSetupShared.js';

const PAGE = 'term_report_analysis.php';

export async function buildReportAnalysisHtml(ctx, courseSel) {
  const subjects = await loadScheduledSubjects(ctx, courseSel.courseId, courseSel.semester);
  const rolls = await loadBatchRollNumbers(
    courseSel.courseId, ctx.academicYear, courseSel.semester, ctx.academicType,
  );
  const students = await loadStudentsByRollNumbers(rolls);
  const stats = { pass: 0, fail: 0, ab: 0, na: 0, total: students.length };
  const subjectStats = {};

  for (const sub of subjects) {
    subjectStats[sub.subjectId] = { pass: 0, fail: 0, ab: 0, na: 0, name: sub.subjectName };
    for (const stu of students) {
      const marks = await prisma.cia_marks_tb.findFirst({
        where: {
          del: 1, exam_name: String(ctx.examSetupId), course_id: String(courseSel.courseId),
          academic_year: ctx.academicYear, current_year: String(courseSel.semester),
          academic_type: ctx.academicType, subject_id: sub.subjectId, register_no: stu.registerNo,
        },
      });
      const ps = marks?.p_status || '';
      if (ps === 'PASS') subjectStats[sub.subjectId].pass += 1;
      else if (ps === 'FAIL') subjectStats[sub.subjectId].fail += 1;
      else if (ps === 'AB') subjectStats[sub.subjectId].ab += 1;
      else if (ps === 'NA') subjectStats[sub.subjectId].na += 1;
    }
  }

  for (const stu of students) {
    let stuResult = 'PASS';
    for (const sub of subjects) {
      const marks = await prisma.cia_marks_tb.findFirst({
        where: {
          del: 1, exam_name: String(ctx.examSetupId), course_id: String(courseSel.courseId),
          academic_year: ctx.academicYear, current_year: String(courseSel.semester),
          academic_type: ctx.academicType, subject_id: sub.subjectId, register_no: stu.registerNo,
        },
      });
      const ps = marks?.p_status || '';
      if (ps === 'FAIL') stuResult = 'FAIL';
      else if (ps === 'AB' && stuResult !== 'FAIL') stuResult = 'AB';
      else if (ps === 'NA' && stuResult === 'PASS') stuResult = 'NA';
    }
    if (stuResult === 'PASS') stats.pass += 1;
    else if (stuResult === 'FAIL') stats.fail += 1;
    else if (stuResult === 'AB') stats.ab += 1;
    else stats.na += 1;
  }

  let table = `<table class="table table-bordered"><thead class="table-secondary">
    <tr><th>Subject</th><th>Pass</th><th>Fail</th><th>AB</th><th>NA</th><th>Total Students</th></tr></thead><tbody>`;
  for (const sub of subjects) {
    const s = subjectStats[sub.subjectId];
    table += `<tr><td>${sub.subjectId} - ${s.name}</td><td>${s.pass}</td><td>${s.fail}</td><td>${s.ab}</td><td>${s.na}</td><td>${stats.total}</td></tr>`;
  }
  table += `</tbody></table>
    <h5 class="mt-3">Overall</h5>
    <table class="table table-bordered w-auto">
      <tr><th>Pass</th><td>${stats.pass}</td></tr>
      <tr><th>Fail</th><td>${stats.fail}</td></tr>
      <tr><th>AB</th><td>${stats.ab}</td></tr>
      <tr><th>NA</th><td>${stats.na}</td></tr>
      <tr><th>Total</th><td>${stats.total}</td></tr>
    </table>`;

  return `${buildPrintHeader('Term Report Analysis', ctx.examNameLabel)}${table}`;
}

export async function loadReportAnalysis(memberId, fields = {}, audit = {}) {
  const examOptions = await loadReportExamOptions();
  const examId = String(fields.exam_name || '').trim();
  const ctx = examId ? await resolveExamContext(examId) : null;
  const { loadCourseSemesterOptions } = await import('../setup/examSetupShared.js');
  const courseGroups = ctx
    ? await loadCourseSemesterOptions(ctx.courseName, ctx.academicYear, ctx.academicType)
    : [];
  const courseKey = String(fields.course_name || '').trim();
  const courseSel = parseCourseSemesterKey(courseKey);
  let reportHtml = '';
  if (ctx && courseSel && fields.action === 'go') {
    reportHtml = await buildReportAnalysisHtml(ctx, courseSel);
  }
  await logExamSetup(PAGE, 'View', 'Successful', examId, memberId, audit);
  return { examOptions, examId, ctx, courseGroups, courseKey, courseSel, reportHtml };
}

export async function saveReportAnalysis() {
  return { success: false, message: 'Report is view only' };
}
