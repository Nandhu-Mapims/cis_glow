import { useEffect, useRef, useState } from 'react';
import { printAaadarCertificate, printInternshipCertificate } from '../../../utils/printReport.js';

export { default as ApproveScreen } from './ApproveScreen';

function Alert({ data }) {
  if (!data?.message) return null;
  const ok = data?.success !== false;
  return <div className={`alert ${ok ? 'alert-success' : 'alert-danger'} py-2`}>{data.message}</div>;
}

export function CertificateSetupScreen({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({ categoryId: '', categoryName: '', categoryOrder: 0, subcategories: [] });
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.form) setForm(data.form);
  }, [data]);
  const setSub = (i, patch) => setForm((f) => ({ ...f, subcategories: f.subcategories.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  return (
    <div>
      <div className="row g-2 mb-3">
        <div className="col-md-4">
          <label className="form-label">Category</label>
          <select className="form-select" value={form.categoryId} onChange={(e) => onLoad({ categoryId: e.target.value })}>
            <option value="add_new">Add new category</option>
            {(data?.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-md-4"><label className="form-label">Category name</label><input className="form-control" value={form.categoryName} onChange={(e) => setForm({ ...form, categoryName: e.target.value })} /></div>
        <div className="col-md-2"><label className="form-label">Order</label><input type="number" className="form-control" value={form.categoryOrder} onChange={(e) => setForm({ ...form, categoryOrder: e.target.value })} /></div>
      </div>
      <table className="table table-sm table-bordered">
        <thead><tr><th>Name</th><th>Order</th><th>Template</th><th>Details</th><th /></tr></thead>
        <tbody>
          {form.subcategories.map((s, i) => (
            <tr key={s.id || `new-${i}`}>
              <td><input className="form-control form-control-sm" value={s.name} onChange={(e) => setSub(i, { name: e.target.value })} /></td>
              <td><input className="form-control form-control-sm" value={s.order} onChange={(e) => setSub(i, { order: e.target.value })} /></td>
              <td>
                <select className="form-select form-select-sm" value={s.format} onChange={(e) => setSub(i, { format: e.target.value })}>
                  <option value="">—</option>
                  {(data?.templates || []).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              <td><input className="form-control form-control-sm" value={s.details} onChange={(e) => setSub(i, { details: e.target.value })} /></td>
              <td>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  disabled={busy}
                  onClick={() => (s.id
                    ? onSave({ action: 'delete', id: s.id, categoryId: form.categoryId })
                    : setForm((f) => ({ ...f, subcategories: f.subcategories.filter((_, j) => j !== i) })))}
                >
                  Del
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-sm btn-outline-secondary me-2" onClick={() => setForm({ ...form, subcategories: [...form.subcategories, { name: '', order: 0, format: '', details: '' }] })}>Add row</button>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onSave(form)}>Save</button>
    </div>
  );
}

export function ReceiptAddScreen({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({ registerNo: '', applyFor: 'Bonafide', applicationFee: '', applicationDate: '', applyReason: [] });
  useEffect(() => { onLoad(); }, [onLoad]);
  return (
    <form className="row g-2" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="col-md-3"><label className="form-label">Register No</label><input className="form-control" value={form.registerNo} onChange={(e) => setForm({ ...form, registerNo: e.target.value })} required /></div>
      <div className="col-md-3"><label className="form-label">Apply for</label>
        <select className="form-select" value={form.applyFor} onChange={(e) => setForm({ ...form, applyFor: e.target.value })}>
          {(data?.applyTypes || ['Bonafide', 'Fee', 'Others']).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="col-md-3"><label className="form-label">Fee</label><input className="form-control" value={form.applicationFee} onChange={(e) => setForm({ ...form, applicationFee: e.target.value })} /></div>
      <div className="col-md-3"><label className="form-label">Date</label><input type="date" className="form-control" value={form.applicationDate} onChange={(e) => setForm({ ...form, applicationDate: e.target.value })} /></div>
      <div className="col-12"><label className="form-label">Reason (comma-separated)</label><input className="form-control" onChange={(e) => setForm({ ...form, applyReason: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></div>
      <div className="col-12"><button type="submit" className="btn btn-primary" disabled={busy}>Create receipt</button></div>
      <Alert data={data} />
    </form>
  );
}

export function ReceiptEditScreen({ data, busy, onLoad, onSave }) {
  const [applicationNo, setApplicationNo] = useState('');
  const [form, setForm] = useState({});
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.receipt) setForm(data.receipt); }, [data]);
  return (
    <div>
      <div className="row g-2 mb-3">
        <div className="col-md-4"><label className="form-label">Receipt no</label><input className="form-control" value={applicationNo} onChange={(e) => setApplicationNo(e.target.value)} /></div>
        <div className="col-md-2 d-flex align-items-end"><button type="button" className="btn btn-secondary" onClick={() => onLoad({ applicationNo })}>Load</button></div>
      </div>
      {form.id ? (
        <form className="row g-2" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
          <div className="col-md-3"><label className="form-label">Register No</label><input className="form-control" value={form.registerNo || ''} onChange={(e) => setForm({ ...form, registerNo: e.target.value })} /></div>
          <div className="col-md-3"><label className="form-label">Apply for</label><input className="form-control" value={form.applyFor || ''} onChange={(e) => setForm({ ...form, applyFor: e.target.value })} /></div>
          <div className="col-md-3"><label className="form-label">Fee</label><input className="form-control" value={form.applicationFee || ''} onChange={(e) => setForm({ ...form, applicationFee: e.target.value })} /></div>
          <div className="col-md-3"><label className="form-label">Date</label><input type="date" className="form-control" value={form.applicationDate || ''} onChange={(e) => setForm({ ...form, applicationDate: e.target.value })} /></div>
          <div className="col-12"><button type="submit" className="btn btn-primary" disabled={busy}>Update</button></div>
        </form>
      ) : null}
      <Alert data={data} />
    </div>
  );
}

export function ReceiptReportScreen({ data, busy, onLoad, onSave }) {
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', searchType: '' });
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.filters) setFilters(data.filters); }, [data]);
  return (
    <div>
      <div className="row g-2 mb-3">
        <div className="col-md-3"><label className="form-label">From</label><input type="date" className="form-control" value={filters.fromDate} max={filters.toDate || undefined} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} /></div>
        <div className="col-md-3"><label className="form-label">To</label><input type="date" className="form-control" value={filters.toDate} min={filters.fromDate || undefined} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} /></div>
        <div className="col-md-3"><label className="form-label">Type</label>
          <select className="form-select" value={filters.searchType} onChange={(e) => setFilters({ ...filters, searchType: e.target.value })}>
            <option value="">All</option>
            {(data?.applyTypes || []).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="col-md-2 d-flex align-items-end"><button type="button" className="btn btn-primary" disabled={busy} onClick={() => onSave({ filters })}>Search</button></div>
      </div>
      <p className="text-muted">Total amount: {data?.totalAmount ?? 0}</p>
      <table className="table table-sm table-bordered">
        <thead><tr><th>Receipt</th><th>Date</th><th>Reg.No</th><th>Name</th><th>Course</th><th>Apply for</th><th>Amount</th></tr></thead>
        <tbody>
          {(data?.receipts || []).map((r) => (
            <tr key={r.id}><td>{r.applicationNo}</td><td>{r.applicationDate}</td><td>{r.registerNo}</td><td>{r.studentName}</td><td>{r.degreeName}</td><td>{r.applyFor}</td><td>{r.applicationFee}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GenerateScreen({ data, busy, onLoad, onSave }) {
  const [searchInput, setSearchInput] = useState('');
  return (
    <div>
      <div className="row g-2 mb-3">
        <div className="col-md-6"><label className="form-label">Receipt / register numbers</label><textarea className="form-control" rows={3} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} /></div>
        <div className="col-md-2 d-flex align-items-end"><button type="button" className="btn btn-primary" disabled={busy} onClick={() => onLoad({ searchInput })}>Search</button></div>
      </div>
      {(data?.receipts || []).map((r) => (
        <div key={r.id} className="card mb-3"><div className="card-body">
          <h6>Receipt {r.applicationNo} — {r.studentName}</h6>
          <p className="mb-1">{r.degreeName} / {r.departmentName}</p>
          <p className="mb-0 small text-muted">{r.applyFor}: {r.applyReason}</p>
        </div></div>
      ))}
    </div>
  );
}

export function CertRequestScreen({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({ categoryId: '', subcategoryId: '', registerNo: '', photocopyList: [] });
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.form) setForm((f) => ({ ...f, categoryId: data.form.categoryId || f.categoryId }));
  }, [data]);

  const selectedSub = (data?.subcategories || []).find((s) => String(s.id) === String(form.subcategoryId));
  const isPhotocopy = String(selectedSub?.format || '').toLowerCase() === 'photocopy';

  const togglePhotocopyItem = (id) => {
    setForm((f) => ({
      ...f,
      photocopyList: f.photocopyList.includes(id) ? f.photocopyList.filter((x) => x !== id) : [...f.photocopyList, id],
    }));
  };

  const submit = (e) => {
    e.preventDefault();
    onSave(form).then(() => setForm((f) => ({ ...f, subcategoryId: '', registerNo: '', photocopyList: [] })));
  };

  const lr = data?.lastRequest;

  return (
    <div className="row g-3">
      <div className="col-md-8">
        <form className="row g-2" onSubmit={submit}>
          <div className="col-md-4"><label className="form-label">Category</label>
            <select className="form-select" value={form.categoryId} onChange={(e) => { const v = e.target.value; setForm({ ...form, categoryId: v, subcategoryId: '', photocopyList: [] }); onLoad({ categoryId: v }); }}>
              {(data?.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="col-md-4"><label className="form-label">Certificate</label>
            <select className="form-select" value={form.subcategoryId} onChange={(e) => setForm({ ...form, subcategoryId: e.target.value, photocopyList: [] })} required>
              <option value="">Select</option>
              {(data?.subcategories || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="col-md-4"><label className="form-label">Register No</label><input className="form-control" value={form.registerNo} onChange={(e) => setForm({ ...form, registerNo: e.target.value })} required /></div>
          {isPhotocopy ? (
            <div className="col-12">
              <label className="form-label">Certificate For</label>
              <div className="d-flex flex-wrap gap-3">
                {(data?.photocopyItems || []).map((p) => (
                  <label key={p.id} className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={form.photocopyList.includes(p.id)}
                      onChange={() => togglePhotocopyItem(p.id)}
                    />
                    <span className="form-check-label ms-1">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <div className="col-12"><button type="submit" className="btn btn-primary" disabled={busy}>Submit request</button></div>
          <Alert data={data} />
        </form>
      </div>
      <div className="col-md-4">
        <div className="card"><div className="card-body">
          <h6 className="card-title">Last Request</h6>
          {lr ? (
            <div>
              <div className="fw-bold">CR{lr.applicationNo}</div>
              <div>{lr.certificateName} @ {lr.applicationDate}</div>
              <div className="fw-bold">{lr.studentName}</div>
              <div>{lr.registerNo} | {lr.degreeName}{lr.departmentName}</div>
            </div>
          ) : <div className="text-muted small">No requests yet.</div>}
        </div></div>
      </div>
    </div>
  );
}

export function TcDetailsScreen({ data, busy, onLoad, onSave }) {
  const [students, setStudents] = useState([]);
  const [page, setPage] = useState(1);
  const yearOptions = data?.discontinuedYearOptions || ['1', '2', '3', '4'];

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (!data?.students) return;
    setStudents(data.students);
    setPage(data.pagination?.page || data.filters?.page || 1);
  }, [data]);

  const update = (i, patch) => setStudents((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const loadCourse = (courseRef, nextPage = 1) => {
    setPage(nextPage);
    return onLoad({ courseRef, page: nextPage });
  };

  const groupedCourses = (data?.courseOptions || []).reduce((groups, option) => {
    const key = option.group || 'Courses';
    if (!groups[key]) groups[key] = [];
    groups[key].push(option);
    return groups;
  }, {});

  const pagination = data?.pagination || { page: 1, pageSize: 50, total: 0, from: 0, to: 0 };

  return (
    <div>
      <div className="mb-3">
        <label className="form-label">Course</label>
        <select
          className="form-select"
          value={data?.courseRef || ''}
          onChange={(e) => loadCourse(e.target.value, 1)}
        >
          <option value="">Select course</option>
          {Object.entries(groupedCourses).map(([group, options]) => (
            <optgroup key={group} label={group}>
              {options.map((option) => (
                <option key={option.courseRef} value={option.courseRef}>{option.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {data?.courseRef ? (
        <div className="d-flex justify-content-end text-muted small mb-2">
          {pagination.total
            ? `Showing ${pagination.from} to ${pagination.to} of ${pagination.total} entries`
            : 'Showing 0 to 0 of 0 entries'}
        </div>
      ) : null}

      <div className="table-responsive">
        <table className="table table-sm table-bordered">
          <thead>
            <tr>
              <th>#</th>
              <th>Roll No</th>
              <th>Name</th>
              <th>Admission No.</th>
              <th>Admission Date</th>
              <th>Leaving Date</th>
              <th>Issue Date</th>
              <th>Reason</th>
              <th>Disc.</th>
            </tr>
          </thead>
          <tbody>
            {students.length ? students.map((s, i) => (
              <tr key={s.id}>
                <td>{pagination.from ? pagination.from + i : i + 1}</td>
                <td>{s.registerNo}</td>
                <td>{s.studentName}</td>
                <td><input className="form-control form-control-sm" value={s.admissionNo || ''} onChange={(e) => update(i, { admissionNo: e.target.value })} /></td>
                <td><input type="date" className="form-control form-control-sm" value={s.admissionDate || ''} onChange={(e) => update(i, { admissionDate: e.target.value })} /></td>
                <td><input type="date" className="form-control form-control-sm" value={s.leavingDate || ''} onChange={(e) => update(i, { leavingDate: e.target.value })} /></td>
                <td><input type="date" className="form-control form-control-sm" value={s.issueDate || ''} onChange={(e) => update(i, { issueDate: e.target.value })} /></td>
                <td style={{ minWidth: '9.5rem' }}>
                  <div className="d-flex flex-column gap-1">
                    <label className="form-check d-flex align-items-center gap-1 mb-0">
                      <input
                        type="radio"
                        className="form-check-input mt-0"
                        name={`reason_${s.id}`}
                        checked={s.leavingReason === 'completed'}
                        onChange={() => update(i, { leavingReason: 'completed', discontinuedYear: '' })}
                      />
                      <span className="form-check-label">Completed</span>
                    </label>
                    <label className="form-check d-flex align-items-center gap-1 mb-0">
                      <input
                        type="radio"
                        className="form-check-input mt-0"
                        name={`reason_${s.id}`}
                        checked={s.leavingReason === 'discontinued'}
                        onChange={() => update(i, { leavingReason: 'discontinued', discontinuedYear: s.discontinuedYear || '1' })}
                      />
                      <span className="form-check-label">Discontinued</span>
                    </label>
                  </div>
                </td>
                <td>
                  {s.leavingReason === 'discontinued' ? (
                    <select
                      className="form-select form-select-sm"
                      style={{ width: '4.5rem' }}
                      value={s.discontinuedYear || ''}
                      onChange={(e) => update(i, { discontinuedYear: e.target.value })}
                    >
                      <option value="">—</option>
                      {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  ) : null}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={9} className="text-danger">{data?.courseRef ? 'No data available' : 'Select a course to load students.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination.total > pagination.pageSize ? (
        <div className="d-flex justify-content-center gap-2 mt-3">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy || pagination.page <= 1} onClick={() => loadCourse(data.courseRef, pagination.page - 1)}>Previous</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy || pagination.to >= pagination.total} onClick={() => loadCourse(data.courseRef, pagination.page + 1)}>Next</button>
        </div>
      ) : null}

      {students.length ? (
        <button
          type="button"
          className="btn btn-danger mt-3"
          disabled={busy}
          onClick={() => onSave({ courseRef: data?.courseRef, page, students })}
        >
          Save
        </button>
      ) : null}
    </div>
  );
}

export function TcRequestAddScreen({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({ approveDate: '', registerNo: '' });
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.form) setForm((prev) => ({ ...prev, ...data.form })); }, [data]);
  return (
    <form className="row g-3" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="col-md-4">
        <label className="form-label">Date</label>
        <input type="date" className="form-control" value={form.approveDate} onChange={(e) => setForm({ ...form, approveDate: e.target.value })} required />
      </div>
      <div className="col-md-8">
        <label className="form-label">Roll No <span className="text-muted small">(separated by comma)</span></label>
        <textarea
          className="form-control"
          rows={4}
          value={form.registerNo}
          onChange={(e) => setForm({ ...form, registerNo: e.target.value })}
          required
        />
      </div>
      <div className="col-12">
        <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
      </div>
    </form>
  );
}

export function TcRequestEditScreen({ data, busy, onLoad, onSave }) {
  const today = new Date().toISOString().slice(0, 10);
  const [filters, setFilters] = useState({ fromDate: today, toDate: '' });
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    if (!data?.filters) return;
    setFilters({
      fromDate: data.filters.fromDate || '',
      toDate: data.filters.toDate || '',
    });
  }, [data?.filters]);

  const runSearch = () => onLoad(filters);

  const confirmDelete = async () => {
    if (!deleteId) return;
    await onSave({ action: 'delete', id: deleteId, filters });
    setDeleteId(null);
  };

  return (
    <div className="row g-3">
      <div className="col-lg-3">
        <div className="card shadow-sm exam-setup-card">
          <div className="card-header bg-white fw-semibold">Filter</div>
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label">From</label>
              <input type="date" className="form-control" value={filters.fromDate} max={filters.toDate || undefined} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label">To</label>
              <input type="date" className="form-control" value={filters.toDate} min={filters.fromDate || undefined} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} />
            </div>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={runSearch}>Search</button>
          </div>
        </div>
      </div>

      <div className="col-lg-9">
        <div className="table-responsive">
          <table className="table table-sm table-bordered">
            <thead className="table-light">
              <tr>
                <th>S.No.</th>
                <th>Date</th>
                <th>Roll No</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {(data?.requests || []).length ? (data.requests || []).map((r) => (
                <tr key={r.id}>
                  <td>{r.serialNo}</td>
                  <td>{r.approveDate}</td>
                  <td>{r.registerNo}</td>
                  <td>
                    <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => setDeleteId(r.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="text-danger">No data found...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteId ? (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirm</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setDeleteId(null)} />
              </div>
              <div className="modal-body">Are you sure to delete...</div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setDeleteId(null)}>Close</button>
                <button type="button" className="btn btn-warning" disabled={busy} onClick={confirmDelete}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TcGenerateScreen({ data, busy, onLoad, onSave }) {
  const [registerNo, setRegisterNo] = useState('');
  return (
    <div>
      <div className="row g-2 mb-3">
        <div className="col-md-4"><input className="form-control" placeholder="Register no" value={registerNo} onChange={(e) => setRegisterNo(e.target.value)} /></div>
        <div className="col-md-2"><button type="button" className="btn btn-primary" disabled={busy} onClick={() => onLoad({ registerNo })}>Load</button></div>
      </div>
      {(data?.students || []).map((s) => (
        <div key={s.registerNo} className="card mb-2"><div className="card-body">
          <h6>{s.studentName} ({s.registerNo})</h6>
          <p className="mb-0">{s.degreeName} — {s.departmentName}</p>
          <p className="small mb-0">Admission: {s.admissionDate} | Leaving: {s.leavingDate} | Issue: {s.issueDate}</p>
        </div></div>
      ))}
    </div>
  );
}

export function InternshipScheduleScreen({ data, busy, onLoad, onSave }) {
  const [registerNo, setRegisterNo] = useState('');
  const [internship, setInternship] = useState({ department: '', elDepartment: '', totalPeriod: '', fromDate: '', toDate: '', grade: '' });
  useEffect(() => { if (data?.registerNo) setRegisterNo(data.registerNo); }, [data]);
  return (
    <div>
      <div className="row g-2 mb-3">
        <div className="col-md-4"><input className="form-control" placeholder="Register no" value={registerNo} onChange={(e) => setRegisterNo(e.target.value)} /></div>
        <div className="col-md-2"><button type="button" className="btn btn-secondary" onClick={() => onLoad({ registerNo })}>Load</button></div>
      </div>
      {data?.student ? <p><strong>{data.student.student_name}</strong> — {data.student.degree_name}</p> : null}
      <div className="row g-2 mb-3">
        {['department', 'elDepartment', 'totalPeriod', 'fromDate', 'toDate', 'grade'].map((k) => (
          <div className="col-md-4" key={k}><label className="form-label">{k}</label><input className="form-control" value={internship[k] || ''} onChange={(e) => setInternship({ ...internship, [k]: e.target.value })} /></div>
        ))}
      </div>
      <button type="button" className="btn btn-primary me-2" disabled={busy} onClick={() => onSave({ registerNo, internship })}>Save internship</button>
      <table className="table table-sm table-bordered mt-3">
        <thead><tr><th>Department</th><th>Period</th><th>From</th><th>To</th><th>Grade</th><th /></tr></thead>
        <tbody>
          {(data?.internships || []).map((r) => (
            <tr key={r.id}><td>{r.department}</td><td>{r.totalPeriod}</td><td>{r.fromDate}</td><td>{r.toDate}</td><td>{r.grade}</td>
              <td><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onSave({ action: 'delete', id: r.id, registerNo })}>Del</button></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InternshipGenerateScreen({ data, busy, onLoad }) {
  const [searchBy, setSearchBy] = useState('roll_no');
  const [searchInput, setSearchInput] = useState('');
  const [courseRef, setCourseRef] = useState('');

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/internship-certificate.css';
    link.id = 'internship-cert-css';
    if (!document.getElementById('internship-cert-css')) {
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (!data) return;
    if (data.searchBy) setSearchBy(data.searchBy);
    if (data.searchInput != null) setSearchInput(data.searchInput);
  }, [data?.searchBy, data?.searchInput]);

  const runSearch = () => {
    const payload = searchBy === 'batch'
      ? { searchBy, searchInput: courseRef }
      : { searchBy, searchInput };
    return onLoad(payload);
  };

  const selectStudent = (studentId) => {
    const payload = searchBy === 'batch'
      ? { searchBy, searchInput: courseRef, studentId }
      : { searchBy, searchInput, studentId };
    return onLoad(payload);
  };

  const groupedCourses = (data?.courseOptions || []).reduce((acc, option) => {
    const group = option.group || 'Courses';
    if (!acc[group]) acc[group] = [];
    acc[group].push(option);
    return acc;
  }, {});

  return (
    <div className="row g-3">
      <div className="col-lg-3">
        <div className="card shadow-sm exam-setup-card">
          <div className="card-header bg-white fw-semibold">Filter</div>
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label d-block">Search By</label>
              <div className="form-check form-check-inline">
                <input className="form-check-input" type="radio" name="internshipSearchBy" id="internshipRollNo" checked={searchBy === 'roll_no'} onChange={() => setSearchBy('roll_no')} />
                <label className="form-check-label" htmlFor="internshipRollNo">Roll No</label>
              </div>
              <div className="form-check form-check-inline">
                <input className="form-check-input" type="radio" name="internshipSearchBy" id="internshipBatch" checked={searchBy === 'batch'} onChange={() => setSearchBy('batch')} />
                <label className="form-check-label" htmlFor="internshipBatch">Batch</label>
              </div>
            </div>

            {searchBy === 'roll_no' ? (
              <div className="mb-3">
                <label className="form-label">Roll No</label>
                <div className="input-group">
                  <input
                    className="form-control"
                    placeholder="Roll No. separated by ,"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  <button type="button" className="btn btn-info" disabled={busy} onClick={runSearch}>Go</button>
                </div>
              </div>
            ) : (
              <div className="mb-3">
                <label className="form-label">Course / Batch</label>
                <select className="form-select" value={courseRef} onChange={(e) => { setCourseRef(e.target.value); if (e.target.value) onLoad({ searchBy: 'batch', searchInput: e.target.value }); }}>
                  <option value="">--Select--</option>
                  {Object.entries(groupedCourses).map(([group, options]) => (
                    <optgroup key={group} label={group}>
                      {options.map((option) => (
                        <option key={option.courseRef} value={option.courseRef}>{option.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}

            <div className="d-flex flex-column gap-2">
              {(data?.students || []).map((student) => (
                <button
                  key={student.id}
                  type="button"
                  className="btn btn-link text-start px-0"
                  style={{ color: data?.selectedStudentId === student.id ? '#7AB12C' : undefined }}
                  disabled={busy}
                  onClick={() => selectStudent(student.id)}
                >
                  {student.registerNo} - {student.studentName}
                </button>
              ))}
              {data?.message ? <p className="text-danger mb-0">{data.message}</p> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="col-lg-9">
        <div className="d-flex justify-content-end mb-2">
          <button
            type="button"
            className="btn btn-info"
            disabled={busy || !data?.certificateHtml}
            onClick={() => printInternshipCertificate(data.certificateHtml)}
          >
            Print
          </button>
        </div>
        {data?.certificateHtml ? (
          <div className="internship-certificate-preview border bg-white overflow-auto p-2">
            <div dangerouslySetInnerHTML={{ __html: data.certificateHtml }} />
          </div>
        ) : (
          <div className="text-muted">Search by roll number or batch to load the internship certificate.</div>
        )}
      </div>
    </div>
  );
}

export function InternshipPhotoScreen({ data, busy, onLoad, onSave }) {
  const [overwriteExists, setOverwriteExists] = useState(false);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef(null);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (Array.isArray(data?.results)) setResults(data.results);
  }, [data?.results]);

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleFiles = async (event) => {
    const files = [...(event.target.files || [])];
    if (!files.length) return;

    setProgress(0);
    setResults([]);

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'jpg' && ext !== 'jpeg') {
        setResults((prev) => [...prev, { filename: file.name, success: false, message: 'Unsupported file type!' }]);
        setProgress(Math.round(((i + 1) / files.length) * 100));
        continue;
      }
      if (file.size > 3 * 1024 * 1024) {
        setResults((prev) => [...prev, { filename: file.name, success: false, message: 'File is too big, it should be less than 3 MB.' }]);
        setProgress(Math.round(((i + 1) / files.length) * 100));
        continue;
      }

      const content = await fileToBase64(file);
      const res = await onSave(
        { overwriteExists },
        [{ filename: file.name, content }],
      );
      if (res?.results) {
        setResults((prev) => [...prev, ...res.results]);
      } else {
        setResults((prev) => [...prev, { filename: file.name, success: false, message: res?.message || 'Upload failed.' }]);
      }
      setProgress(Math.round(((i + 1) / files.length) * 100));
    }

    if (fileRef.current) fileRef.current.value = '';
    setTimeout(() => setProgress(0), 800);
  };

  return (
    <div className="card shadow-sm exam-setup-card">
      <div className="card-body">
        <div className="row g-3 align-items-start">
          <div className="col-md-4">
            <label className="form-label fw-semibold">Upload Internship Certificate Photo</label>
            <input
              ref={fileRef}
              type="file"
              className="form-control"
              accept=".jpg,.jpeg"
              multiple
              disabled={busy}
              onChange={handleFiles}
            />
            <div className="form-check mt-2">
              <input
                className="form-check-input"
                type="checkbox"
                id="overwriteExists"
                checked={overwriteExists}
                onChange={(e) => setOverwriteExists(e.target.checked)}
              />
              <label className="form-check-label ms-1" htmlFor="overwriteExists">Overwrite Existing File</label>
            </div>
            <div className="small text-danger mt-3">
              <strong>NOTE:</strong><br />
              1. File name should be <strong>&quot;rollno&quot;A.jpg</strong> (e.g. 1718007A.jpg)<br />
              2. Individual files size less than 3 MB<br />
              3. JPG format only
            </div>
          </div>
          <div className="col-md-8">
            {progress > 0 && progress < 100 ? (
              <div className="progress mb-3">
                <div className="progress-bar" style={{ width: `${progress}%` }}>{progress}%</div>
              </div>
            ) : null}
            {results.length ? (
              <ul className="list-unstyled mb-0">
                {results.map((row, index) => (
                  <li key={`${row.filename}-${index}`} className={`border rounded px-2 py-1 mb-2 ${row.success ? 'text-success' : 'text-danger'}`}>
                    {row.success ? (
                      <><strong>Success!</strong> {row.filename} uploaded.</>
                    ) : (
                      <><strong>Wrong!</strong> {row.filename} — {row.message}</>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted mb-0">Select one or more JPG photos to upload.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AaadarCertificateScreen({ data, busy, onLoad, title }) {
  const [searchBy, setSearchBy] = useState('roll_no');
  const [searchInput, setSearchInput] = useState('');
  const [courseRef, setCourseRef] = useState('');

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/aaadar-certificate.css';
    link.id = 'aaadar-cert-css';
    if (!document.getElementById('aaadar-cert-css')) {
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (!data) return;
    if (data.searchBy) setSearchBy(data.searchBy);
    if (data.searchInput != null) setSearchInput(data.searchInput);
  }, [data?.searchBy, data?.searchInput]);

  const runSearch = () => {
    const payload = searchBy === 'batch'
      ? { searchBy, searchInput: courseRef }
      : { searchBy, searchInput };
    return onLoad(payload);
  };

  const selectStudent = (studentId) => {
    const payload = searchBy === 'batch'
      ? { searchBy, searchInput: courseRef, studentId }
      : { searchBy, searchInput, studentId };
    return onLoad(payload);
  };

  const groupedCourses = (data?.courseOptions || []).reduce((acc, option) => {
    const group = option.group || 'Courses';
    if (!acc[group]) acc[group] = [];
    acc[group].push(option);
    return acc;
  }, {});

  return (
    <div className="row g-3">
      <div className="col-lg-3">
        <div className="card shadow-sm exam-setup-card">
          <div className="card-header bg-white fw-semibold">Filter</div>
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label d-block">Search By</label>
              <div className="form-check form-check-inline">
                <input className="form-check-input" type="radio" name={`${title}-searchBy`} id={`${title}-rollNo`} checked={searchBy === 'roll_no'} onChange={() => setSearchBy('roll_no')} />
                <label className="form-check-label" htmlFor={`${title}-rollNo`}>Roll No</label>
              </div>
              <div className="form-check form-check-inline">
                <input className="form-check-input" type="radio" name={`${title}-searchBy`} id={`${title}-batch`} checked={searchBy === 'batch'} onChange={() => setSearchBy('batch')} />
                <label className="form-check-label" htmlFor={`${title}-batch`}>Batch</label>
              </div>
            </div>

            {searchBy === 'roll_no' ? (
              <div className="mb-3">
                <label className="form-label">Roll No</label>
                <div className="input-group">
                  <input
                    className="form-control"
                    placeholder="Roll No. separated by ,"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  <button type="button" className="btn btn-info" disabled={busy} onClick={runSearch}>Go</button>
                </div>
              </div>
            ) : (
              <div className="mb-3">
                <label className="form-label">Course / Batch</label>
                <select className="form-select" value={courseRef} onChange={(e) => { setCourseRef(e.target.value); if (e.target.value) onLoad({ searchBy: 'batch', searchInput: e.target.value }); }}>
                  <option value="">--Select--</option>
                  {Object.entries(groupedCourses).map(([group, options]) => (
                    <optgroup key={group} label={group}>
                      {options.map((option) => (
                        <option key={option.courseRef} value={option.courseRef}>{option.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}

            <div className="d-flex flex-column gap-2">
              {(data?.students || []).map((student) => (
                <button
                  key={student.id}
                  type="button"
                  className="btn btn-link text-start px-0"
                  style={{ color: data?.selectedStudentId === student.id ? '#7AB12C' : undefined }}
                  disabled={busy}
                  onClick={() => selectStudent(student.id)}
                >
                  {student.registerNo} - {student.studentName}
                </button>
              ))}
              {data?.message ? <p className="text-danger mb-0">{data.message}</p> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="col-lg-9">
        <div className="d-flex justify-content-end mb-2">
          <button
            type="button"
            className="btn btn-info"
            disabled={busy || !data?.certificateHtml}
            onClick={() => printAaadarCertificate(data.certificateHtml)}
          >
            Print
          </button>
        </div>
        {data?.certificateHtml ? (
          <div className="aaadar-certificate-preview border bg-white overflow-auto p-2">
            <div dangerouslySetInnerHTML={{ __html: data.certificateHtml }} />
          </div>
        ) : (
          <div className="text-muted">Search by roll number or batch to load the {title.toLowerCase()}.</div>
        )}
      </div>
    </div>
  );
}

export function ImplantCertScreen(props) {
  return <AaadarCertificateScreen {...props} title="Implant Certificate" />;
}

export function LaserCertScreen(props) {
  return <AaadarCertificateScreen {...props} title="Laser Certificate" />;
}
