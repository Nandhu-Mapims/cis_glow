import { useEffect, useState } from 'react';
import ConfirmModal from '../../../components/ConfirmModal';
import { useToast } from '../../../components/ToastProvider';

const STATUS_OPTIONS = [
  { value: 1, label: 'Confirm' },
  { value: 4, label: 'Not Yet Confirm' },
  { value: 2, label: 'Postpone' },
  { value: 3, label: 'Cancel' },
];

const emptyEvent = () => ({
  eventTypes: [],
  title: '',
  fromDate: '',
  toDate: '',
  description: '',
  attachment: '',
  venue: '',
  webView: true,
  eventStatus: 1,
  photos: [],
});

async function filePayload(file, field) {
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return { field, name: file.name, data };
}

function EventTypeSelect({ options, value, onChange, disabled }) {
  return (
    <select
      className="form-select"
      multiple
      size={Math.min(6, Math.max(3, options.length))}
      value={value.map(String)}
      disabled={disabled}
      onChange={(e) => {
        const selected = Array.from(e.target.selectedOptions).map((o) => Number(o.value));
        onChange(selected);
      }}
    >
      {options.map((t) => (
        <option key={t.id} value={t.id}>{t.title}</option>
      ))}
    </select>
  );
}

function EventForm({ form, setForm, eventTypes, busy, onSubmit, onDelete, attachmentUrl }) {
  const [attachFile, setAttachFile] = useState(null);
  const [galleryFiles, setGalleryFiles] = useState([]);

  return (
    <form className="cis-setup-form" onSubmit={async (e) => {
      e.preventDefault();
      const files = [];
      if (attachFile) files.push(await filePayload(attachFile, 'attachment'));
      for (let i = 0; i < galleryFiles.length; i++) {
        if (galleryFiles[i]) files.push(await filePayload(galleryFiles[i], `gallery_${i}`));
      }
      await onSubmit(form, files);
      setAttachFile(null);
      setGalleryFiles([]);
    }}>
      <div className="row g-3">
        <div className="col-md-8">
          <label className="form-label">Event name <span className="text-danger">*</span></label>
          <input className="form-control" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="col-md-4">
          <label className="form-label">Type</label>
          <EventTypeSelect
            options={eventTypes}
            value={form.eventTypes}
            onChange={(eventTypes) => setForm({ ...form, eventTypes })}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">From date <span className="text-danger">*</span></label>
          <input type="datetime-local" className="form-control" required value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} />
        </div>
        <div className="col-md-4">
          <label className="form-label">To date <span className="text-danger">*</span></label>
          <input type="datetime-local" className="form-control" required value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} />
        </div>
        <div className="col-md-4">
          <label className="form-label">Venue <span className="text-danger">*</span></label>
          <input className="form-control" required value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
        </div>
        <div className="col-12">
          <label className="form-label">Description</label>
          <textarea className="form-control" rows={6} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Attachment</label>
          <input type="file" className="form-control" onChange={(e) => setAttachFile(e.target.files?.[0] || null)} />
          {form.attachment && (
            <div className="small mt-1">
              Current: {attachmentUrl || `/legacy/files/events/${form.attachment}`}
            </div>
          )}
        </div>
        <div className="col-md-6">
          <label className="form-label">Gallery photos</label>
          <input type="file" className="form-control" multiple accept="image/*" onChange={(e) => setGalleryFiles(Array.from(e.target.files || []))} />
        </div>
        {form.photos?.length > 0 && (
          <div className="col-12">
            <label className="form-label">Existing gallery</label>
            <div className="d-flex flex-wrap gap-2">
              {form.photos.map((p) => (
                <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-secondary">
                  Photo {p.order || p.id}
                </a>
              ))}
            </div>
          </div>
        )}
        <div className="col-md-6">
          <label className="form-label">Web view</label>
          <div className="d-flex gap-3">
            <label><input className="me-2" type="radio" checked={form.webView} onChange={() => setForm({ ...form, webView: true })} /> Yes</label>
            <label><input className="me-2" type="radio" checked={!form.webView} onChange={() => setForm({ ...form, webView: false })} /> No</label>
          </div>
        </div>
        {onDelete && (
          <div className="col-md-6">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.eventStatus} onChange={(e) => setForm({ ...form, eventStatus: Number(e.target.value) })}>
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        )}
        <div className="col-12 d-flex flex-wrap gap-2">
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
          {onDelete && (
            <button type="button" className="btn btn-outline-danger" disabled={busy} onClick={onDelete}>Delete event</button>
          )}
        </div>
      </div>
    </form>
  );
}

