import { useEffect, useState } from 'react';

export default function SmsTemplateEditScreen({ data, busy, onLoad, onSave }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (data?.search != null) setSearch(data.search);
    if (data?.editing) setEditing(data.editing);
    else if (!data?.editing) setEditing(null);
  }, [data]);

  const reload = (extra = {}) => onLoad({ search, page: data?.page || 1, ...extra });

  if (editing) {
    return (
      <form
        className="cis-setup-form"
        onSubmit={async (e) => {
          e.preventDefault();
          await onSave({
            edit_row_id: String(editing.id),
            template_id: editing.templateId,
            template_content: editing.content,
            template_sample: editing.sample,
            search,
            page: data?.page || 1,
            Submit: 'Save',
          });
          setEditing(null);
        }}
      >
        <div className="row g-3" style={{ maxWidth: 640 }}>
          <div className="col-12">
            <label className="form-label">Title</label>
            <input className="form-control" value={editing.sample} onChange={(e) => setEditing({ ...editing, sample: e.target.value })} required />
          </div>
          <div className="col-12">
            <label className="form-label">Template ID</label>
            <input className="form-control" value={editing.templateId} onChange={(e) => setEditing({ ...editing, templateId: e.target.value })} required />
          </div>
          <div className="col-12">
            <label className="form-label">Template Content</label>
            <textarea className="form-control" rows={5} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} required />
          </div>
          <div className="col-12 d-flex gap-2">
            <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div>
      <form
        className="row g-2 mb-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await reload({ search });
        }}
      >
        <div className="col-md-6">
          <input className="form-control" placeholder="Search templates..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="col-md-2">
          <button type="submit" className="btn btn-info" disabled={busy}>Search</button>
        </div>
        <div className="col-md-4 text-muted small align-self-center">
          {data?.total != null ? `Showing page ${data.page} of ${data.totalPages} (${data.total} total)` : null}
        </div>
      </form>

      <table className="table table-hover table-bordered">
        <thead>
          <tr>
            <th>Template ID</th>
            <th>Template</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {(data?.templates || []).length === 0 ? (
            <tr><td colSpan={3}>No data available</td></tr>
          ) : (
            data.templates.map((tpl) => (
              <tr key={tpl.id}>
                <td>{tpl.templateId}</td>
                <td>{tpl.sample} : {tpl.content}</td>
                <td className="text-nowrap">
                  <button
                    type="button"
                    className="btn btn-sm btn-primary me-1"
                    disabled={busy}
                    onClick={() => reload({ editId: tpl.id })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    disabled={busy}
                    onClick={() => onSave({
                      action: 'delete',
                      delete: 'Confirm',
                      confirm: String(tpl.id),
                      search,
                      page: data?.page || 1,
                    })}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {data?.totalPages > 1 && (
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy || data.page <= 1} onClick={() => reload({ page: data.page - 1 })}>
            Previous
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy || data.page >= data.totalPages} onClick={() => reload({ page: data.page + 1 })}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
