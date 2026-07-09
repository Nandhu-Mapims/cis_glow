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

export default function WebPhotosAddScreen({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    title: '',
    description: '',
    webView: true,
  });
  const [coverFile, setCoverFile] = useState(null);
  const [photoFiles, setPhotoFiles] = useState([]);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.form) setForm((f) => ({ ...f, ...data.form }));
  }, [data]);

  return (
    <form
      className="cis-setup-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const files = [];
        if (coverFile) files.push(await filePayload(coverFile, 'cover'));
        for (let i = 0; i < photoFiles.length; i++) {
          if (photoFiles[i]) files.push(await filePayload(photoFiles[i], `photo_${i}`));
        }
        await onSave({
          ...form,
          photos: photoFiles.map((_, i) => ({ title: form.title, order: i + 1 })),
        }, files);
        setCoverFile(null);
        setPhotoFiles([]);
        setForm({ date: new Date().toISOString().slice(0, 10), title: '', description: '', webView: true });
      }}
    >
      <div className="row g-3" style={{ maxWidth: 720 }}>
        <div className="col-md-4">
          <label className="form-label">Date</label>
          <input type="date" className="form-control" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="col-md-8">
          <label className="form-label">Title</label>
          <input className="form-control" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="col-12">
          <label className="form-label">Description</label>
          <textarea className="form-control" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Cover image</label>
          <input type="file" accept="image/*" className="form-control" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Gallery images (multiple)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            className="form-control"
            onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))}
          />
        </div>
        <div className="col-12">
          <label><input type="checkbox" checked={form.webView} onChange={(e) => setForm({ ...form, webView: e.target.checked })} /> Show on website</label>
        </div>
        <div className="col-12">
          <button type="submit" className="btn btn-danger" disabled={busy}>Save gallery</button>
        </div>
      </div>
    </form>
  );
}
