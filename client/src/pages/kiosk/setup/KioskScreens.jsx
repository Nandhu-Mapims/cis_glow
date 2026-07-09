import { useEffect, useState } from 'react';
import ConfirmModal from '../../fees/setup/ConfirmModal';

export function MachineAccessScreen({ data, busy, onLoad, onSave }) {
  const [staffCategory, setStaffCategory] = useState('');
  const [form, setForm] = useState({ group: '', days: [], fromTime: '08:00', toTime: '18:00' });

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.staffCategory) setStaffCategory(data.staffCategory); }, [data]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ staffCategory, ...form }); }}>
      <div className="mb-2">
        <input className="form-control" list="staff-cats" placeholder="Staff category" value={staffCategory} onChange={(e) => setStaffCategory(e.target.value)} />
        <datalist id="staff-cats">{(data?.staffCategories || []).map((c) => <option key={c} value={c} />)}</datalist>
        <button type="button" className="btn btn-sm btn-outline-info mt-2" onClick={() => onLoad({ staffCategory })}>Load groups</button>
      </div>
      <table className="table table-sm table-bordered">
        <thead><tr><th>Group</th><th>Days</th><th>From</th><th>To</th></tr></thead>
        <tbody>
          {(data?.groups || []).map((g) => <tr key={g.id}><td>{g.group}</td><td>{g.days}</td><td>{String(g.fromTime || '').slice(11, 16)}</td><td>{String(g.toTime || '').slice(11, 16)}</td></tr>)}
        </tbody>
      </table>
      <div className="row g-2">
        <div className="col-md-3"><input className="form-control" placeholder="Group #" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} /></div>
        <div className="col-md-3"><input className="form-control" placeholder="Days (Mon,Tue)" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value.split(',') })} /></div>
        <div className="col-md-3"><input type="time" className="form-control" value={form.fromTime} onChange={(e) => setForm({ ...form, fromTime: e.target.value })} /></div>
        <div className="col-md-3"><input type="time" className="form-control" value={form.toTime} onChange={(e) => setForm({ ...form, toTime: e.target.value })} /></div>
      </div>
      <button type="submit" className="btn btn-primary mt-3" disabled={busy}>Save access</button>
    </form>
  );
}

const EMPTY_ROOM_FORM = {
  roomId: '',
  blockId: '',
  blockName: '',
  name: '',
  machineId: '',
  machineIp: '',
  remarks: '',
};

