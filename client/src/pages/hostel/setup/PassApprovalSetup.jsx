import { useEffect, useState } from 'react';

const STATUS_LABEL = ['Pending', 'Approved', 'Rejected'];

export default function PassApprovalSetup({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({
    status: '0', passType: '', registerNo: '', fromDate: '', toDate: '',
  });

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data) {
      setForm((p) => ({
        ...p,
        status: data.statusFilter ?? p.status,
        passType: data.passType || '',
        registerNo: data.registerNo || '',
        fromDate: data.fromDate || '',
        toDate: data.toDate || '',
      }));
    }
  }, [data]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const runSearch = (e) => {
    e.preventDefault();
    onLoad(form);
  };

  return (
    <>
      <form onSubmit={runSearch} className="row g-2 mb-3">
        <div className="col-md-3"><input className="form-control" placeholder="Student ID" value={form.registerNo} onChange={(e) => set('registerNo', e.target.value)} /></div>
        <div className="col-md-2"><input type="date" className="form-control" value={form.fromDate} onChange={(e) => set('fromDate', e.target.value)} /></div>
        <div className="col-md-2"><input type="date" className="form-control" value={form.toDate} onChange={(e) => set('toDate', e.target.value)} /></div>
        <div className="col-md-2 d-flex align-items-center gap-2">
          <label className="mb-0"><input type="radio" name="passType" checked={form.passType === ''} onChange={() => set('passType', '')} /> All</label>
          <label className="mb-0"><input type="radio" name="passType" checked={form.passType === 'out'} onChange={() => set('passType', 'out')} /> Out</label>
          <label className="mb-0"><input type="radio" name="passType" checked={form.passType === 'home'} onChange={() => set('passType', 'home')} /> Home</label>
        </div>
        <div className="col-md-2 d-flex align-items-center gap-2">
          <label className="mb-0"><input type="radio" name="status" checked={form.status === '0'} onChange={() => set('status', '0')} /> Pending</label>
          <label className="mb-0"><input type="radio" name="status" checked={form.status === '1'} onChange={() => set('status', '1')} /> Approved</label>
          <label className="mb-0"><input type="radio" name="status" checked={form.status === '2'} onChange={() => set('status', '2')} /> Rejected</label>
        </div>
        <div className="col-md-1"><button type="submit" className="btn btn-danger" disabled={busy}>Search</button></div>
      </form>
      <div className="table-responsive">
        <table className="table table-bordered">
          <thead className="table-secondary">
            <tr><th>S.No</th><th>R.ID</th><th>Student</th><th>Pass Date</th><th>Purpose</th><th>Request On</th><th>Parent Status</th><th>Warden Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            {(data?.rows || []).map((row, i) => (
              <tr key={row.id}>
                <td>{i + 1}</td>
                <td>{row.requestId}</td>
                <td>{row.studentName} ({row.registerNo})</td>
                <td>{row.fromDate} — {row.toDate}</td>
                <td>{row.purpose}</td>
                <td>{row.createdDt}</td>
                <td>{STATUS_LABEL[row.parentStatus] || 'Pending'}</td>
                <td>{STATUS_LABEL[row.status] || 'Pending'}</td>
                <td className="d-flex gap-1">
                  <button type="button" className="btn btn-sm btn-success" disabled={busy} onClick={() => onSave({ ...form, id: row.id, status: 1, statusFilter: form.status })}>Approve</button>
                  <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => onSave({ ...form, id: row.id, status: 2, statusFilter: form.status })}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
