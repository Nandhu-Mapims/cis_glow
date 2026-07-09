import { useEffect, useState } from 'react';

export default function TransactionIssueSetup({ data, busy, onLoad, onSave }) {
  const [registerNo, setRegisterNo] = useState('');
  const [bookId, setBookId] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => { onLoad(); }, [onLoad]);

  useEffect(() => {
    if (data?.registerNo !== undefined) setRegisterNo(data.registerNo || '');
    if (data?.dueDate !== undefined) setDueDate(data.dueDate || '');
  }, [data?.registerNo, data?.dueDate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ registerNo, bookId, checkOutDate: data?.checkOutDate, dueDate });
  };

  return (
    <form onSubmit={handleSubmit} className="row g-3">
      <div className="col-md-4"><label className="form-label">Register / Staff ID</label><input className="form-control" value={registerNo} onChange={(e) => setRegisterNo(e.target.value.toUpperCase())} onBlur={() => onLoad({ registerNo })} /></div>
      {data?.member ? <div className="col-md-4 align-self-end text-success">{data.member.name}</div> : null}
      <div className="col-md-4"><label className="form-label">Book / Accession ID</label><input className="form-control" value={bookId} onChange={(e) => setBookId(e.target.value)} /></div>
      <div className="col-md-3"><label className="form-label">Due Date</label><input type="date" className="form-control" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
      <div className="col-12"><button type="submit" className="btn btn-danger" disabled={busy}>Issue</button></div>
    </form>
  );
}
