import { useEffect } from 'react';

export default function AttendanceSetup({ data, busy, onLoad, onSave }) {
  useEffect(() => { onLoad(); }, [onLoad]);
  return (
    <>
      <div className="mb-3"><input type="date" className="form-control w-auto d-inline-block" value={data?.date || ''} onChange={(e) => onLoad({ date: e.target.value })} />
        <span className="ms-3">Visitors: <strong>{data?.totalVisitors}</strong> | Punches: <strong>{data?.totalPunches}</strong></span></div>
      <div className="table-responsive"><table className="table table-sm table-bordered"><thead><tr><th>Ticket</th><th>Time</th><th>IN/OUT</th></tr></thead><tbody>
        {(data?.rows || []).map((r, i) => <tr key={i}><td>{r.ticketNo}</td><td>{r.time}</td><td>{r.inOut}</td></tr>)}
      </tbody></table></div>
    </>
  );
}
