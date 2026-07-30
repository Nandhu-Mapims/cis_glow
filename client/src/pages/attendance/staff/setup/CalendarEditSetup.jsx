import { useEffect, useState } from 'react';
import { toDateInputValue } from '../../../../utils/dateInputs';

export default function CalendarEditSetup({ data, busy, onLoad, onSave }) {
  const [eid, setEid] = useState(data?.eid || '');
  const record = data?.record;
  const [form, setForm] = useState(null);
  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  useEffect(() => { setForm(record ? { ...record } : null); }, [record]);

  return (
    <div>
      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label">Record ID</label>
          <div className="input-group">
            <input className="form-control" value={eid} onChange={(e) => setEid(e.target.value)} />
            <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => onLoad({ eid })}>Load</button>
          </div>
        </div>
      </div>
      {form && (
        <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, eid: record.id, Submit: 'Update' }); }}>
          <div className="row g-3">
            <div className="col-md-3"><label className="form-label">From</label><input type="date" className="form-control" value={toDateInputValue(form.from_date)} onChange={(e) => set('from_date', e.target.value)} /></div>
            <div className="col-md-3"><label className="form-label">To</label><input type="date" className="form-control" value={toDateInputValue(form.to_date)} onChange={(e) => set('to_date', e.target.value)} /></div>
            <div className="col-md-3"><label className="form-label">Staff ID</label><input className="form-control" value={form.staff_id || ''} onChange={(e) => set('staff_id', e.target.value)} /></div>
            <div className="col-md-3"><label className="form-label">Comments</label><input className="form-control" value={form.comments || ''} onChange={(e) => set('comments', e.target.value)} /></div>
            <div className="col-12 d-flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={busy}>Update</button>
              <button type="button" className="btn btn-outline-danger" disabled={busy} onClick={() => onSave({ eid: record.id, delete: true })}>Delete</button>
            </div>
          </div>
        </form>
      )}
      <div className="table-responsive mt-4">
        <table className="table table-sm table-bordered">
          <thead><tr><th>ID</th><th>Staff</th><th>From</th><th>To</th><th>Event</th></tr></thead>
          <tbody>
            {(data?.recent || []).map((r) => (
              <tr key={r.id}><td><button type="button" className="btn btn-link btn-sm p-0" onClick={() => onLoad({ eid: r.id })}>{r.id}</button></td><td>{r.staff_id}</td><td>{r.from_date}</td><td>{r.to_date}</td><td>{r.academic_events}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
