export default function IncidentReportSetup({ data, busy, onLoad }) {
  if (!data) return null;
  return (
    <div>
      <form className="row g-2 mb-3" onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onLoad({ fromDate: fd.get('fromDate'), toDate: fd.get('toDate'), search: fd.get('search') });
      }}>
        <div className="col-md-3"><input type="date" name="fromDate" className="form-control" defaultValue={data.fromDate} /></div>
        <div className="col-md-3"><input type="date" name="toDate" className="form-control" defaultValue={data.toDate} /></div>
        <div className="col-md-4"><input name="search" className="form-control" placeholder="Search" defaultValue={data.search || ''} /></div>
        <div className="col-md-2"><button type="submit" className="btn btn-primary w-100" disabled={busy}>Show</button></div>
      </form>
      <table className="table table-sm table-bordered">
        <thead><tr><th>Date</th><th>Dept</th><th>Title</th><th>Location</th><th>First Aid</th><th>Details</th></tr></thead>
        <tbody>
          {data.rows?.map((r) => (
            <tr key={r.id}>
              <td>{r.date}</td><td>{r.department}</td><td>{r.title}</td><td>{r.location}</td><td>{r.firstAidBy}</td><td>{r.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
