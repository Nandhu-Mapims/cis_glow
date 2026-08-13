import { useEffect, useState } from 'react';

export default function WebPageScreen({ data, busy, readOnly, onLoad, onSave }) {
  const [pageId, setPageId] = useState('');
  const [form, setForm] = useState({ title: '', order: 1, link: '', content: '', postOn: '', enabled: true });
  const [listFilter, setListFilter] = useState('');

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (!data) return;
    setPageId(data.pageId ? String(data.pageId) : '');
    setForm(data.form || form);
  }, [data]);

  const switchPage = async (id) => {
    if (id === 'new') {
      setPageId('new');
      setForm({ title: '', order: (data?.pages?.length || 0) + 1, link: '', content: '', postOn: '', enabled: true });
      return;
    }
    setPageId(String(id));
    await onLoad({ pageId: id });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    await onSave({ ...form, pageId: pageId && pageId !== 'new' ? pageId : undefined });
  };

  return (
    <div className="row g-3">
      <div className="col-md-3">
        <input
          type="search"
          className="form-control form-control-sm mb-2"
          placeholder="Search pages..."
          value={listFilter}
          onChange={(e) => setListFilter(e.target.value)}
        />
        <div className="list-group">
          <button
            type="button"
            className={`list-group-item list-group-item-action ${pageId === 'new' ? 'active' : ''}`}
            onClick={() => switchPage('new')}
          >
            + Add New Page
          </button>
          {(data?.pages || [])
            .filter((p) => !listFilter.trim() || (p.title || '').toLowerCase().includes(listFilter.trim().toLowerCase()))
            .map((p) => (
              <button key={p.id} type="button" className={`list-group-item list-group-item-action ${String(p.id) === pageId ? 'active' : ''}`} onClick={() => switchPage(p.id)}>
                {p.title || `Page ${p.id}`}
              </button>
            ))}
        </div>
      </div>
      <div className="col-md-9">
        <form onSubmit={handleSubmit}>
          <div className="row g-2">
            <div className="col-md-8"><input className="form-control" placeholder="Page title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} disabled={readOnly} required /></div>
            <div className="col-md-4"><input type="number" className="form-control" placeholder="Order" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} disabled={readOnly} /></div>
            <div className="col-md-6"><input className="form-control" placeholder="Link slug" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} disabled={readOnly} /></div>
            <div className="col-md-6"><input type="date" className="form-control" value={form.postOn || ''} onChange={(e) => setForm({ ...form, postOn: e.target.value })} disabled={readOnly} /></div>
            <div className="col-12"><label className="form-label text-muted small">Page type: {data?.pageType}</label></div>
            <div className="col-12"><textarea className="form-control" rows={12} placeholder="HTML content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} disabled={readOnly} /></div>
            <div className="col-12 d-flex flex-wrap gap-3">
              <label><input className="me-2" type="radio" name="publish" checked={form.enabled} onChange={() => setForm({ ...form, enabled: true })} disabled={readOnly} /> Enable</label>
              <label><input className="me-2" type="radio" name="publish" checked={!form.enabled} onChange={() => setForm({ ...form, enabled: false })} disabled={readOnly} /> Draft</label>
            </div>
          </div>
          {!readOnly && <button type="submit" className="btn btn-primary mt-3" disabled={busy}>Save page</button>}
        </form>
      </div>
    </div>
  );
}
