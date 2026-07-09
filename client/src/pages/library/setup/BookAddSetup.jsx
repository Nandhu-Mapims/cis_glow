import { useEffect, useState } from 'react';

export default function BookAddSetup({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({});
  useEffect(() => { onLoad(); }, [onLoad]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const handleSave = async (e) => { e.preventDefault(); await onSave(form); };
  return (
    <form onSubmit={handleSave} className="row g-3">
      {['accessionNo','resourceName','authorName','publisherName','callNumber','isbnNo','shelfNo','rackNo'].map((f) => (
        <div key={f} className="col-md-4"><label className="form-label">{f}</label><input className="form-control" value={form[f] || ''} onChange={(e) => set(f, e.target.value)} /></div>
      ))}
      <div className="col-12"><button type="submit" className="btn btn-danger" disabled={busy}>Save</button></div>
    </form>
  );
}
