import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';
import SetupAlerts from '../../fees/setup/SetupAlerts';

function emptyRow(order = 1) {
  return { key: `new-${Date.now()}`, order, name: '', shortName: '', subCategory: '' };
}

export default function StaffMasterSetup({ data, busy, onLoad, onSave }) {
  const [category, setCategory] = useState('');
  const [rows, setRows] = useState([emptyRow(1)]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (data?.category) setCategory(data.category);
    if (data?.rows) {
      setRows(data.rows.length
        ? data.rows.map((r) => ({ ...r, key: r.id ? `id-${r.id}` : `new-${r.order}` }))
        : [emptyRow(1)]);
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
      rows: rows.map(({ id, order, name, shortName, subCategory }) => ({
        id, order, name, shortName, subCategory,
      })),
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await onSave({ action: 'delete', id: deleteId, category });
    setDeleteId(null);
  };

  const groups = ['Staff', 'Other'];

  return (
    <>
      <SetupAlerts notice={null} error={null} busy={busy} />
      <div className="mb-3 row g-2 align-items-center">
        <label className="col-sm-2 col-form-label">Category</label>
        <div className="col-sm-4">
          <select className="form-select" value={category} onChange={(e) => onCategoryChange(e.target.value)}>
            <option value="">--Select--</option>
            {groups.map((group) => (
              <optgroup key={group} label={group}>
                {(data?.categoryOptions || []).filter((o) => o.group === group).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {category ? (
        <form onSubmit={handleSave}>
          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-secondary">
                <tr><th>Order</th><th>Name</th><th>Short Name</th><th>Sub Name List</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.key}>
                    <td><input className="form-control" value={row.order} onChange={(e) => updateRow(index, { order: e.target.value })} /></td>
                    <td><input className="form-control" value={row.name} onChange={(e) => updateRow(index, { name: e.target.value })} /></td>
                    <td><input className="form-control" value={row.shortName} onChange={(e) => updateRow(index, { shortName: e.target.value })} /></td>
                    <td><input className="form-control" value={row.subCategory} onChange={(e) => updateRow(index, { subCategory: e.target.value })} /></td>
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
