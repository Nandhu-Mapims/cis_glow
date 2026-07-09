import { useState } from 'react';

export default function AttTimeSetup({ data, busy, onLoad, onSave }) {
  const [staffId, setStaffId] = useState(data?.staffId || '');
  const staff = data?.staff;

  return (
    <div>
      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label">Staff ID</label>
          <div className="input-group">
            <input className="form-control" value={staffId} onChange={(e) => setStaffId(e.target.value)} />
            <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => onLoad({ staff_id: staffId })}>Load</button>
          </div>
        </div>
      </div>
      {staff && (
        <>
          <p><strong>{staff.staff_name}</strong> — att category: {staff.att_category}</p>
          <div className="table-responsive mb-3">
            <table className="table table-bordered table-sm">
              <thead><tr><th>Group</th><th>From</th><th>To</th><th>Days</th><th>Time</th></tr></thead>
              <tbody>
                {(data?.schedules || []).map((s) => (
                  <tr key={s.id}><td>{s.att_group}</td><td>{s.from_date}</td><td>{s.to_date}</td><td>{s.days}</td><td>{String(s.from_time).slice(0, 5)} - {String(s.to_time).slice(0, 5)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => onSave({
            staff_id: staffId,
            staff_row_id: staff.id,
            schedule: { att_group: 'Default', from_date: new Date().toISOString().slice(0, 10), to_date: '2099-12-31', days: 'Mon,Tue,Wed,Thu,Fri', from_time: '09:00', to_time: '17:00' },
          })}>Add Default Schedule</button>
        </>
      )}
    </div>
  );
}
