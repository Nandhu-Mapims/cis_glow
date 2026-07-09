import { useEffect, useState } from 'react';
import ReportPrintBar from '../../../components/ReportPrintBar';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useAcademicSetupApi } from './useAcademicSetupApi';
import {
  countReportRows,
  CurriculumFilterCard,
  CurriculumFilterRow,
  CurriculumReportEmptyState,
  CurriculumReportSkeleton,
  GroupedSelect,
  SegmentedControl,
  SemesterPills,
} from './curriculumReportUi';

const REPORT_TYPES = [
  { value: 'timetable', label: 'Time Table' },
  { value: 'exam', label: 'Exam' },
];

const EMPTY_COPY = {
  title: 'No subject report data found.',
  hint: 'Try another course, year, or subject category.',
};

export default function SubjectReportSetup() {
  const { data, busy, error, notice, load } = useAcademicSetupApi('subject-report');
  const [courseYearKey, setCourseYearKey] = useState('');
  const [semester, setSemester] = useState('1');
  const [reportType, setReportType] = useState('timetable');
  const [html, setHtml] = useState('');
  const [generating, setGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (data?.courseYearKey) setCourseYearKey(data.courseYearKey);
    if (data?.semester) setSemester(String(data.semester));
    if (data?.reportType) setReportType(data.reportType);
  }, [data]);

  const selectedOption = (data?.courseYearOptions || []).find((opt) => opt.value === courseYearKey);
  const totalSemester = Number(data?.totalSemester)
    || Number(selectedOption?.totalSemester)
    || 0;

  const reloadCourse = async (nextCourseKey) => {
    setCourseYearKey(nextCourseKey);
    setSemester('1');
    setHasGenerated(false);
    await load({
      course_name: nextCourseKey,
      semester_name: '1',
      report_type: reportType,
    });
  };

  const generate = async () => {
    if (!courseYearKey || !semester) return;
    setGenerating(true);
    setHasGenerated(true);
    try {
      const res = await load({
        course_name: courseYearKey,
        semester_name: semester,
        report_type: reportType,
        generate: true,
      });
      if (res?.html !== undefined) setHtml(res.html || '');
    } finally {
      setGenerating(false);
    }
  };

  const showReportPanel = hasGenerated || Boolean(html);
  const dataRowCount = countReportRows(html);
  const showEmpty = hasGenerated && !generating && html && dataRowCount === 0;

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy && !generating} />

      <CurriculumFilterCard
        action={courseYearKey && totalSemester > 0 ? (
          <button
            type="button"
            className="btn btn-info"
            disabled={generating || !semester}
            onClick={generate}
          >
            {generating ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
                Loading…
              </>
            ) : 'Go'}
          </button>
        ) : null}
      >
        <CurriculumFilterRow label="Course">
          <GroupedSelect
            options={data?.courseYearOptions}
            value={courseYearKey}
            disabled={busy || generating}
            placeholder="--Select Course--"
            onChange={reloadCourse}
          />
        </CurriculumFilterRow>
        {courseYearKey ? (
          <CurriculumFilterRow label="Year">
            <SemesterPills
              total={totalSemester}
              value={semester}
              disabled={busy || generating}
              loading={busy && !totalSemester}
              onChange={setSemester}
            />
          </CurriculumFilterRow>
        ) : null}
        {courseYearKey && totalSemester > 0 ? (
          <CurriculumFilterRow label="Category">
            <SegmentedControl
              options={REPORT_TYPES}
              value={reportType}
              disabled={generating}
              onChange={setReportType}
            />
          </CurriculumFilterRow>
        ) : null}
      </CurriculumFilterCard>

      {showReportPanel ? (
        <>
          <ReportPrintBar html={html} printMode="academic-subject-report" />
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
                  title={EMPTY_COPY.title}
                  hint={EMPTY_COPY.hint}
                  onRetry={generate}
                  retryLabel="Go"
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
