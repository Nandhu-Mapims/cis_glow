import { useEffect, useState } from 'react';
import ReportPrintBar from '../../../components/ReportPrintBar';
import { CourseSemesterSelector, ExamSelector, ExamSetupShell } from './ExamSelectors';
import { useExamSetupApi } from './useExamSetupApi';

export default function ReportAnalysisV1Setup() {
  const { data, busy, error, notice, load } = useExamSetupApi('report-analysis-v1');
  const [examId, setExamId] = useState('');
  const [courseKey, setCourseKey] = useState('');

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.examId != null) setExamId(data.examId);
    if (data?.courseKey != null) setCourseKey(data.courseKey);
  }, [data]);

  const reload = (patch = {}) => load({
    exam_name: patch.examId ?? examId,
    course_name: patch.courseKey ?? courseKey,
    ...patch,
  });

  const subjectColumns = data?.subjectColumns || [];
  const tableRows = data?.tableRows || [];

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

      {data?.reportHtml ? (
        <>
          <ReportPrintBar html={data.reportHtml} />
          <div id="att_report_span">
            <h4>Individual Department Pass Percentage</h4>
            <div className="table-responsive">
              <table className="table table-bordered table-sm">
                <thead className="table-secondary">
                  <tr>
                    <th>Subject</th>
                    {subjectColumns.map((col) => (
                      <th key={col.rid} nowrap="nowrap">{col.sname}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.label}>
                      <td nowrap="nowrap">{row.label}</td>
                      {row.cells.map((cell, idx) => (
                        <td key={`${row.label}-${subjectColumns[idx]?.rid}`} className="text-end">
                          {row.isPercent ? `${cell}%` : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="mt-3">Overall Pass Percentage</h4>
            <table className="table table-bordered table-sm w-auto">
              <tbody>
                <tr>
                  <th>Pass %</th>
                  <td><strong style={{ fontSize: '18px' }}>{data.overallPassPct ?? 0}%</strong></td>
                </tr>
              </tbody>
            </table>

            {(data.toppers || []).length > 0 ? (
              <>
                <h4 className="mt-3">Overall Topper</h4>
                <table className="table table-bordered table-sm">
                  <thead className="table-secondary">
                    <tr><th>Rank</th><th>Reg.No.</th><th>Marks</th><th>Name</th></tr>
                  </thead>
                  <tbody>
                    {data.toppers.map((t) => (
                      <tr key={`${t.rank}-${t.registerNo}`}>
                        <td>{t.rank} Rank</td>
                        <td>{t.registerNo}</td>
                        <td>{t.marks}/{t.totalMarks}</td>
                        <td>{t.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}

            {(data.subjectToppers || []).length > 0 ? (
              <>
                <h4 className="mt-3">Subject wise Topper</h4>
                <table className="table table-bordered table-sm">
                  <thead className="table-secondary">
                    <tr><th>Subject</th><th>Reg.No.</th><th>Marks</th><th>Name</th></tr>
                  </thead>
                  <tbody>
                    {data.subjectToppers.map((t) => (
                      <tr key={`${t.subjectName}-${t.registerNo}`}>
                        <td>{t.subjectName}</td>
                        <td>{t.registerNo}</td>
                        <td>{t.marks}/{t.totalMarks}</td>
                        <td>{t.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}

            {(data.failedStudents || []).length > 0 ? (
              <>
                <h4 className="mt-3">Failed Student Details</h4>
                <table className="table table-bordered table-sm">
                  <thead className="table-secondary">
                    <tr><th>S.No</th><th>Reg.No.</th><th>Name</th><th>Marks</th><th>Failed Subject(s)</th></tr>
                  </thead>
                  <tbody>
                    {data.failedStudents.map((f) => (
                      <tr key={f.registerNo}>
                        <td>{f.sno}</td>
                        <td>{f.registerNo}</td>
                        <td>{f.name}</td>
                        <td>{f.marks}</td>
                        <td>{f.failedSubjects}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </ExamSetupShell>
  );
}
