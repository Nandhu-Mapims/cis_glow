import { useEffect, useState } from 'react';

export default function PassReportSetup({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({
    fromDate: '', toDate: '', registerNo: '', passType: ['home', 'out'], status: ['p', '1', '2'],
  });

  useEffect(() => {
    onLoad().then((d) => {
      if (d) {
        setForm((p) => ({
          ...p,
          fromDate: d.fromDate || '',
          toDate: d.toDate || '',
          registerNo: d.registerNo || '',
          passType: d.passType?.length ? d.passType : p.passType,
          status: d.status?.length ? d.status : p.status,
        }));
      }
    });
  }, [onLoad]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const toggle = (key, value) => setForm((p) => {
    const has = p[key].includes(value);
    return { ...p, [key]: has ? p[key].filter((v) => v !== value) : [...p[key], value] };
  });

  const run = () => onLoad(form);

  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-md-2"><label className="form-label">Student ID</label><input className="form-control" value={form.registerNo} onChange={(e) => set('registerNo', e.target.value)} /></div>
        <div className="col-md-2"><label className="form-label">From</label><input type="date" className="form-control" value={form.fromDate} max={form.toDate || undefined} onChange={(e) => set('fromDate', e.target.value)} /></div>
        <div className="col-md-2"><label className="form-label">To</label><input type="date" className="form-control" value={form.toDate} min={form.fromDate || undefined} onChange={(e) => set('toDate', e.target.value)} /></div>
        <div className="col-md-2">
          <label className="form-label d-block">Request Type</label>
          <label className="me-2"><input type="checkbox" checked={form.passType.includes('home')} onChange={() => toggle('passType', 'home')} /> Home</label>
          <label><input type="checkbox" checked={form.passType.includes('out')} onChange={() => toggle('passType', 'out')} /> Out</label>
        </div>
        <div className="col-md-3">
          <label className="form-label d-block">Status</label>
          <label className="me-2"><input type="checkbox" checked={form.status.includes('p')} onChange={() => toggle('status', 'p')} /> Pending</label>
          <label className="me-2"><input type="checkbox" checked={form.status.includes('1')} onChange={() => toggle('status', '1')} /> Approved</label>
          <label><input type="checkbox" checked={form.status.includes('2')} onChange={() => toggle('status', '2')} /> Rejected</label>
        </div>
        <div className="col-md-1 d-flex align-items-end"><button type="button" className="btn btn-primary" onClick={run} disabled={busy}>Search</button></div>
      </div>
      <div className="table-responsive">
        <table className="table table-bordered table-sm">
          <thead className="table-secondary">
            <tr><th>S.No</th><th>Register No</th><th>Student</th><th>Type</th><th>From</th><th>To</th><th>Parent Status</th><th>Warden Status</th><th>Comments</th></tr>
          </thead>
          <tbody>
            {(data?.rows || []).map((row, i) => (
              <tr key={row.id || i}>
                <td>{i + 1}</td>
                <td>{row.registerNo}</td>
                <td>{row.studentName}</td>
                <td>{row.passType}</td>
                <td>{row.fromDate}</td>
                <td>{row.toDate}</td>
                <td>{row.parentStatus}</td>
                <td>{row.status}</td>
                <td>{row.comments}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