export function MachineRoomScreen({ data, busy, onLoad, onSave, mode = 'edit' }) {
  const isAddMode = mode === 'add';
  const [form, setForm] = useState(EMPTY_ROOM_FORM);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (isAddMode) {
      if (data?.form && !data?.roomId) {
        setForm(EMPTY_ROOM_FORM);
      }
      return;
    }
    if (data?.form && data?.roomId) {
      setForm({ ...EMPTY_ROOM_FORM, ...data.form });
    }
    if (data?.search !== undefined) setSearch(data.search);
  }, [data, isAddMode]);

  const rooms = data?.rooms || [];
  const blockOptions = data?.blockOptions || [];
  const selectedId = String(form.roomId || '');

  const patch = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const selectRoom = (room) => {
    setForm({
      roomId: room.id,
      blockId: room.blockId || '',
      blockName: room.blockName || '',
      name: room.name || '',
      machineId: room.machineId || '',
      machineIp: room.machineIp || '',
      remarks: room.remarks || '',
    });
  };

  const startNewRoom = () => setForm({ ...EMPTY_ROOM_FORM });

  const onBlockChange = (value) => {
    if (value === 'add_new') {
      patch('blockId', value);
      patch('blockName', '');
      return;
    }
    const block = blockOptions.find((opt) => opt.value === value);
    setForm((prev) => ({
      ...prev,
      blockId: value,
      blockName: block?.label || prev.blockName,
    }));
  };

  const runSearch = (e) => {
    e.preventDefault();
    onLoad({ search, roomId: form.roomId || undefined });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await onSave({ action: 'delete', roomId: deleteId });
    setDeleteId(null);
    setForm(EMPTY_ROOM_FORM);
  };

  const isNewBlock = form.blockId === 'add_new';

  const roomForm = (
    <div className="card shadow-sm">
      <div className="card-header fw-semibold">
        {isAddMode ? 'Add machine room' : (form.roomId ? 'Edit room' : 'Select a room')}
      </div>
      <div className="card-body">
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
          <div className="mb-3">
            <label className="form-label">Block <span className="text-danger">*</span></label>
            <select
              className="form-select"
              value={form.blockId || ''}
              disabled={busy}
              onChange={(e) => onBlockChange(e.target.value)}
            >
              <option value="">--Select block--</option>
              {blockOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
              <option value="add_new">Add new block</option>
            </select>
          </div>

          {form.blockId ? (
            <div className="mb-3">
              <label className="form-label">
                {isNewBlock ? 'New block name' : 'Block name'}
                {' '}
                <span className="text-danger">*</span>
              </label>
              <input
                className="form-control"
                value={form.blockName || ''}
                disabled={busy}
                onChange={(e) => patch('blockName', e.target.value)}
              />
            </div>
          ) : null}

          <div className="mb-3">
            <label className="form-label">Hall / Room no. <span className="text-danger">*</span></label>
            <input
              className="form-control"
              value={form.name || ''}
              disabled={busy}
              onChange={(e) => patch('name', e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Machine ID <span className="text-danger">*</span></label>
            <input
              className="form-control"
              placeholder="Comma-separated IDs"
              value={form.machineId || ''}
              disabled={busy}
              onChange={(e) => patch('machineId', e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">IP address</label>
            <input
              className="form-control"
              placeholder="e.g. 192.168.1.10"
              value={form.machineIp || ''}
              disabled={busy}
              onChange={(e) => patch('machineIp', e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Description</label>
            <textarea
              className="form-control"
              rows={3}
              value={form.remarks || ''}
              disabled={busy}
              onChange={(e) => patch('remarks', e.target.value)}
            />
          </div>

          <div className="d-flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {isAddMode ? 'Save' : (form.roomId ? 'Save room' : 'Save')}
            </button>
            {!isAddMode && form.roomId ? (
              <button
                type="button"
                className="btn btn-outline-danger"
                disabled={busy}
                onClick={() => setDeleteId(form.roomId)}
              >
                Delete
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );

  if (isAddMode) {
    return (
      <div className="kiosk-machine-room">
        <div className="row justify-content-center">
          <div className="col-lg-8">{roomForm}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="row g-3 kiosk-machine-room">
      <div className="col-lg-5">
        <div className="card shadow-sm h-100">
          <div className="card-header fw-semibold d-flex justify-content-between align-items-center">
            <span>Rooms</span>
            <button type="button" className="btn btn-sm btn-outline-primary" disabled={busy} onClick={startNewRoom}>
              Clear form
            </button>
          </div>
          <div className="card-body">
            <form className="mb-3" onSubmit={runSearch}>
              <div className="input-group input-group-sm">
                <input
                  className="form-control"
                  placeholder="Search room, block, or machine ID"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button type="submit" className="btn btn-info" disabled={busy}>Search</button>
              </div>
            </form>
            <div className="list-group kiosk-room-list">
              {rooms.length ? rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  className={`list-group-item list-group-item-action ${selectedId === String(room.id) ? 'active' : ''}`}
                  onClick={() => selectRoom(room)}
                >
                  <div className="fw-semibold">{room.name}</div>
                  <div className="small opacity-75">
                    {room.blockName || '—'}
                    {room.machineId ? ` · ${room.machineId}` : ''}
                  </div>
                </button>
              )) : (
                <div className="text-muted small py-3 text-center">No rooms found.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="col-lg-7">
        {roomForm}
      </div>

      <ConfirmModal
        show={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        message="Delete this room?"
      />
    </div>
  );
}

export function MachineRoomAddScreen(props) {
  return <MachineRoomScreen {...props} mode="add" />;
}

export function MachineRoomEditScreen(props) {
  return <MachineRoomScreen {...props} mode="edit" />;
}

export function MachinePasswordScreen({ data, busy, onLoad, onSave, type }) {
  const [search, setSearch] = useState('');
  useEffect(() => { onLoad({ type, search }); }, [onLoad, type]);
  return (
    <div>
      <form className="row g-2 mb-3" onSubmit={(e) => { e.preventDefault(); onLoad({ type, search }); }}>
        <div className="col-md-8"><input className="form-control" placeholder="Search by ID or name" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="col-md-4"><button className="btn btn-outline-info" type="submit">Search</button></div>
      </form>
      <table className="table table-sm table-bordered">
        <thead><tr><th>Code</th><th>Name</th><th>PIN</th><th /></tr></thead>
        <tbody>
          {(data?.entries || []).map((row) => (
            <tr key={row.id}>
              <td>{row.code}</td><td>{row.name}</td>
              <td><input className="form-control form-control-sm" defaultValue={row.password} id={`pin-${row.id}`} /></td>
              <td><button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => onSave({ type, search, id: row.id, password: document.getElementById(`pin-${row.id}`).value })}>Update</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MachineSliderScreen({ data, busy, onLoad, onSave }) {
  const [slides, setSlides] = useState([]);
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.slides) setSlides(data.slides); }, [data]);
  const updateSlide = (index, patch) => setSlides((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ slides }); }}>
      {slides.map((slide, index) => (
        <div key={slide.id || index} className="border rounded p-3 mb-3">
          <h6>Slide {index + 1}</h6>
          <div className="row g-2">
            <div className="col-md-3"><label className="form-label">Type</label><select className="form-select" value={slide.objectType} onChange={(e) => updateSlide(index, { objectType: e.target.value })}><option value="image">Image</option><option value="video">Video</option></select></div>
            <div className="col-md-3"><label className="form-label">Order</label><input type="number" className="form-control" value={slide.orderNo} onChange={(e) => updateSlide(index, { orderNo: e.target.value })} /></div>
            <div className="col-md-6"><label className="form-label">Image</label><input className="form-control" value={slide.imageName} onChange={(e) => updateSlide(index, { imageName: e.target.value })} /></div>
            <div className="col-md-3"><label className="form-label">Interval (sec)</label><input type="number" className="form-control" value={slide.intervalSec} onChange={(e) => updateSlide(index, { intervalSec: e.target.value })} /></div>
            <div className="col-md-3"><label className="form-label">BG</label><input className="form-control" value={slide.bgColor} onChange={(e) => updateSlide(index, { bgColor: e.target.value })} /></div>
            <div className="col-md-3"><label className="form-label">Text</label><input className="form-control" value={slide.foreColor} onChange={(e) => updateSlide(index, { foreColor: e.target.value })} /></div>
            <div className="col-md-6"><label className="form-label">Link</label><input className="form-control" value={slide.contentLink} onChange={(e) => updateSlide(index, { contentLink: e.target.value })} /></div>
            <div className="col-md-6"><label className="form-label">Title</label><input className="form-control" value={slide.contentTitle} onChange={(e) => updateSlide(index, { contentTitle: e.target.value })} /></div>
            <div className="col-12"><label className="form-label">Message</label><textarea className="form-control" rows={2} value={slide.contentMessage} onChange={(e) => updateSlide(index, { contentMessage: e.target.value })} /></div>
            <div className="col-12 d-flex gap-3">
              <label><input type="checkbox" checked={slide.widgetEnable} onChange={(e) => updateSlide(index, { widgetEnable: e.target.checked })} /> Widget</label>
              <label><input type="checkbox" checked={slide.imageEnable} onChange={(e) => updateSlide(index, { imageEnable: e.target.checked })} /> Image</label>
              <label><input type="checkbox" checked={slide.contentEnable} onChange={(e) => updateSlide(index, { contentEnable: e.target.checked })} /> Content</label>
            </div>
          </div>
        </div>
      ))}
      <button type="submit" className="btn btn-primary" disabled={busy || !slides.length}>Save slider</button>
    </form>
  );
}

export function SliderWidgetStyleScreen({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({ contentScript: '', contentJs: '', contentStyle: '' });
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.form) setForm(data.form); }, [data]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      {['contentScript', 'contentJs', 'contentStyle'].map((k) => (
        <div key={k} className="mb-3">
          <label className="form-label">{k}</label>
          <textarea className="form-control font-monospace" rows={6} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
        </div>
      ))}
      <button type="submit" className="btn btn-primary" disabled={busy}>Save style</button>
    </form>
  );
}

function CategoryPicker({ categories, value, onChange, label = 'Category' }) {
  return (
    <div className="mb-3">
      <label className="form-label">{label}</label>
      <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {(categories || []).map((c) => <option key={c.value || c.id} value={c.value || c.id}>{c.label || c.name}</option>)}
      </select>
    </div>
  );
}

export function AttMenuScreen({ data, busy, onLoad, onSave }) {
  const [menuCategory, setMenuCategory] = useState('');
  const [rows, setRows] = useState([]);
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.menuCategory) setMenuCategory(data.menuCategory);
    if (data?.rows) setRows(data.rows);
  }, [data]);
  const updateRow = (index, patch) => setRows((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <div>
      <CategoryPicker categories={data?.categories} value={menuCategory} onChange={(v) => { setMenuCategory(v); onLoad({ menuCategory: v }); }} />
      <table className="table table-sm table-bordered">
        <thead><tr><th>On</th><th>Order</th><th>Title</th><th>URL</th><th>Icon</th><th /></tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.rowId || `new-${i}`}>
              <td><input type="checkbox" checked={row.enable} onChange={(e) => updateRow(i, { enable: e.target.checked })} /></td>
              <td><input className="form-control form-control-sm" value={row.order} onChange={(e) => updateRow(i, { order: e.target.value })} /></td>
              <td><input className="form-control form-control-sm" value={row.title} onChange={(e) => updateRow(i, { title: e.target.value })} /></td>
              <td><input className="form-control form-control-sm" value={row.url} onChange={(e) => updateRow(i, { url: e.target.value })} /></td>
              <td><input className="form-control form-control-sm" value={row.icon} onChange={(e) => updateRow(i, { icon: e.target.value })} /></td>
              <td>{row.rowId ? <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => onSave({ menuCategory, action: 'delete', rowId: row.rowId })}>Del</button> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-sm btn-outline-secondary me-2" onClick={() => setRows([...rows, { enable: true, order: rows.length + 1, title: '', url: '', icon: '' }])}>Add row</button>
      <button type="button" className="btn btn-primary" disabled={busy || !menuCategory} onClick={() => onSave({ menuCategory, rows })}>Save menu</button>
    </div>
  );
}

export function AttMenuAccessScreen({ data, busy, onLoad, onSave }) {
  const [menuCategory, setMenuCategory] = useState('');
  const [staffList, setStaffList] = useState('');
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.menuCategory) setMenuCategory(data.menuCategory);
    if (data?.staffList !== undefined) setStaffList(data.staffList);
  }, [data]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ menuCategory, staffList }); }}>
      <CategoryPicker categories={data?.categories} value={menuCategory} onChange={(v) => { setMenuCategory(v); onLoad({ menuCategory: v }); }} />
      <div className="mb-3">
        <label className="form-label">Staff IDs (comma-separated)</label>
        <textarea className="form-control" rows={4} value={staffList} onChange={(e) => setStaffList(e.target.value)} />
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy || !menuCategory}>Save access</button>
    </form>
  );
}

