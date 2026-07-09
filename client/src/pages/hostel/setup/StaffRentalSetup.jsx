import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';

export default function StaffRentalSetup({ data, busy, onLoad, onSave }) {
  const [searchBy, setSearchBy] = useState('name');
  const [searchInput, setSearchInput] = useState('');
  const [stays, setStays] = useState([]);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (!data) return;
    if (data.searchBy) setSearchBy(data.searchBy);
    if (data.searchInput !== undefined) setSearchInput(data.searchInput);
    if (data.stays) setStays(data.stays);
  }, [data]);

  const runSearch = () => onLoad({ searchBy, searchInput, staffId: '' });
  const selectStaff = (staffId) => onLoad({ searchBy, searchInput, staffId });

  const roomsForBlock = (blockPk) => (data?.rooms || []).filter((room) => String(room.blockId) === String(blockPk));

  return (
    <div className="row g-3">
      <div className="col-md-4">
        <div className="card">
          <div className="card-header">Filter</div>
          <div className="card-body">
            <div className="mb-2">
              <label className="form-label">Search By</label>
              <div className="d-flex flex-wrap gap-2">
                {[
                  { value: 'name', label: 'Name' },
                  { value: 'staff_id', label: 'Staff ID' },
                  { value: 'category', label: 'Category' },
                ].map((opt) => (
                  <label key={opt.value} className="me-2">
                    <input type="radio" name="searchBy" checked={searchBy === opt.value} onChange={() => setSearchBy(opt.value)} /> {opt.label}
                  </label>
                ))}
              </div>
            </div>
            {searchBy === 'category' ? (
              <select className="form-select mb-2" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}>
                <option value="">--Select--</option>
                {data?.categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            ) : (
              <input className="form-control mb-2" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            )}
            <button type="button" className="btn btn-info btn-sm" onClick={runSearch} disabled={busy}>Go</button>
            <div className="mt-3 d-grid gap-1">
              {data?.staffList?.map((staff) => (
                <button
                  key={staff.id}
                  type="button"
                  className={`btn btn-sm text-start ${data?.staff?.id === staff.id ? 'btn-success' : staff.hasHostel ? 'btn-outline-danger' : 'btn-outline-secondary'}`}
                  onClick={() => selectStaff(String(staff.id))}
                >
                  {staff.staffId} - {staff.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="col-md-8">
        {data?.staff ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSave({
                staffId: String(data.staff.id),
                searchBy,
                searchInput,
                stays,
              });
            }}
          >
            <div className="mb-3">
              <h5 className="mb-1">{data.staff.name}</h5>
              <p className="text-muted mb-0">Staff ID: {data.staff.staffId}</p>
            </div>
            {stays.map((stay, index) => (
              <div key={stay.id || index} className="border rounded p-3 mb-3">
                <div className="row g-2">
                  <div className="col-md-3">
                    <label className="form-label">Type</label>
                    <select
                      className="form-select"
                      value={stay.stayType || 'Hostel'}
                      onChange={(e) => setStays((prev) => prev.map((row, i) => (i === index ? { ...row, stayType: e.target.value } : row)))}
                    >
                      <option value="Hostel">Hostel</option>
                      <option value="Quarters">Quarters</option>
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Block</label>
                    <select
                      className="form-select"
                      value={stay.blockNo || ''}
                      onChange={(e) => setStays((prev) => prev.map((row, i) => (i === index ? { ...row, blockNo: e.target.value, roomNo: '' } : row)))}
                    >
                      <option value="">--Select--</option>
                      {data.blockGroups?.flatMap((group) => group.blocks.map((block) => (
                        <option key={block.id} value={block.id}>{block.label}</option>
                      )))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Room</label>
                    <select
                      className="form-select"
                      value={stay.roomNo || ''}
                      onChange={(e) => setStays((prev) => prev.map((row, i) => (i === index ? { ...row, roomNo: e.target.value } : row)))}
                    >
                      <option value="">--Select--</option>
                      {roomsForBlock(stay.blockNo).map((room) => (
                        <option key={room.id} value={room.id}>
                          {[room.roomId, room.name].filter(Boolean).join(' : ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Rental Fee</label>
                    <div className="form-check mt-2">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={Boolean(stay.rentalFee)}
                        onChange={(e) => setStays((prev) => prev.map((row, i) => (i === index ? { ...row, rentalFee: e.target.checked } : row)))}
                      />
                      <label className="form-check-label">Yes</label>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">From</label>
                    <input
                      type="date"
                      className="form-control"
                      value={stay.fromMonth || ''}
                      onChange={(e) => setStays((prev) => prev.map((row, i) => (i === index ? { ...row, fromMonth: e.target.value } : row)))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">To</label>
                    <input
                      type="date"
                      className="form-control"
                      value={stay.toMonth || ''}
                      onChange={(e) => setStays((prev) => prev.map((row, i) => (i === index ? { ...row, toMonth: e.target.value } : row)))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Discontinue</label>
                    <div className="form-check mt-2">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={Boolean(stay.hostelDiscontinue)}
                        onChange={(e) => setStays((prev) => prev.map((row, i) => (i === index ? { ...row, hostelDiscontinue: e.target.checked } : row)))}
                      />
                    </div>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Reason</label>
                    <input
                      className="form-control"
                      value={stay.discontinueReason || stay.joinReason || ''}
                      onChange={(e) => setStays((prev) => prev.map((row, i) => (i === index ? { ...row, discontinueReason: e.target.value } : row)))}
                    />
                  </div>
                  {stay.id ? (
                    <div className="col-12 text-end">
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteId(stay.id)}>Delete row</button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            <div className="d-flex justify-content-between">
              <button
                type="button"
                className="btn btn-sm btn-info"
                onClick={() => setStays((prev) => [...prev, { stayType: 'Hostel', rentalFee: false, hostelDiscontinue: false }])}
              >
                +
              </button>
              <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
            </div>
          </form>
        ) : (
          <p className="text-muted">Select a staff member from the list.</p>
        )}
      </div>
      <ConfirmModal
        show={Boolean(deleteId)}
        message="Are you sure to delete..."
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          await onSave({
            action: 'delete',
            id: deleteId,
            staffId: String(data.staff.id),
            searchBy,
            searchInput,
          });
          setDeleteId(null);
        }}
        busy={busy}
      />
    </div>
  );
}
