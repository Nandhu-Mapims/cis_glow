import { useState } from 'react';

export default function CalendarAddSetup({ data, busy, onSave }) {
  const [form, setForm] = useState({});
  const f = { ...data?.form, ...form };
  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...f, Submit: 'Update', fresult: 1 }); }}>
      <div className="row g-3">
        <div className="col-md-3"><label className="form-label">From Date</label><input className="form-control" value={f.from_date || ''} onChange={(e) => set('from_date', e.target.value)} /></div>
        <div className="col-md-3"><label className="form-label">To Date</label><input className="form-control" value={f.to_date || ''} onChange={(e) => set('to_date', e.target.value)} /></div>
        <div className="col-md-3"><label className="form-label">Staff ID</label><input className="form-control" value={f.staff_id || ''} onChange={(e) => set('staff_id', e.target.value)} /></div>
        <div className="col-md-3"><label className="form-label">Event</label>
          <select className="form-select" value={f.a_event || ''} onChange={(e) => set('a_event', e.target.value)}>
            <option value="">Select</option>
            {(data?.events || []).map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
        </div>
        <div className="col-md-3"><label className="form-label">Authority</label>
          <select className="form-select" value={f.authority || ''} onChange={(e) => set('authority', e.target.value)}>
            <option value="">Select</option>
            {(data?.authorities || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="col-md-6"><label className="form-label">Comments</label><input className="form-control" value={f.comments || ''} onChange={(e) => set('comments', e.target.value)} /></div>
        <div className="col-12"><button type="submit" className="btn btn-primary" disabled={busy}>Save</button></div>
      </div>
    </form>
  );
}
