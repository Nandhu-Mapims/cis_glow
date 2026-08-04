import { useEffect, useRef, useState } from 'react';
import { ExamSetupShell } from './ExamSelectors';
import { toDateTimeInputValue } from '../../../utils/dateInputs';
import { useExamSetupApi } from './useExamSetupApi';

async function readFilesAsBase64(fileList, fieldName) {
  const files = [];
  for (let i = 0; i < fileList.length; i += 1) {
    const file = fileList[i];
    const content = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    files.push({ field: fieldName, index: i, filename: file.name, type: file.type, content });
  }
  return files;
}

export default function CampActivityEditSetup() {
  const { data, busy, error, notice, load, save } = useExamSetupApi('camp-activity-edit');
  const attachRef = useRef(null);
  const galleryRef = useRef(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState(null);
  const [gallery, setGallery] = useState([]);

  useEffect(() => { load({ search, page }); }, [load, search, page]);

  useEffect(() => {
    if (data?.mode === 'edit') {
      setForm({
        editId: data.editId,
        eventTitle: data.eventTitle || '',
        eventTypes: data.selectedTypes || [],
        fromDate: toDateTimeInputValue(data.fromDate),
        toDate: toDateTimeInputValue(data.toDate),
        venue: data.venue || '',
        totalPatients: data.totalPatients || '',
        description: data.description || '',
        attachmentExisting: data.attachment || '',
        webView: data.webView || '1',
        eventStatus: data.eventStatus || '1',
      });
      setGallery((data.gallery || []).map((g) => ({ ...g, selected: false })));
    } else {
      setForm(null);
      setGallery([]);
    }
  }, [data]);

  const reloadList = (patch = {}) => load({ search, page, ...patch });
  const openEdit = (id) => load({ editId: id, search, page });
  const backToList = () => load({ search, page });

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleType = (id) => {
    const key = String(id);
    setForm((prev) => ({
      ...prev,
      eventTypes: prev.eventTypes.includes(key)
        ? prev.eventTypes.filter((v) => v !== key)
        : [...prev.eventTypes, key],
    }));
  };

  const onSave = async (e) => {
    e.preventDefault();
    if (!form) return;
    const files = [];
    if (attachRef.current?.files?.length) {
      files.push(...await readFilesAsBase64(attachRef.current.files, 'attachment'));
    }
    if (galleryRef.current?.files?.length) {
      files.push(...await readFilesAsBase64(galleryRef.current.files, 'gallery[]'));
    }
    await save({
      edit_row_id: form.editId,
      event_title: form.eventTitle,
      event_types: form.eventTypes,
      from_date: form.fromDate,
      to_date: form.toDate,
      venue: form.venue,
      total_patients: form.totalPatients,
      description: form.description,
      hd_attachment: form.attachmentExisting,
      web_view: form.webView,
      event_status: form.eventStatus,
      search,
      page,
      Submit: 'Save',
    }, files);
  };

  const onUpdateGallery = async () => {
    await save({
      edit_row_id: form.editId,
      p_u_id: gallery.map((g) => g.id),
      p_title: gallery.map((g) => g.title),
      p_order: gallery.map((g) => g.photoOrder),
      search,
      page,
      Submit: 'Update Gallery',
    });
  };

  const onDeleteGallery = async () => {
    const selected = gallery.filter((g) => g.selected);
    if (!selected.length) return;
    await save({
      edit_row_id: form.editId,
      photo_id: selected.map((g) => g.id),
      search,
      page,
      Submit: 'Delete Gallery',
    });
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await save({ delete: 'Confirm', confirm: deleteId, search, page });
    setDeleteId(null);
  };

  if (data?.mode === 'edit' && form) {
    return (
      <ExamSetupShell notice={notice} error={error} busy={busy}>
        <div className="text-end mb-2">
          <button type="button" className="btn btn-link btn-sm" onClick={backToList}>Back</button>
        </div>
        <form onSubmit={onSave}>
          <div className="mb-3 row g-2">
            <label className="col-sm-2 col-form-label">Event Name</label>
            <div className="col-sm-8">
              <input className="form-control" required value={form.eventTitle} onChange={(e) => setField('eventTitle', e.target.value)} />
            </div>
          </div>

          <div className="mb-3 row g-2">
            <label className="col-sm-2 col-form-label">Type</label>
            <div className="col-sm-5 d-flex flex-wrap gap-2">
              {(data.eventTypes || []).map((type) => (
                <label key={type.id} className="form-check-label">
                  <input type="checkbox" className="form-check-input me-1" checked={form.eventTypes.includes(String(type.id))} onChange={() => toggleType(type.id)} />
                  {type.title}
                </label>
              ))}
            </div>
          </div>

          <div className="mb-3 row g-2">
            <label className="col-sm-2 col-form-label">From Date</label>
            <div className="col-sm-3">
              <input type="datetime-local" className="form-control" required value={form.fromDate} onChange={(e) => setField('fromDate', e.target.value)} />
            </div>
            <label className="col-sm-1 col-form-label">To Date</label>
            <div className="col-sm-3">
              <input type="datetime-local" className="form-control" required value={form.toDate} onChange={(e) => setField('toDate', e.target.value)} />
            </div>
          </div>

          <div className="mb-3 row g-2">
            <label className="col-sm-2 col-form-label">Venue</label>
            <div className="col-sm-5">
              <input className="form-control" required value={form.venue} onChange={(e) => setField('venue', e.target.value)} />
            </div>
          </div>

          <div className="mb-3 row g-2">
            <label className="col-sm-2 col-form-label">Total Patient Registration</label>
            <div className="col-sm-5">
              <input className="form-control" required value={form.totalPatients} onChange={(e) => setField('totalPatients', e.target.value)} />
            </div>
          </div>

          <div className="mb-3 row g-2">
            <label className="col-sm-2 col-form-label">Description</label>
            <div className="col-sm-10">
              <textarea className="form-control" rows={6} value={form.description} onChange={(e) => setField('description', e.target.value)} />
            </div>
          </div>

          <div className="mb-3 row g-2">
            <label className="col-sm-2 col-form-label">Gallery Upload</label>
            <div className="col-sm-5">
              <input ref={galleryRef} type="file" className="form-control" multiple accept="image/*" />
              <span className="help-block small text-muted">Support: {data.imagesHelp}</span>
            </div>
          </div>

          <div className="mb-3 row g-2">
            <label className="col-sm-2 col-form-label">Attachment</label>
            <div className="col-sm-5">
              <input ref={attachRef} type="file" className="form-control" />
              {form.attachmentExisting ? (
                <p className="small mt-1">
                  Current: <a href={data.attachmentUrl} target="_blank" rel="noreferrer">{form.attachmentExisting}</a>
                </p>
              ) : null}
              <span className="help-block small text-muted">Support: {data.attachmentHelp}</span>
            </div>
          </div>

          <div className="mb-3 row g-2">
            <label className="col-sm-2 col-form-label">Status</label>
            <div className="col-sm-8 d-flex flex-wrap gap-3">
              {[['1', 'Confirm'], ['4', 'Not Yet Confirm'], ['2', 'Postpone'], ['3', 'Cancel']].map(([value, label]) => (
                <label key={value}>
                  <input className="me-2" type="radio" name="event_status" value={value} checked={form.eventStatus === value} onChange={() => setField('eventStatus', value)} />
                  {' '}{label}
                </label>
              ))}
            </div>
          </div>

          <div className="mb-3 row g-2">
            <label className="col-sm-2 col-form-label">Web View</label>
            <div className="col-sm-8 d-flex gap-3">
              <label><input className="me-2" type="radio" name="web_view" value="1" checked={form.webView === '1'} onChange={() => setField('webView', '1')} /> Yes</label>
              <label><input className="me-2" type="radio" name="web_view" value="0" checked={form.webView === '0'} onChange={() => setField('webView', '0')} /> No</label>
            </div>
          </div>

          <div className="mb-3">
            <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
          </div>
        </form>

        {gallery.length > 0 ? (
          <>
            <h5 className="mt-4">Gallery</h5>
            <div className="row g-3">
              {gallery.map((photo, index) => (
                <div key={photo.id} className="col-sm-3 border p-2">
                  <label className="small">
                    <input
                      type="checkbox"
                      checked={photo.selected}
                      onChange={(e) => setGallery((prev) => prev.map((g, i) => (i === index ? { ...g, selected: e.target.checked } : g)))}
                    />
                    {' '}Order {photo.photoOrder}
                  </label>
                  {photo.thumbUrl ? <img src={photo.thumbUrl} alt="" className="img-fluid mt-1" style={{ maxHeight: 80 }} /> : null}
                  <input
                    className="form-control form-control-sm mt-1"
                    placeholder="Order"
                    value={photo.photoOrder}
                    onChange={(e) => setGallery((prev) => prev.map((g, i) => (i === index ? { ...g, photoOrder: e.target.value } : g)))}
                  />
                  <input
                    className="form-control form-control-sm mt-1"
                    placeholder="Title"
                    value={photo.title}
                    onChange={(e) => setGallery((prev) => prev.map((g, i) => (i === index ? { ...g, title: e.target.value } : g)))}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 d-flex gap-2">
              <button type="button" className="btn btn-info btn-sm" onClick={onUpdateGallery} disabled={busy}>Update Gallery Title & Order</button>
              <button type="button" className="btn btn-info btn-sm" onClick={onDeleteGallery} disabled={busy}>Delete Selected Gallery</button>
            </div>
          </>
        ) : null}
      </ExamSetupShell>
    );
  }

  return (
    <ExamSetupShell notice={notice} error={error} busy={busy}>
      <form className="row g-2 mb-3" onSubmit={(e) => { e.preventDefault(); setPage(1); reloadList({ search, page: 1 }); }}>
        <div className="col-sm-4">
          <input className="form-control form-control-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" />
        </div>
        <div className="col-sm-2">
          <button type="submit" className="btn btn-sm btn-info" disabled={busy}>Search</button>
        </div>
        <div className="col-sm-6 text-end small text-muted align-self-center">
          {data?.total != null ? `Showing page ${data.page} of ${data.totalPages} (${data.total} entries)` : null}
        </div>
      </form>

      <div className="table-responsive">
        <table className="table table-hover table-sm">
          <thead>
            <tr><th>From Date</th><th>To Date</th><th>Event Name</th><th /></tr>
          </thead>
          <tbody>
            {(data?.rows || []).map((row) => (
              <tr key={row.id}>
                <td>{row.fromDate}</td>
                <td>{row.toDate}</td>
                <td>{row.title}</td>
                <td nowrap="nowrap">
                  <button type="button" className="btn btn-sm btn-primary me-1" onClick={() => openEdit(row.id)} disabled={busy}>Edit</button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteId(row.id)} disabled={busy}>Delete</button>
                </td>
              </tr>
            ))}
            {!data?.rows?.length ? <tr><td colSpan={4}>No data available</td></tr> : null}
          </tbody>
        </table>
      </div>

      {data?.totalPages > 1 ? (
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page <= 1 || busy} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page >= data.totalPages || busy} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      ) : null}

      {deleteId ? (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header"><h5 className="modal-title">Confirm</h5></div>
              <div className="modal-body">Are you sure to delete...</div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setDeleteId(null)}>Close</button>
                <button type="button" className="btn btn-warning" onClick={confirmDelete}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </ExamSetupShell>
  );
}