export function AttInstructionScreen({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({ title: '', content: '' });
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.form) setForm(data.form); }, [data]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="mb-3"><label className="form-label">Title</label><input className="form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div className="mb-3"><label className="form-label">Content</label><textarea className="form-control" rows={10} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
      <button type="submit" className="btn btn-primary" disabled={busy}>Save instruction</button>
    </form>
  );
}

export function PinResetScreen({ data, busy, onLoad, onSave, type }) {
  const [searchBy, setSearchBy] = useState('category');
  const [searchInput, setSearchInput] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  useEffect(() => { onLoad({ type }); }, [onLoad, type]);
  useEffect(() => {
    if (data?.searchBy) setSearchBy(data.searchBy);
    if (data?.searchInput) setSearchInput(data.searchInput);
    if (data?.searchCategory) setSearchCategory(data.searchCategory);
  }, [data]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ type, searchBy, searchInput, searchCategory }); }}>
      <p className="text-muted">Regenerate machine PINs for {type === 'staff' ? 'staff' : 'students'}.</p>
      <div className="mb-3">
        <label className="form-label">Search by</label>
        <select className="form-select" value={searchBy} onChange={(e) => setSearchBy(e.target.value)}>
          <option value="category">Category / all</option>
          <option value="roll_no">{type === 'staff' ? 'Staff ID' : 'Register no.'} (comma-separated)</option>
        </select>
      </div>
      {searchBy === 'roll_no' ? (
        <div className="mb-3"><label className="form-label">IDs</label><input className="form-control" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} /></div>
      ) : type === 'staff' ? (
        <CategoryPicker categories={data?.categories} value={searchCategory} onChange={setSearchCategory} label="Job category" />
      ) : null}
      <button type="submit" className="btn btn-danger" disabled={busy}>Regenerate PINs</button>
    </form>
  );
}

