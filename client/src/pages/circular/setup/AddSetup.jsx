import { useEffect, useState } from 'react';

export default function AddSetup({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({});
  const [file, setFile] = useState(null);
  useEffect(() => { onLoad(); }, [onLoad]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form, file ? [file] : []); }} className="row g-3">
      <div className="col-md-6"><label className="form-label">Title</label><input className="form-control" value={form.title || ''} onChange={(e) => set('title', e.target.value)} /></div>
      <div className="col-md-6"><label className="form-label">Sub Title</label><input className="form-control" value={form.subTitle || ''} onChange={(e) => set('subTitle', e.target.value)} /></div>
      <div className="col-md-3"><label className="form-label">From Date</label><input type="date" className="form-control" value={form.fromDate || ''} max={form.toDate || undefined} onChange={(e) => set('fromDate', e.target.value)} /></div>
      <div className="col-md-3"><label className="form-label">To Date</label><input type="date" className="form-control" value={form.toDate || ''} min={form.fromDate || undefined} onChange={(e) => set('toDate', e.target.value)} /></div>
      <div className="col-md-3"><label className="form-label">Audience</label><select className="form-select" value={form.audienceFor || 'Staff'} onChange={(e) => set('audienceFor', e.target.value)}><option>Staff</option><option>Student</option><option>Department</option></select></div>
      <div className="col-12"><label className="form-label">Description</label><textarea className="form-control" rows={4} value={form.description || ''} onChange={(e) => set('description', e.target.value)} /></div>
      <div className="col-md-6"><label className="form-label">Attachment</label><input type="file" className="form-control" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
      <div className="col-12"><button type="submit" className="btn btn-danger" disabled={busy}>Submit</button></div>
    </form>
  );
}
