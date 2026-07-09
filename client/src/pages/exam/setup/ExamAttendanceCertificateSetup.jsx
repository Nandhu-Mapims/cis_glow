import { useEffect, useState } from 'react';
import ReportPrintBar from '../../../components/ReportPrintBar';
import { CourseSemesterSelector, ExamSelector, ExamSetupShell } from './ExamSelectors';
import { useExamSetupApi } from './useExamSetupApi';

export default function ExamAttendanceCertificateSetup() {
  const { data, busy, error, notice, load } = useExamSetupApi('exam-attendance-certificate');
  const [examId, setExamId] = useState('');
  const [courseKey, setCourseKey] = useState('');
  const [subjectId, setSubjectId] = useState('');

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.examId) setExamId(data.examId);
    if (data?.courseKey) setCourseKey(data.courseKey);
    if (data?.subjectId) setSubjectId(data.subjectId);
  }, [data]);

  const reload = (patch = {}) => load({
    exam_name: patch.examId ?? examId,
    course_name: patch.courseKey ?? courseKey,
    subject_name: patch.subjectId ?? subjectId,
    ...patch,
  });

  const onGo = async () => {
    await reload({ action: 'go' });
  };

  return (
    <ExamSetupShell notice={notice} error={error} busy={busy}>
      <ExamSelector value={examId} options={data?.examOptions} onChange={async (value) => {
        setExamId(value); setCourseKey(''); setSubjectId('');
        await reload({ exam_name: value, course_name: '', subject_name: '' });
      }} disabled={busy} />
      <CourseSemesterSelector courseGroups={data?.courseGroups} value={courseKey} onChange={async (value) => {
        setCourseKey(value); setSubjectId('');
        await reload({ course_name: value, subject_name: '' });
      }} disabled={busy} />

      {data?.subjects?.length ? (
        <div className="mb-3 row g-2">
          <label className="col-sm-2 col-form-label">Subject</label>
          <div className="col-sm-4">
            <select className="form-select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">--Select Subject--</option>
              {data.subjects.map((sub) => (
                <option key={sub.subjectId} value={sub.subjectId} style={sub.hasExaminers ? { background: '#9ABB44' } : undefined}>
                  {sub.subjectId} | {sub.categoryName} | {sub.subjectName}{sub.hasExaminers ? ' *' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="col-sm-2">
            <button type="button" className="btn btn-danger" onClick={onGo} disabled={busy || !subjectId}>Go</button>
          </div>
        </div>
      ) : null}

      {data?.infoMessage ? (
        <div className="alert alert-info py-2">{data.infoMessage}</div>
      ) : null}

      <ReportPrintBar html={data?.reportHtml} label="Print" />
      {data?.reportHtml ? (
        <div id="att_report_span" className="exam-report-preview" dangerouslySetInnerHTML={{ __html: data.reportHtml }} />
      ) : null}
    </ExamSetupShell>
  );
}
