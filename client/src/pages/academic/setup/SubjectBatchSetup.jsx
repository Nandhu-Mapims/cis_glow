import { useEffect, useMemo, useState } from 'react';
import ReportPrintBar from '../../../components/ReportPrintBar';
import { buildSubjectBatchPrintHtml } from '../../../utils/subjectBatchPrint';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useAcademicSetupApi } from './useAcademicSetupApi';

export default function SubjectBatchSetup() {
  const { data, busy, error, notice, load, save } = useAcademicSetupApi('subject-batch');
  const [courseYearKey, setCourseYearKey] = useState('');
  const [semester, setSemester] = useState('');
  const [totalBatch, setTotalBatch] = useState('');
  const [assignments, setAssignments] = useState({});

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (data?.courseYearKey) setCourseYearKey(data.courseYearKey);
    if (data?.semester) setSemester(String(data.semester));
    if (data?.totalBatch) setTotalBatch(String(data.totalBatch));
    if (data?.batchAssignments) setAssignments({ ...data.batchAssignments });
  }, [data]);

  const reload = (patch = {}) => load({
    course_name: patch.courseYearKey ?? courseYearKey,
    semester_name: patch.semester ?? semester,
    total_batch: Object.prototype.hasOwnProperty.call(patch, 'totalBatch') ? patch.totalBatch : totalBatch,
  });

  const onCourseChange = async (value) => {
    setCourseYearKey(value);
    setSemester('');
    setTotalBatch('');
    setAssignments({});
    await reload({ courseYearKey: value, semester: '', totalBatch: '' });
  };

  const onSemesterChange = async (value) => {
    setSemester(String(value));
    setTotalBatch('');
    setAssignments({});
    await reload({ semester: String(value), totalBatch: '' });
  };

  const onGo = async () => {
    await reload({ totalBatch });
  };

  const setStudentBatch = (registerNo, batchNo) => {
    setAssignments((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((roll) => {
        if (next[roll] === batchNo) delete next[roll];
      });
      if (batchNo) next[registerNo] = batchNo;
      else delete next[registerNo];
      return next;
    });
  };

  const setBatchAll = (batchNo, checked) => {
    setAssignments((prev) => {
      const next = { ...prev };
      (data?.students || []).forEach((student) => {
        if (checked) next[student.registerNo] = batchNo;
        else if (next[student.registerNo] === batchNo) delete next[student.registerNo];
      });
      return next;
    });
  };

  const isBatchAllChecked = (batchNo) => {
    const students = data?.students || [];
    return students.length > 0 && students.every((student) => Number(assignments[student.registerNo]) === batchNo);
  };

  const batchCount = Number(totalBatch) || Number(data?.totalBatch) || 0;
  const batchNums = Array.from({ length: batchCount }, (_, i) => i + 1);
  const letters = data?.batchLetters || {};
  const printHtml = useMemo(() => {
    if (!data?.printMeta || !batchCount || !(data.students || []).length) return '';
    return buildSubjectBatchPrintHtml({
      title: data.printMeta.title,
      subtitle: data.printMeta.subtitle,
      bannerUrl: data.bannerUrl,
      students: data.students,
      assignments,
      batchCount,
      batchLetters: letters,
    });
  }, [assignments, batchCount, data?.bannerUrl, data?.printMeta, data?.students, letters]);
  const courseOptionsByGroup = (data?.courseYearOptions || []).reduce((groups, option) => {
    const key = option.group || 'Courses';
    if (!groups[key]) groups[key] = [];
    groups[key].push(option);
    return groups;
  }, {});

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} />
      <div className="mb-3 row g-2">
        <label className="col-sm-2 col-form-label">Course &amp; Academic year</label>
        <div className="col-sm-5">
          <select className="form-select" value={courseYearKey} disabled={busy} onChange={(e) => onCourseChange(e.target.value)}>
            <option value="">--Select Course--</option>
            {Object.entries(courseOptionsByGroup).map(([group, options]) => (
              <optgroup key={group} label={group}>
                {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {data?.selection ? (
        <div className="mb-3 row g-2">
          <label className="col-sm-2 col-form-label">Year</label>
          <div className="col-sm-8">
            {Array.from({ length: data.totalSemester || 0 }, (_, i) => i + 1).map((yr) => (
              <label key={yr} className="me-3">
                <input type="radio" checked={String(semester) === String(yr)} onChange={() => onSemesterChange(yr)} /> {yr}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {data?.scope ? (
        <>
          <div className="mb-3 row g-2 align-items-center">
            <label className="col-sm-2 col-form-label">Batch count</label>
            <div className="col-sm-2">
              <input className="form-control" value={totalBatch} onChange={(e) => setTotalBatch(e.target.value)} />
            </div>
            <div className="col-sm-2">
              <button type="button" className="btn btn-info" disabled={busy} onClick={onGo}>Go</button>
            </div>
          </div>

          {batchCount > 0 && (data.students || []).length ? (
            <form onSubmit={async (e) => {
              e.preventDefault();
              await save({
                scope: data.scope,
                totalBatch: batchCount,
                assignments,
                courseYearKey,
              });
            }}>
              <ReportPrintBar html={printHtml} label="Print" printMode="academic-subject-batch" />
              <div id="batch-edit-panel" className="table-responsive">
                <table className="table table-bordered align-middle">
                  <thead className="table-secondary">
                    <tr>
                      <th>#</th><th>Roll No.</th><th>Student Name</th>
                      {batchNums.map((b) => (
                        <th key={b}>
                          <label className="mb-0">
                            <input
                              type="checkbox"
                              className="me-1"
                              checked={isBatchAllChecked(b)}
                              onChange={(e) => setBatchAll(b, e.target.checked)}
                            />
                            Batch {letters[b] || String.fromCharCode(64 + b)}
                          </label>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data.students || []).map((student, index) => (
                      <tr key={student.registerNo}>
                        <td>{index + 1}</td>
                        <td>{student.registerNo}</td>
                        <td>{student.name}</td>
                        {batchNums.map((b) => (
                          <td key={b} className="text-center">
                            <input
                              type="checkbox"
                              checked={Number(assignments[student.registerNo]) === b}
                              onChange={(e) => setStudentBatch(student.registerNo, e.target.checked ? b : null)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-end">
                <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
              </div>
            </form>
          ) : null}
        </>
      ) : null}
    </>
  );
}
