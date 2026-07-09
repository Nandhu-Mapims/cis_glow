import { useEffect, useState } from 'react';
import api from '../../../api/client';
import { useTransientNotice } from '../../../hooks/useTransientNotice';
import SetupAlerts from './SetupAlerts';

export default function FeeDmeSetup() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useTransientNotice(4000);
  const [error, setError] = useState('');
  const [courseKey, setCourseKey] = useState('');

  const load = async (nextKey = courseKey) => {
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/api/fees/setup/dme/load', { courseKey: nextKey });
      setData(res.data);
      setCourseKey(res.data.selected?.courseKey || nextKey);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load DME setup');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCourseChange = async (value) => {
    setCourseKey(value);
    await load(value);
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
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await api.post('/api/fees/setup/dme/save', {
        courseKey,
        rows: (data?.students || []).map((row) => ({
          studentId: row.studentId,
          amount: Number(row.amount) || 0,
        })),
      });
      setNotice(`Saved ${res.data.saved || 0} DME rows.`);
      await load(courseKey);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save DME setup');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <SetupAlerts notice={notice} error={error} busy={busy} onDismissNotice={() => setNotice('')} />

      <div className="card shadow-sm mb-3 cis-fee-filter-card">
        <div className="card-header py-2">Course filter</div>
        <div className="card-body">
          <div className="row g-3">
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
          </div>
        </div>
      </div>

      {courseKey && !data?.students?.length && !busy && (
        <div className="alert alert-warning">No DME receipt rows found for this course and year.</div>
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
                  <th>Receipt No</th>
                  <th>Date</th>
                  <th className="text-end">Amount</th>
                  <th>Approved Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((row, idx) => (
                  <tr key={row.studentId}>
                    <td>{idx + 1}</td>
                    <td>{row.registerNo}</td>
                    <td>{row.name}</td>
                    <td>{row.receiptNo}</td>
                    <td>{row.receiptDate}</td>
                    <td className="text-end">{row.receiptAmount}</td>
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
