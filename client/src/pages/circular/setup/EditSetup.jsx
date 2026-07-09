import { useEffect, useState } from 'react';

export default function EditSetup({ data, busy, onLoad, onSave }) {
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({});
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.circular) setForm(data.circular); }, [data]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  return (
    <>
      <div className="row g-2 mb-3"><div className="col-md-4"><input className="form-control" placeholder="Search title" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="col-md-2"><button type="button" className="btn btn-primary" onClick={() => onLoad({ search })} disabled={busy}>Search</button></div></div>
      {(data?.list || []).length && !form.id ? (
        <ul className="list-group mb-3">{(data.list).map((c) => (
          <li key={c.id} className="list-group-item d-flex justify-content-between"><span>{c.title}</span>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onLoad({ id: c.id })}>Edit</button></li>
        ))}</ul>
      ) : null}
      {form.id ? (
        <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, id: form.id }); }} className="row g-3">
          <div className="col-md-8"><label className="form-label">Title</label><input className="form-control" value={form.title || ''} onChange={(e) => set('title', e.target.value)} /></div>
          <div className="col-12"><label className="form-label">Description</label><textarea className="form-control" rows={4} value={form.description || ''} onChange={(e) => set('description', e.target.value)} /></div>
          <div className="col-12 d-flex gap-2"><button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
            <button type="button" className="btn btn-outline-danger" onClick={() => onSave({ action: 'delete', id: form.id })} disabled={busy}>Delete</button></div>
        </form>
      ) : null}
    </>
  );
}
