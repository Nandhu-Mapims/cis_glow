import { useEffect, useState } from 'react';

function formatDateInput(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

function formatDisplayDate(value) {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SmsHistoryScreen({ data, busy, onLoad, onSave }) {
  const [filters, setFilters] = useState({
    mobile: '',
    user_by: '',
    from_date: new Date().toISOString().slice(0, 10),
    to_date: '',
  });

  useEffect(() => { onLoad({ action: 'search', ...filters }); }, [onLoad]);

  useEffect(() => {
    if (!data?.filters) return;
    setFilters({
      mobile: data.filters.mobile || '',
      user_by: data.filters.userBy || '',
      from_date: formatDateInput(data.filters.fromDate) || filters.from_date,
      to_date: formatDateInput(data.filters.toDate) || '',
    });
  }, [data?.filters]);

  const search = async (e) => {
    e.preventDefault();
    await onSave({ action: 'search', Submit: 'Search', ...filters });
  };

  return (
    <div className="row g-4">
      <div className="col-lg-3">
        <form className="card card-body" onSubmit={search}>
          <h5 className="mb-3">Filter</h5>
          <div className="mb-2">
            <label className="form-label">Mobile No</label>
            <input className="form-control" value={filters.mobile} onChange={(e) => setFilters((f) => ({ ...f, mobile: e.target.value }))} />
          </div>
          <div className="mb-2">
            <label className="form-label">User</label>
            <select className="form-select" value={filters.user_by} onChange={(e) => setFilters((f) => ({ ...f, user_by: e.target.value }))}>
              <option value="">--Select--</option>
              {(data?.senders || []).map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="mb-2">
            <label className="form-label">From</label>
            <input type="date" className="form-control" value={filters.from_date} onChange={(e) => setFilters((f) => ({ ...f, from_date: e.target.value }))} />
          </div>
          <div className="mb-3">
            <label className="form-label">To</label>
            <input type="date" className="form-control" value={filters.to_date} onChange={(e) => setFilters((f) => ({ ...f, to_date: e.target.value }))} />
          </div>
          <button type="submit" className="btn btn-danger w-100" disabled={busy}>Search</button>
        </form>
      </div>

      <div className="col-lg-9">
        {(data?.rows || []).length === 0 ? (
          <p className="text-danger">No data found...</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-bordered table-sm">
              <thead className="table-light">
                <tr>
                  <th>S.No.</th>
                  <th>Date</th>
                  <th>Purpose</th>
                  <th>Mobile Number</th>
                  <th>Count</th>
                  <th>Sample Message</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.sno}</td>
                    <td>{formatDisplayDate(row.sentAt)}</td>
                    <td>{row.messageType}</td>
                    <td>{row.mobiles}</td>
                    <td>{row.messageCount}</td>
                    <td style={{ whiteSpace: 'pre-wrap' }}>{row.sampleMessage}</td>
                    <td>{row.createdByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
