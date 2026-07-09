import { useEffect, useState } from 'react';
import SetupAlerts from '../../fees/setup/SetupAlerts';

export default function ApprovalSetup({ data, busy, onLoad, onSave }) {
  const [items, setItems] = useState([]);

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (data?.items) setItems(data.items);
  }, [data]);

  const toggle = (id) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item)));
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
              <tr><th>Type</th><th>Enable</th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.pageType}</td>
                  <td>
                    <label className="mb-0">
                      <input type="checkbox" checked={item.enabled} onChange={() => toggle(item.id)} />
                      {' '}Enable approval option
                    </label>
                  </td>
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
