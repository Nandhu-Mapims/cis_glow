import { useEffect, useState } from 'react';
import SetupAlerts from '../../fees/setup/SetupAlerts';

export default function DOrderSetup({ data, busy, onLoad, onSave }) {
  const [rows, setRows] = useState([]);

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (data?.rows) {
      setRows(data.rows.map((r, i) => ({ ...r, key: r.id ? `id-${r.id}` : `row-${i}` })));
    }
  }, [data]);

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await onSave({ rows: rows.map(({ id, name, order }) => ({ id, name, order })) });
  };

  return (
    <>
      <SetupAlerts notice={null} error={null} busy={busy} />
      <form onSubmit={handleSave}>
        <div className="table-responsive">
          <table className="table table-bordered align-middle">
            <thead className="table-secondary">
              <tr><th>Designation</th><th>Order</th></tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.key}>
                  <td>{row.name}</td>
                  <td><input className="form-control" value={row.order} onChange={(e) => updateRow(index, { order: e.target.value })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-end">
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </div>
      </form>
    </>
  );
}
