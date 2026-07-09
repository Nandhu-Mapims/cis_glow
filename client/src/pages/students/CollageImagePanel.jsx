import { useState } from 'react';

export default function CollageImagePanel({ data, busy, onSave, onReload }) {
  const images = data?.images || [];
  const [albumTitle, setAlbumTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [pendingFiles, setPendingFiles] = useState([]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUploadChange = async (e) => {
    const files = [...e.target.files];
    const encoded = await Promise.all(files.map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, data: reader.result, title: albumTitle });
      reader.readAsDataURL(file);
    })));
    setPendingFiles(encoded);
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    const titles = images.map((img, i) => ({
      id: img.id,
      title: document.getElementById(`collage-title-${i}`)?.value || img.title,
    }));
    onSave({
      titles,
      files: pendingFiles,
      deleteIds: [],
      photo_title: albumTitle,
    }).then(() => {
      setPendingFiles([]);
      setAlbumTitle('');
      e.target.reset?.();
    });
  };

  const handleDelete = () => {
    if (!selectedIds.size) return;
    onSave({
      titles: [],
      files: [],
      deleteIds: [...selectedIds],
    }).then(() => {
      setSelectedIds(new Set());
      onReload?.();
    });
  };

  return (
    <div className="card cis-student-screen-card">
      <div className="card-body">
        <form onSubmit={handleUpdate}>
          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <label className="form-label">Album title</label>
              <input
                className="form-control"
                value={albumTitle}
                onChange={(e) => setAlbumTitle(e.target.value)}
                placeholder="Title for new uploads"
                maxLength={255}
              />
            </div>
            <div className="col-md-5">
              <label className="form-label">Images</label>
              <input
                type="file"
                className="form-control"
                accept=".png,.jpg,.jpeg,.gif"
                multiple
                onChange={handleUploadChange}
              />
              <div className="form-text">Supported: jpg, gif, png.</div>
            </div>
          </div>

          <div className="cis-collage-template-grid mb-4">
            {images.map((img, i) => (
              <div key={img.id} className="cis-collage-template-card">
                <label className="cis-collage-template-select">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(img.id)}
                    onChange={() => toggleSelected(img.id)}
                  />
                  <span>{i + 1}</span>
                </label>
                <div className="cis-collage-template-preview">
                  {img.url ? (
                    <img src={img.url} alt={img.title || 'Template'} />
                  ) : (
                    <span className="text-muted small">No preview</span>
                  )}
                </div>
                <input
                  id={`collage-title-${i}`}
                  className="form-control form-control-sm"
                  defaultValue={img.title}
                  placeholder="Title"
                />
              </div>
            ))}
          </div>

          <div className="d-flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary" disabled={busy}>Update</button>
            <button
              type="button"
              className="btn btn-outline-danger"
              disabled={busy || selectedIds.size === 0}
              onClick={handleDelete}
            >
              Delete Selected
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
