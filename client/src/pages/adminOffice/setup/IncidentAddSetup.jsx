import { useEffect, useState } from 'react';

function IncidentFields({ form, setForm, departmentOptions, busy }) {
  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <div className="row g-3">
      <div className="col-md-4">
        <label className="form-label">Date &amp; Time</label>
        <input type="datetime-local" className="form-control" value={form.incidentDate || ''} disabled={busy} onChange={(e) => update('incidentDate', e.target.value)} />
      </div>
      <div className="col-md-4">
        <label className="form-label">Department</label>
        <select className="form-select" value={form.category || ''} disabled={busy} onChange={(e) => update('category', e.target.value)}>
          <option value="">--Select--</option>
          {departmentOptions?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="col-md-4">
        <label className="form-label">Title</label>
        <input className="form-control" value={form.title || ''} disabled={busy} onChange={(e) => update('title', e.target.value)} />
      </div>
      <div className="col-md-6">
        <label className="form-label">Location</label>
        <input className="form-control" value={form.location || ''} disabled={busy} onChange={(e) => update('location', e.target.value)} />
      </div>
      <div className="col-md-6">
        <label className="form-label">First Aid By</label>
        <input className="form-control" value={form.firstAidBy || ''} disabled={busy} onChange={(e) => update('firstAidBy', e.target.value)} />
      </div>
      <div className="col-12">
        <label className="form-label">Details</label>
        <textarea className="form-control" rows={4} value={form.details || ''} disabled={busy} onChange={(e) => update('details', e.target.value)} />
      </div>
    </div>
  );
}

export default function IncidentAddSetup({ data, busy, onSave }) {
  const [form, setForm] = useState(data?.form || {});
  useEffect(() => { if (data?.form) setForm(data.form); }, [data?.form]);
  if (!data) return null;
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <IncidentFields form={form} setForm={setForm} departmentOptions={data.departmentOptions} busy={busy} />
      <div className="mt-3"><button type="submit" className="btn btn-primary" disabled={busy}>Submit</button></div>
    </form>
  );
}

export { IncidentFields };
