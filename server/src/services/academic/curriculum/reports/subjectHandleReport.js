import { escapeSql } from '../../../../utils/sqlSafe.js';
import { convertNYear } from '../../../fees/feeHelpers.js';
import { logAcademicSetup } from '../../setup/setupAudit.js';
import {
  buildCourseCyearOptions,
  buildPeriodCompletionReport,
  buildPeriodTableHtml,
  defaultDateRange,
  escapeHtml,
  getCourseById,
  parseCourseCyearKey,
  parseInputDate,
  wrapReportPanel,
} from './reportShared.js';

const PAGE = 'subject_handle.php';

export async function loadSubjectHandleReport(memberId, fields = {}, audit = {}) {
  const defaults = defaultDateRange();
  const courseYearOptions = await buildCourseCyearOptions();
  const selection = parseCourseCyearKey(fields.course_name);
  const fromDate = fields.from_date || defaults.fromDate;
  const toDate = fields.to_date || defaults.toDate;
  const generate = Boolean(fields.generate || fields.Submit === 'Generate');
  let html = '';

  if (generate && selection) {
    const course = await getCourseById(selection.courseId);
    let dept = String(course?.department_name || '').trim();
    if (dept && dept !== '-') dept = ` - ${dept}`;
    const title = `${convertNYear(selection.currentYear, course?.course_name || 'U.G')}  ${course?.degree_name || ''}${dept}`;
    const fromIso = parseInputDate(fromDate);
    const toIso = parseInputDate(toDate);

    const { rows, totals } = await buildPeriodCompletionReport({
      fromDate,
      toDate,
      whereExtra: fromIso && toIso ? `AND A.course_id = '${escapeSql(String(selection.courseId))}'
        AND A.academic_year = '${escapeSql(selection.academicYear)}'
        AND A.current_year = '${escapeSql(String(selection.currentYear))}'
        AND A.academic_type = 'Regular'` : '',
    });

    const table = buildPeriodTableHtml(title, rows, totals, [
      { label: 'S.No', render: (_r, i) => i + 1 },
      { label: 'S.ID', key: 'staffId' },
      { label: 'Staff Name', key: 'staffName' },
      { label: 'Subject', key: 'subjectName' },
      { label: 'Type', key: 'subjectType' },
      { label: 'Scheduled', key: 'allocated', align: 'end' },
      { label: 'Actual', key: 'attended', align: 'end' },
      { label: 'Missed', key: 'missed', align: 'end' },
      { label: 'OD/AL/UL', render: (r) => `${r.od} / ${r.al} / ${r.ul}` },
      { label: 'Deputation Staff', key: 'alternate' },
    ]);
    html = wrapReportPanel(`<p class="text-center">${escapeHtml(fromDate)} to ${escapeHtml(toDate)}</p>${table}`);
  }

  await logAcademicSetup(PAGE, generate ? 'Generate' : 'View', 'Successful', fields.course_name || '', memberId, audit);
  return {
    courseYearOptions,
    courseYearKey: fields.course_name || '',
    selection,
    fromDate,
    toDate,
    html,
  };
}

export async function saveSubjectHandleReport(memberId, fields = {}, audit = {}) {
  return loadSubjectHandleReport(memberId, fields, audit);
}
