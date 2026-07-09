import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';
import SetupAlerts from '../../fees/setup/SetupAlerts';

function emptyRow(order = 1) {
  return { key: `new-${Date.now()}`, order, name: '', shortName: '' };
}

export default function StaffEduMasterSetup({ data, busy, onLoad, onSave }) {
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [rows, setRows] = useState([emptyRow(1)]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (data?.category) setCategory(data.category);
    if (data?.subCategory) setSubCategory(data.subCategory);
    if (data?.rows) {
      setRows(data.rows.length
        ? data.rows.map((r) => ({ ...r, key: r.id ? `id-${r.id}` : `new-${r.order}` }))
        : [emptyRow(1)]);
    }
  }, [data]);

  const onCategoryChange = async (value) => {
    setCategory(value);
    await onLoad({ category: value, subCategory });
  };

  const onSubCategoryChange = async (value) => {
    setSubCategory(value);
    await onLoad({ category, subCategory: value });
  };

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await onSave({
      action: 'update',
      category,
      subCategory,
      rows: rows.map(({ id, order, name, shortName }) => ({ id, order, name, shortName })),
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await onSave({ action: 'delete', id: deleteId, category, subCategory });
    setDeleteId(null);
  };

  return (
    <>
      <SetupAlerts notice={null} error={null} busy={busy} />
      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label">Category (Degree)</label>
          <select className="form-select" value={category} onChange={(e) => onCategoryChange(e.target.value)}>
            <option value="">--Select--</option>
            {(data?.degreeOptions || []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Sub Category (Major)</label>
          <select className="form-select" value={subCategory} onChange={(e) => onSubCategoryChange(e.target.value)}>
            <option value="">--Select--</option>
            {(data?.majorOptions || []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {category && subCategory ? (
        <form onSubmit={handleSave}>
          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-secondary">
                <tr><th>Order</th><th>Name</th><th>Short Name</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.key}>
                    <td><input className="form-control" value={row.order} onChange={(e) => updateRow(index, { order: e.target.value })} /></td>
                    <td><input className="form-control" value={row.name} onChange={(e) => updateRow(index, { name: e.target.value })} /></td>
                    <td><input className="form-control" value={row.shortName} onChange={(e) => updateRow(index, { shortName: e.target.value })} /></td>
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
