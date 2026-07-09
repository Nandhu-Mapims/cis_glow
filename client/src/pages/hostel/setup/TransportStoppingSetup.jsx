import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';

function emptyRow(order = 1) {
  return { key: `new-${Date.now()}`, order, name: '', km: '' };
}

export default function TransportStoppingSetup({ data, busy, onLoad, onSave }) {
  const [rows, setRows] = useState([emptyRow(1)]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (!data?.rows) return;
    setRows(data.rows.length
      ? data.rows.map((row) => ({ ...row, key: row.id ? `id-${row.id}` : `new-${row.order}` }))
      : [emptyRow(1)]);
  }, [data]);

  const updateRow = (index, patch) => setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ rows: rows.map(({ id, order, name, km }) => ({ id, order, name, km })) }); }}>
        <div className="table-responsive">
          <table className="table table-bordered align-middle">
            <thead className="table-secondary">
              <tr><th>SNo.</th><th>Order</th><th>Stopping Name</th><th>KM</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.key}>
                  <td>{index + 1}</td>
                  <td><input className="form-control" value={row.order} onChange={(e) => updateRow(index, { order: e.target.value })} /></td>
                  <td><input className="form-control" value={row.name} onChange={(e) => updateRow(index, { name: e.target.value })} /></td>
                  <td><input className="form-control" value={row.km} onChange={(e) => updateRow(index, { km: e.target.value })} /></td>
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
      <ConfirmModal show={Boolean(deleteId)} message="Are you sure to delete..." onClose={() => setDeleteId(null)} onConfirm={async () => { await onSave({ action: 'delete', id: deleteId }); setDeleteId(null); }} busy={busy} />
    </>
  );
}
