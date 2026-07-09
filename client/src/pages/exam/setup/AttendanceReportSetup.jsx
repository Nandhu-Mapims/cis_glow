import { useEffect, useState } from 'react';
import ReportPrintBar from '../../../components/ReportPrintBar';
import { CourseSemesterSelector, ExamSelector, ExamSetupShell } from './ExamSelectors';
import { useExamSetupApi } from './useExamSetupApi';

export default function AttendanceReportSetup() {
  const { data, busy, error, notice, load } = useExamSetupApi('attendance-report');
  const [examId, setExamId] = useState('');
  const [courseKey, setCourseKey] = useState('');

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.examId) setExamId(data.examId);
    if (data?.courseKey) setCourseKey(data.courseKey);
  }, [data]);

  const reload = (patch = {}) => load({
    exam_name: patch.examId ?? examId,
    course_name: patch.courseKey ?? courseKey,
    ...patch,
  });

  const onGo = async () => {
    await reload({ action: 'go' });
  };

  const subjects = data?.subjects || [];
  const students = data?.students || [];

  return (
    <ExamSetupShell notice={notice} error={error} busy={busy}>
      <ExamSelector
        value={examId}
        options={data?.examOptions}
        onChange={async (value) => {
          setExamId(value);
          setCourseKey('');
          await reload({ exam_name: value, course_name: '' });
        }}
        disabled={busy}
      />
      <CourseSemesterSelector
        courseGroups={data?.courseGroups}
        value={courseKey}
        onChange={async (value) => {
          setCourseKey(value);
          await reload({ course_name: value });
        }}
        disabled={busy}
      />

      {data?.ctx && courseKey ? (
        <div className="mb-3 d-flex gap-2">
          <button type="button" className="btn btn-danger" onClick={onGo} disabled={busy}>Go</button>
        </div>
      ) : null}

      <ReportPrintBar html={data?.reportHtml} />

      {students.length > 0 && subjects.length > 0 ? (
        <div className="table-responsive" id="att_report_span">
          <table className="table table-bordered table-sm align-middle">
            <thead className="table-secondary">
              <tr>
                <th>#</th>
                <th>Roll.No</th>
                <th>Name</th>
                {subjects.map((sub) => (
                  <th key={sub.subjectId} className="small text-center">
                    {sub.shortName}
                    <br />
                    ({sub.categoryShort})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((stu, index) => (
                <tr key={stu.registerNo}>
                  <td>{index + 1}</td>
                  <td>{stu.registerNo}</td>
                  <td nowrap="nowrap">{stu.name}</td>
                  {stu.subjects.map((sub) => (
                    <td key={`${stu.registerNo}-${sub.subjectId}`} className="text-end">
                      {sub.attPer}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </ExamSetupShell>
  );
}
