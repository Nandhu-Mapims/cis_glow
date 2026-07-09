import { useEffect, useState } from 'react';
import CourierFields from './CourierFields';

export default function CourierEditSetup({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState(data?.courier || {});
  useEffect(() => { setForm(data?.courier || {}); }, [data?.courier]);
  if (!data) return null;

  if (!data.courier) {
    return (
      <div>
        <form className="row g-2 mb-3" onSubmit={(e) => { e.preventDefault(); onLoad({ search: e.currentTarget.search.value, page: 1 }); }}>
          <div className="col-md-8">
            <input name="search" className="form-control" placeholder="Search from / to / in-out" defaultValue={data.search || ''} />
          </div>
          <div className="col-md-4">
            <button type="submit" className="btn btn-outline-primary" disabled={busy}>Search</button>
          </div>
        </form>
        <div className="table-responsive">
          <table className="table table-sm table-hover">
            <thead><tr><th>Date</th><th>In/Out</th><th>From</th><th>To</th><th>Type</th><th /></tr></thead>
            <tbody>
              {data.list?.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.inout}</td>
                  <td>{row.fromName}</td>
                  <td>{row.toName}</td>
                  <td>{row.type}</td>
                  <td><button type="button" className="btn btn-link btn-sm p-0" disabled={busy} onClick={() => onLoad({ id: row.id })}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, id: data.courier.id }); }}>
      <div className="mb-2">
        <button type="button" className="btn btn-link btn-sm p-0" disabled={busy} onClick={() => onLoad({})}>← Back to list</button>
      </div>
      <CourierFields form={form} setForm={setForm} departmentOptions={data.departmentOptions} busy={busy} />
      <div className="mt-3 d-flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>Update</button>
        <button type="button" className="btn btn-outline-danger" disabled={busy} onClick={() => onSave({ action: 'delete', id: data.courier.id })}>Delete</button>
      </div>
    </form>
  );
}
