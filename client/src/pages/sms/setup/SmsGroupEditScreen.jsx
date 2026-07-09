import { useEffect, useState } from 'react';

export default function SmsGroupEditScreen({ data, busy, onLoad, onSave }) {
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
            group_title: editing.groupTitle,
            group_mobile: editing.groupMobile,
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
            <input className="form-control" value={editing.groupTitle} onChange={(e) => setEditing({ ...editing, groupTitle: e.target.value })} required />
          </div>
          <div className="col-12">
            <label className="form-label">Mobile No.</label>
            <textarea className="form-control" rows={4} value={editing.groupMobile} onChange={(e) => setEditing({ ...editing, groupMobile: e.target.value })} required />
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
          <input className="form-control" placeholder="Search groups..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="col-md-2">
          <button type="submit" className="btn btn-info" disabled={busy}>Search</button>
        </div>
      </form>

      <div className="table-responsive">
        <table className="table table-hover table-bordered">
          <thead>
            <tr>
              <th>Title</th>
              <th>Mobiles</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data?.groups || []).length === 0 ? (
              <tr><td colSpan={3}>No data available</td></tr>
            ) : (
              data.groups.map((group) => (
                <tr key={group.id}>
                  <td className="text-nowrap">{group.groupTitle}</td>
                  <td style={{ whiteSpace: 'pre-wrap' }}>{group.groupMobile}</td>
                  <td className="text-nowrap">
                    <button type="button" className="btn btn-sm btn-primary me-1" disabled={busy} onClick={() => reload({ editId: group.id })}>Edit</button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      disabled={busy}
                      onClick={() => onSave({
                        action: 'delete',
                        delete: 'Confirm',
                        confirm: String(group.id),
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
      </div>
    </div>
  );
}
