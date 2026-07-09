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
import { buildTermReportHtml } from './termReportCore.js';

const PAGE = 'term_report_statement.php';

export async function buildTermStatementHtml(ctx, courseSel) {
  const subjects = await loadScheduledSubjects(ctx, courseSel.courseId, courseSel.semester);
  const rolls = await loadBatchRollNumbers(
    courseSel.courseId, ctx.academicYear, courseSel.semester, ctx.academicType,
  );
  const students = await loadStudentsByRollNumbers(rolls);

  const grouped = {};
  for (const sub of subjects) {
    const ridRows = await prisma.$queryRawUnsafe(
      `SELECT B.rid, C.subject_name, C.short_subject_name FROM basic_subject_marks_tb AS B
       INNER JOIN basic_setup_subject_tb AS C ON C.id=B.rid
       WHERE B.del=1 AND B.subject_id='${escapeSql(sub.subjectId)}' LIMIT 1`,
    );
    const rid = ridRows[0]?.rid;
    if (!rid) continue;
    if (!grouped[rid]) {
      grouped[rid] = {
        name: ridRows[0].subject_name,
        shortName: ridRows[0].short_subject_name || ridRows[0].subject_name,
        papers: [],
        totalMark: 0,
      };
    }
    const tmark = sub.internalMax + sub.vivaMax + sub.externalMax;
    grouped[rid].papers.push({ ...sub, tmark });
    grouped[rid].totalMark += tmark;
  }

  let header1 = '';
  let header2 = '';
  for (const g of Object.values(grouped)) {
    const esize = g.papers.length + 1;
    header1 += `<th colspan="${esize}">${g.shortName}</th>`;
    for (const p of g.papers) {
      header2 += `<th class="text-center"><small><strong>${(p.categoryName || '').slice(0, 3)}</strong><br>${p.tmark}</small></th>`;
    }
    header2 += `<th class="text-center"><small><strong>Tot</strong><br>${g.totalMark}</small></th>`;
  }

  let body = '';
  let counter = 0;
  for (const stu of students) {
    let overallTotal = 0;
    let overallResult = { FAIL: 0, PASS: 0, AB: 0, NA: 0 };
    let cells = '';
    for (const g of Object.values(grouped)) {
      let catTotal = 0;
      let catPass = 0;
      let catStatus = [];
      for (const p of g.papers) {
        const marks = await prisma.cia_marks_tb.findFirst({
          where: {
            del: 1, exam_name: String(ctx.examSetupId), course_id: String(courseSel.courseId),
            academic_year: ctx.academicYear, current_year: String(courseSel.semester),
            academic_type: ctx.academicType, subject_id: p.subjectId, register_no: stu.registerNo,
          },
        });
        const t = marks?.t_marks ?? '';
        const ps = marks?.p_status ?? '';
        cells += `<td class="text-end">${t}</td>`;
        if (ps) overallResult[ps] = (overallResult[ps] || 0) + 1;
        if (!Number.isNaN(Number(t))) catTotal += Number(t);
        catPass += p.passMark;
        catStatus.push(ps);
      }
      const catResult = catStatus.includes('FAIL') ? 'FAIL' : (catStatus.includes('AB') ? 'AB' : 'PASS');
      cells += `<td class="text-end fw-bold">${catTotal}</td>`;
      overallTotal += catTotal;
    }
    const result = overallResult.FAIL > 0 ? 'FAIL' : (overallResult.AB > 0 ? 'AB' : 'PASS');
    body += `<tr><td>${counter + 1}</td><td>${stu.registerNo}</td><td>${stu.uregisterNo}</td><td nowrap>${stu.name}</td>
      <td class="text-center">1</td><td class="text-center">${Object.values(grouped).length}</td>${cells}
      <td class="text-end">${overallTotal}</td><td>${result}</td></tr>`;
    counter += 1;
  }

  const tcolspan = 6 + Object.values(grouped).reduce((n, g) => n + g.papers.length + 1, 0) + 2;
  return `${buildPrintHeader(ctx.examNameLabel, ctx.academicYear)}
    <table class="table table-bordered table-sm">
      <thead><tr class="table-secondary">
        <th rowspan="2">#</th><th rowspan="2">Roll No</th><th rowspan="2">Reg. No</th>
        <th rowspan="2">Student Name</th><th rowspan="2">App</th><th rowspan="2">No. of Papers</th>
        ${header1}<th rowspan="2">Over all Total</th><th rowspan="2">Results</th>
      </tr><tr class="table-secondary">${header2}</tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

export async function loadTermStatement(memberId, fields = {}, audit = {}) {
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
    reportHtml = await buildTermStatementHtml(ctx, courseSel);
  }
  await logExamSetup(PAGE, 'View', 'Successful', examId, memberId, audit);
  return { examOptions, examId, ctx, courseGroups, courseKey, courseSel, reportHtml };
}

export async function saveTermStatement() {
  return { success: false, message: 'Report is view only' };
}
