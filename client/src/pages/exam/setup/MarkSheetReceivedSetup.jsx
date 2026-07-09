import { useEffect, useState } from 'react';
import ReportPrintBar from '../../../components/ReportPrintBar';
import { CourseSemesterSelector, ExamSelector, ExamSetupShell } from './ExamSelectors';
import { useExamSetupApi } from './useExamSetupApi';

export default function MarkSheetReceivedSetup() {
  const { data, busy, error, notice, load } = useExamSetupApi('mark-sheet-received');
  const [examId, setExamId] = useState('');
  const [courseKey, setCourseKey] = useState('');
  const [markOptions, setMarkOptions] = useState([]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.examId != null) setExamId(data.examId);
    if (data?.courseKey != null) setCourseKey(data.courseKey);
    if (data?.markOptions) setMarkOptions(data.markOptions);
  }, [data]);

  const reload = (patch = {}) => load({
    exam_name: patch.examId ?? examId,
    course_name: patch.courseKey ?? courseKey,
    mark_option: patch.mark_option ?? markOptions.filter((o) => o.checked).map((o) => o.value),
    ...patch,
  });

  const toggleMark = (value) => {
    const next = markOptions.map((o) => (o.value === value ? { ...o, checked: !o.checked } : o));
    setMarkOptions(next);
  };

  const onGo = async () => {
    await reload({ action: 'go' });
  };

  const rows = data?.rows || [];

  return (
    <ExamSetupShell notice={notice} error={error} busy={busy}>
      <ExamSelector
        value={examId}
        options={data?.examOptions}
        onChange={async (value) => {
          setExamId(value);
          setCourseKey('');
          await reload({ exam_name: value, course_name: '', action: '' });
        }}
        disabled={busy}
      />
      <CourseSemesterSelector
        courseGroups={data?.courseGroups}
        value={courseKey}
        onChange={async (value) => {
          setCourseKey(value);
          await reload({ course_name: value, action: '' });
        }}
        disabled={busy}
      />

      {data?.ctx && courseKey ? (
        <>
          <div className="mb-3 row g-2">
            <label className="col-sm-2 col-form-label">Marks</label>
            <div className="col-sm-10 d-flex flex-wrap gap-3">
              {markOptions.map((opt) => (
                <label key={opt.value} className="form-check-label">
                  <input
                    type="checkbox"
                    className="form-check-input me-1"
                    checked={opt.checked}
                    onChange={() => toggleMark(opt.value)}
                    disabled={busy}
                  />
                  {opt.displayLabel || opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="mb-3 d-flex gap-2">
            <button type="button" className="btn btn-danger" onClick={onGo} disabled={busy}>Go</button>
          </div>
        </>
      ) : null}

      {data?.showReport && rows.length > 0 ? (
        <>
          <ReportPrintBar html={data?.reportHtml} />
          <div className="table-responsive" id="att_report_span">
            <table className="table table-bordered table-sm" style={{ fontSize: '11px' }}>
              <thead className="table-secondary">
                <tr>
                  <th>#</th>
                  <th>Cat</th>
                  <th>Subject ID</th>
                  <th>Subject Name</th>
                  <th>Batch</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Page</th>
                  <th>OMR Print</th>
                  <th>Hand Over</th>
                  <th>Rec</th>
                  <th>Scan</th>
                  <th>Upload</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.subjectId}-${row.markTypeShort}-${row.index}`}>
                    <td className="text-center">{row.index}</td>
                    <td className="text-center">{row.categoryShort}</td>
                    <td>{row.subjectId}</td>
                    <td>{row.shortSubjectName}</td>
                    <td className="text-center">{row.batchStr}</td>
                    <td nowrap="nowrap">{row.examDateSession}</td>
                    <td className="text-center">{row.markTypeShort}</td>
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </ExamSetupShell>
  );
}
