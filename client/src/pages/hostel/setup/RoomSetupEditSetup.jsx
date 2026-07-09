import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';
import { BlockSelect } from './RoomSetupAddSetup';

export default function RoomSetupEditSetup({ data, busy, onLoad, onSave }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (!data) return;
    if (data.mode === 'list') {
      setSearch(data.search || '');
      setPage(data.page || 1);
      setForm(null);
    } else if (data.mode === 'edit' && data.room) {
      setForm({
        ...data.room,
        prevRoomNo: data.room.roomNo,
        listSearch: data.listContext?.search || '',
        listPage: data.listContext?.page || 1,
      });
    }
  }, [data]);

  const loadList = (next = {}) => {
    onLoad({
      search: next.search ?? search,
      page: next.page ?? page,
    });
  };

  const openEdit = (id) => onLoad({ id, search, page });

  const backToList = () => onLoad({ search: form?.listSearch || search, page: form?.listPage || page });

  if (data?.mode === 'edit' && form) {
    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            id: form.id,
            roomNo: form.roomNo,
            prevRoomNo: form.prevRoomNo,
            roomName: form.roomName,
            roomType: form.roomType,
            blockId: form.blockId,
            floorName: form.floorName,
            bedCount: form.bedCount,
            search: form.listSearch,
            page: form.listPage,
          });
        }}
        className="row g-3"
      >
        <div className="col-12 text-end">
          <button type="button" className="btn btn-link p-0" onClick={backToList}>Back</button>
        </div>
        <div className="col-md-6">
          <label className="form-label">Block *</label>
          <BlockSelect groups={data.blockGroups} value={String(form.blockId || '')} onChange={(v) => set('blockId', v)} required />
        </div>
        <div className="col-md-6">
          <label className="form-label">Room Type *</label>
          <select className="form-select" value={form.roomType || ''} onChange={(e) => set('roomType', e.target.value)} required>
            <option value="">--Select--</option>
            {data.roomTypes?.map((type) => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
        </div>
        <div className="col-md-6">
          <label className="form-label">Room No *</label>
          <input className="form-control" value={form.roomNo} onChange={(e) => set('roomNo', e.target.value)} required />
        </div>
        <div className="col-md-6">
          <label className="form-label">Room Name</label>
          <input className="form-control" value={form.roomName} onChange={(e) => set('roomName', e.target.value)} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Floor</label>
          <input className="form-control" value={form.floorName} onChange={(e) => set('floorName', e.target.value)} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Bed</label>
          <input className="form-control" value={form.bedCount} onChange={(e) => set('bedCount', e.target.value)} />
        </div>
        <div className="col-12">
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </div>
      </form>
    );
  }

  return (
    <>
      <div className="row g-2 mb-3">
        <div className="col-md-4">
          <input className="form-control" placeholder="Search room" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="col-md-2">
          <button type="button" className="btn btn-info" onClick={() => loadList({ search, page: 1 })} disabled={busy}>Search</button>
        </div>
        <div className="col-md-6 text-end text-muted small align-self-center">
          {data?.total ? `Showing page ${data.page} of ${data.totalPages} (${data.total} total)` : null}
        </div>
      </div>
      <div className="table-responsive">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Room Id</th>
              <th>Room Name</th>
              <th>Room Type</th>
              <th>Block</th>
              <th>Floor</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.rows?.length ? data.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.roomId}</td>
                <td>{row.roomName}</td>
                <td>{row.roomTypeLabel}</td>
                <td>{row.blockLabel}</td>
                <td>{row.floorName}</td>
                <td className="text-nowrap">
                  <button type="button" className="btn btn-sm btn-primary me-1" onClick={() => openEdit(row.id)}>Edit</button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteId(row.id)}>Delete</button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="text-muted">No data available</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {data?.totalPages > 1 ? (
        <div className="d-flex justify-content-center gap-2">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy || page <= 1} onClick={() => { const p = page - 1; setPage(p); loadList({ page: p }); }}>Previous</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy || page >= data.totalPages} onClick={() => { const p = page + 1; setPage(p); loadList({ page: p }); }}>Next</button>
        </div>
      ) : null}
      <ConfirmModal
        show={Boolean(deleteId)}
        message="Are you sure to delete..."
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          await onSave({ action: 'delete', id: deleteId, search, page });
          setDeleteId(null);
        }}
        busy={busy}
      />
    </>
  );
}
