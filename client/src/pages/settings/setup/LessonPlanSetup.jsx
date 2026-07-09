import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';
import SetupAlerts from '../../fees/setup/SetupAlerts';

function emptyRow(order = 1) {
  return { key: `new-${Date.now()}`, order, name: '', enableTopic: false };
}

export default function LessonPlanSetup({ data, busy, onLoad, onSave }) {
  const [category, setCategory] = useState('');
  const [rows, setRows] = useState([emptyRow(1)]);
  const [limitValue, setLimitValue] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (data?.category) setCategory(data.category);
    if (data?.mode === 'grid' && data?.rows) {
      setRows(data.rows.length
        ? data.rows.map((r) => ({ ...r, key: r.id ? `id-${r.id}` : `new-${r.order}` }))
        : [emptyRow(1)]);
    }
    if (data?.mode === 'limit') setLimitValue(data.limitValue || '');
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
    if (data?.mode === 'limit') {
      await onSave({ category, limitValue, limitId: data.limitId });
      return;
    }
    await onSave({
      action: 'update',
      category,
      rows: rows.map(({ id, order, name, enableTopic }) => ({ id, order, name, enableTopic })),
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
            <option value="Type">Type</option>
            <option value="Limit">Limit</option>
          </select>
        </div>
      </div>

      {category && data?.mode === 'limit' ? (
        <form onSubmit={handleSave}>
          <div className="mb-3">
            <label className="form-label">Edit limit (in days)</label>
            <input className="form-control w-auto" value={limitValue} onChange={(e) => setLimitValue(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </form>
      ) : null}

      {category && data?.mode === 'grid' ? (
        <form onSubmit={handleSave}>
          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-secondary">
                <tr><th>Order</th><th>Name</th><th>Enable Topic</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.key}>
                    <td><input className="form-control" value={row.order} onChange={(e) => updateRow(index, { order: e.target.value })} /></td>
                    <td><input className="form-control" value={row.name} onChange={(e) => updateRow(index, { name: e.target.value })} /></td>
                    <td><input type="checkbox" checked={row.enableTopic} onChange={(e) => updateRow(index, { enableTopic: e.target.checked })} /></td>
                    <td>{row.id ? <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteId(row.id)}>Delete</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-between">
            <button type="button" className="btn btn-sm btn-info" onClick={() => setRows((prev) => [...prev, emptyRow(prev.length + 1)])}>+</button>
            <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
          </div>
        </form>
      ) : null}

      <ConfirmModal show={Boolean(deleteId)} message="Are you sure to delete..." onClose={() => setDeleteId(null)} onConfirm={handleDelete} busy={busy} />
    </>
  );
}
