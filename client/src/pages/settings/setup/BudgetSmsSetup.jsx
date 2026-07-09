import { useEffect, useState } from 'react';
import SetupAlerts from '../../fees/setup/SetupAlerts';

export default function BudgetSmsSetup({ data, busy, onLoad, onSave }) {
  const [items, setItems] = useState([]);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.items) setItems(data.items); }, [data]);

  const updateItem = (id, patch) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await onSave({ items });
  };

  return (
    <>
      <SetupAlerts notice={null} error={null} busy={busy} />
      <form onSubmit={handleSave}>
        <div className="table-responsive">
          <table className="table table-bordered align-middle">
            <thead className="table-secondary">
              <tr><th>Title</th><th>Enable</th><th>Mobile</th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>
                    <input type="checkbox" checked={item.enabled} onChange={(e) => updateItem(item.id, { enabled: e.target.checked })} />
                  </td>
                  <td>
                    <input className="form-control" value={item.mobile || ''} onChange={(e) => updateItem(item.id, { mobile: e.target.value })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-end"><button type="submit" className="btn btn-danger" disabled={busy}>Save</button></div>
      </form>
    </>
  );
}
