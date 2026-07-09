import { useEffect, useState } from 'react';

const COLUMNS = [
  { key: 'sn', label: 'S.No' },
  { key: 'date', label: 'Date' },
  { key: 'issued', label: 'Issued' },
  { key: 'returned', label: 'Return' },
  { key: 'due', label: 'Due' },
  { key: 'ugIn', label: 'U.G In' },
  { key: 'ugOut', label: 'U.G Out' },
  { key: 'pgIn', label: 'P.G In' },
  { key: 'pgOut', label: 'P.G Out' },
  { key: 'staffIn', label: 'Staff In' },
  { key: 'staffOut', label: 'Staff Out' },
];

export default function EntryReportSetup({ data, busy, onLoad }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    onLoad().then((d) => {
      if (d) {
        setFromDate(d.fromDate || '');
        setToDate(d.toDate || '');
      }
    });
  }, [onLoad]);

  const run = () => onLoad({ fromDate, toDate, load: true });

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
          <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>Load</button>
        </div>
      </div>

      {data?.summary && (
        <p className="text-muted small">
          Total issued: {data.summary.issued} · Total returned: {data.summary.returned} · Days: {data.rowCount || 0}
        </p>
      )}

      <div className="table-responsive">
        <table className="table table-bordered table-sm">
          <thead className="table-secondary">
            <tr>
              {COLUMNS.map((col) => <th key={col.key}>{col.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {(data?.rows || []).length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="text-muted text-center py-3">
                  {busy ? 'Loading…' : 'No summary rows for the selected date range.'}
                </td>
              </tr>
            ) : (
              (data?.rows || []).map((row) => (
                <tr key={`${row.sn}-${row.date}`}>
                  {COLUMNS.map((col) => (
                    <td key={col.key} className={col.key === 'sn' || col.key === 'date' ? '' : 'text-end'}>
                      {row[col.key] ?? ''}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