export function AttStatementScreen({ data, busy, onLoad, onSave }) {
  const [staffCategory, setStaffCategory] = useState('');
  const [options, setOptions] = useState([]);
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.staffCategory) setStaffCategory(data.staffCategory);
    if (data?.options) setOptions(data.options);
  }, [data]);
  return (
    <div>
      <CategoryPicker categories={data?.categories} value={staffCategory} onChange={(v) => { setStaffCategory(v); onLoad({ staffCategory: v }); }} label="Staff category" />
      <div className="list-group mb-3">
        {options.map((opt, i) => (
          <label key={opt.key} className="list-group-item d-flex gap-2">
            <input type="checkbox" checked={opt.enabled} onChange={(e) => setOptions((rows) => rows.map((r, j) => (j === i ? { ...r, enabled: e.target.checked } : r)))} />
            {opt.label}
          </label>
        ))}
      </div>
      <button type="button" className="btn btn-primary" disabled={busy || !staffCategory} onClick={() => onSave({ staffCategory, options })}>Save options</button>
    </div>
  );
}

export function AnnouncementAddScreen({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({});
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.form) setForm(data.form); }, [data]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="mb-2"><label className="form-label">Title</label><input className="form-control" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
      <div className="mb-2"><label className="form-label">Description</label><textarea className="form-control" rows={4} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="row g-2 mb-2">
        <div className="col-md-4"><label className="form-label">From</label><input type="date" className="form-control" value={form.fromDate || ''} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} /></div>
        <div className="col-md-4"><label className="form-label">To</label><input type="date" className="form-control" value={form.toDate || ''} onChange={(e) => setForm({ ...form, toDate: e.target.value })} /></div>
        <div className="col-md-4"><label className="form-label">Audience</label><select className="form-select" value={form.audience || 'all'} onChange={(e) => setForm({ ...form, audience: e.target.value })}><option value="all">All</option><option value="staff">Staff</option><option value="student">Student</option></select></div>
      </div>
      <div className="d-flex gap-3 mb-3">
        <label><input type="checkbox" checked={!!form.tvWidget} onChange={(e) => setForm({ ...form, tvWidget: e.target.checked })} /> TV widget</label>
        <label><input type="checkbox" checked={!!form.tvFlash} onChange={(e) => setForm({ ...form, tvFlash: e.target.checked })} /> TV flash</label>
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>Add announcement</button>
    </form>
  );
}

