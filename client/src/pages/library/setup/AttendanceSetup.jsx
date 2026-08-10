import { useEffect, useState } from 'react';

export default function AttendanceSetup({ data, busy, onLoad, onSave }) {
  const [staffId, setStaffId] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => { onLoad(); }, [onLoad]);

  const lookup = async () => {
    const id = staffId.trim();
    if (!id) return;
    const res = await onSave({ staffId: id });
    setStaffId('');
    if (res?.success) setResult(res);
    else setResult({ error: res?.message || `Invalid ID: ${id}` });
  };

  const clear = () => {
    setResult(null);
    setStaffId('');
  };

  return (
    <div className="row g-3">
      <div className="col-lg-8">
        <section className="panel mb-0">
          <header className="panel-heading">Attendance</header>
          <div className="panel-body">
            <div className="mb-3">
              <label className="form-label">Student/Staff ID <span className="text-danger">*</span></label>
              <input
                className="form-control form-control-lg"
                autoFocus
                maxLength={10}
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookup(); } }}
                onBlur={lookup}
                placeholder="ID, then Tab/Enter"
              />
            </div>
            <dl className="row mb-3">
              <dt className="col-sm-3">Name</dt><dd className="col-sm-9">{result?.name || ''}</dd>
              <dt className="col-sm-3">Designation</dt><dd className="col-sm-9">{result?.designation || ''}</dd>
              <dt className="col-sm-3">Time</dt><dd className="col-sm-9">{result?.time || ''}</dd>
              <dt className="col-sm-3">In/Out</dt><dd className="col-sm-9">{result?.inOut || ''}</dd>
            </dl>
            {result?.error && <p className="text-danger">{result.error}</p>}
            <button type="button" className="btn btn-sm btn-danger" onClick={clear} disabled={busy}>Clear</button>
          </div>
        </section>
      </div>
      <div className="col-lg-4">
        <section className="panel mb-0">
          <div className="panel-body text-center">
            {result?.photoUrl ? (
              <img src={result.photoUrl} alt="" height="140" width="160" />
            ) : (
              <p className="text-muted small mb-0">
                {data?.liveAttPhoto === 1
                  ? 'Webcam capture requires the kiosk device; this screen only replays the ID lookup + In/Out logic.'
                  : 'Live photo capture is disabled in Library settings (live_att_photo=0).'}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
