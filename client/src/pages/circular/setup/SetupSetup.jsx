import { useEffect, useState } from 'react';

export default function SetupSetup({ data, busy, onLoad, onSave }) {
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
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="table-responsive">
        <table className="table table-bordered">
          <thead className="table-secondary">
            <tr>
              <th>Order</th>
              <th>Name</th>
              <th>Mobile</th>
              <th>Attachment</th>
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
                <td>
                  <input
                    className="form-control"
                    value={row.mobileNo || ''}
                    onChange={(e) => setRows((p) => p.map((r, j) => (j === i ? { ...r, mobileNo: e.target.value } : r)))}
                  />
                </td>
                <td>
                  <input
                    className="form-control"
                    value={row.attach || ''}
                    onChange={(e) => setRows((p) => p.map((r, j) => (j === i ? { ...r, attach: e.target.value } : r)))}
                  />
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
          onClick={() => setRows((p) => [...p, { key: `new-${Date.now()}`, order: p.length + 1, name: '', mobileNo: '', attach: '' }])}
        >
          +
        </button>
        <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
      </div>
    </form>
  );
}
