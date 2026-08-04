import { useEffect, useState } from 'react';
import api from '../../../api/client';
import { useTransientNotice } from '../../../hooks/useTransientNotice';
import SetupAlerts from './SetupAlerts';

export default function FeeScholarshipSetup() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useTransientNotice(4000);
  const [error, setError] = useState('');
  const [courseKey, setCourseKey] = useState('');
  const [currentYear, setCurrentYear] = useState('');

  const load = async (payload = {}, options = {}) => {
    setBusy(true);
    if (!options.keepNotice) setError('');
    try {
      const res = await api.post('/api/fees/setup/scholarship/load', payload);
      setData(res.data);
      if (res.data.selected?.courseKey) setCourseKey(res.data.selected.courseKey);
      if (res.data.selected?.currentYear) setCurrentYear(res.data.selected.currentYear);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load scholarship setup');
      return null;
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCourseChange = async (value) => {
    setCourseKey(value);
    setCurrentYear('');
    setError('');
    if (!value) {
      setData((prev) => (prev ? { ...prev, students: [], classOptions: [], loaded: false } : prev));
      return;
    }
    await load({ courseKey: value });
  };

  const handleGo = async (e) => {
    e.preventDefault();
    if (!courseKey) {
      setError('Select course and academic year first.');
      return;
    }
    if (!currentYear) {
      setError('Select year, then click Go.');
      return;
    }
    await load({ courseKey, currentYear, Submit: 'Go' });
  };

  const updateAmount = (studentId, amount) => {
    setData((prev) => ({
      ...prev,
      students: (prev?.students || []).map((row) => (
        row.studentId === studentId ? { ...row, amount } : row
      )),
    }));
  };

  const onSave = async () => {
    if (!data?.loaded || !data?.students?.length) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        courseKey,
        currentYear,
        rows: (data.students || []).map((row) => ({
          studentId: row.studentId,
          amount: Number(row.amount) || 0,
        })),
      };
      const res = await api.post('/api/fees/setup/scholarship/save', payload);
      setNotice(res.data.message || `Saved ${res.data.saved || 0} scholarship rows.`);
      await load({ courseKey, currentYear, loadStudents: true }, { keepNotice: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save scholarship setup');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <SetupAlerts notice={notice} error={error} busy={busy} onDismissNotice={() => setNotice('')} />

      <p className="text-muted small mb-3">
        Select the course batch from the grouped list (Regular / Additional), choose the class year, then click Go.
      </p>

      <form className="card shadow-sm mb-3 cis-fee-filter-card" onSubmit={handleGo}>
        <div className="card-header py-2">Course &amp; year</div>
        <div className="card-body row g-3 align-items-end">
          <div className="col-md-5">
            <label className="form-label">Course &amp; Academic Year</label>
            <select className="form-select" value={courseKey} onChange={(e) => onCourseChange(e.target.value)}>
              <option value="">--Select Course--</option>
              {(data?.courseGroups || []).map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </optgroup>
              ))}
              {!data?.courseGroups?.length && (data?.courseOptions || []).map((course) => (
                <option key={course.value} value={course.value}>{course.label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-5">
            <label className="form-label d-block">Year</label>
            <div className="d-flex flex-wrap gap-3 pt-1">
              {(data?.classOptions || []).map((year) => (
                <label key={year.value} className="mb-0">
                  <input className="me-2"
                    type="radio"
                    name="currentYear"
                    value={year.value}
                    checked={currentYear === year.value}
                    onChange={() => setCurrentYear(year.value)}
                    disabled={!courseKey}
                  />
                  {' '}
                  {year.label}
                </label>
              ))}
              {!courseKey && <span className="text-muted small">Select course first</span>}
              {courseKey && !(data?.classOptions || []).length && (
                <span className="text-muted small">Loading year options…</span>
              )}
            </div>
          </div>
          <div className="col-md-2">
            <button type="submit" className="btn btn-primary w-100" disabled={busy}>Go</button>
          </div>
        </div>
      </form>

      {data?.loaded && !data?.students?.length && (
        <div className="alert alert-warning">
          No scholarship students found for this course, year, and class. Check that students have
          scholarship enabled on their profile.
        </div>
      )}

      {!!data?.students?.length && (
        <>
          <div className="table-responsive">
            <table className="table table-bordered table-sm cis-fee-setup-table">
              <thead className="cis-fee-sheet-head">
                <tr>
                  <th>#</th>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>Scholarship Type</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((row, idx) => (
                  <tr key={row.studentId}>
                    <td>{idx + 1}</td>
                    <td>{row.registerNo}</td>
                    <td>{row.name}</td>
                    <td>{row.scholarshipType}</td>
                    <td>
                      <input
                        className="form-control form-control-sm"
                        value={row.amount}
                        onChange={(e) => updateAmount(row.studentId, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={busy}>Save</button>
        </>
      )}
    </div>
  );
}
