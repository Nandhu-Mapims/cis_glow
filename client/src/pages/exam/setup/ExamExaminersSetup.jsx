import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CourseSemesterSelector, ExamSelector, ExamSetupShell } from './ExamSelectors';
import { useExamSetupApi } from './useExamSetupApi';

export default function ExamExaminersSetup({ readOnly }) {
  const { data, busy, error, notice, load, save } = useExamSetupApi('exam-examiners');
  const [examId, setExamId] = useState('');
  const [courseKey, setCourseKey] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [examiners, setExaminers] = useState([]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.examId) setExamId(data.examId);
    if (data?.courseKey) setCourseKey(data.courseKey);
    if (data?.subjectId) setSubjectId(data.subjectId);
    if (data?.examiners) setExaminers(data.examiners);
  }, [data]);

  const reload = async (patch = {}) => load({
    exam_name: patch.examId ?? examId,
    course_name: patch.courseKey ?? courseKey,
    subject_name: patch.subjectId ?? subjectId,
    ...patch,
  });

  const onExamChange = async (value) => {
    setExamId(value);
    setCourseKey('');
    setSubjectId('');
    setExaminers([]);
    await reload({ exam_name: value, course_name: '', subject_name: '' });
  };

  const onCourseChange = async (value) => {
    setCourseKey(value);
    setSubjectId('');
    setExaminers([]);
    await reload({ course_name: value, subject_name: '' });
  };

  const onGo = async () => {
    await reload({ subject_name: subjectId, action: 'go' });
  };

  const updateExaminer = (index, patch) => {
    setExaminers((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await save({
      examSetupId: examId,
      courseKey,
      subjectId,
      examiners,
    });
  };

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
                <option
                  key={sub.subjectId}
                  value={sub.subjectId}
                  style={sub.hasExaminers ? { background: '#9ABB44' } : undefined}
                >
                  {sub.subjectId} | {sub.categoryName} | {sub.subjectName}{sub.hasExaminers ? ' *' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="col-sm-2">
            <button type="button" className="btn btn-danger" onClick={onGo} disabled={busy || !subjectId}>Go</button>
          </div>
        </div>
      ) : null}

      {data?.infoMessage ? (
        <div className="alert alert-warning py-2">
          {data.infoMessage}
          {data?.notConfigured ? (
            <div className="mt-2">
              <Link to="/exam/setup/examiner-setup" className="btn btn-sm btn-outline-primary">
                Open Examiner Setup
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {examiners.length > 0 ? (
        <form onSubmit={handleSave}>
          <div className="table-responsive">
            <table className="table table-bordered table-sm align-middle">
              <thead className="table-secondary">
                <tr>
                  <th>Type</th>
                  <th>Examiner Name</th>
                  <th>Designation</th>
                  <th>College</th>
                  <th>Mobile No.</th>
                  <th>E-Mail ID</th>
                </tr>
              </thead>
              <tbody>
                {examiners.map((row, index) => (
                  <tr key={`${row.examinerType}-${index}`}>
                    <td>{row.examinerLabel}</td>
                    <td>
                      <input
                        className="form-control form-control-sm"
                        value={row.extName}
                        disabled={readOnly || busy}
                        onChange={(e) => updateExaminer(index, { extName: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="form-control form-control-sm"
                        value={row.extDesig}
                        disabled={readOnly || busy}
                        onChange={(e) => updateExaminer(index, { extDesig: e.target.value })}
                      />
                    </td>
                    <td>
                      <textarea
                        className="form-control form-control-sm"
                        rows={2}
                        value={row.extWorking}
                        disabled={readOnly || busy}
                        onChange={(e) => updateExaminer(index, { extWorking: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="form-control form-control-sm"
                        value={row.extMobile}
                        disabled={readOnly || busy}
                        onChange={(e) => updateExaminer(index, { extMobile: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="form-control form-control-sm"
                        value={row.extEmail}
                        disabled={readOnly || busy}
                        onChange={(e) => updateExaminer(index, { extEmail: e.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
