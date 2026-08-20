import { useEffect, useState } from 'react';

function groupOptions(options) {
  const groups = new Map();
  for (const opt of options || []) {
    if (!groups.has(opt.group)) groups.set(opt.group, []);
    groups.get(opt.group).push(opt);
  }
  return [...groups.entries()];
}

export default function StudentHostelSetup({ data, busy, onLoad, onSave }) {
  const [registerNo, setRegisterNo] = useState('');
  const [searchBy, setSearchBy] = useState('roll_no');
  const [searchInput, setSearchInput] = useState('');
  const [searchCourse, setSearchCourse] = useState('');
  const [searchYear, setSearchYear] = useState('');
  const [stays, setStays] = useState([]);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.stays) setStays(data.stays); }, [data]);

  const loadByRegisterNo = (reg) => {
    setRegisterNo(reg);
    onLoad({ registerNo: reg });
  };

  const runSearch = () => {
    setRegisterNo('');
    if (searchBy === 'roll_no') onLoad({ searchBy, searchInput, registerNo: '' });
    else if (searchBy === 'batch') onLoad({ searchBy, searchCourse, registerNo: '' });
    else if (searchBy === 'year') onLoad({ searchBy, searchYear, registerNo: '' });
  };

  const batchGroups = groupOptions(data?.batchOptions);
  const yearGroups = groupOptions(data?.yearOptions);

  return (
    <>
      <div className="row g-2 mb-3">
        <div className="col-md-3">
          <label className="form-label d-block">Search By</label>
          <label className="me-2"><input type="radio" name="searchBy" checked={searchBy === 'roll_no'} onChange={() => setSearchBy('roll_no')} /> R.No</label>
          <label className="me-2"><input type="radio" name="searchBy" checked={searchBy === 'year'} onChange={() => setSearchBy('year')} /> Year</label>
          <label><input type="radio" name="searchBy" checked={searchBy === 'batch'} onChange={() => setSearchBy('batch')} /> Batch</label>
        </div>
        {searchBy === 'roll_no' && (
          <>
            <div className="col-md-4"><input className="form-control" placeholder="Roll No. separated by ," value={searchInput} onChange={(e) => setSearchInput(e.target.value)} /></div>
            <div className="col-md-2"><button type="button" className="btn btn-primary" onClick={runSearch} disabled={busy}>Go</button></div>
          </>
        )}
        {searchBy === 'batch' && (
          <div className="col-md-6">
            <select className="form-select" value={searchCourse} onChange={(e) => { setSearchCourse(e.target.value); onLoad({ searchBy: 'batch', searchCourse: e.target.value, registerNo: '' }); }}>
              <option value="">--Select--</option>
              {batchGroups.map(([group, opts]) => (
                <optgroup key={group} label={group}>
                  {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        )}
        {searchBy === 'year' && (
          <div className="col-md-6">
            <select className="form-select" value={searchYear} onChange={(e) => { setSearchYear(e.target.value); onLoad({ searchBy: 'year', searchYear: e.target.value, registerNo: '' }); }}>
              <option value="">--Select--</option>
              {yearGroups.map(([group, opts]) => (
                <optgroup key={group} label={group}>
                  {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        )}
      </div>

      {data?.matches?.length ? (
        <div className="table-responsive mb-3">
          <table className="table table-bordered table-sm">
            <thead className="table-secondary"><tr><th>Register No</th><th>Name</th><th></th></tr></thead>
            <tbody>
              {data.matches.map((m) => (
                <tr key={m.id}>
                  <td>{m.registerNo}</td>
                  <td>{m.name}</td>
                  <td><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => loadByRegisterNo(m.registerNo)}>Select</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {data?.student ? (
        <form onSubmit={(e) => { e.preventDefault(); onSave({ studentId: data.student.id, registerNo: data.student.registerNo, stays, smsMobile: data.student.smsMobile }); }}>
          <p><strong>{data.student.name}</strong> ({data.student.registerNo})</p>
          {stays.map((s, i) => (
            <div key={s.id || i} className="row g-2 mb-2 border-bottom pb-2">
              <div className="col-md-2"><input className="form-control" placeholder="Block" value={s.blockNo || ''} onChange={(e) => setStays((p) => p.map((r, j) => j===i ? {...r, blockNo: e.target.value} : r))} /></div>
              <div className="col-md-2"><input className="form-control" placeholder="Room" value={s.roomNo || ''} onChange={(e) => setStays((p) => p.map((r, j) => j===i ? {...r, roomNo: e.target.value} : r))} /></div>
              <div className="col-md-2"><input type="date" className="form-control" value={s.fromMonth || ''} max={s.toMonth || undefined} onChange={(e) => setStays((p) => p.map((r, j) => j===i ? {...r, fromMonth: e.target.value} : r))} /></div>
              <div className="col-md-2"><input type="date" className="form-control" value={s.toMonth || ''} min={s.fromMonth || undefined} onChange={(e) => setStays((p) => p.map((r, j) => j===i ? {...r, toMonth: e.target.value} : r))} /></div>
            </div>
          ))}
          <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
        </form>
      ) : null}
    </>
  );
}
