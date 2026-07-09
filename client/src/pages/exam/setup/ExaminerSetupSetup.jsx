import { useEffect, useMemo, useState } from 'react';
import { CourseYearSelector, ExamSetupShell } from './ExamSelectors';
import { useExamSetupApi } from './useExamSetupApi';

export default function ExaminerSetupSetup() {
  const { data, busy, error, notice, load, save } = useExamSetupApi('examiner-setup');
  const [courseKey, setCourseKey] = useState('');
  const [semester, setSemester] = useState('');
  const [rows, setRows] = useState([]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.courseKey) setCourseKey(data.courseKey);
    if (data?.semester) setSemester(String(data.semester));
    if (data?.rows) setRows(data.rows);
  }, [data]);

  const totalBatch = data?.totalBatch || 0;
  const batchNumbers = useMemo(
    () => Array.from({ length: totalBatch }, (_, i) => i + 1),
    [totalBatch],
  );

  const reload = (patch = {}) => load({
    course_name: patch.courseKey ?? courseKey,
    semester_name: patch.semester ?? semester,
    ...patch,
  });

  const onCourseChange = async (value) => {
    setCourseKey(value);
    setSemester('');
    setRows([]);
    await reload({ course_name: value, semester_name: '' });
  };

  const onSemesterChange = async (value) => {
    setSemester(String(value));
    setRows([]);
    await reload({ semester_name: value });
  };

  const setRowBatch = (index, batchNo) => {
    setValidationError('');
    setRows((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      return { ...row, selectedBatch: batchNo || null };
    }));
  };

  const toggleSelectAllBatch = (batchNo, checked) => {
    setValidationError('');
    setRows((prev) => prev.map((row) => {
      if (checked) return { ...row, selectedBatch: batchNo };
      if (row.selectedBatch === batchNo) return { ...row, selectedBatch: null };
      return row;
    }));
  };

  const [validationError, setValidationError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    if (!rows.some((row) => row.examinerType && row.selectedBatch)) {
      setValidationError('Please select at least one examiner type for a batch');
      return;
    }
    setValidationError('');
    await save({
      courseKey,
      semester: Number(semester),
      totalBatch,
      rows,
    });
  };

  return (
    <ExamSetupShell notice={validationError ? null : notice} error={validationError || error} busy={busy}>
      <CourseYearSelector
        label="Course & Academic year"
        options={data?.courseOptions}
        value={courseKey}
        onChange={onCourseChange}
        disabled={busy}
      />

      {data?.semesterOptions?.length ? (
        <div className="mb-3 row g-2">
          <label className="col-sm-2 col-form-label">Year</label>
          <div className="col-sm-10 d-flex flex-wrap gap-3">
            {data.semesterOptions.map((opt) => (
              <label key={opt.value} className="form-check-label">
                <input
                  type="radio"
                  className="form-check-input me-1"
                  name="examiner_semester"
                  value={opt.value}
                  checked={Number(semester) === opt.value}
                  onChange={() => onSemesterChange(opt.value)}
                  disabled={busy}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {rows.length > 0 && totalBatch > 0 ? (
        <form onSubmit={handleSave}>
          <div className="table-responsive">
            <table className="table table-bordered table-sm align-middle">
              <thead className="table-secondary">
                <tr>
                  <th>#</th>
                  <th>Examiner Type</th>
                  {batchNumbers.map((batchNo) => (
                    <th key={batchNo}>
                      <label className="mb-0 small">
                        <input
                          type="checkbox"
                          className="form-check-input me-1"
                          onChange={(e) => toggleSelectAllBatch(batchNo, e.target.checked)}
                        />
                        Select
                      </label>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.examinerType}>
                    <td>{index + 1}</td>
                    <td>{row.examinerLabel}</td>
                    {batchNumbers.map((batchNo) => {
                      const disabled = row.selectedBatch != null && row.selectedBatch !== batchNo;
                      return (
                        <td key={batchNo}>
                          <input
                            type="checkbox"
                            checked={row.selectedBatch === batchNo}
                            disabled={disabled || busy}
                            onChange={(e) => setRowBatch(index, e.target.checked ? batchNo : null)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-center">
            <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
          </div>
        </form>
      ) : null}
    </ExamSetupShell>
  );
}
