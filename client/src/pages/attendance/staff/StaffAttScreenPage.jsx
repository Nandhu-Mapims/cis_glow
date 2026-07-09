import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import DashboardLayout from '../../../layouts/DashboardLayout';
import { useShellData } from '../../../hooks/useShellData';
import { printReportHtml } from '../../../utils/printReport';
import { STAFF_ATT_SCREEN_META } from './staffAttSetupMeta';
import { useStaffAttScreenApi } from './useStaffAttSetupApi';

const APPROVAL_SCREENS = new Set(['smr-leave-approve', 'smr-permission-approve', 'smr-defaulter-approve']);
const SAVE_SCREENS = new Set(['clear-icache', 'holiday-roster', 'compensation', 'available-cl', 'att-transport', ...APPROVAL_SCREENS]);

function AttChartTable({ rows, title }) {
  if (!rows?.length) return null;
  return (
    <div className="card shadow-sm">
      {title ? <div className="card-header py-2"><strong>{title}</strong></div> : null}
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-bordered table-sm mb-0">
            <thead className="table-light">
              <tr>
                <th>Day</th><th>Present</th><th>Absent/Leave</th><th>Late</th><th>Permission</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date}>
                  <td>{row.day} ({row.weekday})</td>
                  <td>{row.present}</td>
                  <td>{row.absent}</td>
                  <td>{row.late}</td>
                  <td>{row.permission}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DailyAttendanceTable({ rows, title }) {
  if (!rows?.length) return null;
  return (
    <div className="card shadow-sm">
      {title ? <div className="card-header py-2"><strong>{title}</strong> <span className="text-muted small">({rows.length} staff)</span></div> : null}
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-bordered table-sm mb-0">
            <thead className="table-light">
              <tr>
                <th>Staff ID</th><th>Name</th><th>Dept</th><th>FN/AN</th><th>In</th><th>Out</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.staffId}>
                  <td>{row.staffId}</td>
                  <td>{row.name}</td>
                  <td>{row.dept}</td>
                  <td>{row.session}</td>
                  <td>{row.inTime}</td>
                  <td>{row.outTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReportFilters({ screen, data, onGenerate }) {
  const [fields, setFields] = useState({});
  const set = (k, v) => setFields((prev) => ({ ...prev, [k]: v }));

  const submitFilters = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const submitted = Object.fromEntries(fd.entries());
    const categories = fd.getAll('search_category');
    if (categories.length) submitted.search_category = categories;
    onGenerate({ ...fields, ...submitted, Submit: 'Generate' });
  };

  const commonDateRow = (
    <>
      <div className="col-md-3"><label className="form-label">From Date</label><input type="date" className="form-control" onChange={(e) => set('from_date', e.target.value)} /></div>
      <div className="col-md-3"><label className="form-label">To Date</label><input type="date" className="form-control" onChange={(e) => set('to_date', e.target.value)} /></div>
    </>
  );

  return (
    <form className="row g-3 mb-3" onSubmit={submitFilters}>
      {screen === 'daily-attendance' && (
        <>
          <div className="col-md-3"><label className="form-label">Date</label><input type="date" name="current_date" className="form-control" defaultValue={data?.current_date_iso || ''} onChange={(e) => set('current_date', e.target.value)} /></div>
          <div className="col-md-4"><label className="form-label">Type</label>
            <select name="att_type" className="form-select" defaultValue={data?.att_type || 'Teaching'} onChange={(e) => set('att_type', e.target.value)}>
              <option value="Teaching">Teaching</option><option value="NON Teaching">Non Teaching</option><option value="All">All</option>
            </select>
          </div>
        </>
      )}
      {screen === 'biometric-report' && (
        <>
          <div className="col-md-3"><label className="form-label">Staff ID</label><input className="form-control" onChange={(e) => set('roll_no', e.target.value)} /></div>
          {commonDateRow}
        </>
      )}
      {screen === 'yearly-report' && (
        <>
          <div className="col-md-3"><label className="form-label">Staff ID</label><input className="form-control" required onChange={(e) => set('staff_id', e.target.value)} /></div>
          {commonDateRow}
        </>
      )}
      {(screen === 'smr-acknowledge' || screen === 'smr-lpd-report' || APPROVAL_SCREENS.has(screen)) && commonDateRow}
      {APPROVAL_SCREENS.has(screen) && (
        <div className="col-md-3"><label className="form-label">Status</label>
          <select className="form-select" onChange={(e) => set('a_status', e.target.value)} defaultValue="0">
            <option value="0">Pending</option><option value="1">Approved</option><option value="2">Rejected</option>
          </select>
        </div>
      )}
      {(screen === 'attendance-report' || screen === 'teaching-month-report' || screen.startsWith('att-chart')) && (
        <>
          <div className="col-md-4"><label className="form-label">Category</label>
            <select
              name="search_category"
              className="form-select"
              multiple
              size={Math.min(8, Math.max(4, (data?.categories || []).length))}
              defaultValue={(data?.search_category || []).map(String)}
              onChange={(e) => set('search_category', Array.from(e.target.selectedOptions, (o) => o.value))}
            >
              {(data?.categories || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {screen.startsWith('att-chart')
            ? <div className="col-md-3"><label className="form-label">Month</label><input type="month" name="from_month" className="form-control" defaultValue={data?.from_month || ''} onChange={(e) => set('from_month', e.target.value)} /></div>
            : commonDateRow}
        </>
      )}
      {screen === 'available-leave' && (
        <>
          <div className="col-md-3"><label className="form-label">As of Date</label><input type="date" className="form-control" onChange={(e) => set('from_date', e.target.value)} /></div>
          <div className="col-md-4"><label className="form-label">Department</label>
            <select className="form-select" multiple onChange={(e) => set('search_dept', Array.from(e.target.selectedOptions, (o) => o.value))}>
              {(data?.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </>
      )}
      {screen === 'clear-icache' && (
        <div className="col-md-4"><label className="form-label">Staff ID</label><input className="form-control" required onChange={(e) => set('staff_id', e.target.value)} /></div>
      )}
      {screen === 'compensation' && (
        <div className="col-md-4"><label className="form-label">Staff ID</label><input className="form-control" onChange={(e) => set('staff_id', e.target.value)} /></div>
      )}
      {screen === 'att-transport' && (
        <>
          <div className="col-md-3"><label className="form-label">Date</label><input type="date" className="form-control" onChange={(e) => set('attendance_date', e.target.value)} /></div>
          <div className="col-md-3"><label className="form-label">Transport</label>
            <select className="form-select" onChange={(e) => set('transport_number', e.target.value)}>
              {(data?.transports || []).map((t) => <option key={t.id} value={t.transport_number}>{t.transport_route || t.transport_number}</option>)}
            </select>
          </div>
        </>
      )}
      <div className="col-md-2 d-flex align-items-end">
        <button type="submit" className="btn btn-danger w-100">{SAVE_SCREENS.has(screen) && screen === 'clear-icache' ? 'Go' : 'Generate'}</button>
      </div>
    </form>
  );
}

function ApprovalList({ data, screen, onSelect, onSave, busy }) {
  const requests = data?.requests || [];
  const detail = data?.detail;
  return (
    <div className="row">
      <div className="col-md-5">
        <div className="list-group" style={{ maxHeight: '50vh', overflow: 'auto' }}>
          {requests.map((r) => (
            <button key={r.id} type="button" className="list-group-item list-group-item-action" onClick={() => onSelect({ rid: r.id })}>
              <strong>{r.staffId}</strong> {r.staffName}<br /><small>{r.fromDate} — {r.toDate} · {r.statusLabel}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="col-md-7">
        {detail?.header && (
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            onSave({ rid: detail.header.id, att_status: fd.get('status'), l_comments: fd.get('comments'), update: 'Confirm' });
          }}>
            <p><strong>{detail.header.emp_id || detail.header.staff_id}</strong></p>
            <div className="mb-2"><label className="form-label">Status</label>
              <select name="status" className="form-select" defaultValue={detail.header.status}>
                <option value="1">Approved</option><option value="2">Rejected</option><option value="0">Pending</option>
              </select>
            </div>
            <div className="mb-2"><label className="form-label">Comments</label><textarea name="comments" className="form-control" defaultValue={detail.header.comments} rows={2} /></div>
            <button type="submit" className="btn btn-primary" disabled={busy}>Confirm</button>
          </form>
        )}
      </div>
    </div>
  );
}

function ClElGrid({ data, onSave, busy }) {
  const [items, setItems] = useState([]);
  useEffect(() => { setItems(data?.rows || []); }, [data?.rows]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ items, Submit: 'Update' }); }}>
      <div className="table-responsive">
        <table className="table table-bordered table-sm">
          <thead><tr><th>Staff ID</th><th>Name</th><th>Comp CL</th><th>Comp EL</th><th>Comp OD</th></tr></thead>
          <tbody>
            {items.map((row, i) => (
              <tr key={row.sid}>
                <td>{row.staff_id}</td><td>{row.staff_name}</td>
                <td><input className="form-control form-control-sm" value={row.comp_cl} onChange={(e) => setItems((prev) => prev.map((r, j) => j === i ? { ...r, comp_cl: e.target.value } : r))} /></td>
                <td><input className="form-control form-control-sm" value={row.comp_el} onChange={(e) => setItems((prev) => prev.map((r, j) => j === i ? { ...r, comp_el: e.target.value } : r))} /></td>
                <td><input className="form-control form-control-sm" value={row.comp_od} onChange={(e) => setItems((prev) => prev.map((r, j) => j === i ? { ...r, comp_od: e.target.value } : r))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>Update</button>
    </form>
  );
}

export default function StaffAttScreenPage() {
  const { screen } = useParams();
  const meta = STAFF_ATT_SCREEN_META[screen];
  const { data, busy, error, notice, load, save } = useStaffAttScreenApi(screen);
  const { settings, menu, loading, error: shellError } = useShellData();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!meta) { setReady(true); return; }
    load().finally(() => setReady(true));
  }, [meta, load]);

  if (!meta) {
    return <div className="p-4"><p className="text-danger">Unknown staff attendance screen.</p><Link to="/attendance/staff/hub">Back</Link></div>;
  }
  if (loading || !ready) return <div className="p-4 text-muted">Loading...</div>;

  const handleGenerate = (fields) => {
    if (screen === 'clear-icache') save(fields);
    else load(fields);
  };

  return (
    <DashboardLayout settings={settings} dashboard={{ title: meta.title }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/attendance">Attendance</Link></li>
          <li className="breadcrumb-item"><Link to="/attendance/staff/hub">Staff Att</Link></li>
          <li className="breadcrumb-item active">{meta.title}</li>
        </ol>
      </nav>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div><h3 className="dashboard-title mb-0">{meta.title}</h3><p className="text-muted small mb-0">Legacy: {meta.legacy}</p></div>
        <div className="d-flex gap-2">
          {data?.reportHtml && <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => printReportHtml(data.reportHtml)}>Print</button>}
          <Link to="/attendance/staff/hub" className="btn btn-outline-secondary btn-sm">Back</Link>
        </div>
      </div>
      {shellError && <div className="alert alert-warning">{shellError}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}
      {data?.infoMessage && !data?.reportHtml && !(data?.rows?.length) && !(data?.dayRows?.length) && <div className="alert alert-info py-2">{data.infoMessage}</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {busy && (
        <div className="alert alert-light border py-2 mb-2">
          {screen === 'daily-attendance'
            ? 'Generating daily attendance — this can take 1–2 minutes for large staff lists. Please wait…'
            : screen.startsWith('att-chart')
              ? 'Generating attendance chart — select categories first; this may take a minute. Please wait…'
              : 'Loading…'}
        </div>
      )}

      <div className="card shadow-sm mb-3"><div className="card-body">
        <ReportFilters screen={screen} data={data} onGenerate={handleGenerate} />
        {APPROVAL_SCREENS.has(screen) && <ApprovalList data={data} screen={screen} busy={busy} onSelect={load} onSave={save} />}
        {screen === 'available-cl' && <ClElGrid data={data} onSave={save} busy={busy} />}
        {screen === 'compensation' && data?.staff && (
          <p className="text-muted">Compensation rows for {data.staff.staff_name}: {(data.rows || []).length}</p>
        )}
        {screen === 'holiday-roster' && data?.groups && (
          <p className="text-muted">Roster groups: {data.groups.length} (use API save for edits)</p>
        )}
      </div></div>

      {screen === 'daily-attendance' && data?.rows?.length > 0 && (
        <DailyAttendanceTable rows={data.rows} title={data.title} />
      )}

      {screen.startsWith('att-chart') && data?.dayRows?.length > 0 && (
        <AttChartTable rows={data.dayRows} title={data.title} />
      )}

      {screen !== 'daily-attendance' && !screen.startsWith('att-chart') && data?.reportHtml && (
        <div className="card shadow-sm"><div className="card-body report-html" dangerouslySetInnerHTML={{ __html: data.reportHtml }} /></div>
      )}
    </DashboardLayout>
  );
}
