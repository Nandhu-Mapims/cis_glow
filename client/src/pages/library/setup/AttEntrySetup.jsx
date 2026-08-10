import { useEffect, useState } from 'react';

const blankRow = (sn) => ({ sn, regNo: '', inTime: '', inId: '', outTime: '', outId: '' });

export default function AttEntrySetup({ busy, onLoad, onSave }) {
  const [attDate, setAttDate] = useState('');
  const [rows, setRows] = useState([blankRow(1)]);

  useEffect(() => {
    onLoad().then((d) => {
      if (d) {
        setAttDate(d.attDate || '');
        setRows(d.rows?.length ? d.rows : [blankRow(1)]);
      }
    });
  }, [onLoad]);

  const changeDate = (value) => {
    setAttDate(value);
    onLoad({ attDate: value }).then((d) => {
      if (d) setRows(d.rows?.length ? d.rows : [blankRow(1)]);
    });
  };

  const setRow = (i, key, value) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  const addRow = () => setRows((prev) => [...prev, blankRow(prev.length + 1)]);
  const removeRow = () => setRows((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));

  const submit = (e) => {
    e.preventDefault();
    onSave({ attDate, rows }).then((res) => {
      if (res?.rows) setRows(res.rows.length ? res.rows : [blankRow(1)]);
    });
  };

  return (
    <form onSubmit={submit}>
      <div className="row g-3 mb-3">
        <div className="col-md-3">
          <label className="form-label">Date <span className="text-danger">*</span></label>
          <input type="date" className="form-control" value={attDate} onChange={(e) => changeDate(e.target.value)} />
        </div>
      </div>
      <div className="table-responsive">
        <table className="table table-bordered table-sm" id="mySampleTable">
          <thead className="table-secondary">
            <tr><th>SNo.</th><th>Reg No. / Emp ID</th><th>In Time (24:00 Hrs)</th><th>Out Time (24:00 Hrs)</th></tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><input className="form-control" value={row.regNo} maxLength={10} onChange={(e) => setRow(i, 'regNo', e.target.value)} /></td>
                <td><input className="form-control" placeholder="HH:MM" value={row.inTime} maxLength={5} onChange={(e) => setRow(i, 'inTime', e.target.value)} /></td>
                <td><input className="form-control" placeholder="HH:MM" value={row.outTime} maxLength={5} onChange={(e) => setRow(i, 'outTime', e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mb-3 text-end">
        <button type="button" className="btn btn-sm btn-info me-2" onClick={addRow}>+</button>
        <button type="button" className="btn btn-sm btn-info" onClick={removeRow}>-</button>
      </div>
      <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
    </form>
  );
}
