import { useEffect, useState } from 'react';

export default function AttendanceReportSetup({ data, busy, onLoad }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    if (!data) return;
    if (data.fromDate) setFromDate(data.fromDate);
    if (data.toDate) setToDate(data.toDate);
  }, [data]);

  const run = () => onLoad({ fromDate, toDate, search: true });

  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-md-3">
          <label className="form-label">From</label>
          <input type="date" className="form-control" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="col-md-3">
          <label className="form-label">To</label>
          <input type="date" className="form-control" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <div className="col-md-2 d-flex align-items-end">
          <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>
            {busy ? 'Loading…' : 'Load'}
          </button>
        </div>
      </div>
      <div className="table-responsive">
        <table className="table table-bordered table-sm">
          <thead className="table-secondary">
            <tr>
              {(data?.rows?.[0] ? Object.keys(data.rows[0]) : ['ticketNo', 'date', 'time', 'inOut']).map((k) => (
                <th key={k}>{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.rows || []).map((row, i) => (
              <tr key={row.id || i}>
                {Object.values(row).map((v, j) => <td key={j}>{String(v ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
