import { logExamSetup } from '../setup/setupAudit.js';
import {
  loadReportExamOptions,
  parseCourseSemesterKey,
  resolveExamContext,
} from '../setup/examSetupShared.js';
import { buildTermStatementHtml } from './termStatementCore.js';

const PAGE = 'term_progress_card.php';

export async function loadProgressCard(memberId, fields = {}, audit = {}) {
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
    const base = await buildTermStatementHtml(ctx, courseSel);
    reportHtml = `<div class="progress-card-report">${base}</div>`;
  }
  await logExamSetup(PAGE, 'View', 'Successful', examId, memberId, audit);
  return { examOptions, examId, ctx, courseGroups, courseKey, courseSel, reportHtml };
}

export async function saveProgressCard() {
  return { success: false, message: 'Report is view only' };
}
