import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';
import { fileToPayload } from './TransportAddSetup';

export default function TransportEditSetup({ data, busy, onLoad, onSave }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (!data) return;
    if (data.mode === 'list') {
      setSearch(data.search || '');
      setPage(data.page || 1);
      setForm(null);
    } else if (data.mode === 'edit' && data.transport) {
      setForm({
        ...data.transport,
        listSearch: data.listContext?.search || '',
        listPage: data.listContext?.page || 1,
      });
    }
  }, [data]);

  const loadList = (next = {}) => onLoad({ search: next.search ?? search, page: next.page ?? page });
  const openEdit = (id) => onLoad({ id, search, page });
  const backToList = () => onLoad({ search: form?.listSearch || search, page: form?.listPage || page });

  const toggleStop = (id) => {
    const sid = String(id);
    setForm((prev) => ({
      ...prev,
      stopIds: prev.stopIds.includes(sid)
        ? prev.stopIds.filter((s) => s !== sid)
        : [...prev.stopIds, sid],
    }));
  };

  if (data?.mode === 'edit' && form) {
    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const files = photo ? [await fileToPayload(photo)] : [];
          await onSave({
            id: form.id,
            vehicleId: form.vehicleId,
            vehicleType: form.vehicleType,
            regNumber: form.regNumber,
            capacity: form.capacity,
            contact: form.contact,
            route: form.route,
            tripCount: form.tripCount,
            stopIds: form.stopIds,
            existingImage: form.image,
            search: form.listSearch,
            page: form.listPage,
          }, files);
          setPhoto(null);
        }}
        className="row g-3"
      >
        <div className="col-12 text-end"><button type="button" className="btn btn-link p-0" onClick={backToList}>Back</button></div>
        {form.imageUrl ? <div className="col-12"><img src={form.imageUrl} alt="" style={{ maxHeight: 120 }} /></div> : null}
        <div className="col-md-4"><label className="form-label">Vehicle Id *</label><input className="form-control" value={form.vehicleId} onChange={(e) => set('vehicleId', e.target.value)} required /></div>
        <div className="col-md-4"><label className="form-label">Vehicle No *</label><input className="form-control" value={form.regNumber} onChange={(e) => set('regNumber', e.target.value)} required /></div>
        <div className="col-md-4">
          <label className="form-label">Vehicle Type</label>
          <div className="d-flex gap-3 pt-2">
            {['Bus', 'Van', 'Auto'].map((type) => (
              <label key={type}><input type="radio" checked={form.vehicleType === type} onChange={() => set('vehicleType', type)} /> {type}</label>
            ))}
          </div>
        </div>
        <div className="col-md-4"><label className="form-label">Capacity *</label><input type="number" className="form-control" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} required /></div>
        <div className="col-md-4"><label className="form-label">Photo</label><input type="file" className="form-control" accept="image/png,image/jpeg,image/gif" onChange={(e) => setPhoto(e.target.files?.[0] || null)} /></div>
        <div className="col-md-4">
          <label className="form-label">Trip</label>
          <select className="form-select" value={String(form.tripCount)} onChange={(e) => set('tripCount', e.target.value)}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={String(n)}>{n}</option>)}
          </select>
        </div>
        <div className="col-md-6"><label className="form-label">Route</label><input className="form-control" value={form.route} onChange={(e) => set('route', e.target.value)} /></div>
        <div className="col-md-6"><label className="form-label">Contact</label><input className="form-control" value={form.contact} onChange={(e) => set('contact', e.target.value)} /></div>
        <div className="col-12">
          <label className="form-label">Stops</label>
          <div className="row g-2">
            {data.stops?.map((stop) => (
              <div key={stop.id} className="col-md-4">
                <label><input type="checkbox" checked={form.stopIds.includes(String(stop.id))} onChange={() => toggleStop(stop.id)} /> {stop.name}</label>
              </div>
            ))}
          </div>
        </div>
        <div className="col-12"><button type="submit" className="btn btn-danger" disabled={busy}>Save</button></div>
      </form>
    );
  }

  return (
    <>
      <div className="row g-2 mb-3">
        <div className="col-md-4"><input className="form-control" placeholder="Search vehicle" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="col-md-2"><button type="button" className="btn btn-info" onClick={() => loadList({ search, page: 1 })} disabled={busy}>Search</button></div>
      </div>
      <div className="table-responsive">
        <table className="table table-hover">
          <thead><tr><th>Vehicle Id</th><th>Reg No</th><th>Type</th><th>Capacity</th><th>Route</th><th>Trip</th><th /></tr></thead>
          <tbody>
            {data?.rows?.length ? data.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.vehicleId}</td><td>{row.regNumber}</td><td>{row.vehicleType}</td><td>{row.capacity}</td><td>{row.route}</td><td>{row.tripCount}</td>
                <td className="text-nowrap">
                  <button type="button" className="btn btn-sm btn-primary me-1" onClick={() => openEdit(row.id)}>Edit</button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteId(row.id)}>Delete</button>
                </td>
              </tr>
            )) : <tr><td colSpan={7} className="text-muted">No data available</td></tr>}
          </tbody>
        </table>
      </div>
      {data?.totalPages > 1 ? (
        <div className="d-flex justify-content-center gap-2">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy || page <= 1} onClick={() => { const p = page - 1; setPage(p); loadList({ page: p }); }}>Previous</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy || page >= data.totalPages} onClick={() => { const p = page + 1; setPage(p); loadList({ page: p }); }}>Next</button>
        </div>
      ) : null}
      <ConfirmModal show={Boolean(deleteId)} message="Are you sure to delete..." onClose={() => setDeleteId(null)} onConfirm={async () => { await onSave({ action: 'delete', id: deleteId, search, page }); setDeleteId(null); }} busy={busy} />
    </>
  );
}
