import { useEffect, useState } from 'react';

export default function TransactionSetupSetup({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({});
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data) setForm(data); }, [data]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="table-responsive">
      <table className="table table-bordered">
        <thead className="table-secondary"><tr><th /><th>Book Limit</th><th>Duration (Days)</th></tr></thead>
        <tbody>
          {[
            ['ugLimit', 'ugDuration', 'U.G Student'],
            ['pgLimit', 'pgDuration', 'P.G Student'],
            ['staffLimit', 'staffDuration', 'Staff'],
          ].map(([limitKey, durationKey, label]) => (
            <tr key={label}>
              <td>{label}</td>
              <td><input className="form-control" value={form[limitKey] ?? ''} onChange={(e) => set(limitKey, e.target.value)} /></td>
              <td><input className="form-control" value={form[durationKey] ?? ''} onChange={(e) => set(durationKey, e.target.value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
    </form>
  );
}
