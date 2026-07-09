export default function CourierReportSetup({ data, busy, onLoad }) {
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
      <div className="table-responsive">
        <table className="table table-sm table-bordered">
          <thead>
            <tr><th>Date</th><th>In/Out</th><th>Dept</th><th>From</th><th>To</th><th>Type</th><th>Item</th><th>Qty</th><th>Receiver</th></tr>
          </thead>
          <tbody>
            {data.rows?.map((r) => (
              <tr key={r.id}>
                <td>{r.date}</td><td>{r.inout}</td><td>{r.department}</td><td>{r.fromName}</td><td>{r.toName}</td>
                <td>{r.type}</td><td>{r.itemName}</td><td>{r.quantity}</td><td>{r.receiver}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
