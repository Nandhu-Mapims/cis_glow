import { useEffect, useState } from 'react';
import ReportPrintBar from '../../../components/ReportPrintBar';
import { ExamSelector, CourseSemesterSelector, ExamSetupShell } from './ExamSelectors';
import { useExamSetupApi } from './useExamSetupApi';

export default function ExamReportScreen({ screen, goLabel = 'Go' }) {
  const { data, busy, error, notice, load } = useExamSetupApi(screen);
  const [examId, setExamId] = useState('');
  const [courseKey, setCourseKey] = useState('');

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.examId) setExamId(data.examId);
    if (data?.courseKey) setCourseKey(data.courseKey);
  }, [data]);

  const reload = (patch) => load({
    exam_name: patch.examId ?? examId,
    course_name: patch.courseKey ?? courseKey,
    ...patch,
  });

  const onGo = async () => {
    await reload({ action: 'go', Submit: 'Update' });
  };

  return (
    <ExamSetupShell notice={notice} error={error} busy={busy}>
      <ExamSelector value={examId} options={data?.examOptions} onChange={async (v) => {
        setExamId(v); setCourseKey('');
        await reload({ exam_name: v, course_name: '' });
      }} disabled={busy} />
      <CourseSemesterSelector courseGroups={data?.courseGroups} value={courseKey} onChange={async (v) => {
        setCourseKey(v);
        await reload({ course_name: v });
      }} disabled={busy} />

      {data?.ctx && courseKey ? (
        <div className="mb-3">
          <button type="button" className="btn btn-danger btn-lg" onClick={onGo} disabled={busy}>{goLabel}</button>
        </div>
      ) : null}

      <ReportPrintBar html={data?.reportHtml} />
      {data?.reportHtml ? (
        <div className="exam-report-preview" dangerouslySetInnerHTML={{ __html: data.reportHtml }} />
      ) : null}
    </ExamSetupShell>
  );
}
