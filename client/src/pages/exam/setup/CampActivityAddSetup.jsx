import { useEffect, useRef, useState } from 'react';
import { ExamSetupShell } from './ExamSelectors';
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

export default function CampActivityAddSetup() {
  const { data, busy, error, notice, load, save } = useExamSetupApi('camp-activity-add');
  const attachRef = useRef(null);
  const galleryRef = useRef(null);
  const [form, setForm] = useState({
    eventTitle: '',
    eventTypes: [],
    fromDate: '',
    toDate: '',
    venue: '',
    totalPatients: '',
    description: '',
    webView: '1',
  });

  useEffect(() => { load(); }, [load]);

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

  const onSubmit = async (e) => {
    e.preventDefault();
    const files = [];
    if (attachRef.current?.files?.length) {
      files.push(...await readFilesAsBase64(attachRef.current.files, 'attachment'));
    }
    if (galleryRef.current?.files?.length) {
      files.push(...await readFilesAsBase64(galleryRef.current.files, 'gallery[]'));
    }
    await save({
      event_title: form.eventTitle,
      event_types: form.eventTypes,
      from_date: form.fromDate,
      to_date: form.toDate,
      venue: form.venue,
      total_patients: form.totalPatients,
      description: form.description,
      web_view: form.webView,
      Submit: 'Save',
    }, files);
  };

  return (
    <ExamSetupShell notice={notice} error={error} busy={busy}>
      <form onSubmit={onSubmit}>
        <div className="mb-3 row g-2">
          <label className="col-sm-2 col-form-label">Camp Name</label>
          <div className="col-sm-8">
            <input className="form-control" required value={form.eventTitle} onChange={(e) => setField('eventTitle', e.target.value)} />
          </div>
        </div>

        <div className="mb-3 row g-2">
          <label className="col-sm-2 col-form-label">Type</label>
          <div className="col-sm-5 d-flex flex-wrap gap-2">
            {(data?.eventTypes || []).map((type) => (
              <label key={type.id} className="form-check-label">
                <input
                  type="checkbox"
                  className="form-check-input me-1"
                  checked={form.eventTypes.includes(String(type.id))}
                  onChange={() => toggleType(type.id)}
                />
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
          <label className="col-sm-2 col-form-label">Attachment</label>
          <div className="col-sm-5">
            <input ref={attachRef} type="file" className="form-control" />
            <span className="help-block small text-muted">Support: {data?.attachmentHelp}</span>
          </div>
        </div>

        <div className="mb-3 row g-2">
          <label className="col-sm-2 col-form-label">Gallery</label>
          <div className="col-sm-5">
            <input ref={galleryRef} type="file" className="form-control" multiple accept="image/*" />
            <span className="help-block small text-muted">Support: {data?.imagesHelp}</span>
          </div>
        </div>

        <div className="mb-3 row g-2">
          <label className="col-sm-2 col-form-label">Web View</label>
          <div className="col-sm-8 d-flex gap-3">
            <label><input type="radio" name="web_view" value="1" checked={form.webView === '1'} onChange={() => setField('webView', '1')} /> Yes</label>
            <label><input type="radio" name="web_view" value="0" checked={form.webView === '0'} onChange={() => setField('webView', '0')} /> No</label>
          </div>
        </div>

        <div className="mb-3">
          <button type="submit" className="btn btn-danger me-2" disabled={busy}>Save</button>
          <button type="reset" className="btn btn-default" onClick={() => setForm({
            eventTitle: '', eventTypes: [], fromDate: '', toDate: '', venue: '', totalPatients: '', description: '', webView: '1',
          })}
          >
            Reset
          </button>
        </div>
      </form>
    </ExamSetupShell>
  );
}
