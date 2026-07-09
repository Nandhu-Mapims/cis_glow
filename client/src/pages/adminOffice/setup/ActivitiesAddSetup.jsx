import { useEffect, useState } from 'react';
import api from '../../../api/client';

function ActivityForm({ data, form, setForm, busy, onLookup }) {
  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const idLabel = data.eventFor === 'staff' ? 'Staff ID' : 'Admission No';

  const updateRow = (index, key, value) => {
    setForm((f) => {
      const rows = [...(f.participantRows || [])];
      rows[index] = { ...rows[index], [key]: value };
      return { ...f, participantRows: rows };
    });
  };

  return (
    <div className="row g-3">
      <div className="col-md-6">
        <label className="form-label">Event Name</label>
        <input className="form-control" value={form.eventName || ''} disabled={busy} onChange={(e) => update('eventName', e.target.value)} />
      </div>
      <div className="col-md-3">
        <label className="form-label">Category</label>
        <select className="form-select" value={form.eventCategory || ''} disabled={busy} onChange={(e) => update('eventCategory', e.target.value)}>
          {data.categoryOptions?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="col-md-3">
        <label className="form-label">Type</label>
        <select className="form-select" value={form.eventType || ''} disabled={busy} onChange={(e) => update('eventType', e.target.value)}>
          {data.eventTypes?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="col-md-4">
        <label className="form-label">Date</label>
        <input type="date" className="form-control" value={form.eventDate || ''} disabled={busy} onChange={(e) => update('eventDate', e.target.value)} />
      </div>
      <div className="col-md-4">
        <label className="form-label">Venue</label>
        <input className="form-control" value={form.eventVenue || ''} disabled={busy} onChange={(e) => update('eventVenue', e.target.value)} />
      </div>
      <div className="col-md-4">
        <label className="form-label">Content</label>
        <input className="form-control" value={form.eventContent || ''} disabled={busy} onChange={(e) => update('eventContent', e.target.value)} />
      </div>
      <div className="col-md-6">
        <label className="form-label">Participant IDs</label>
        <input className="form-control" value={form.participantsNo || ''} disabled={busy} onChange={(e) => update('participantsNo', e.target.value)} />
      </div>
      <div className="col-md-6">
        <label className="form-label">Participant Names</label>
        <textarea className="form-control" rows={2} value={form.participantsName || ''} disabled={busy} onChange={(e) => update('participantsName', e.target.value)} />
      </div>
      <div className="col-12">
        <h6 className="mb-2">Prize / Participant Rows</h6>
        {(form.participantRows || []).map((row, index) => (
          <div className="row g-2 mb-2" key={row.id || `row-${index}`}>
            <div className="col-md-3">
              <input className="form-control" placeholder="Prize / Type" value={row.prizeName || ''} disabled={busy} onChange={(e) => updateRow(index, 'prizeName', e.target.value)} />
            </div>
            <div className="col-md-3">
              <input className="form-control" placeholder={idLabel} value={row.studentList || ''} disabled={busy} onChange={(e) => updateRow(index, 'studentList', e.target.value)} />
            </div>
            <div className="col-md-4">
              <textarea className="form-control" rows={1} placeholder="Names" value={row.studentNameList || ''} disabled={busy} onChange={(e) => updateRow(index, 'studentNameList', e.target.value)} />
            </div>
            <div className="col-md-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => onLookup(index)}>Lookup</button>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-link btn-sm p-0" disabled={busy} onClick={() => update('participantRows', [...(form.participantRows || []), { prizeName: '', studentList: '', studentNameList: '' }])}>+ Add row</button>
      </div>
    </div>
  );
}

export default function ActivitiesAddSetup({ data, busy, onSave }) {
  const [form, setForm] = useState(data?.form || {});
  useEffect(() => { if (data?.form) setForm(data.form); }, [data?.form]);
  if (!data) return null;

  const lookup = async (index) => {
    const ids = form.participantRows?.[index]?.studentList;
    if (!ids) return;
    const res = await api.post('/api/admin-office/lookup-participants', { eventFor: data.eventFor, ids });
    if (res.data.names) {
      setForm((f) => {
        const rows = [...(f.participantRows || [])];
        rows[index] = { ...rows[index], studentNameList: res.data.names };
        return { ...f, participantRows: rows };
      });
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <ActivityForm data={data} form={form} setForm={setForm} busy={busy} onLookup={lookup} />
      <div className="mt-3"><button type="submit" className="btn btn-primary" disabled={busy}>Submit</button></div>
    </form>
  );
}

export function ActivitiesEditSetup({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState(data?.event || {});
  useEffect(() => { setForm(data?.event || {}); }, [data?.event]);
  if (!data) return null;

  const lookup = async (index) => {
    const ids = form.participantRows?.[index]?.studentList;
    if (!ids) return;
    const res = await api.post('/api/admin-office/lookup-participants', { eventFor: data.eventFor, ids });
    if (res.data.names) {
      setForm((f) => {
        const rows = [...(f.participantRows || [])];
        rows[index] = { ...rows[index], studentNameList: res.data.names };
        return { ...f, participantRows: rows };
      });
    }
  };

  if (!data.event) {
    return (
      <div>
        <form className="row g-2 mb-3" onSubmit={(e) => { e.preventDefault(); onLoad({ search: e.currentTarget.search.value }); }}>
          <div className="col-md-8"><input name="search" className="form-control" placeholder="Search event" defaultValue={data.search || ''} /></div>
          <div className="col-md-4"><button type="submit" className="btn btn-outline-primary" disabled={busy}>Search</button></div>
        </form>
        <table className="table table-sm table-hover">
          <thead><tr><th>Date</th><th>Event</th><th>Category</th><th /></tr></thead>
          <tbody>
            {data.list?.map((row) => (
              <tr key={row.id}>
                <td>{row.date}</td><td>{row.name}</td><td>{row.category}</td>
                <td><button type="button" className="btn btn-link btn-sm p-0" onClick={() => onLoad({ id: row.id })}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, id: data.event.id }); }}>
      <button type="button" className="btn btn-link btn-sm p-0 mb-2" onClick={() => onLoad({})}>← Back to list</button>
      <ActivityForm data={data} form={form} setForm={setForm} busy={busy} onLookup={lookup} />
      <div className="mt-3 d-flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>Update</button>
        <button type="button" className="btn btn-outline-danger" disabled={busy} onClick={() => onSave({ action: 'delete', id: data.event.id })}>Delete</button>
      </div>
    </form>
  );
}
