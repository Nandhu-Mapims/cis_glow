import { useEffect } from 'react';

export default function DashboardSetup({ data, busy, onLoad, onSave }) {
  useEffect(() => { onLoad(); }, [onLoad]);
  const stats = data?.stats || {};
  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-md-3"><label className="form-label">Date</label>
          <input type="date" className="form-control" value={data?.date || ''} onChange={(e) => onLoad({ date: e.target.value })} />
        </div>
      </div>
      <div className="row g-3">
        {Object.entries(stats).map(([k, v]) => (
          <div key={k} className="col-md-3"><div className="card"><div className="card-body text-center"><div className="h4 mb-0">{v}</div><div className="text-muted small">{k}</div></div></div></div>
        ))}
      </div>
      {data?.departmentCounts?.length ? (
        <div className="mt-4"><h5>By Department</h5>
          <div className="row g-2">{data.departmentCounts.map((d) => (
            <div key={d.id} className="col-md-2"><div className="border rounded p-2 text-center"><strong>{d.count}</strong><div className="small">{d.name}</div></div></div>
          ))}</div></div>
      ) : null}
      {data?.recent?.length ? (
        <div className="mt-4 table-responsive"><table className="table table-sm table-bordered"><thead><tr><th>Title</th><th>Date</th><th>Status</th></tr></thead><tbody>
          {data.recent.map((r) => <tr key={r.id}><td>{r.title}</td><td>{r.date}</td><td>{r.status}</td></tr>)}
        </tbody></table></div>
      ) : null}
    </>
  );
}
