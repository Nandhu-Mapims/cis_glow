import { useState } from 'react';

export default function SmsTemplateAddScreen({ busy, onSave }) {
  const [form, setForm] = useState({ templateId: '', content: '', sample: '' });

  return (
    <form
      className="cis-setup-form"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave(form);
        setForm({ templateId: '', content: '', sample: '' });
      }}
    >
      <div className="row g-3" style={{ maxWidth: 640 }}>
        <div className="col-12">
          <label className="form-label">Title</label>
          <input className="form-control" value={form.sample} onChange={(e) => setForm({ ...form, sample: e.target.value })} required />
        </div>
        <div className="col-12">
          <label className="form-label">Template ID</label>
          <input className="form-control" value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })} required />
        </div>
        <div className="col-12">
          <label className="form-label">Template Content</label>
          <textarea className="form-control" rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required />
        </div>
        <div className="col-12">
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </div>
      </div>
    </form>
  );
}