export function WebEventAddScreen({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState(emptyEvent());

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.form) setForm({ ...emptyEvent(), ...data.form }); }, [data]);

  return (
    <EventForm
      form={form}
      setForm={setForm}
      eventTypes={data?.eventTypes || []}
      busy={busy}
      onSubmit={async (payload, files) => {
        await onSave(payload, files);
        setForm(emptyEvent());
      }}
    />
  );
}

export function WebEventEditScreen({ data, busy, onLoad, onSave }) {
  const toast = useToast();
  const [eventId, setEventId] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyEvent());
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.eventId) setEventId(String(data.eventId));
    if (data?.search !== undefined) setSearch(data.search);
    if (data?.form) setForm({ ...emptyEvent(), ...data.form });
  }, [data]);

  const pick = async (id) => {
    setEventId(String(id));
    await onLoad({ eventId: id, search });
  };

  const runSearch = async (e) => {
    e.preventDefault();
    await onLoad({ search, eventId: eventId || undefined });
  };

  const runDelete = async () => {
    try {
      await onSave({ action: 'delete', eventId });
      toast.success('Event deleted');
      setEventId('');
      setForm(emptyEvent());
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    } finally {
      setConfirmDelete(false);
    }
  };

  return (
    <div className="row g-3">
      <div className="col-md-4">
        <form className="mb-2" onSubmit={runSearch}>
          <div className="input-group input-group-sm">
            <input className="form-control" placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <button type="submit" className="btn btn-outline-primary">Search</button>
          </div>
        </form>
        <div className="list-group" style={{ maxHeight: '480px', overflowY: 'auto' }}>
          {(data?.events || []).map((ev) => (
            <button
              key={ev.id}
              type="button"
              className={`list-group-item list-group-item-action ${String(ev.id) === eventId ? 'active' : ''}`}
              onClick={() => pick(String(ev.id))}
            >
              <div className="fw-semibold">{ev.title}</div>
              <div className="small opacity-75">{ev.venue}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="col-md-8">
        {eventId ? (
          <EventForm
            form={form}
            setForm={setForm}
            eventTypes={data?.eventTypes || []}
            busy={busy}
            onSubmit={async (payload, files) => onSave({ ...payload, eventId }, files)}
            onDelete={() => setConfirmDelete(true)}
          />
        ) : (
          <p className="text-muted">Select an event from the list to edit.</p>
        )}
      </div>

      <ConfirmModal
        show={confirmDelete}
        title="Delete event?"
        message="Delete this event? This cannot be undone."
        confirmLabel="Delete Event"
        tone="danger"
        busy={busy}
        onConfirm={runDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}

export function WebEventTypeScreen({ data, busy, onLoad, onSave }) {
  const [rows, setRows] = useState([]);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.rows) setRows(data.rows); }, [data]);

  const updateRow = (i, title) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, title } : r)));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ rows }); }}>
      <div className="table-responsive">
        <table className="table table-bordered table-sm">
          <thead className="table-secondary">
            <tr><th style={{ width: 60 }}>#</th><th>Category</th><th style={{ width: 100 }} /></tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id || `new-${i}`}>
                <td>{i + 1}</td>
                <td>
                  <input className="form-control form-control-sm" value={row.title} onChange={(e) => updateRow(i, e.target.value)} />
                </td>
                <td>
                  {row.id ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => onSave({ action: 'delete', id: row.id })}
                    >
                      Delete
                    </button>
                  ) : (
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setRows((p) => p.filter((_, j) => j !== i))}>Remove</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="d-flex gap-2">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setRows((p) => [...p, { title: '' }])}>Add row</button>
        <button type="submit" className="btn btn-danger btn-sm" disabled={busy}>Save</button>
      </div>
    </form>
  );
}

export default WebEventAddScreen;
