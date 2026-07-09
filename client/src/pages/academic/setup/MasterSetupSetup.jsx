import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useAcademicSetupApi } from './useAcademicSetupApi';

function emptyRow(order = 1) {
  return {
    key: `new-${Date.now()}-${Math.random()}`,
    order,
    name: '',
    shortName: '',
    subCategory: '',
    ug: false,
    pg: false,
  };
}

function hydrateRows(rows) {
  if (!rows?.length) return [emptyRow(1)];
  return rows.map((row) => ({
    ...row,
    key: row.id ? `id-${row.id}` : `new-${row.order}`,
  }));
}

export default function MasterSetupSetup() {
  const { data, busy, error, notice, load, save } = useAcademicSetupApi('master-setup');
  const [category, setCategory] = useState('');
  const [rows, setRows] = useState([emptyRow(1)]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.category) setCategory(data.category);
    if (data?.rows) setRows(hydrateRows(data.rows));
  }, [data]);

  const onCategoryChange = async (value) => {
    setCategory(value);
    await load({ category: value });
  };

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await save({
      action: 'update',
      category,
      rows: rows.map(({ id, order, name, shortName, subCategory, ug, pg }) => ({
        id, order, name, shortName, subCategory, ug, pg,
      })),
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await save({ action: 'delete', id: deleteId, category });
    setDeleteId(null);
  };

  const showDegree = data?.showDegree || category === 'Attachment';
  const groups = ['Student', 'Other'];

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} />
      <div className="mb-3 row g-2 align-items-center">
        <label className="col-sm-2 col-form-label">Category</label>
        <div className="col-sm-4">
          <select className="form-select" value={category} onChange={(e) => onCategoryChange(e.target.value)}>
            <option value="">--Select--</option>
            {groups.map((group) => (
              <optgroup key={group} label={group}>
                {(data?.categoryOptions || [])
                  .filter((opt) => opt.group === group)
                  .map((opt) => (
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
                <tr>
                  <th>Order</th>
                  {showDegree ? <th>Degree</th> : null}
                  <th>Name</th>
                  <th>Short Name</th>
                  <th>Sub Name List</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.key}>
                    <td><input className="form-control" value={row.order} onChange={(e) => updateRow(index, { order: e.target.value })} /></td>
                    {showDegree ? (
                      <td>
                        <label className="d-block"><input type="checkbox" checked={row.ug} onChange={(e) => updateRow(index, { ug: e.target.checked })} /> U.G</label>
                        <label className="d-block"><input type="checkbox" checked={row.pg} onChange={(e) => updateRow(index, { pg: e.target.checked })} /> P.G</label>
                      </td>
                    ) : null}
                    <td><input className="form-control" value={row.name} onChange={(e) => updateRow(index, { name: e.target.value })} /></td>
                    <td><input className="form-control" value={row.shortName} onChange={(e) => updateRow(index, { shortName: e.target.value })} /></td>
                    <td><input className="form-control" value={row.subCategory} onChange={(e) => updateRow(index, { subCategory: e.target.value })} /></td>
                    <td>
                      {row.id ? (
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteId(row.id)}>Delete</button>
                      ) : null}
                    </td>
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
