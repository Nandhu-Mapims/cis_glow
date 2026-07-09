import { useEffect, useState } from 'react';
import { ExamSelector, CourseSemesterSelector, ExamSetupShell } from './ExamSelectors';
import { useExamSetupApi } from './useExamSetupApi';

export default function MarkSheetSetup() {
  const { data, busy, error, notice, load } = useExamSetupApi('mark-sheet');
  const [examId, setExamId] = useState('');
  const [courseKey, setCourseKey] = useState('');
  const [markOpt, setMarkOpt] = useState('1');

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.examId) setExamId(data.examId);
    if (data?.courseKey) setCourseKey(data.courseKey);
    if (data?.markOpt) setMarkOpt(data.markOpt);
  }, [data]);

  const reload = (patch) => load({
    exam_name: patch.examId ?? examId,
    course_name: patch.courseKey ?? courseKey,
    mopt: patch.markOpt ?? markOpt,
    ...patch,
  });

  const openPrint = (params) => {
    const qs = new URLSearchParams({ ...params, flag: '1' });
    const win = window.open(`/api/exam/marksheet/print?${qs}`, 'Report', 'scrollbars=1');
    win?.focus();
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

      {data?.schedules?.length ? (
        <div className="table-responsive">
          <table className="table table-bordered table-sm">
            <thead className="table-secondary">
              <tr>
                <th>Subject</th>
                <th>Date</th>
                <th>Session</th>
                <th>Batch</th>
                <th>I/V/E/Pass</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.schedules.map((row) => (
                <tr key={row.scheduleId}>
                  <td>{row.subjectId} | {row.categoryName} | {row.subjectName}</td>
                  <td>{row.examDate}</td>
                  <td>{row.examSession}</td>
                  <td>{row.batchLabel}</td>
                  <td>{row.internalMax}/{row.vivaMax}/{row.externalMax}/{row.passMark}</td>
                  <td>
                    <button type="button" className="btn btn-sm btn-outline-primary"
                      onClick={() => openPrint(row.printParams)}>
                      Print
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </ExamSetupShell>
  );
}