export function AnnouncementEditScreen({ data, busy, onLoad, onSave }) {
  const [announcementId, setAnnouncementId] = useState('');
  const [form, setForm] = useState({});
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.announcementId) setAnnouncementId(String(data.announcementId));
    if (data?.form) setForm(data.form);
  }, [data]);
  return (
    <div className="row g-3">
      <div className="col-md-4">
        <div className="list-group">
          {(data?.announcements || []).map((a) => (
            <button key={a.id} type="button" className={`list-group-item list-group-item-action ${String(a.id) === announcementId ? 'active' : ''}`} onClick={() => onLoad({ announcementId: a.id })}>
              {a.title}<br /><small>{a.fromDate} – {a.toDate}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="col-md-8">
        <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, announcementId }); }}>
          <div className="mb-2"><label className="form-label">Title</label><input className="form-control" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="mb-2"><label className="form-label">Description</label><textarea className="form-control" rows={4} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="row g-2 mb-2">
            <div className="col-md-4"><label className="form-label">From</label><input type="date" className="form-control" value={form.fromDate || ''} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} /></div>
            <div className="col-md-4"><label className="form-label">To</label><input type="date" className="form-control" value={form.toDate || ''} onChange={(e) => setForm({ ...form, toDate: e.target.value })} /></div>
            <div className="col-md-4"><label className="form-label">Audience</label><select className="form-select" value={form.audience || 'all'} onChange={(e) => setForm({ ...form, audience: e.target.value })}><option value="all">All</option><option value="staff">Staff</option><option value="student">Student</option></select></div>
          </div>
          <div className="d-flex gap-3 mb-3">
            <label><input type="checkbox" checked={!!form.tvWidget} onChange={(e) => setForm({ ...form, tvWidget: e.target.checked })} /> TV widget</label>
            <label><input type="checkbox" checked={!!form.tvFlash} onChange={(e) => setForm({ ...form, tvFlash: e.target.checked })} /> TV flash</label>
          </div>
          <button type="submit" className="btn btn-primary me-2" disabled={busy || !announcementId}>Update</button>
          <button type="button" className="btn btn-outline-danger" disabled={busy || !announcementId} onClick={() => onSave({ action: 'delete', announcementId })}>Delete</button>
        </form>
      </div>
    </div>
  );
}

