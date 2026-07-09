import { useEffect, useState } from 'react';
import ReportPrintBar from '../../../components/ReportPrintBar';
import { calculateMarkTotal, normalizeMarkInput } from './markEntryUtils';
import { ExamSelector, CourseSemesterSelector, ExamSetupShell } from './ExamSelectors';
import { useExamSetupApi } from './useExamSetupApi';

export default function MarkEntrySetup() {
  const { data, busy, error, notice, load, save } = useExamSetupApi('mark-entry');
  const [examId, setExamId] = useState('');
  const [courseKey, setCourseKey] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [students, setStudents] = useState([]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.examId) setExamId(data.examId);
    if (data?.courseKey) setCourseKey(data.courseKey);
    if (data?.subjectId) setSubjectId(data.subjectId);
    if (data?.students) setStudents(data.students);
  }, [data]);

  const reload = async (patch = {}) => {
    const res = await load({
      exam_name: patch.examId ?? examId,
      course_name: patch.courseKey ?? courseKey,
      subject_name: patch.subjectId ?? subjectId,
      ...patch,
    });
    return res;
  };

  const onExamChange = async (value) => {
    setExamId(value);
    setCourseKey('');
    setSubjectId('');
    setStudents([]);
    await reload({ exam_name: value, course_name: '', subject_name: '' });
  };

  const onCourseChange = async (value) => {
    setCourseKey(value);
    setSubjectId('');
    setStudents([]);
    await reload({ course_name: value, subject_name: '' });
  };

  const onGo = async () => {
    await reload({ subject_name: subjectId, action: 'go' });
  };

  const updateStudent = (index, patch) => {
    setStudents((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      const next = { ...row, ...patch };
      if (data?.columns) {
        const calc = calculateMarkTotal(next.iMark, next.vMark, next.eMark, {
          iMax: data.columns.iMax,
          vMax: data.columns.vMax,
          eMax: data.columns.eMax,
          passMin: data.columns.passMin,
        });
        return { ...next, ...calc };
      }
      return next;
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await save({
      examSetupId: examId,
      courseKey,
      subjectId,
      students,
    });
  };

  const cols = data?.columns;

  return (
    <ExamSetupShell notice={notice} error={error} busy={busy}>
      <ExamSelector value={examId} options={data?.examOptions} onChange={onExamChange} disabled={busy} />
      <CourseSemesterSelector courseGroups={data?.courseGroups} value={courseKey} onChange={onCourseChange} disabled={busy} />

      {data?.subjects?.length ? (
        <div className="mb-3 row g-2">
          <label className="col-sm-2 col-form-label">Subject</label>
          <div className="col-sm-4">
            <select className="form-select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">--Select Subject--</option>
              {data.subjects.map((sub) => (
                <option key={sub.subjectId} value={sub.subjectId} style={sub.hasMarks ? { background: '#9ABB44' } : undefined}>
                  {sub.subjectId} | {sub.categoryName} | {sub.subjectName}{sub.hasMarks ? ' *' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="col-sm-2">
            <button type="button" className="btn btn-danger" onClick={onGo} disabled={busy || !subjectId}>Go</button>
          </div>
        </div>
      ) : null}

      {students.length > 0 && cols ? (
        <form onSubmit={handleSave}>
          <div className="table-responsive">
            <table className="table table-bordered table-sm align-middle">
              <thead className="table-secondary">
                <tr>
                  <th>Reg.No</th>
                  <th>Roll.No</th>
                  <th>Name</th>
                  {cols.I ? <th>Int.({cols.iMax})</th> : null}
                  {cols.V ? <th>Viva({cols.vMax})</th> : null}
                  {cols.E ? <th>{(data.subject?.categoryName || 'Ext').slice(0, 3)}({cols.eMax})</th> : null}
                  {cols.showTotal ? <th>Total</th> : null}
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {students.map((row, index) => (
                  <tr key={row.registerNo}>
                    <td>{row.uregisterNo}</td>
                    <td>{row.registerNo}</td>
                    <td>{row.name}</td>
                    {cols.I ? (
                      <td>
                        <input className="form-control form-control-sm" style={{ width: 60 }} value={row.iMark}
                          onChange={(e) => updateStudent(index, { iMark: normalizeMarkInput(e.target.value) })} maxLength={2} />
                      </td>
                    ) : null}
                    {cols.V ? (
                      <td>
                        <input className="form-control form-control-sm" style={{ width: 60 }} value={row.vMark}
                          onChange={(e) => updateStudent(index, { vMark: normalizeMarkInput(e.target.value) })} maxLength={2} />
                      </td>
                    ) : null}
                    {cols.E ? (
                      <td>
                        <input className="form-control form-control-sm" style={{ width: 60 }} value={row.eMark}
                          onChange={(e) => updateStudent(index, { eMark: normalizeMarkInput(e.target.value) })} maxLength={3} />
                      </td>
                    ) : null}
                    {cols.showTotal ? <td><input className="form-control form-control-sm" style={{ width: 70 }} value={row.tMark} readOnly /></td> : null}
                    <td><input className="form-control form-control-sm" style={{ width: 70 }} value={row.result} readOnly /></td>
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
