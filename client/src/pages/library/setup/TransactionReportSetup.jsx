import { useEffect, useState } from 'react';

export default function TransactionReportSetup({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({ fromDate: '', toDate: '', issueReturn: '', registerNo: '', isDamaged: '' });
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data) setForm((p) => ({ ...p, fromDate: data.fromDate || p.fromDate, toDate: data.toDate || p.toDate, issueReturn: data.issueReturn || '', registerNo: data.registerNo || '', isDamaged: data.isDamaged ?? '' })); }, [data]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, search: true }); }} className="row g-2 mb-3">
        <div className="col-md-2"><input type="date" className="form-control" value={form.fromDate} onChange={(e) => set('fromDate', e.target.value)} /></div>
        <div className="col-md-2"><input type="date" className="form-control" value={form.toDate} onChange={(e) => set('toDate', e.target.value)} /></div>
        <div className="col-md-2">
          <select className="form-select" value={form.issueReturn} onChange={(e) => set('issueReturn', e.target.value)}>
            <option value="">Issued & Return</option>
            <option value="Issued">Issued</option>
            <option value="Return">Return</option>
            <option value="Due">Due</option>
          </select>
        </div>
        <div className="col-md-2"><input className="form-control" placeholder="Register/Staff ID" value={form.registerNo} onChange={(e) => set('registerNo', e.target.value)} /></div>
        <div className="col-md-2">
          <select className="form-select" value={form.isDamaged} onChange={(e) => set('isDamaged', e.target.value)}>
            <option value="">Damage: All</option>
            <option value="1">Damaged</option>
            <option value="0">Not damaged</option>
          </select>
        </div>
        <div className="col-md-2"><button type="submit" className="btn btn-danger" disabled={busy}>Search</button></div>
      </form>
      <div className="table-responsive">
        <table className="table table-bordered table-sm">
          <thead><tr><th>Register</th><th>Book</th><th>Checkout</th><th>Due</th><th>Return</th><th>Title</th><th>Author</th><th>Dmg</th></tr></thead>
          <tbody>
            {data?.rows?.map((row, i) => (
              <tr key={i}><td>{row.registerNo}</td><td>{row.bookId}</td><td>{row.checkOutDate}</td><td>{row.dueDate}</td><td>{row.checkInDate}</td><td>{row.resourceName}</td><td>{row.authorName}</td><td>{row.isDamage ? 'Yes' : ''}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
