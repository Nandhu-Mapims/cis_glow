import { useEffect, useMemo, useState } from 'react';
import CheckListSelect from '../../../components/CheckListSelect';

export default function AttReportSetup({ data, busy, onLoad, onSave }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [showEmpty, setShowEmpty] = useState(false);

  useEffect(() => {
    onLoad().then((d) => {
      if (d) {
        setFromDate(d.fromDate || '');
        setToDate(d.toDate || '');
      }
    });
  }, [onLoad]);

  const groupedOptions = useMemo(() => {
    const byGroup = new Map();
    for (const opt of data?.courseYearOptions || []) {
      if (!byGroup.has(opt.group)) byGroup.set(opt.group, []);
      byGroup.get(opt.group).push(opt);
    }
    return [...byGroup.entries()].map(([label, options]) => ({ label, options }));
  }, [data?.courseYearOptions]);

  const run = () => onSave({ fromDate, toDate, courseKeys: selectedKeys, showEmpty, load: true });

  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label">Category</label>
          <CheckListSelect
            groups={groupedOptions}
            value={selectedKeys}
            onChange={setSelectedKeys}
            searchPlaceholder="Search category..."
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">From</label>
          <input type="date" className="form-control" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="col-md-2">
          <label className="form-label">To</label>
          <input type="date" className="form-control" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <div className="col-md-2">
          <label className="form-label d-block">Show Empty</label>
          <label className="form-check-label">
            <input type="checkbox" className="form-check-input me-1" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} />
            Yes
          </label>
        </div>
        <div className="col-md-2 d-flex align-items-end">
          <button type="button" className="btn btn-primary" onClick={run} disabled={busy || !selectedKeys.length}>Go</button>
        </div>
      </div>

      {data?.generated && data.groups?.length === 0 && (
        <p className="text-muted">No students found for the selected category/date range.</p>
      )}

      {(data?.groups || []).map((group, gi) => (
        <div key={`${group.label}-${gi}`} className="mb-4">
          {(data.groups.length > 1) && <p className="mb-2"><strong>Course:</strong> {group.label}</p>}
          <div className="table-responsive">
            <table className="table table-bordered table-sm">
              <thead className="table-secondary">
                <tr>
                  <th>S.No</th>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  {(data.days || []).map((d) => (
                    <th key={d.date} style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 10, whiteSpace: 'nowrap' }}>
                      {d.label}
                    </th>
                  ))}
                  <th>Total Days</th>
                  <th>Punched Days</th>
                  <th>Time</th>
                  <th>Avg.</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.length === 0 ? (
                  <tr><td colSpan={7 + (data.days?.length || 0)} className="text-muted text-center py-3">No rows.</td></tr>
                ) : (
                  group.rows.map((row) => (
                    <tr key={row.registerNo}>
                      <td>{row.sn}</td>
                      <td>{row.registerNo}</td>
                      <td className="text-nowrap">{row.name}</td>
                      {row.perDay.map((v, i) => <td key={i} className="text-end"><small>{v}</small></td>)}
                      <td className="text-end">{row.totalDays}</td>
                      <td className="text-end">{row.punchedDays}</td>
                      <td className="text-end">{row.time}</td>
                      <td className="text-end">{row.avg}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
