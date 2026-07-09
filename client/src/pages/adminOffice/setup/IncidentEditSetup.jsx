import { useEffect, useState } from 'react';
import { IncidentFields } from './IncidentAddSetup';

export default function IncidentEditSetup({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState(data?.incident || {});
  useEffect(() => { setForm(data?.incident || {}); }, [data?.incident]);
  if (!data) return null;

  if (!data.incident) {
    return (
      <div>
        <form className="row g-2 mb-3" onSubmit={(e) => { e.preventDefault(); onLoad({ search: e.currentTarget.search.value }); }}>
          <div className="col-md-8"><input name="search" className="form-control" placeholder="Search title" defaultValue={data.search || ''} /></div>
          <div className="col-md-4"><button type="submit" className="btn btn-outline-primary" disabled={busy}>Search</button></div>
        </form>
        <table className="table table-sm table-hover">
          <thead><tr><th>Date</th><th>Title</th><th>Dept</th><th /></tr></thead>
          <tbody>
            {data.list?.map((row) => (
              <tr key={row.id}>
                <td>{row.date}</td><td>{row.title}</td><td>{row.department}</td>
                <td><button type="button" className="btn btn-link btn-sm p-0" onClick={() => onLoad({ id: row.id })}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, id: data.incident.id }); }}>
      <button type="button" className="btn btn-link btn-sm p-0 mb-2" onClick={() => onLoad({})}>← Back to list</button>
      <IncidentFields form={form} setForm={setForm} departmentOptions={data.departmentOptions} busy={busy} />
      <div className="mt-3 d-flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>Update</button>
        <button type="button" className="btn btn-outline-danger" disabled={busy} onClick={() => onSave({ action: 'delete', id: data.incident.id })}>Delete</button>
      </div>
    </form>
  );
}
