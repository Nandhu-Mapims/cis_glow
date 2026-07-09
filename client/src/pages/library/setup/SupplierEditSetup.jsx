import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';

export default function SupplierEditSetup({ data, busy, onLoad, onSave }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (!data) return;
    if (data.mode === 'list') { setSearch(data.search || ''); setPage(data.page || 1); setForm(null); }
    else if (data.mode === 'edit' && data.supplier) setForm({ ...data.supplier, listSearch: data.listContext?.search || '', listPage: data.listContext?.page || 1 });
  }, [data]);

  if (data?.mode === 'edit' && form) {
    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
    return (
      <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, id: form.id, search: form.listSearch, page: form.listPage }); }} className="row g-3">
        <div className="col-12 text-end"><button type="button" className="btn btn-link p-0" onClick={() => onLoad({ search: form.listSearch, page: form.listPage })}>Back</button></div>
        {['supplierName', 'contactName', 'contactNo', 'address'].map((key) => (
          <div key={key} className="col-md-6"><label className="form-label">{key}</label><input className="form-control" value={form[key] || ''} onChange={(e) => set(key, e.target.value)} /></div>
        ))}
        <div className="col-12"><button type="submit" className="btn btn-danger" disabled={busy}>Save</button></div>
      </form>
    );
  }

  return (
    <>
      <div className="row g-2 mb-3">
        <div className="col-md-4"><input className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search supplier" /></div>
        <div className="col-md-2"><button type="button" className="btn btn-info" onClick={() => onLoad({ search, page: 1 })} disabled={busy}>Search</button></div>
      </div>
      <div className="table-responsive">
        <table className="table table-hover">
          <thead><tr><th>Supplier</th><th>Contact</th><th>Phone</th><th /></tr></thead>
          <tbody>
            {data?.rows?.map((row) => (
              <tr key={row.id}>
                <td>{row.supplierName}</td><td>{row.contactName}</td><td>{row.contactNo}</td>
                <td>
                  <button type="button" className="btn btn-sm btn-primary me-1" onClick={() => onLoad({ id: row.id, search, page })}>Edit</button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteId(row.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmModal show={Boolean(deleteId)} message="Are you sure to delete..." onClose={() => setDeleteId(null)} onConfirm={async () => { await onSave({ action: 'delete', id: deleteId, search, page }); setDeleteId(null); }} busy={busy} />
    </>
  );
}
