import { useEffect, useState } from 'react';
import ReportPrintBar from '../../../components/ReportPrintBar';
import { CourseSemesterSelector, ExamSelector, ExamSetupShell } from './ExamSelectors';
import { useExamSetupApi } from './useExamSetupApi';

export default function MarkSheetStatusSetup() {
  const { data, busy, error, notice, load } = useExamSetupApi('mark-sheet-status');
  const [examId, setExamId] = useState('');
  const [courseKey, setCourseKey] = useState('');
  const [markOptions, setMarkOptions] = useState([]);
  const [processOptions, setProcessOptions] = useState([]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.examId != null) setExamId(data.examId);
    if (data?.courseKey != null) setCourseKey(data.courseKey);
    if (data?.markOptions) setMarkOptions(data.markOptions);
    if (data?.processOptions) setProcessOptions(data.processOptions);
  }, [data]);

  const reload = (patch = {}) => load({
    exam_name: patch.examId ?? examId,
    course_name: patch.courseKey ?? courseKey,
    mark_option: patch.mark_option ?? markOptions.filter((o) => o.checked).map((o) => o.value),
    process_option: patch.process_option ?? processOptions.filter((o) => o.checked).map((o) => o.value),
    ...patch,
  });

  const toggleMark = (value) => {
    const next = markOptions.map((o) => (o.value === value ? { ...o, checked: !o.checked } : o));
    setMarkOptions(next);
  };

  const toggleProcess = (value) => {
    const next = processOptions.map((o) => (o.value === value ? { ...o, checked: !o.checked } : o));
    setProcessOptions(next);
  };

  const onGo = async () => {
    await reload({ action: 'go' });
  };

  const rows = data?.rows || [];
  const summaryCounts = data?.summaryCounts || {};
  const processTypes = data?.processTypes || [];

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

          <div className="mb-3 row g-2">
            <label className="col-sm-2 col-form-label">Status</label>
            <div className="col-sm-10 d-flex flex-wrap gap-3">
              {processOptions.map((opt) => (
                <label key={opt.value} className="form-check-label">
                  <input
                    type="checkbox"
                    className="form-check-input me-1"
                    checked={opt.checked}
                    onChange={() => toggleProcess(opt.value)}
                    disabled={busy}
                  />
                  {opt.value}
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
          <div id="att_report_span">
            <h3>{data.ctx?.examNameLabel} | {data.courseLabel}</h3>
            <table className="table table-bordered table-sm col-sm-6 mb-3">
              <tbody>
                <tr>
                  {processTypes.flatMap((option) => [
                    <td key={`${option}-label`} className="text-end">{option}</td>,
                    <td key={`${option}-count`}>
                      <strong>{summaryCounts[option] || 0}</strong>
                      {option === 'Not Printed' ? ' Subject' : ' Sheet'}
                    </td>,
                  ])}
                </tr>
              </tbody>
            </table>
            <div className="table-responsive">
              <table className="table table-bordered table-sm">
                <thead className="table-secondary">
                  <tr>
                    <th>#</th>
                    <th>Subject ID</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Batch</th>
                    <th>Date</th>
                    <th>M.Type</th>
                    <th>Page</th>
                    <th>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.subjectId}-${row.markLabel}-${row.pageNo}-${row.index}`}>
                      <td>{row.index}</td>
                      <td>{row.subjectId}</td>
                      <td>{row.subjectName}</td>
                      <td>{row.categoryName}</td>
                      <td>{row.batchStr}</td>
                      <td>{row.examDateSession}</td>
                      <td>{row.markLabel}</td>
                      <td>{row.pageNo}</td>
                      <td>
                        {row.fileUrl ? (
                          <a href={row.fileUrl} className={row.badgeClass} target="_blank" rel="noreferrer">
                            {row.status}
                          </a>
                        ) : (
                          <span className={row.badgeClass}>{row.status}</span>
                        )}
                      </td>
                      <td>{row.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </ExamSetupShell>
  );
}
