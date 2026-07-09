import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../api/client';
import { useTransientNotice } from '../../../hooks/useTransientNotice';
import SetupAlerts from './SetupAlerts';

export default function FeeAcmecScholarshipSetup() {
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
      const res = await api.post('/api/fees/setup/acmec-scholarship/load', payload);
      setData(res.data);
      if (res.data.selected?.courseKey) setCourseKey(res.data.selected.courseKey);
      if (res.data.selected?.currentYear) setCurrentYear(res.data.selected.currentYear);
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load ACMEC scholarship setup');
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

  const onYearChange = async (value) => {
    setCurrentYear(value);
    setError('');
    if (!courseKey || !value) return;
    await load({ courseKey, currentYear: value });
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
          amount: row.amount,
        })),
      };
      const res = await api.post('/api/fees/setup/acmec-scholarship/save', payload);
      setNotice(res.data.message || `Saved ${res.data.saved || 0} ACMEC scholarship rows.`);
      await load({ courseKey, currentYear }, { keepNotice: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save ACMEC scholarship setup');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <SetupAlerts notice={notice} error={error} busy={busy} onDismissNotice={() => setNotice('')} />

      <p className="text-muted small mb-3">
        Select course and academic year from the grouped list, then choose the class year to load students.
      </p>

      <div className="card shadow-sm mb-3 cis-fee-filter-card">
        <div className="card-header py-2">Course &amp; academic year</div>
        <div className="card-body row g-3">
          <div className="col-md-6">
            <label className="form-label">Course &amp; Academic Year</label>
            <select className="form-select" value={courseKey} onChange={(e) => onCourseChange(e.target.value)}>
              <option value="">-- Select Course --</option>
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
          {!!courseKey && (
            <div className="col-md-6">
              <label className="form-label d-block">Year</label>
              <div className="d-flex flex-wrap gap-3 pt-1">
                {(data?.classOptions || []).map((year) => (
                  <label key={year.value} className="mb-0">
                    <input
                      type="radio"
                      name="currentYear"
                      value={year.value}
                      checked={currentYear === year.value}
                      onChange={() => onYearChange(year.value)}
                    />
                    {' '}
                    {year.label}
                  </label>
                ))}
                {!(data?.classOptions || []).length && (
                  <span className="text-muted small">Loading year options…</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {data?.loaded && !data?.students?.length && (
        <div className="alert alert-warning mb-0">
          {data.enrolledCount > 0 ? (
            <>
              <strong>{data.enrolledCount}</strong> student{data.enrolledCount === 1 ? '' : 's'} enrolled
              in this batch, but none have <strong>ACMEC Scholarship</strong> enabled on their profile.
            </>
          ) : (
            <>No students are enrolled in this course, year, and batch.</>
          )}
          {' '}
          Enable it under{' '}
          <Link to="/fees/acmec-config">Fees → ACMEC Scholarship Entry</Link>
          {' '}
          (check <em>ACMEC Scholarship</em> and enter the profile amount), then select the year again.
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
                  <th>Amount</th>
                  <th>Approved Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((row, idx) => (
                  <tr key={row.studentId}>
                    <td>{idx + 1}</td>
                    <td>{row.registerNo}</td>
                    <td>{row.name}</td>
                    <td>{row.profileAmount}</td>
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
