import { useEffect, useState } from 'react';

export default function AttSetupSetup({ data, busy, onSave }) {
  const [form, setForm] = useState({});
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="row g-3">
      {['outFrom', 'outTo', 'inFrom', 'inTo'].map((f) => (
        <div key={f} className="col-md-3">
          <label className="form-label">{f}</label>
          <input type="time" className="form-control" value={form[f] || ''} onChange={(e) => set(f, e.target.value)} />
        </div>
      ))}
      <div className="col-12">
        <button type="submit" className="btn btn-danger" disabled={busy || !data}>
          {busy && !data ? 'Loading…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