export function ReceiptSetupScreen({ data, busy, onLoad, onSave }) {
  const [jobCategory, setJobCategory] = useState('');
  const [receiptType, setReceiptType] = useState('');
  const [setup, setSetup] = useState({});
  const [signatures, setSignatures] = useState([]);
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.jobCategory) setJobCategory(data.jobCategory);
    if (data?.receiptType) setReceiptType(data.receiptType);
    if (data?.setup) setSetup(data.setup);
    if (data?.signatures) setSignatures(data.signatures);
  }, [data]);
  const updateSig = (i, patch) => setSignatures((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div>
      <div className="row g-2 mb-3">
        <div className="col-md-6"><CategoryPicker categories={data?.categories} value={jobCategory} onChange={(v) => { setJobCategory(v); onLoad({ jobCategory: v, receiptType }); }} label="Job category" /></div>
        <div className="col-md-6"><CategoryPicker categories={data?.receiptTypes} value={receiptType} onChange={(v) => { setReceiptType(v); onLoad({ jobCategory, receiptType: v }); }} label="Receipt type" /></div>
      </div>
      {jobCategory && receiptType ? (
        <form onSubmit={(e) => { e.preventDefault(); onSave({ jobCategory, receiptType, setup, signatures }); }}>
          <div className="row g-2 mb-3">
            <div className="col-md-3"><label className="form-label">Task assign</label><input type="number" className="form-control" value={setup.taskAssign ?? 0} onChange={(e) => setSetup({ ...setup, taskAssign: e.target.value })} /></div>
            <div className="col-md-3"><label className="form-label">Task row</label><input type="number" className="form-control" value={setup.taskRow ?? 1} onChange={(e) => setSetup({ ...setup, taskRow: e.target.value })} /></div>
            <div className="col-md-3"><label className="form-label">Row height</label><input type="number" className="form-control" value={setup.taskRowHeight ?? 20} onChange={(e) => setSetup({ ...setup, taskRowHeight: e.target.value })} /></div>
          </div>
          <div className="mb-3"><label className="form-label">Receipt message</label><textarea className="form-control" rows={3} value={setup.receiptMessage || ''} onChange={(e) => setSetup({ ...setup, receiptMessage: e.target.value })} /></div>
          <table className="table table-sm table-bordered">
            <thead><tr><th>Name</th><th>Designation</th><th>Order</th><th>Row</th></tr></thead>
            <tbody>
              {signatures.map((sig, i) => (
                <tr key={sig.id || `new-${i}`}>
                  <td><input className="form-control form-control-sm" value={sig.name} onChange={(e) => updateSig(i, { name: e.target.value })} /></td>
                  <td><input className="form-control form-control-sm" value={sig.designation} onChange={(e) => updateSig(i, { designation: e.target.value })} /></td>
                  <td><input type="number" className="form-control form-control-sm" value={sig.order} onChange={(e) => updateSig(i, { order: e.target.value })} /></td>
                  <td><input type="number" className="form-control form-control-sm" value={sig.row} onChange={(e) => updateSig(i, { row: e.target.value })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn btn-sm btn-outline-secondary me-2" onClick={() => setSignatures([...signatures, { name: '', designation: '', order: signatures.length + 1, row: 1 }])}>Add signature</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>Save receipt setup</button>
        </form>
      ) : null}
    </div>
  );
}
