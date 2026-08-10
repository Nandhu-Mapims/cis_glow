import { useEffect, useState } from 'react';

export default function BookCategorySetup({ data, busy, onLoad, onSave }) {
  const [rows, setRows] = useState([]);
  const [category, setCategory] = useState('');

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (!data) return;
    setCategory(data.selectedCategory || '');
    setRows((data.rows || []).map((r, i) => ({ ...r, key: r.id ? `id-${r.id}` : `new-${i}` })));
  }, [data]);

  const handleSave = async (e) => {
    e.preventDefault();
    await onSave({ category, rows });
  };

  const handleDelete = async (row) => {
    if (!row.id) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm('Delete this entry?')) return;
    await onSave({ category, action: 'delete', id: row.id });
  };

  return (
    <form onSubmit={handleSave}>
      <div className="mb-3">
        <label className="form-label">Category</label>
        <select
          className="form-select"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            onLoad({ category: e.target.value });
          }}
        >
          {(data?.categories || []).map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <div className="table-responsive">
        <table className="table table-bordered">
          <thead className="table-secondary">
            <tr>
              <th>Order</th>
              <th>Name</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.key}>
                <td>
                  <input
                    className="form-control"
                    value={row.order || ''}
                    onChange={(e) => setRows((p) => p.map((r, j) => (j === i ? { ...r, order: e.target.value } : r)))}
                  />
                </td>
                <td>
                  <input
                    className="form-control"
                    value={row.name || ''}
                    onChange={(e) => setRows((p) => p.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                  />
                </td>
                <td className="text-center">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    title="Delete"
                    disabled={!row.id || busy}
                    onClick={() => handleDelete(row)}
                  >
                    <i className="fa fa-trash" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="d-flex justify-content-between">
        <button
          type="button"
          className="btn btn-sm btn-info"
          onClick={() => setRows((p) => [...p, { key: `new-${Date.now()}`, order: p.length + 1, name: '' }])}
        >
          +
        </button>
        <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
      </div>
    </form>
  );
}
