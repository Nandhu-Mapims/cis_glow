import { useEffect, useState } from 'react';
import { CourseSemesterSelector, ExamSelector, ExamSetupShell } from './ExamSelectors';
import { useExamSetupApi } from './useExamSetupApi';

function normalizeAttInput(value) {
  let next = String(value || '').replace(/[^0-9.Aa]/g, '');
  if (/[Aa]/.test(next)) next = 'A';
  return next.slice(0, 5);
}

export default function AttendanceEntrySetup({ readOnly }) {
  const { data, busy, error, notice, load, save } = useExamSetupApi('attendance-entry');
  const [examId, setExamId] = useState('');
  const [courseKey, setCourseKey] = useState('');
  const [students, setStudents] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.examId) setExamId(data.examId);
    if (data?.courseKey) setCourseKey(data.courseKey);
    if (data?.students) setStudents(data.students);
    if (data?.pagination?.page) setPage(data.pagination.page);
  }, [data]);

  const reload = async (patch = {}) => load({
    exam_name: patch.examId ?? examId,
    course_name: patch.courseKey ?? courseKey,
    page: patch.page ?? page,
    ...patch,
  });

  const onExamChange = async (value) => {
    setExamId(value);
    setCourseKey('');
    setStudents([]);
    setPage(1);
    await reload({ exam_name: value, course_name: '', action: '', page: 1 });
  };

  const onCourseChange = async (value) => {
    setCourseKey(value);
    setStudents([]);
    setPage(1);
    await reload({ course_name: value, action: '', page: 1 });
  };

  const onGo = async () => {
    setPage(1);
    await reload({ action: 'go', page: 1 });
  };

  const onPageChange = async (nextPage) => {
    setPage(nextPage);
    await reload({ action: 'go', page: nextPage });
  };

  const updateStudentSubject = (studentIndex, subjectIndex, attPer) => {
    setStudents((prev) => prev.map((row, i) => {
      if (i !== studentIndex) return row;
      return {
        ...row,
        subjects: row.subjects.map((sub, j) => (
          j === subjectIndex ? { ...sub, attPer: normalizeAttInput(attPer) } : sub
        )),
      };
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await save({
      examSetupId: examId,
      courseKey,
      page,
      students,
    });
  };

  const pagination = data?.pagination;
  const subjects = data?.subjects || [];

  return (
    <ExamSetupShell notice={notice} error={error} busy={busy}>
      <ExamSelector value={examId} options={data?.examOptions} onChange={onExamChange} disabled={busy} />
      <CourseSemesterSelector courseGroups={data?.courseGroups} value={courseKey} onChange={onCourseChange} disabled={busy} />

      {courseKey ? (
        <div className="mb-3 row g-2">
          <div className="col-sm-2" />
          <div className="col-sm-2">
            <button type="button" className="btn btn-danger" onClick={onGo} disabled={busy}>Go</button>
          </div>
          {pagination?.total ? (
            <div className="col-sm-8 text-end text-muted small align-self-center">
              Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} entries
            </div>
          ) : null}
        </div>
      ) : null}

      {students.length > 0 && subjects.length > 0 ? (
        <form onSubmit={handleSave}>
          <div className="table-responsive">
            <table className="table table-bordered table-sm align-middle">
              <thead className="table-secondary">
                <tr>
                  <th>#</th>
                  <th>Roll.No</th>
                  <th>Name</th>
                  {subjects.map((sub) => (
                    <th key={sub.subjectId} className="small">{sub.subjectName}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((stu, studentIndex) => (
                  <tr key={stu.registerNo}>
                    <td>{stu.index}</td>
                    <td>{stu.registerNo}</td>
                    <td nowrap="nowrap">{stu.name}</td>
                    {stu.subjects.map((sub, subjectIndex) => (
                      <td key={`${stu.registerNo}-${sub.subjectId}`}>
                        <input
                          className="form-control form-control-sm text-end"
                          style={{ maxWidth: 70 }}
                          value={sub.attPer}
                          maxLength={5}
                          disabled={readOnly || busy}
                          onChange={(e) => updateStudentSubject(studentIndex, subjectIndex, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination?.totalPages > 1 ? (
            <nav className="d-flex justify-content-center mb-3">
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${pagination.page <= 1 ? 'disabled' : ''}`}>
                  <button type="button" className="page-link" disabled={pagination.page <= 1 || busy} onClick={() => onPageChange(pagination.page - 1)}>Prev</button>
                </li>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).slice(
                  Math.max(0, pagination.page - 3),
                  Math.min(pagination.totalPages, pagination.page + 2),
                ).map((p) => (
                  <li key={p} className={`page-item ${p === pagination.page ? 'active' : ''}`}>
                    <button type="button" className="page-link" disabled={busy} onClick={() => onPageChange(p)}>{p}</button>
                  </li>
                ))}
                <li className={`page-item ${pagination.page >= pagination.totalPages ? 'disabled' : ''}`}>
                  <button type="button" className="page-link" disabled={pagination.page >= pagination.totalPages || busy} onClick={() => onPageChange(pagination.page + 1)}>Next</button>
                </li>
              </ul>
            </nav>
          ) : null}

          {!readOnly ? (
            <div className="text-center">
              <button type="submit" className="btn btn-danger btn-lg" disabled={busy}>Save</button>
            </div>
          ) : null}
        </form>
      ) : null}
    </ExamSetupShell>
  );
}
