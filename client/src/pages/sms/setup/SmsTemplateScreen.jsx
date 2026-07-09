import { useEffect, useState } from 'react';

export default function SmsTemplateScreen({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({ templateId: '', content: '', sample: '' });

  useEffect(() => { onLoad(); }, [onLoad]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(form);
    setForm({ templateId: '', content: '', sample: '' });
  };

  return (
    <div className="row g-4">
      <div className="col-lg-5">
        <form onSubmit={handleSubmit}>
          <div className="mb-2"><input className="form-control" placeholder="Title" value={form.sample} onChange={(e) => setForm({ ...form, sample: e.target.value })} required /></div>
          <div className="mb-2"><input className="form-control" placeholder="Template ID" value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })} required /></div>
          <div className="mb-2"><textarea className="form-control" rows={4} placeholder="Content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required /></div>
          <button type="submit" className="btn btn-primary" disabled={busy}>Add template</button>
        </form>
      </div>
      <div className="col-lg-7">
        <table className="table table-bordered table-sm">
          <thead><tr><th>ID</th><th>Title</th><th>Template</th><th /></tr></thead>
          <tbody>
            {(data?.templates || []).map((tpl) => (
              <tr key={tpl.id}>
                <td>{tpl.templateId}</td>
                <td>{tpl.sample}</td>
                <td>{tpl.content}</td>
                <td><button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => onSave({ action: 'delete', id: tpl.id })}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
