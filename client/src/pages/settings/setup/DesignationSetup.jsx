import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';
import SetupAlerts from '../../fees/setup/SetupAlerts';

export default function DesignationSetup({ data, busy, onLoad, onSave }) {
  const [deptRef, setDeptRef] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptOrder, setDeptOrder] = useState('');
  const [rows, setRows] = useState([{ order: 1, name: '' }]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (!data) return;
    setDeptRef(data.deptRef || '');
    setDeptName(data.deptName || '');
    setDeptOrder(data.deptOrder ?? '');
    setRows((data.designations || [{ order: 1, name: '' }]).map((r) => ({ ...r, key: r.id ? `id-${r.id}` : `new-${r.order}` })));
  }, [data]);

  const onDeptChange = async (value) => {
    setDeptRef(value);
    await onLoad({ deptRef: value });
  };

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await onSave({
      deptRef,
      deptName,
      deptOrder,
      designations: rows.map(({ id, order, name }) => ({ id, order, name })),
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await onSave({ action: 'delete', id: deleteId, deptRef });
    setDeleteId(null);
  };

  return (
    <>
      <SetupAlerts notice={null} error={null} busy={busy} />
      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label">Department</label>
          <select className="form-select" value={deptRef} onChange={(e) => onDeptChange(e.target.value)}>
            <option value="">--Select One--</option>
            {(data?.departments || []).map((d) => (
              <option key={d.id} value={String(d.id)}>{d.name}</option>
            ))}
            <option value="add_new">Add New</option>
          </select>
        </div>
        {data?.showGrid ? (
          <>
            <div className="col-md-4">
              <label className="form-label">Dept. Name</label>
              <input className="form-control" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label">Dept. Order</label>
              <input className="form-control" value={deptOrder} onChange={(e) => setDeptOrder(e.target.value)} />
            </div>
          </>
        ) : null}
      </div>

      {data?.showGrid ? (
        <form onSubmit={handleSave}>
          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-secondary">
                <tr><th>Order</th><th>Designation</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.key || index}>
                    <td><input className="form-control" value={row.order} onChange={(e) => updateRow(index, { order: e.target.value })} /></td>
                    <td><input className="form-control" value={row.name} onChange={(e) => updateRow(index, { name: e.target.value })} /></td>
                    <td>{row.id ? <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteId(row.id)}>Delete</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-between">
            <button type="button" className="btn btn-sm btn-info" onClick={() => setRows((prev) => [...prev, { key: `new-${Date.now()}`, order: prev.length + 1, name: '' }])}>+</button>
            <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
          </div>
        </form>
      ) : null}

      <ConfirmModal show={Boolean(deleteId)} message="Are you sure to delete..." onClose={() => setDeleteId(null)} onConfirm={handleDelete} busy={busy} />
    </>
  );
}
