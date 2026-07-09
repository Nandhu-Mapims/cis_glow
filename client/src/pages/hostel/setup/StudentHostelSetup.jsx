import { useEffect, useState } from 'react';

export default function StudentHostelSetup({ data, busy, onLoad, onSave }) {
  const [registerNo, setRegisterNo] = useState('');
  const [stays, setStays] = useState([]);
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.stays) setStays(data.stays); }, [data]);
  return (
    <>
      <div className="row g-2 mb-3"><div className="col-md-4"><input className="form-control" placeholder="Register no" value={registerNo} onChange={(e) => setRegisterNo(e.target.value)} /></div>
        <div className="col-md-2"><button type="button" className="btn btn-primary" onClick={() => onLoad({ registerNo })} disabled={busy}>Load</button></div></div>
      {data?.student ? (
        <form onSubmit={(e) => { e.preventDefault(); onSave({ studentId: data.student.id, registerNo, stays, smsMobile: data.student.smsMobile }); }}>
          <p><strong>{data.student.name}</strong> ({data.student.registerNo})</p>
          {stays.map((s, i) => (
            <div key={s.id || i} className="row g-2 mb-2 border-bottom pb-2">
              <div className="col-md-2"><input className="form-control" placeholder="Block" value={s.blockNo || ''} onChange={(e) => setStays((p) => p.map((r, j) => j===i ? {...r, blockNo: e.target.value} : r))} /></div>
              <div className="col-md-2"><input className="form-control" placeholder="Room" value={s.roomNo || ''} onChange={(e) => setStays((p) => p.map((r, j) => j===i ? {...r, roomNo: e.target.value} : r))} /></div>
              <div className="col-md-2"><input type="date" className="form-control" value={s.fromMonth || ''} onChange={(e) => setStays((p) => p.map((r, j) => j===i ? {...r, fromMonth: e.target.value} : r))} /></div>
              <div className="col-md-2"><input type="date" className="form-control" value={s.toMonth || ''} onChange={(e) => setStays((p) => p.map((r, j) => j===i ? {...r, toMonth: e.target.value} : r))} /></div>
            </div>
          ))}
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </form>
      ) : null}
    </>
  );
}
