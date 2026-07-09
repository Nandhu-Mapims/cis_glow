import { useEffect, useState } from 'react';

export default function AttEntrySetup({ data, busy, onLoad, onSave }) {
  const [staffId, setStaffId] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [entryTime, setEntryTime] = useState('');
  const [inOut, setInOut] = useState('IN');
  useEffect(() => { onLoad().then((d) => { if (d) { setEntryDate(d.entryDate || ''); setEntryTime(d.entryTime || ''); } }); }, [onLoad]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ staffId, entryDate, entryTime, inOut }); }} className="row g-3">
      <div className="col-md-4"><label className="form-label">Staff ID</label><input className="form-control" value={staffId} onChange={(e) => setStaffId(e.target.value)} /></div>
      <div className="col-md-3"><label className="form-label">Date</label><input type="date" className="form-control" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} /></div>
      <div className="col-md-2"><label className="form-label">Time</label><input type="time" className="form-control" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} /></div>
      <div className="col-md-2"><label className="form-label">IN/OUT</label><select className="form-select" value={inOut} onChange={(e) => setInOut(e.target.value)}><option>IN</option><option>OUT</option></select></div>
      <div className="col-12"><button type="submit" className="btn btn-danger" disabled={busy}>Save</button></div>
    </form>
  );
}
