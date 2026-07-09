import { useCallback, useEffect, useState } from 'react';
import api from '../../api/client';

const ALLOWED_TYPES = '.jpg,.jpeg,.png,.gif,.doc,.docx,.pdf';

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function StaffAttachments({ staffRowId }) {
  const [catalog, setCatalog] = useState({ types: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/staff/${staffRowId}/attachments`);
      setCatalog(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attachments');
    } finally {
      setLoading(false);
    }
  }, [staffRowId]);

  useEffect(() => {
    load();
  }, [load]);

  const types = catalog.types || [];

  const updateRow = (index, patch) => {
    setCatalog((prev) => ({
      ...prev,
      types: prev.types.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  };

  const handleFile = async (index, file) => {
    if (!file) return;
    setUploading(index);
    setError(null);
    try {
      const dataBase64 = await readFileAsBase64(file);
      const res = await api.post(`/api/staff/${staffRowId}/attachments/upload`, {
        filename: file.name,
        dataBase64,
      });
      updateRow(index, {
        attachFile: res.data.filename,
        fileUrl: res.data.url,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const clearFile = (index) => {
    updateRow(index, { attachFile: '', fileUrl: null });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.put(`/api/staff/${staffRowId}/attachments`, {
        items: types.map((t) => ({
          attachId: t.attachId,
          recordId: t.recordId,
          attachNo: t.attachNo,
          attachFile: t.attachFile,
        })),
      });
      setCatalog(res.data);
      setMessage('Attachments saved.');
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-muted p-3">Loading attachments...</div>;
  }

  return (
    <div className="card shadow-sm">
      <div className="card-header fw-semibold d-flex justify-content-between align-items-center">
        <span>Attachments</span>
        <button type="button" className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      <div className="card-body">
        {message && <div className="alert alert-success py-2">{message}</div>}
        {error && <div className="alert alert-danger py-2">{error}</div>}
        {catalog.message && <div className="alert alert-warning py-2 mb-0">{catalog.message}</div>}
        <p className="text-muted small mb-0">Supported: jpg, png, gif, doc, docx, pdf</p>

        {types.length === 0 && !catalog.message && (
          <div className="text-muted">No attachment types configured for this staff member.</div>
        )}

        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Document</th>
                <th style={{ width: '20%' }}>Reference No</th>
                <th style={{ width: '25%' }}>File</th>
                <th style={{ width: '15%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {types.map((row, index) => (
                <tr key={row.attachId}>
                  <td>
                    <div className="fw-medium">
                      {row.subCategory} — {row.docCategory}
                      {row.mandatory && <span className="text-danger ms-1">*</span>}
                    </div>
                    <div className="text-muted small">
                      {row.mainCategory} · {row.notes}
                    </div>
                  </td>
                  <td>
                    <input
                      className="form-control form-control-sm"
                      value={row.attachNo || ''}
                      onChange={(e) => updateRow(index, { attachNo: e.target.value })}
                    />
                  </td>
                  <td>
                    {row.fileUrl ? (
                      <a href={row.fileUrl} target="_blank" rel="noreferrer" className="small">
                        {row.attachFile}
                      </a>
                    ) : (
                      <span className="text-muted small">No file</span>
                    )}
                  </td>
                  <td>
                    <input
                      type="file"
                      className="form-control form-control-sm mb-1"
                      accept={ALLOWED_TYPES}
                      disabled={uploading === index}
                      onChange={(e) => handleFile(index, e.target.files?.[0])}
                    />
                    {row.attachFile && (
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => clearFile(index)}>
                        Clear
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
