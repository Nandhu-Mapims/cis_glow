import { useEffect, useState } from 'react';

export default function BookEditSetup({ data, busy, onLoad, onSave }) {
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({});
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.book) setForm(data.book); }, [data]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  return (
    <>
      <div className="row g-2 mb-3"><div className="col-md-4"><input className="form-control" placeholder="Accession no" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="col-md-2"><button type="button" className="btn btn-primary" onClick={() => onLoad({ search })} disabled={busy}>Search</button></div></div>
      {form.id ? (
        <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, action: 'update' }); }} className="row g-3">
          {['accessionNo','resourceName','authorName','callNumber','shelfNo'].map((f) => (
            <div key={f} className="col-md-4"><label className="form-label">{f}</label><input className="form-control" value={form[f] || ''} onChange={(e) => set(f, e.target.value)} /></div>
          ))}
          <div className="col-12 d-flex gap-2"><button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
            <button type="button" className="btn btn-outline-danger" onClick={() => onSave({ action: 'delete', id: form.id })} disabled={busy}>Delete</button></div>
        </form>
      ) : null}
    </>
  );
}
