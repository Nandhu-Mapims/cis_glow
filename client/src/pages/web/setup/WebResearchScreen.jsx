import { useEffect, useState } from 'react';

const empty = () => ({
  researchData: '',
  registrationClose: '',
  fromDate: new Date().toISOString().slice(0, 10),
  description: '',
  venue: '',
  webView: true,
  progTime: '',
  researchTopic: '',
  presenterName: '',
  presenterDesig: '',
  presenterDept: '',
  presenterCollege: '',
  presenterCity: '',
  targetLink: '',
  region: '',
  memberView: false,
  eventStatus: '',
  eventTypes: '',
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

function ResearchForm({ form, setForm, attachFile, setAttachFile, busy, onSubmit }) {
  return (
    <form className="cis-setup-form" onSubmit={onSubmit}>
      <div className="row g-3">
        <div className="col-md-8">
          <label className="form-label">Research topic</label>
          <input className="form-control" required value={form.researchTopic} onChange={(e) => setForm({ ...form, researchTopic: e.target.value })} />
        </div>
        <div className="col-md-4">
          <label className="form-label">Program date</label>
          <input type="date" className="form-control" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} />
        </div>
        <div className="col-md-4">
          <label className="form-label">Registration close</label>
          <input type="date" className="form-control" value={form.registrationClose} onChange={(e) => setForm({ ...form, registrationClose: e.target.value })} />
        </div>
        <div className="col-md-4">
          <label className="form-label">Time</label>
          <input className="form-control" value={form.progTime} onChange={(e) => setForm({ ...form, progTime: e.target.value })} />
        </div>
        <div className="col-md-4">
          <label className="form-label">Venue</label>
          <input className="form-control" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
        </div>
        <div className="col-12">
          <label className="form-label">Description</label>
          <textarea className="form-control" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Presenter name</label>
          <input className="form-control" value={form.presenterName} onChange={(e) => setForm({ ...form, presenterName: e.target.value })} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Designation</label>
          <input className="form-control" value={form.presenterDesig} onChange={(e) => setForm({ ...form, presenterDesig: e.target.value })} />
        </div>
        <div className="col-md-4">
          <label className="form-label">Department</label>
          <input className="form-control" value={form.presenterDept} onChange={(e) => setForm({ ...form, presenterDept: e.target.value })} />
        </div>
        <div className="col-md-4">
          <label className="form-label">College</label>
          <input className="form-control" value={form.presenterCollege} onChange={(e) => setForm({ ...form, presenterCollege: e.target.value })} />
        </div>
        <div className="col-md-4">
          <label className="form-label">City</label>
          <input className="form-control" value={form.presenterCity} onChange={(e) => setForm({ ...form, presenterCity: e.target.value })} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Target link</label>
          <input className="form-control" value={form.targetLink} onChange={(e) => setForm({ ...form, targetLink: e.target.value })} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Attachment</label>
          <input type="file" className="form-control" onChange={(e) => setAttachFile(e.target.files?.[0] || null)} />
        </div>
        <div className="col-12 d-flex flex-wrap gap-3">
          <label><input type="checkbox" checked={form.webView} onChange={(e) => setForm({ ...form, webView: e.target.checked })} /> Web view</label>
          <label><input type="checkbox" checked={form.memberView} onChange={(e) => setForm({ ...form, memberView: e.target.checked })} /> Member view</label>
        </div>
        <div className="col-12">
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </div>
      </div>
    </form>
  );
}

export function WebResearchAddScreen({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState(empty());
  const [attachFile, setAttachFile] = useState(null);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.form) setForm({ ...empty(), ...data.form }); }, [data]);

  return (
    <ResearchForm
      form={form}
      setForm={setForm}
      attachFile={attachFile}
      setAttachFile={setAttachFile}
      busy={busy}
      onSubmit={async (e) => {
        e.preventDefault();
        const files = attachFile ? [await filePayload(attachFile, 'attachment')] : [];
        await onSave(form, files);
        setForm(empty());
        setAttachFile(null);
      }}
    />
  );
}

export function WebResearchEditScreen({ data, busy, onLoad, onSave }) {
  const [programId, setProgramId] = useState('');
  const [form, setForm] = useState(empty());
  const [attachFile, setAttachFile] = useState(null);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.programId) setProgramId(String(data.programId));
    if (data?.form) setForm({ ...empty(), ...data.form });
  }, [data]);

  const pick = async (id) => {
    setProgramId(id);
    await onLoad({ programId: id });
  };

  return (
    <div className="row g-3">
      <div className="col-md-3">
        <div className="list-group">
          {(data?.programs || []).map((p) => (
            <button
              key={p.id}
              type="button"
              className={`list-group-item list-group-item-action ${String(p.id) === programId ? 'active' : ''}`}
              onClick={() => pick(String(p.id))}
            >
              {p.topic}
            </button>
          ))}
        </div>
      </div>
      <div className="col-md-9">
        {programId && (
          <ResearchForm
            form={form}
            setForm={setForm}
            attachFile={attachFile}
            setAttachFile={setAttachFile}
            busy={busy}
            onSubmit={async (e) => {
              e.preventDefault();
              const files = attachFile ? [await filePayload(attachFile, 'attachment')] : [];
              await onSave({ ...form, programId }, files);
            }}
          />
        )}
      </div>
    </div>
  );
}

export default WebResearchAddScreen;
