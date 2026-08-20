import { useCallback, useEffect, useState } from 'react';
import ChipMultiSelect from '../../../components/ChipMultiSelect';
import LegacyDateInput from '../../../components/LegacyDateInput';
import LegacyDateTimeInput from '../../../components/LegacyDateTimeInput';
import ReportPrintBar from '../../../components/ReportPrintBar';
import { FormSection } from '../../../components/FormShell';
import { ensureLegacyDateTimePicker } from '../../../utils/legacyDateTimePickerLoader';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useAcademicSetupApi } from '../setup/useAcademicSetupApi';
import { CURRICULUM_REPORT_CONFIG, CURRICULUM_REPORT_EMPTY } from '../curriculumReportConfig';
import {
  countReportRows,
  CurriculumFilterCard,
  CurriculumFilterRow,
  CurriculumReportEmptyState,
  CurriculumReportSkeleton,
  DateTimeQuickChips,
  GroupedSelect,
  SegmentedControl,
  SemesterPills,
} from './curriculumReportUi';

const UG_REPORT_TYPES = [
  { value: 'subject', label: 'Subject' },
  { value: 'overall', label: 'Overall' },
  { value: 'theory', label: 'Theory' },
  { value: 'practical', label: 'Practical' },
  { value: 'online', label: 'Online' },
];

const PG_REPORT_TYPES = [
  { value: 'subject', label: 'Subject' },
  { value: 'pg-clinical', label: 'PG Clinical' },
];

