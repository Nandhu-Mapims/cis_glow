import { useEffect, useState } from 'react';

export default function AttendanceReportSetup({ data, busy, onLoad }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [ticketNo, setTicketNo] = useState('');

  useEffect(() => {
    if (!data) return;
    if (data.fromDate) setFromDate(data.fromDate);
    if (data.toDate) setToDate(data.toDate);
    if (data.ticketNo !== undefined) setTicketNo(data.ticketNo);
  }, [data]);

  const run = () => onLoad({ fromDate, toDate, ticketNo, search: true });

  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-md-3">
          <label className="form-label">From</label>
          <input type="date" className="form-control" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="col-md-3">
          <label className="form-label">To</label>
          <input type="date" className="form-control" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <div className="col-md-3">
          <label className="form-label">Register / Ticket No</label>
          <input className="form-control" value={ticketNo} onChange={(e) => setTicketNo(e.target.value)} />
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
            <tr><th>Register No</th><th>Student</th><th>Date</th><th>Time</th><th>In/Out</th></tr>
          </thead>
          <tbody>
            {(data?.rows || []).map((row, i) => (
              <tr key={i}>
                <td>{row.registerNo || row.ticketNo}</td>
                <td>{row.studentName}</td>
                <td>{row.date}</td>
                <td>{row.time}</td>
                <td>{row.inOut}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
