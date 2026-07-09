import { useEffect, useMemo, useState } from 'react';
import ReportPrintBar from '../../../components/ReportPrintBar';
import { ExamSetupShell } from './ExamSelectors';
import { useExamSetupApi } from './useExamSetupApi';

function groupOptions(options) {
  const groups = new Map();
  for (const opt of options || []) {
    const g = opt.group || 'Courses';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(opt);
  }
  return [...groups.entries()];
}

export default function ExamBatchSetup() {
  const { data, busy, error, notice, load, save } = useExamSetupApi('exam-batch');
  const [courseYearKey, setCourseYearKey] = useState('');
  const [courseProgramKey, setCourseProgramKey] = useState('');
  const [totalBatch, setTotalBatch] = useState('');
  const [assignments, setAssignments] = useState({});

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.courseYearKey) setCourseYearKey(data.courseYearKey);
    if (data?.courseProgramKey) setCourseProgramKey(data.courseProgramKey);
    if (data?.totalBatch) setTotalBatch(String(data.totalBatch));
    if (data?.assignments) setAssignments(data.assignments);
  }, [data]);

  const groupedCourseOptions = useMemo(
    () => groupOptions(data?.courseYearOptions),
    [data?.courseYearOptions],
  );

  const reload = (patch) => load({
    course_name: patch.courseYearKey ?? courseYearKey,
    course_program: patch.courseProgramKey ?? courseProgramKey,
    total_batch: patch.totalBatch ?? totalBatch,
    ...patch,
  });

  const onCourseYearChange = async (value) => {
    setCourseYearKey(value);
    setCourseProgramKey('');
    setTotalBatch('');
    setAssignments({});
    await reload({
      course_name: value,
      course_program: '',
      semester_name: '',
      total_batch: '',
    });
  };

  const onProgramChange = async (value) => {
    setCourseProgramKey(value);
    setTotalBatch('');
    setAssignments({});
    await reload({
      course_program: value,
      total_batch: '',
    });
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
    await save({
      courseYearKey,
      courseProgramKey,
      semester: data?.semester,
      totalBatch: Number(totalBatch),
      assignments,
    });
  };

  const letters = data?.batchLetters || {};

  return (
    <ExamSetupShell notice={notice} error={error} busy={busy}>
      <div className="mb-3 row g-2">
        <label className="col-sm-2 col-form-label">Course &amp; Academic year</label>
        <div className="col-sm-5">
          <select
            className="form-select"
            value={courseYearKey}
            onChange={(e) => onCourseYearChange(e.target.value)}
            disabled={busy}
          >
            <option value="">--Select Course--</option>
            {groupedCourseOptions.map(([group, opts]) => (
              <optgroup key={group} label={group}>
                {opts.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {data?.yearSelection && data?.coursePrograms?.length ? (
        <div className="mb-3">
          {data.coursePrograms.map((program) => (
            <div key={program.courseId} className="row g-2 mb-2 align-items-center">
              <label className="col-sm-3 col-form-label">
                {program.degreeName}
                {program.departmentShortName ? ` | ${program.departmentShortName}` : ''}
                {program.academicYear ? ` | ${program.academicYear}` : ''}
              </label>
              <div className="col-sm-9 d-flex flex-wrap gap-3">
                {Array.from({ length: program.courseDuration }, (_, i) => i + 1).map((yr) => {
                  const value = `${program.courseId}___${yr}`;
                  return (
                    <label key={value}>
                      <input
                        type="radio"
                        name="course_program"
                        value={value}
                        checked={courseProgramKey === value}
                        onChange={() => onProgramChange(value)}
                      />
                      {' '}{yr}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {data?.selection && data?.semester ? (
        <div className="mb-3 row g-2 align-items-center">
          <label className="col-sm-2 col-form-label">Batch</label>
          <div className="col-sm-1">
            <input className="form-control" value={totalBatch} onChange={(e) => setTotalBatch(e.target.value)} />
          </div>
          <div className="col-sm-2">
            <button type="button" className="btn btn-info" onClick={onGo} disabled={busy}>Go</button>
          </div>
        </div>
      ) : null}

      <ReportPrintBar html={data?.printHtml} />

      {data?.students?.length && totalBatch ? (
        <form onSubmit={handleSave}>
          <div className="table-responsive">
            <table className="table table-bordered table-sm">
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
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </form>
      ) : null}
    </ExamSetupShell>
  );
}
