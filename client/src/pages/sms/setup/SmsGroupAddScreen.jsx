import { useState } from 'react';

export default function SmsGroupAddScreen({ busy, onSave }) {
  const [form, setForm] = useState({ groupTitle: '', groupMobile: '' });

  return (
    <form
      className="cis-setup-form"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave({
          group_title: form.groupTitle,
          group_mobile: form.groupMobile,
          Submit: 'Update',
        });
        setForm({ groupTitle: '', groupMobile: '' });
      }}
    >
      <div className="row g-3" style={{ maxWidth: 640 }}>
        <div className="col-12">
          <label className="form-label">Title</label>
          <input className="form-control" value={form.groupTitle} onChange={(e) => setForm({ ...form, groupTitle: e.target.value })} required />
        </div>
        <div className="col-12">
          <label className="form-label">Mobile No. (comma-separated, max 100)</label>
          <textarea className="form-control" rows={4} value={form.groupMobile} onChange={(e) => setForm({ ...form, groupMobile: e.target.value })} required />
        </div>
        <div className="col-12">
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </div>
      </div>
    </form>
  );
}
