import { useEffect, useState } from 'react';
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { printReportHtml } from '../../utils/printReport';
import { STAFF_SCREEN_META } from './staffModuleMeta';
import { useStaffScreenApi } from './useStaffModuleApi';

const SAVE_SCREENS = new Set(['transport', 'photo-upload', 'certificates']);

function ScreenFilters({ screen, meta, data, onGenerate, onSave, busy }) {
  const todayIso = () => new Date().toISOString().slice(0, 10);
  const [fields, setFields] = useState(() => {
    if (meta.type === 'staff-search-report') return { search_by: 'roll_no' };
    if (meta.type === 'date-category-report') {
      const t = new Date().toISOString().slice(0, 10);
      return { from_date: t, to_date: t, category: '0', letter_date: t };
    }
    return {};
  });
  const set = (k, v) => setFields((prev) => ({ ...prev, [k]: v }));

  const staffSearch = (
    <>
      <div className="col-md-2">
        <select className="form-select" value={fields.search_by || 'roll_no'} onChange={(e) => set('search_by', e.target.value)}>
          <option value="roll_no">Staff ID</option><option value="category">Category</option><option value="all">All</option>
        </select>
      </div>
      <div className="col-md-4"><input className="form-control" placeholder="Staff IDs (comma) or category" onChange={(e) => set('search_input', e.target.value)} /></div>
    </>
  );

  return (
    <form className="row g-3 mb-3" onSubmit={(e) => {
      e.preventDefault();
      const payload = { ...fields, Submit: 'Generate' };
      if (SAVE_SCREENS.has(screen)) onSave(payload);
      else onGenerate(payload);
    }}>
      {meta.type === 'staff-search-report' && staffSearch}
      {screen === 'attach-print' && (
        <div className="col-md-3 d-flex align-items-end">
          <div className="form-check mb-2">
            <input
              type="checkbox"
              className="form-check-input"
              id="affidavit_only"
              onChange={(e) => set('affidavit', e.target.checked ? 1 : 0)}
            />
            <label className="form-check-label" htmlFor="affidavit_only">Only Affidavit Attachments</label>
          </div>
        </div>
      )}
      {(screen === 'affidavit-dci' || screen === 'affidavit-tnmgrmu') && (
        <>
          <div className="col-md-2">
            <input className="form-control" placeholder="Page No." onChange={(e) => set('page_no', e.target.value)} />
          </div>
          <div className="col-md-2">
            <input className="form-control" placeholder="Pub. Year" onChange={(e) => set('pub_year', e.target.value)} />
          </div>
          <div className="col-md-3 d-flex align-items-end">
            <div className="form-check mb-2">
              <input
                type="checkbox"
                className="form-check-input"
                id="affidavit_pub"
                onChange={(e) => set('affidavit', e.target.checked ? 1 : 0)}
              />
              <label className="form-check-label" htmlFor="affidavit_pub">Affidavit publications only</label>
            </div>
          </div>
        </>
      )}
      {meta.type === 'date-category-report' && (
        <>
          <div className="col-md-2">
            <label className="form-label">From</label>
            <input type="date" className="form-control" value={fields.from_date || ''} onChange={(e) => set('from_date', e.target.value)} required />
          </div>
          <div className="col-md-2">
            <label className="form-label">To</label>
            <input type="date" className="form-control" value={fields.to_date || ''} onChange={(e) => set('to_date', e.target.value)} required />
          </div>
          <div className="col-md-3">
            <label className="form-label">Category</label>
            <select className="form-select" value={fields.category || '0'} onChange={(e) => set('category', e.target.value)}>
              <option value="0">All</option>
              {(data?.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {screen === 'salary-note' && (
            <div className="col-md-2">
              <label className="form-label">Letter Date</label>
              <input type="date" className="form-control" value={fields.letter_date || ''} onChange={(e) => set('letter_date', e.target.value)} required />
            </div>
          )}
        </>
      )}
      {meta.type === 'category-report' && (
        <div className="col-md-4"><label className="form-label">Category</label>
          <select className="form-select" multiple onChange={(e) => set('search_category', Array.from(e.target.selectedOptions, (o) => o.value))}>
            {(data?.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      {meta.type === 'dept-report' && (
        <div className="col-md-4"><label className="form-label">Department</label>
          <select className="form-select" multiple onChange={(e) => set('search_category', Array.from(e.target.selectedOptions, (o) => o.value))}>
            {(data?.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      )}
      {meta.type === 'attn-sheet' && (
        <>
          <div className="col-md-3"><label className="form-label">Department</label>
            <select className="form-select" onChange={(e) => set('department_id', e.target.value)}>
              {(data?.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="col-md-2"><label className="form-label">Type</label>
            <select className="form-select" onChange={(e) => set('cat_search_type', e.target.value)} defaultValue="Faculty">
              <option value="Faculty">Faculty</option><option value="PGStudent">PG Student</option>
            </select>
          </div>
          <div className="col-md-2 form-check mt-4">
            <input type="checkbox" className="form-check-input" id="show_photo" defaultChecked onChange={(e) => set('show_photo', e.target.checked)} />
            <label className="form-check-label" htmlFor="show_photo">Show photo</label>
          </div>
        </>
      )}
      {meta.type === 'org-structure' && (
        <>
          <div className="col-md-3"><label className="form-label">Mode</label>
            <select className="form-select" onChange={(e) => set('mode', e.target.value)} defaultValue="employee">
              <option value="employee">Employee</option><option value="department">Department</option>
            </select>
          </div>
        </>
      )}
      {meta.type === 'upload' && (
        <div className="col-md-6">
          <label className="form-label">PNG files (staffid.png)</label>
          <input type="file" className="form-control" accept=".png" multiple onChange={async (e) => {
            const files = await Promise.all([...e.target.files].map((f) => new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve({ name: f.name, data: reader.result });
              reader.readAsDataURL(f);
            })));
            set('files', files);
          }} />
        </div>
      )}
      {meta.type !== 'auto-report' && meta.type !== 'certificates' && (
        <div className="col-md-2 d-flex align-items-end">
          <button type="submit" className="btn btn-danger w-100" disabled={busy}>
            {SAVE_SCREENS.has(screen) ? 'Save' : 'Generate'}
          </button>
        </div>
      )}
    </form>
  );
}

function TransportGrid({ data, onSave, busy }) {
  const [items, setItems] = useState([]);
  useEffect(() => { setItems(data?.rows || []); }, [data?.rows]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ items, page: data?.page }); }}>
      <div className="table-responsive">
        <table className="table table-bordered table-sm">
          <thead><tr><th>Staff ID</th><th>Name</th><th>Transport</th><th>Route #</th></tr></thead>
          <tbody>
            {items.map((row, i) => (
              <tr key={row.staffRowId}>
                <td>{row.staffId}</td><td>{row.staffName}</td>
                <td><input type="checkbox" checked={!!row.enabled} onChange={(e) => setItems((p) => p.map((r, j) => j === i ? { ...r, enabled: e.target.checked } : r))} /></td>
                <td>
                  <select className="form-select form-select-sm" value={row.transportNumber || ''} onChange={(e) => setItems((p) => p.map((r, j) => j === i ? { ...r, transportNumber: e.target.value } : r))}>
                    <option value="">—</option>
                    {(data?.transports || []).map((t) => <option key={t.id} value={t.transportNumber}>{t.transportRoute || t.transportNumber}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>Update</button>
    </form>
  );
}

function InspectionDetailsPanel({ data, busy, onLoad, onSave }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    setRows(data?.rows?.length ? data.rows : [{ inspectorType: '', name: '', designation: '', working: '', mobile: '', email: '' }]);
  }, [data?.rows]);

  const groups = (data?.inspectionOptions || []).reduce((acc, opt) => {
    if (!acc[opt.groupLabel]) acc[opt.groupLabel] = [];
    acc[opt.groupLabel].push(opt);
    return acc;
  }, {});

  return (
    <div>
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <label className="form-label">Inspection Department <span className="text-danger">*</span></label>
          <select
            className="form-select"
            value={data?.configId || ''}
            disabled={busy}
            onChange={(e) => onLoad({ configId: e.target.value })}
          >
            <option value="">-- Select Inspection Department --</option>
            {Object.entries(groups).map(([groupLabel, opts]) => (
              <optgroup key={groupLabel} label={groupLabel}>
                {opts.map((o) => (
                  <option key={o.configId} value={o.configId}>{o.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
      {!data?.configId && (
        <div className="alert alert-info py-2">Select an inspection department to enter examiner details.</div>
      )}
      {data?.configId && (
        <div className="alert alert-secondary py-2 mb-3">
          <strong>{data.selectedLabel || 'Inspection'}</strong>
          {data.groupLabel && <span className="text-muted"> — {data.groupLabel}</span>}
          {data.academicYear && <span className="text-muted"> ({data.academicYear})</span>}
        </div>
      )}
      {data?.configId && (
        <form onSubmit={(e) => {
          e.preventDefault();
          onSave({
            configId: data.configId,
            courseId: data.courseId,
            academicYear: data.academicYear,
            academicType: data.academicType,
            rows,
          });
        }}>
          <div className="table-responsive">
            <table className="table table-bordered table-sm">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Type</th>
                  <th>Examiner Name</th>
                  <th>Designation</th>
                  <th>College</th>
                  <th>Mobile No.</th>
                  <th>E-Mail ID</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id || `new-${i}`}>
                    <td>{i + 1}</td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={row.inspectorType || ''}
                        onChange={(e) => setRows((p) => p.map((r, j) => j === i ? { ...r, inspectorType: e.target.value } : r))}
                      >
                        <option value="">-- Select --</option>
                        {(data?.inspectorTypes || []).map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </td>
                    <td><input className="form-control form-control-sm" value={row.name || ''} placeholder="Examiner Name" onChange={(e) => setRows((p) => p.map((r, j) => j === i ? { ...r, name: e.target.value } : r))} /></td>
                    <td><input className="form-control form-control-sm" value={row.designation || ''} placeholder="Designation" onChange={(e) => setRows((p) => p.map((r, j) => j === i ? { ...r, designation: e.target.value } : r))} /></td>
                    <td><textarea className="form-control form-control-sm" rows={2} value={row.working || ''} placeholder="College Name with Address" onChange={(e) => setRows((p) => p.map((r, j) => j === i ? { ...r, working: e.target.value } : r))} /></td>
                    <td><input className="form-control form-control-sm" value={row.mobile || ''} placeholder="Mobile No" onChange={(e) => setRows((p) => p.map((r, j) => j === i ? { ...r, mobile: e.target.value } : r))} /></td>
                    <td><input className="form-control form-control-sm" value={row.email || ''} placeholder="E-Mail" onChange={(e) => setRows((p) => p.map((r, j) => j === i ? { ...r, email: e.target.value } : r))} /></td>
                    <td>
                      {rows.length > 1 && (
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setRows((p) => p.filter((_, j) => j !== i))}>×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setRows((p) => [...p, { inspectorType: '', name: '', designation: '', working: '', mobile: '', email: '' }])}>+ Add Row</button>
            {data?.reportHtml && (
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => printReportHtml(data.reportHtml, 'inspection')}
              >
                Print
              </button>
            )}
            <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
          </div>
        </form>
      )}
    </div>
  );
}

function CertificatesPanel({ data, busy, onLoad, onSave, searchMore }) {
  const [by, setBy] = useState('name');
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searchNotice, setSearchNotice] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const catalog = data?.catalog;
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (data?.searchResults) setResults(data.searchResults);
  }, [data?.searchResults]);

  useEffect(() => {
    if (catalog?.staffId) setSelectedId(catalog.staffId);
  }, [catalog?.staffId]);

  useEffect(() => {
    if (catalog?.types) {
      setItems(catalog.types.map((t) => ({
        attachId: t.attachId,
        attachNo: t.attachNo || '',
        attachFile: t.attachFile || '',
        recordId: t.recordId,
      })));
    }
  }, [catalog]);

  const runSearch = async (searchQuery = q) => {
    setSearchNotice('');
    const res = await searchMore({ by, q: searchQuery.trim() });
    const staff = Array.isArray(res) ? res : res?.staff || [];
    setResults(staff);
    if (searchQuery.trim() && !staff.length) {
      setSearchNotice('No staff found. Try the staff name, full display name, or staff ID.');
    }
  };

  const selectStaff = (staff) => {
    setSelectedId(staff.id);
    onLoad({ staffId: staff.id });
  };

  return (
    <div className="row g-3">
      <div className="col-lg-4">
        <div className="row g-2 mb-2">
          <div className="col-md-5">
            <select className="form-select form-select-sm" value={by} onChange={(e) => setBy(e.target.value)}>
              <option value="name">Name</option>
              <option value="staff_id">Staff ID</option>
              <option value="category">Category</option>
            </select>
          </div>
          <div className="col-md-7">
            <input
              className="form-control form-control-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
            />
          </div>
          <div className="col-12">
            <button type="button" className="btn btn-outline-primary btn-sm" disabled={busy} onClick={() => runSearch()}>
              Search
            </button>
          </div>
        </div>
        {searchNotice && <div className="alert alert-warning py-2 small">{searchNotice}</div>}
        <div className="list-group" style={{ maxHeight: '420px', overflow: 'auto' }}>
          {(results || []).length === 0 ? (
            <div className="list-group-item text-muted small">No staff found.</div>
          ) : (results || []).map((r) => (
            <button
              key={r.id}
              type="button"
              className={`list-group-item list-group-item-action ${selectedId === r.id ? 'active' : ''}`}
              onClick={() => selectStaff(r)}
            >
              <strong>{r.staffId}</strong> — {r.name}
              {r.resigned && <span className="ms-1 small fst-italic text-danger">Resigned</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="col-lg-8">
        {!catalog && (
          <div className="alert alert-info py-2 mb-0">Select a staff member to view and edit attachment certificates.</div>
        )}
        {catalog && !catalog.types?.length && (
          <div className="alert alert-info">{catalog.message || 'No attachment document types are configured for this staff member.'}</div>
        )}
        {catalog?.types?.length > 0 && (
          <form onSubmit={(e) => { e.preventDefault(); onSave({ staffId: catalog.staffId, items }); }}>
            <p className="mb-1"><strong>{catalog.staffCode}</strong></p>
            <p className="text-muted small mb-3">{catalog.departmentName} / {catalog.designationName}</p>
            <div className="table-responsive">
              <table className="table table-bordered table-sm">
                <thead><tr><th>Attachment</th><th>Number</th><th>File</th></tr></thead>
                <tbody>
                  {catalog.types.map((t, i) => (
                    <tr key={t.attachId}>
                      <td>{[t.mainCategory, t.subCategory, t.docCategory].filter(Boolean).join(' / ') || t.label || `Type ${t.attachId}`}</td>
                      <td><input className="form-control form-control-sm" value={items[i]?.attachNo || ''} onChange={(e) => setItems((p) => p.map((r, j) => j === i ? { ...r, attachNo: e.target.value } : r))} /></td>
                      <td>
                        <input className="form-control form-control-sm" value={items[i]?.attachFile || ''} onChange={(e) => setItems((p) => p.map((r, j) => j === i ? { ...r, attachFile: e.target.value } : r))} />
                        {t.fileUrl && (
                          <a className="small d-block mt-1" href={t.fileUrl} target="_blank" rel="noreferrer">View file</a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>Save Attachments</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function StaffScreenPage() {
  const { screen: paramScreen } = useParams();
  const location = useLocation();
  const pathSlug = location.pathname.replace(/^\/staff\//, '');
  const screen = (paramScreen && STAFF_SCREEN_META[paramScreen]) ? paramScreen : (STAFF_SCREEN_META[pathSlug] ? pathSlug : paramScreen);
  const meta = STAFF_SCREEN_META[screen];
  const { data, busy, error, notice, clearNotice, load, save, searchMore } = useStaffScreenApi(screen);
  const { settings, menu } = useOutletContext();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!meta) { setReady(true); return; }
    load().finally(() => setReady(true));
  }, [meta, load]);

  if (!meta) {
    return <div className="p-4"><p className="text-danger">Unknown staff screen.</p><Link to="/staff/hub">Back</Link></div>;
  }
  if (!ready) return <div className="p-4 text-muted">Loading...</div>;

  return (
    <DashboardLayout settings={settings} dashboard={{ title: meta.title }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/staff/hub">Staff</Link></li>
          <li className="breadcrumb-item active">{meta.title}</li>
        </ol>
      </nav>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div><h3 className="dashboard-title mb-0">{meta.title}</h3></div>
        <div className="d-flex gap-2">
          {data?.reportHtml && (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={() => printReportHtml(
                data.reportHtml,
                screen === 'affidavit-dci' || screen === 'affidavit-tnmgrmu'
                  ? 'affidavit'
                  : screen === 'inspection-details'
                    ? 'inspection'
                    : screen === 'appoint-order'
                      ? 'appointment-order'
                      : 'default',
              )}
            >
              Print
            </button>
          )}
          <Link to="/staff/hub" className="btn btn-outline-secondary btn-sm">Back</Link>
        </div>
      </div>
      {notice && (
        <div className="alert alert-success alert-dismissible fade show">
          {notice}
          <button type="button" className="btn-close" aria-label="Close" onClick={clearNotice} />
        </div>
      )}
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="card shadow-sm mb-3"><div className="card-body">
        {meta.type !== 'transport-grid' && meta.type !== 'certificates' && meta.type !== 'inspection-grid' && (
          <ScreenFilters screen={screen} meta={meta} data={data} busy={busy} onGenerate={load} onSave={save} />
        )}
        {screen === 'transport' && <TransportGrid data={data} onSave={save} busy={busy} />}
        {screen === 'certificates' && <CertificatesPanel data={data} busy={busy} onLoad={load} onSave={save} searchMore={searchMore} />}
        {screen === 'inspection-details' && <InspectionDetailsPanel data={data} busy={busy} onLoad={load} onSave={save} />}
      </div></div>
      {data?.reportHtml && (
        <div className={`card shadow-sm${screen === 'affidavit-dci' || screen === 'affidavit-tnmgrmu' ? ' affidavit-report-card' : screen === 'inspection-details' ? ' inspection-cert-card' : ''}`}>
          <div className={`card-body${
            screen === 'affidavit-dci' || screen === 'affidavit-tnmgrmu'
              ? ' affidavit-report-html'
              : screen === 'inspection-details'
                ? ' inspection-cert-html'
                : screen === 'appoint-order'
                  ? ' appoint-order-report-html report-html'
                  : ' report-html'
          }`} dangerouslySetInnerHTML={{ __html: data.reportHtml }} />
        </div>
      )}
    </DashboardLayout>
  );
}
