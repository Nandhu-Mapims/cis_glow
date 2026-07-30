import { useEffect, useState } from 'react';
import HtmlRichTextEditor from '../../../components/HtmlRichTextEditor';

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
          <div className="col-lg-7">
            <HtmlRichTextEditor
              label="Description"
              value={form.description || ''}
              onChange={(html) => set('description', html)}
              minHeight="300px"
            />
          </div>
          <div className="col-lg-5">
            <label className="form-label">Document preview</label>
            <div className="card h-100 border">
              <div className="card-header d-flex align-items-center gap-2"><i className="fa fa-eye text-primary" aria-hidden="true" />HTML preview</div>
              <div
                className="card-body circular-description-html legacy-form-html"
                dangerouslySetInnerHTML={{ __html: form.description || '<p class="text-muted mb-0">Start typing to preview the circular.</p>' }}
              />
            </div>
          </div>
          <div className="col-12 d-flex gap-2"><button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
            <button type="button" className="btn btn-outline-danger" onClick={() => onSave({ action: 'delete', id: form.id })} disabled={busy}>Delete</button></div>
        </form>
      ) : null}
    </>
  );
}
