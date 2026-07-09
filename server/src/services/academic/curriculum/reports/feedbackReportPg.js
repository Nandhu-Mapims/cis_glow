import { logAcademicSetup } from '../../setup/setupAudit.js';
import {
  formatDateTime,
  loadFeedbackOptions,
  wrapReportPanel,
} from './reportShared.js';
import {
  buildFeedbackCourseContext,
  buildOverallFeedbackHtml,
  buildSubjectFeedbackHtml,
  loadFeedbackSubjectOptions,
} from './feedbackReportShared.js';

const PAGE = 'feedback_report_pg.php';

function parseSubjectIds(fields) {
  const raw = fields.subject_name;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(Number).filter(Boolean);
}

function findFeedbackOption(options, feedbackId) {
  return options.find((f) => Number(f.id) === feedbackId) || null;
}

export async function loadFeedbackReportPg(memberId, fields = {}, audit = {}) {
  const feedbackId = Number(fields.category) || 0;
  const reportType = fields.report_type === 'pg-clinical' ? 'pg-clinical' : 'subject';
  const generate = Boolean(fields.generate || fields.Submit === 'Generate' || fields.Submit === 'Go');
  const subjectIds = parseSubjectIds(fields);

  const [feedbackOptions, courseCtx] = await Promise.all([
    loadFeedbackOptions(false),
    feedbackId
      ? buildFeedbackCourseContext(feedbackId, fields.course_name)
      : Promise.resolve({ courseList: [], selected: null }),
  ]);

  let html = '';
  const { courseList, selected } = courseCtx;
  let selectedFeedback = feedbackId ? findFeedbackOption(feedbackOptions, feedbackId) : null;
  const courseOptions = courseList.map((c) => ({ value: c.cidStr, label: c.label }));
  const subjectOptions = feedbackId && selected
    ? await loadFeedbackSubjectOptions(feedbackId, selected)
    : [];

  if (generate && selectedFeedback) {
    if (reportType === 'subject' && selected && subjectIds.length) {
      html = await buildSubjectFeedbackHtml(
        feedbackId,
        selectedFeedback.title,
        selected.label,
        selected.cidStr,
        subjectIds,
        'PG-Clinical',
      );
    } else if (reportType === 'pg-clinical') {
      html = await buildOverallFeedbackHtml(feedbackId, selectedFeedback.title, 'pg-clinical', courseList);
    } else if (!courseList.length) {
      html = wrapReportPanel('<p class="text-muted mb-0">No courses are mapped for this feedback.</p>');
    } else if (!selected || !subjectIds.length) {
      html = wrapReportPanel('<p class="text-muted mb-0">Select a course and at least one subject, or choose PG Clinical overall.</p>');
    }
  }

  await logAcademicSetup(PAGE, generate ? 'Generate' : 'View', 'Successful', String(feedbackId), memberId, audit);
  return {
    feedbackOptions,
    courseOptions,
    subjectOptions,
    feedbackId: feedbackId || '',
    courseYearKey: fields.course_name || '',
    reportType,
    subjectIds,
    selectedFeedback: selectedFeedback ? {
      id: selectedFeedback.id,
      title: selectedFeedback.title,
      fromDate: formatDateTime(selectedFeedback.fromDate),
      toDate: formatDateTime(selectedFeedback.toDate),
    } : null,
    selection: selected,
    html,
  };
}

export async function saveFeedbackReportPg(memberId, fields = {}, audit = {}) {
  return loadFeedbackReportPg(memberId, fields, audit);
}
