import { useEffect, useState } from 'react';

export default function AttReportSetup({ data, busy, onLoad, onSave }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  useEffect(() => { onLoad().then((d) => { if (d) { setFromDate(d.fromDate || ''); setToDate(d.toDate || ''); } }); }, [onLoad]);
  const run = () => onLoad({ fromDate, toDate, ...(data?.status !== undefined ? { status: data.status } : {}), ...(data?.source ? { source: data.source } : {}) });
  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-md-3"><label className="form-label">From</label><input type="date" className="form-control" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} /></div>
        <div className="col-md-3"><label className="form-label">To</label><input type="date" className="form-control" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} /></div>
        <div className="col-md-2 d-flex align-items-end"><button type="button" className="btn btn-primary" onClick={run} disabled={busy}>Load</button></div>
      </div>
      <div className="table-responsive"><table className="table table-bordered table-sm"><thead className="table-secondary"><tr>
        {(data?.rows?.[0] ? Object.keys(data.rows[0]) : ['id']).map((k) => <th key={k}>{k}</th>)}
      </tr></thead><tbody>
        {(data?.rows || []).map((row, i) => <tr key={row.id || i}>{Object.values(row).map((v, j) => <td key={j}>{String(v ?? '')}</td>)}</tr>)}
      </tbody></table></div>
    </>
  );
}
