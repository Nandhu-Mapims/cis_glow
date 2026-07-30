import { useEffect, useState } from 'react';
import ReportPrintBar from '../../../components/ReportPrintBar';
import { FormSection } from '../../../components/FormShell';
import { CourseYearSelector, ExamSetupShell } from './ExamSelectors';
import { useExamSetupApi } from './useExamSetupApi';

export default function ExamBatchSetup() {
  const { data, busy, error, notice, load, save } = useExamSetupApi('exam-batch');
  const [courseKey, setCourseKey] = useState('');
  const [semester, setSemester] = useState(0);
  const [totalBatch, setTotalBatch] = useState('');
  const [assignments, setAssignments] = useState({});

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.courseKey) setCourseKey(data.courseKey);
    if (data?.semester) setSemester(data.semester);
    if (data?.totalBatch) setTotalBatch(String(data.totalBatch));
    if (data?.assignments) setAssignments(data.assignments);
  }, [data]);

  const reload = (patch) => load({
    course_name: patch.courseKey ?? courseKey,
    semester_name: patch.semester ?? semester,
    total_batch: patch.totalBatch ?? totalBatch,
    ...patch,
  });

  const onCourseChange = async (value) => {
    setCourseKey(value);
    setSemester(0);
    setTotalBatch('');
    setAssignments({});
    await reload({ course_name: value, semester_name: '', total_batch: '' });
  };

  const onSemesterChange = async (value) => {
    const sem = Number(value);
    setSemester(sem);
    setTotalBatch('');
    setAssignments({});
    await reload({ semester_name: sem, total_batch: '' });
  };

  const onGo = async () => {
    await reload({ action: 'go', Save: 'Go' });
  };

  const toggleBatch = (registerNo, batchNo) => {
    setAssignments((prev) => {
      const next = { ...prev };
      for (let b = 1; b <= Number(totalBatch); b += 1) {
        next[b] = (next[b] || []).filter((r) => r !== registerNo);
      }
      if (batchNo) next[batchNo] = [...(next[batchNo] || []), registerNo];
      return next;
    });
  };

  const getStudentBatch = (registerNo) => {
    for (let b = 1; b <= Number(totalBatch); b += 1) {
      if ((assignments[b] || []).includes(registerNo)) return b;
    }
    return 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await save({ courseKey, semester, totalBatch: Number(totalBatch), assignments });
  };

  const letters = data?.batchLetters || {};
  const duration = data?.selection?.courseDuration || 0;
  const yearHeader = data?.selection
    ? `${data.selection.degreeName || ''}${data.selection.departmentShortName ? ` | ${data.selection.departmentShortName}` : ''} | ${data.selection.academicYear || ''}`
    : '';

  return (
    <ExamSetupShell notice={notice} error={error} busy={busy}>
      <FormSection
        id="exam-batch-filters"
        title="Batch Setup"
        description="Select the course, academic year and semester, then set the number of batches."
        grid={false}
      >
        <CourseYearSelector
          wide
          options={data?.courseYearOptions}
          value={courseKey}
          onChange={onCourseChange}
          disabled={busy}
        />

        {data?.selection && duration ? (
          <div className="mb-3 row g-2">
            <label className="col-sm-2 col-form-label">Year</label>
            <div className="col-sm-10">
              {yearHeader ? <div className="text-muted small mb-2">{yearHeader}</div> : null}
              <div className="d-flex flex-wrap gap-3">
                {Array.from({ length: duration }, (_, i) => i + 1).map((yr) => (
                  <label key={yr} className="form-check d-inline-flex align-items-center gap-1 mb-0 border rounded px-2 py-1">
                    <input
                      type="radio"
                      className="form-check-input mt-0"
                      name="semester"
                      value={yr}
                      checked={semester === yr}
                      onChange={() => onSemesterChange(yr)}
                    />
                    <span className="form-check-label">{yr}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {semester ? (
          <div className="mb-0 row g-2 align-items-center">
            <label className="col-sm-2 col-form-label">Batch</label>
            <div className="col-sm-1">
              <input className="form-control" value={totalBatch} onChange={(e) => setTotalBatch(e.target.value)} />
            </div>
            <div className="col-sm-2">
              <button type="button" className="btn btn-info" onClick={onGo} disabled={busy}>Go</button>
            </div>
          </div>
        ) : null}
      </FormSection>

      <ReportPrintBar html={data?.printHtml} />

      {data?.students?.length && totalBatch ? (
        <form onSubmit={handleSave}>
          <div className="cis-dt-scroll">
            <table className="table table-bordered table-sm cis-dt-table">
              <thead className="table-secondary">
                <tr>
                  <th>#</th>
                  <th>Roll.No.</th>
                  <th>Student Name</th>
                  {Array.from({ length: Number(totalBatch) }, (_, i) => i + 1).map((b) => (
                    <th key={b}>Batch {letters[b] || b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.students.map((stu, index) => (
                  <tr key={stu.registerNo}>
                    <td>{index + 1}</td>
                    <td>{stu.registerNo}</td>
                    <td>{stu.name}</td>
                    {Array.from({ length: Number(totalBatch) }, (_, i) => i + 1).map((b) => (
                      <td key={b}>
                        <input
                          type="checkbox"
                          checked={getStudentBatch(stu.registerNo) === b}
                          onChange={(e) => toggleBatch(stu.registerNo, e.target.checked ? b : 0)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="submit" className="btn btn-danger mt-3" disabled={busy}>Save</button>
        </form>
      ) : null}
    </ExamSetupShell>
  );
}
