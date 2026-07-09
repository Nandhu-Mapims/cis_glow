import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';
import SetupAlerts from '../../fees/setup/SetupAlerts';

function emptyRow() {
  return { key: `new-${Date.now()}`, refName: '', designation: '', order: 1, enabled: true, existingFile: '' };
}

export default function SignatureSetup({ data, busy, onLoad, onSave }) {
  const [category, setCategory] = useState('');
  const [rows, setRows] = useState([emptyRow()]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (data?.category) setCategory(data.category);
    if (data?.rows) {
      setRows(data.rows.length
        ? data.rows.map((r) => ({ ...r, key: r.id ? `id-${r.id}` : `new-${r.refName}` }))
        : [emptyRow()]);
    }
  }, [data]);

  const onCategoryChange = async (value) => {
    setCategory(value);
    await onLoad({ category: value });
  };

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await onSave({
      action: 'update',
      category,
      rows: rows.map(({ id, refName, designation, enabled, existingFile }) => ({
        id, refName, designation, enabled, existingFile,
      })),
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await onSave({ action: 'delete', id: deleteId, category });
    setDeleteId(null);
  };

  return (
    <>
      <SetupAlerts notice={null} error={null} busy={busy} />
      <div className="mb-3 row g-2 align-items-center">
        <label className="col-sm-2 col-form-label">Category</label>
        <div className="col-sm-3">
          <select className="form-select" value={category} onChange={(e) => onCategoryChange(e.target.value)}>
            <option value="">--Select--</option>
            {(data?.categoryOptions || []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {category ? (
        <form onSubmit={handleSave}>
          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-secondary">
                <tr><th>Enable</th><th>Ref ID</th><th>Designation</th><th>Existing file</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.key}>
                    <td><input type="checkbox" checked={row.enabled} onChange={(e) => updateRow(index, { enabled: e.target.checked })} /></td>
                    <td><input className="form-control" value={row.refName} onChange={(e) => updateRow(index, { refName: e.target.value })} /></td>
                    <td><input className="form-control" value={row.designation} onChange={(e) => updateRow(index, { designation: e.target.value })} /></td>
                    <td className="text-muted small">{row.existingFile || '—'}</td>
                    <td>{row.id ? <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteId(row.id)}>Delete</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-between">
            <button type="button" className="btn btn-sm btn-info" onClick={() => setRows((prev) => [...prev, emptyRow()])}>+</button>
            <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
          </div>
        </form>
      ) : null}

      <ConfirmModal show={Boolean(deleteId)} message="Are you sure to delete..." onClose={() => setDeleteId(null)} onConfirm={handleDelete} busy={busy} />
    </>
  );
}