export default function CurriculumReportScreen({ screen }) {
  const config = CURRICULUM_REPORT_CONFIG[screen] || { type: 'generic', goLabel: 'Go' };
  const emptyCopy = CURRICULUM_REPORT_EMPTY[screen] || {
    title: 'No report data found.',
    hint: 'Adjust filters and try again.',
  };
  const { data, busy, error, notice, load } = useAcademicSetupApi(screen);
  const [html, setHtml] = useState('');
  const [fields, setFields] = useState({});
  const [generating, setGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const needsPicker = ['datetime', 'course-cyear-range', 'staff-range', 'dept-range'].includes(config.type);
    if (needsPicker) {
      ensureLegacyDateTimePicker().catch(() => {});
    }
  }, [config.type]);
  useEffect(() => {
    if (data?.html) {
      setHtml(data.html);
      setHasGenerated(true);
    }
    setFields((prev) => ({
      ...prev,
      current_date: data?.currentDate || prev.current_date,
      course_name: data?.courseYearKey || data?.courseKey || prev.course_name,
      semester_name: data?.semester ? String(data.semester) : (data?.courseYearKey && data.courseYearKey !== prev.course_name ? '' : prev.semester_name),
      category: data?.feedbackId ? String(data.feedbackId) : prev.category,
      from_date: data?.fromDate || prev.from_date,
      to_date: data?.toDate || prev.to_date,
      staff_id: data?.staffId || prev.staff_id,
      department: data?.department || prev.department,
      report_month: data?.reportMonth || prev.report_month,
      show_date_batch: data?.showDateBatch ? '1' : prev.show_date_batch,
      report_type: data?.reportType || prev.report_type,
      subject_name: data?.subjectIds?.length ? data.subjectIds.map(String) : prev.subject_name,
    }));
  }, [data]);

  const patch = (key, value) => setFields((prev) => ({ ...prev, [key]: value }));

  const reloadCourseFilters = async (courseName, extra = {}) => {
    let nextFields;
    setFields((prev) => {
      nextFields = { ...prev, ...extra, course_name: courseName, semester_name: '' };
      return nextFields;
    });
    await load(nextFields);
  };

  const reloadFeedback = async (category, extra = {}) => {
    const nextFields = {
      ...fields,
      ...extra,
      category,
      course_name: '',
      subject_name: [],
      report_type: extra.report_type ?? fields.report_type ?? 'subject',
    };
    setFields(nextFields);
    await load(nextFields);
  };

  const reloadFeedbackCourse = async (courseName) => {
    const nextFields = { ...fields, course_name: courseName, subject_name: [] };
    setFields(nextFields);
    await load(nextFields);
  };

  const generate = useCallback(async () => {
    if ((config.type === 'course-semester' || config.type === 'course-semester-batch') && !fields.semester_name) {
      return;
    }
    if ((config.type === 'feedback' || config.type === 'feedback-course') && !fields.category) {
      return;
    }
    if (config.type === 'feedback-course') {
      const reportType = fields.report_type || 'subject';
      if (reportType === 'subject') {
        const subjects = Array.isArray(fields.subject_name) ? fields.subject_name : fields.subject_name ? [fields.subject_name] : [];
        if (!fields.course_name || subjects.length === 0) return;
      }
    }
    setGenerating(true);
    setHasGenerated(true);
    try {
      const res = await load({ ...fields, generate: true, Submit: config.goLabel });
      if (res?.html !== undefined) setHtml(res.html || '');
    } finally {
      setGenerating(false);
    }
  }, [config.type, config.goLabel, fields, load]);

  const selectedCourseOption = (data?.courseYearOptions || []).find((opt) => opt.value === fields.course_name);
  const totalSemester = Number(data?.totalSemester)
    || Number(selectedCourseOption?.totalSemester)
    || 0;

  const renderFilters = () => {
    switch (config.type) {
      case 'datetime':
        return (
          <FormSection id="curriculum-filter-datetime" title="Date &amp; time" grid={false}>
            <CurriculumFilterRow label="Date &amp; time">
              <LegacyDateTimeInput
                value={fields.current_date || ''}
                onChange={(next) => patch('current_date', next)}
                disabled={generating}
              />
              <DateTimeQuickChips
                disabled={generating}
                onSelect={(next) => patch('current_date', next)}
              />
            </CurriculumFilterRow>
          </FormSection>
        );
      case 'course-semester':
      case 'course-semester-batch':
        return (
          <FormSection
            id="curriculum-filter-course-semester"
            title={config.type === 'course-semester-batch' ? 'Course, semester &amp; batch options' : 'Course &amp; semester'}
            grid={false}
          >
            <CurriculumFilterRow label="Course">
              <GroupedSelect
                options={data?.courseYearOptions}
                value={fields.course_name}
                disabled={busy || generating}
                placeholder="--Select Course--"
                onChange={(value) => reloadCourseFilters(value, {
                  show_date_batch: fields.show_date_batch,
                })}
              />
            </CurriculumFilterRow>
            {fields.course_name ? (
              <CurriculumFilterRow label="Semester">
                <SemesterPills
                  total={totalSemester}
                  value={fields.semester_name}
                  disabled={busy || generating}
                  loading={busy && !totalSemester}
                  onChange={(value) => patch('semester_name', value)}
                />
              </CurriculumFilterRow>
            ) : null}
            {config.type === 'course-semester-batch' ? (
              <CurriculumFilterRow label="Options">
                <div className="form-check form-switch">
                  <input
                    id="show-date-batch"
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={fields.show_date_batch === '1'}
                    disabled={generating}
                    onChange={(e) => patch('show_date_batch', e.target.checked ? '1' : '0')}
                  />
                  <label className="form-check-label" htmlFor="show-date-batch">
                    Show date &amp; batch
                  </label>
                </div>
              </CurriculumFilterRow>
            ) : null}
          </FormSection>
        );
      case 'feedback':
        return (
          <FormSection id="curriculum-filter-feedback" title="Feedback round" grid={false}>
            <CurriculumFilterRow label="Feedback">
              <select
                className="form-select"
                value={fields.category || ''}
                disabled={generating}
                onChange={(e) => patch('category', e.target.value)}
              >
                <option value="">--Select--</option>
                {(data?.feedbackOptions || []).map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.title}</option>
                ))}
              </select>
            </CurriculumFilterRow>
          </FormSection>
        );
      case 'feedback-course': {
        const reportType = fields.report_type || data?.reportType || 'subject';
        const subjectValues = Array.isArray(fields.subject_name)
          ? fields.subject_name
          : fields.subject_name
            ? [fields.subject_name]
            : [];
        const typeOptions = screen === 'feedback-report-pg' ? PG_REPORT_TYPES : UG_REPORT_TYPES;
        return (
          <FormSection id="curriculum-filter-feedback-course" title="Feedback round, type, course &amp; subjects" grid={false}>
            <CurriculumFilterRow label="Feedback">
              <select
                className="form-select"
                value={fields.category || ''}
                disabled={generating}
                onChange={(e) => reloadFeedback(e.target.value)}
              >
                <option value="">--Select--</option>
                {(data?.feedbackOptions || []).map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.title}</option>
                ))}
              </select>
            </CurriculumFilterRow>
            {fields.category ? (
              <CurriculumFilterRow label="Type">
                <SegmentedControl
                  options={typeOptions}
                  value={reportType}
                  disabled={generating}
                  onChange={(value) => reloadFeedback(fields.category, { report_type: value })}
                />
              </CurriculumFilterRow>
            ) : null}
            {fields.category && reportType === 'subject' ? (
              <CurriculumFilterRow label="Course">
                <GroupedSelect
                  options={data?.courseOptions}
                  value={fields.course_name}
                  disabled={generating}
                  placeholder="--Course--"
                  onChange={reloadFeedbackCourse}
                />
              </CurriculumFilterRow>
            ) : null}
            {fields.category && reportType === 'subject' && fields.course_name ? (
              <CurriculumFilterRow label="Subject">
                <ChipMultiSelect
                  options={(data?.subjectOptions || []).map((opt) => ({ value: opt.value, label: opt.label }))}
                  value={subjectValues}
                  disabled={generating}
                  onChange={(next) => patch('subject_name', next)}
                  emptySelectionText="No subjects selected"
                  emptySearchText="No subjects match your search."
                  listHeight={260}
                />
              </CurriculumFilterRow>
            ) : null}
          </FormSection>
        );
      }
      case 'course-cyear-range':
      case 'course-cyear-month':
        return (
          <FormSection
            id="curriculum-filter-course-cyear"
            title={config.type === 'course-cyear-month' ? 'Course, year &amp; month' : 'Course, year &amp; date range'}
            grid={false}
          >
            <CurriculumFilterRow label="Course &amp; year">
              <GroupedSelect
                options={data?.courseYearOptions}
                value={fields.course_name}
                disabled={generating}
                placeholder={
                  screen === 'subject-schedule-report' || screen === 'subject-handle' || screen === 'subject-handle-grid'
                    ? '--Select Course--'
                    : '--Select--'
                }
                onChange={(value) => patch('course_name', value)}
              />
            </CurriculumFilterRow>
            {config.type === 'course-cyear-month' ? (
              <CurriculumFilterRow label="Month">
                <input
                  className="form-control"
                  type="month"
                  value={fields.report_month || ''}
                  disabled={generating}
                  onChange={(e) => patch('report_month', e.target.value)}
                />
              </CurriculumFilterRow>
            ) : (
              <CurriculumFilterRow label="Date range">
                <div className="row g-2">
                  <div className="col-sm-5">
                    <LegacyDateInput
                      value={fields.from_date || ''}
                      disabled={generating}
                      placeholder="From (dd-mm-yyyy)"
                      onChange={(next) => patch('from_date', next)}
                    />
                  </div>
                  <div className="col-sm-5">
                    <LegacyDateInput
                      value={fields.to_date || ''}
                      disabled={generating}
                      placeholder="To (dd-mm-yyyy)"
                      onChange={(next) => patch('to_date', next)}
                    />
                  </div>
                </div>
              </CurriculumFilterRow>
            )}
          </FormSection>
        );
      case 'staff-range':
        return (
          <FormSection id="curriculum-filter-staff-range" title="Staff &amp; date range" grid={false}>
            <CurriculumFilterRow label="Staff">
              <select
                className="form-select"
                value={fields.staff_id || ''}
                disabled={generating}
                onChange={(e) => patch('staff_id', e.target.value)}
              >
                <option value="">--Select--</option>
                {(data?.staffOptions || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </CurriculumFilterRow>
            <CurriculumFilterRow label="Date range">
              <div className="row g-2">
                <div className="col-sm-5">
                  <LegacyDateInput
                    value={fields.from_date || ''}
                    disabled={generating}
                    placeholder="From (dd-mm-yyyy)"
                    onChange={(next) => patch('from_date', next)}
                  />
                </div>
                <div className="col-sm-5">
                  <LegacyDateInput
                    value={fields.to_date || ''}
                    disabled={generating}
                    placeholder="To (dd-mm-yyyy)"
                    onChange={(next) => patch('to_date', next)}
                  />
                </div>
              </div>
            </CurriculumFilterRow>
          </FormSection>
        );
      case 'dept-range':
        return (
          <FormSection id="curriculum-filter-dept-range" title="Department &amp; date range" grid={false}>
            <CurriculumFilterRow label="Department">
              <select
                className="form-select"
                value={fields.department || ''}
                disabled={generating}
                onChange={(e) => patch('department', e.target.value)}
              >
                <option value="">--Select--</option>
                {(data?.departmentOptions || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </CurriculumFilterRow>
            <CurriculumFilterRow label="Date range">
              <div className="row g-2">
                <div className="col-sm-5">
                  <LegacyDateInput
                    value={fields.from_date || ''}
                    disabled={generating}
                    placeholder="From (dd-mm-yyyy)"
                    onChange={(next) => patch('from_date', next)}
                  />
                </div>
                <div className="col-sm-5">
                  <LegacyDateInput
                    value={fields.to_date || ''}
                    disabled={generating}
                    placeholder="To (dd-mm-yyyy)"
                    onChange={(next) => patch('to_date', next)}
                  />
                </div>
              </div>
            </CurriculumFilterRow>
          </FormSection>
        );
      default:
        return null;
    }
  };

  const printMode = (screen === 'class-timetable' || screen === 'class-timetable-v3')
    ? 'academic-class-timetable'
    : screen === 'feedback-dashboard'
      ? 'academic-feedback-dashboard'
      : screen === 'subject-timing'
        ? 'academic-subject-timing'
        : screen === 'staff-period-completed'
          ? 'academic-staff-period-completed'
          : screen === 'subject-handle'
            ? 'academic-subject-handle'
            : screen === 'department-period-completed'
              ? 'academic-department-period-completed'
              : screen === 'subject-handle-grid'
                ? 'academic-subject-handle-grid'
                : 'default';

  const dataRowCount = countReportRows(html);
  const showReportPanel = hasGenerated || Boolean(html);
  const showEmpty = hasGenerated && !generating && html && dataRowCount === 0;

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy && !generating} />

      <CurriculumFilterCard
        action={(
          <button
            type="button"
            className="btn btn-info"
            disabled={generating}
            onClick={generate}
          >
            {generating ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
                {config.goLabel === 'Go' ? 'Loading…' : 'Generating…'}
              </>
            ) : config.goLabel}
          </button>
        )}
      >
        {renderFilters()}
      </CurriculumFilterCard>

      {showReportPanel ? (
        <>
          <ReportPrintBar html={html} printMode={printMode} />
          <div className="academic-report-panel card shadow-sm">
            <div className="card-body academic-report-panel-body">
              {generating ? (
                <div className="academic-report-loading" aria-live="polite" aria-busy="true">
                  <div className="spinner-border text-primary" role="status" aria-hidden="true" />
                  <span>Refreshing report…</span>
                </div>
              ) : null}
              {showEmpty ? (
                <CurriculumReportEmptyState
                  title={emptyCopy.title}
                  hint={emptyCopy.hint}
                  onRetry={generate}
                  retryLabel={config.goLabel}
                />
              ) : null}
              {html && !showEmpty ? (
                <div
                  className={`academic-report-html curriculum-report-html ${generating ? 'is-refreshing' : ''}`}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              ) : null}
              {!html && generating ? <CurriculumReportSkeleton /> : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
