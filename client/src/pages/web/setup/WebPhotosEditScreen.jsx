import { useEffect, useState } from 'react';

async function filePayload(file, field) {
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return { field, name: file.name, data };
}

export default function WebPhotosEditScreen({ data, busy, onLoad, onSave }) {
  const [galleryId, setGalleryId] = useState('');
  const [form, setForm] = useState({ date: '', title: '', description: '', webView: true });
  const [photos, setPhotos] = useState([]);
  const [coverFile, setCoverFile] = useState(null);
  const [listFilter, setListFilter] = useState('');

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.galleryId) setGalleryId(String(data.galleryId));
    if (data?.detail) {
      const d = data.detail;
      setForm({ date: d.date, title: d.title, description: d.description, webView: d.webView });
      setPhotos(d.photos || []);
    }
  }, [data]);

  const pickGallery = async (id) => {
    setGalleryId(id);
    await onLoad({ galleryId: id });
  };

  return (
    <div className="row g-3">
      <div className="col-md-3">
        <input
          type="search"
          className="form-control form-control-sm mb-2"
          placeholder="Search galleries..."
          value={listFilter}
          onChange={(e) => setListFilter(e.target.value)}
        />
        <div className="list-group">
          {(data?.galleries || [])
            .filter((g) => !listFilter.trim() || (g.title || '').toLowerCase().includes(listFilter.trim().toLowerCase()))
            .map((g) => (
              <button
                key={g.id}
                type="button"
                className={`list-group-item list-group-item-action ${String(g.id) === galleryId ? 'active' : ''}`}
                onClick={() => pickGallery(String(g.id))}
              >
                {g.title || `Gallery ${g.id}`}
              </button>
            ))}
        </div>
      </div>
      <div className="col-md-9">
        {galleryId && (
          <form
            className="cis-setup-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const files = [];
              if (coverFile) files.push(await filePayload(coverFile, 'cover'));
              await onSave({ galleryId, ...form, photos }, files);
            }}
          >
            <div className="row g-2">
              <div className="col-md-4">
                <label className="form-label">Date</label>
                <input type="date" className="form-control" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="col-md-8">
                <label className="form-label">Title</label>
                <input className="form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="col-12">
                <label className="form-label">Description</label>
                <textarea className="form-control" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Replace cover</label>
                <input type="file" accept="image/*" className="form-control" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
              </div>
              <div className="col-12">
                <label><input type="checkbox" checked={form.webView} onChange={(e) => setForm({ ...form, webView: e.target.checked })} /> Show on website</label>
              </div>
              {photos.length > 0 && (
                <div className="col-12">
                  <h6>Photos</h6>
                  <ul className="list-group">
                    {photos.map((p) => (
                      <li key={p.id} className="list-group-item d-flex justify-content-between align-items-center">
                        <span>{p.title || p.attachment}</span>
                        {p.url && <a href={p.url} target="_blank" rel="noreferrer">View</a>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <button type="submit" className="btn btn-danger mt-3" disabled={busy}>Update gallery</button>
          </form>
        )}
      </div>
    </div>
  );
}
