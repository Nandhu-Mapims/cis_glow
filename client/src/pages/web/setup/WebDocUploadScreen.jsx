import { useEffect, useState } from 'react';

async function filesPayload(fileList) {
  const out = [];
  for (const file of fileList) {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    out.push({ name: file.name, data });
  }
  return out;
}

export default function WebDocUploadScreen({ data, busy, onLoad, onSave }) {
  const [selected, setSelected] = useState([]);
  const [overwrite, setOverwrite] = useState(false);

  useEffect(() => { onLoad(); }, [onLoad]);

  return (
    <div>
      <form
        className="cis-setup-form mb-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const files = await filesPayload(selected);
          await onSave({ overwrite, files });
          setSelected([]);
          await onLoad();
        }}
      >
        <div className="row g-3" style={{ maxWidth: 640 }}>
          <div className="col-12">
            <label className="form-label">PDF documents</label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="form-control"
              onChange={(e) => setSelected(Array.from(e.target.files || []))}
            />
          </div>
          <div className="col-12">
            <label><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} /> Overwrite existing files</label>
          </div>
          <div className="col-12">
            <button type="submit" className="btn btn-danger" disabled={busy || !selected.length}>Upload</button>
          </div>
        </div>
      </form>

      <h6>Documents folder</h6>
      <table className="table table-sm table-bordered">
        <thead>
          <tr><th>File</th><th>Size</th><th>Link</th></tr>
        </thead>
        <tbody>
          {(data?.files || []).map((f) => (
            <tr key={f.name}>
              <td>{f.name}</td>
              <td>{Math.round(f.size / 1024)} KB</td>
              <td><a href={f.url} target="_blank" rel="noreferrer">Open</a></td>
            </tr>
          ))}
          {!data?.files?.length && <tr><td colSpan={3} className="text-muted">No documents yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
