import { useEffect, useState } from 'react';

export default function TransportFeeConfigSetup({ data, busy, onLoad, onSave }) {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => { onLoad({ page: 1 }); }, [onLoad]);
  useEffect(() => {
    if (!data) return;
    if (data.page) setPage(data.page);
    if (data.rows) setRows(data.rows);
  }, [data]);

  const loadPage = (nextPage) => {
    setPage(nextPage);
    onLoad({ page: nextPage });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ page, rows });
      }}
    >
      <div className="table-responsive">
        <table className="table table-bordered">
          <thead className="table-secondary">
            <tr><th>SNo.</th><th>Route</th><th>Stopping Name</th><th>Amount</th></tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.stopId}>
                <td>{((page - 1) * (data?.pageSize || 60)) + index + 1}</td>
                <td>{row.route}</td>
                <td>{row.stopName}</td>
                <td>
                  <input
                    className="form-control text-end"
                    value={row.amount || ''}
                    onChange={(e) => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, amount: e.target.value } : r)))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data?.totalPages > 1 ? (
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span className="text-muted small">Page {page} of {data.totalPages} ({data.total} stops)</span>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy || page <= 1} onClick={() => loadPage(page - 1)}>Previous</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy || page >= data.totalPages} onClick={() => loadPage(page + 1)}>Next</button>
          </div>
        </div>
      ) : null}
      <button type="submit" className="btn btn-danger" disabled={busy}>Update</button>
    </form>
  );
}
