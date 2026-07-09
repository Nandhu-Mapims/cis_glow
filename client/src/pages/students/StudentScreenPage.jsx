import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useShellData } from '../../hooks/useShellData';
import { printReportHtml } from '../../utils/printReport';
import AlumniEditPanel from './AlumniEditPanel';
import AlumniIdCardPanel from './AlumniIdCardPanel';
import CollageGeneratePanel from './CollageGeneratePanel';
import CollageImagePanel from './CollageImagePanel';
import PromotePanel from './PromotePanel';
import StudentPageShell, { STUDENT_BREADCRUMB_HUB } from './StudentPageShell';
import { STUDENT_SCREEN_META } from './studentModuleMeta';
import { useStudentScreenApi } from './useStudentModuleApi';

const SAVE_SCREENS = new Set([
  'photo-upload',
  'attachments-upload',
  'attachments-view',
  'temp-admission-add',
  'temp-admission-edit',
  'academic-promotion',
  'collage-image',
]);

function StudentAttachmentsPanel({ data, busy, onLoad, onSave, searchMore, readOnly }) {
  const [q, setQ] = useState('');
  const catalog = data?.catalog;
  const [items, setItems] = useState([]);
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

  return (
    <div>
      <div className="row g-2 mb-3">
        <div className="col-md-4"><input className="form-control" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by register no..." /></div>
        <div className="col-md-2">
          <button type="button" className="btn btn-outline-primary" disabled={busy} onClick={async () => {
            const res = await searchMore({ by: 'roll', q });
            const first = (Array.isArray(res) ? res : res?.students || [])[0];
            if (first) onLoad({ studentId: first.id });
          }}>Search</button>
        </div>
      </div>
      {catalog && (
        <form onSubmit={(e) => { e.preventDefault(); if (!readOnly) onSave({ studentId: catalog.studentId, items }); }}>
          <p><strong>Student #{catalog.studentId}</strong></p>
          <div className="table-responsive">
            <table className="table table-bordered table-sm">
              <thead><tr><th>Attachment</th><th>Number</th><th>File</th></tr></thead>
              <tbody>
                {catalog.types.map((t, i) => (
                  <tr key={t.attachId}>
                    <td>{t.name}</td>
                    <td>
                      <input className="form-control form-control-sm" readOnly={readOnly} value={items[i]?.attachNo || ''} onChange={(e) => setItems((p) => p.map((r, j) => j === i ? { ...r, attachNo: e.target.value } : r))} />
                    </td>
                    <td>
                      {t.fileUrl ? <a href={t.fileUrl} target="_blank" rel="noreferrer">{t.attachFile || 'View'}</a> : null}
                      {!readOnly && (
                        <input className="form-control form-control-sm mt-1" value={items[i]?.attachFile || ''} onChange={(e) => setItems((p) => p.map((r, j) => j === i ? { ...r, attachFile: e.target.value } : r))} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readOnly && <button type="submit" className="btn btn-primary" disabled={busy}>Save Attachments</button>}
        </form>
      )}
    </div>
  );
}

function formFieldsFromDom(formEl, state) {
  const fd = new FormData(formEl);
  const fromForm = {};
  for (const [key, value] of fd.entries()) {
    if (value instanceof File) continue;
    fromForm[key] = value;
  }
  return { ...state, ...fromForm };
}

function ScreenFilters({ screen, meta, data, onGenerate, onSave, busy }) {
  const [fields, setFields] = useState({});
  const set = (k, v) => setFields((prev) => ({ ...prev, [k]: v }));

  const studentSearch = (
    <>
      <div className="col-md-2">
        <select className="form-select" name="search_by" onChange={(e) => set('search_by', e.target.value)} defaultValue="roll_no">
          <option value="roll_no">Register No</option>
          <option value="batch">Batch</option>
        </select>
      </div>
      <div className="col-md-4">
        <input className="form-control" name="search_input" placeholder="Register nos (comma) or batch value" onChange={(e) => set('search_input', e.target.value)} />
      </div>
      <div className="col-md-3">
        <select className="form-select" name="search_course" onChange={(e) => set('search_course', e.target.value)} defaultValue="">
          <option value="">Course / batch</option>
          {(data?.courses || []).flatMap((c) => (c.batchOptions || []).map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          )))}
        </select>
      </div>
    </>
  );

  return (
    <form className="row g-3 mb-3" onSubmit={(e) => {
      e.preventDefault();
      const submitAction = meta.type === 'alumni-filter' ? 'Search' : 'Generate';
      const payload = { ...formFieldsFromDom(e.currentTarget, fields), Submit: submitAction };
      if (SAVE_SCREENS.has(screen)) onSave(payload);
      else onGenerate(payload);
    }}>
      {(meta.type === 'student-search-report' || meta.type === 'course-report') && studentSearch}
      {meta.type === 'course-year-report' && (
        <>
          <div className="col-md-4">
            <select className="form-select" onChange={(e) => set('search_course', e.target.value)}>
              <option value="">Course / batch</option>
              {(data?.courses || []).flatMap((c) => (c.batchOptions || []).map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              )))}
            </select>
          </div>
          <div className="col-md-2"><input className="form-control" placeholder="Year" onChange={(e) => set('search_year', e.target.value)} /></div>
        </>
      )}
      {meta.type === 'application-report' && (
        <div className="col-md-4"><input className="form-control" placeholder="Application no" onChange={(e) => set('application_no', e.target.value)} /></div>
      )}
      {meta.type === 'upload' && (
        <div className="col-md-6">
          <label className="form-label">PNG/JPG (register_no.ext)</label>
          <input type="file" className="form-control" accept=".png,.jpg,.jpeg" multiple onChange={async (e) => {
            const files = await Promise.all([...e.target.files].map((f) => new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve({ name: f.name, data: reader.result });
              reader.readAsDataURL(f);
            })));
            set('files', files);
          }} />
        </div>
      )}
      {meta.type === 'alumni-search' && (
        <>
          <div className="col-md-2"><input type="date" className="form-control" onChange={(e) => set('from_date', e.target.value)} /></div>
          <div className="col-md-2"><input type="date" className="form-control" onChange={(e) => set('to_date', e.target.value)} /></div>
          <div className="col-md-2"><input className="form-control" placeholder="Find" onChange={(e) => set('find', e.target.value)} /></div>
          <div className="col-md-2">
            <select className="form-select" onChange={(e) => set('field', e.target.value)}>
              <option value="">Field</option>
              {Object.entries(data?.fieldLabels || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </>
      )}
      {meta.type === 'alumni-filter' && (
        <>
          <div className="col-12"><div className="cis-student-filter-heading">Filter</div></div>
          <div className="col-md-2">
            <label className="form-label small text-muted mb-1">From date</label>
            <input
              type="date"
              name="from_date"
              className="form-control"
              value={fields.from_date ?? data?.filters?.from_date ?? ''}
              onChange={(e) => set('from_date', e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label small text-muted mb-1">To date</label>
            <input
              type="date"
              name="to_date"
              className="form-control"
              value={fields.to_date ?? data?.filters?.to_date ?? ''}
              onChange={(e) => set('to_date', e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label small text-muted mb-1">Year of pass</label>
            <select
              name="a_year"
              className="form-select"
              value={fields.a_year ?? data?.filters?.a_year ?? ''}
              onChange={(e) => set('a_year', e.target.value)}
            >
              <option value="">Year of pass</option>
              {(data?.yopOptions || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label small text-muted mb-1">Course</label>
            <select
              name="a_class"
              className="form-select"
              value={fields.a_class ?? data?.filters?.a_class ?? ''}
              onChange={(e) => set('a_class', e.target.value)}
            >
              <option value="">Select course</option>
              {(data?.courseOptions || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </>
      )}
      {meta.type === 'alumni-find' && (
        <div className="col-md-4"><input className="form-control" name="find" placeholder="Name or reg no" onChange={(e) => set('find', e.target.value)} /></div>
      )}
      {meta.type === 'temp-form' && (
        <>
          <div className="col-md-3"><input className="form-control" placeholder="Application no *" onChange={(e) => set('application_no', e.target.value)} /></div>
          <div className="col-md-3"><input className="form-control" placeholder="Student name" onChange={(e) => set('student_name', e.target.value)} /></div>
          <div className="col-md-2"><input className="form-control" placeholder="Register no" onChange={(e) => set('register_no', e.target.value)} /></div>
          <div className="col-md-2"><input className="form-control" placeholder="Mobile" onChange={(e) => set('mobile_no', e.target.value)} /></div>
        </>
      )}
      {meta.type === 'temp-form-search' && (
        <>
          <div className="col-md-3"><input className="form-control" placeholder="Application no" onChange={(e) => set('application_no', e.target.value)} /></div>
          <div className="col-md-2 d-flex align-items-end">
            <button type="button" className="btn btn-outline-primary" disabled={busy} onClick={() => onGenerate({ application_no: fields.application_no })}>Load</button>
          </div>
          {data?.profile && (
            <>
              <div className="col-md-3"><input className="form-control" defaultValue={data.profile.studentName} placeholder="Name" onChange={(e) => set('student_name', e.target.value)} /></div>
              <div className="col-md-2"><input className="form-control" defaultValue={data.profile.registerNo} placeholder="Register no" onChange={(e) => set('register_no', e.target.value)} /></div>
              <input type="hidden" value={data.profile.id} onChange={() => set('student_id', data.profile.id)} />
            </>
          )}
        </>
      )}
      {meta.type === 'academic-form' && (
        <>
          <div className="col-md-3"><input className="form-control" placeholder="Register no" onChange={(e) => set('register_no', e.target.value)} /></div>
          <div className="col-md-2 d-flex align-items-end">
            <button type="button" className="btn btn-outline-primary" disabled={busy} onClick={() => onGenerate({ register_no: fields.register_no })}>Load</button>
          </div>
        </>
      )}
      {meta.type === 'alumni-form' && (
        <>
          <div className="col-md-3"><input className="form-control" placeholder="Alumni reg no" onChange={(e) => set('reg_no', e.target.value)} /></div>
          <div className="col-md-2 d-flex align-items-end">
            <button type="button" className="btn btn-outline-primary" disabled={busy} onClick={() => onGenerate({ reg_no: fields.reg_no })}>Load</button>
          </div>
        </>
      )}
      {!['attachments', 'attachments-view', 'collage-image', 'alumni-form', 'promote-form'].includes(meta.type) && (
        <div className="col-md-2 d-flex align-items-end">
          <button type="submit" className="btn btn-primary w-100" disabled={busy}>
            {SAVE_SCREENS.has(screen) ? 'Save' : meta.type === 'alumni-filter' ? 'Search' : 'Generate'}
          </button>
        </div>
      )}
    </form>
  );
}

export default function StudentScreenPage() {
  const location = useLocation();
  const pathSlug = location.pathname.replace(/^\/students\//, '');
  const screen = STUDENT_SCREEN_META[pathSlug] ? pathSlug : null;
  const meta = screen ? STUDENT_SCREEN_META[screen] : null;
  const { data, busy, error, notice, load, save, searchMore } = useStudentScreenApi(screen || 'id-card');
  const { settings, menu, loading: shellLoading, error: shellError, reload: reloadShell } = useShellData();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!meta) {
      setReady(true);
      return;
    }
    setReady(false);
    load().finally(() => setReady(true));
  }, [screen, meta, load]);

  const pageLoading = shellLoading || (meta && !ready);

  const hasAlerts = Boolean((shellError && settings) || notice || error);

  if (!meta) {
    return (
      <StudentPageShell
        settings={settings}
        menu={menu}
        loading={shellLoading}
        error={shellError}
        onRetry={reloadShell}
        dashboardTitle="Student"
        breadcrumbs={[
          { label: 'Home', to: '/dashboard' },
          STUDENT_BREADCRUMB_HUB,
          { label: 'Screen' },
        ]}
        title="Unknown screen"
      >
        <div className="alert alert-danger mb-3">Unknown student screen.</div>
        <Link to="/students/hub" className="btn btn-outline-secondary btn-sm">Back to module hub</Link>
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell
      settings={settings}
      menu={menu}
      loading={pageLoading}
      error={shellError && !settings ? shellError : null}
      onRetry={reloadShell}
      dashboardTitle={meta.title}
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        STUDENT_BREADCRUMB_HUB,
        { label: meta.title },
      ]}
      title={meta.title}
      legacy={meta.legacy}
      actions={(
        <>
          {data?.reportHtml && screen !== 'alumni-id-card' && (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={() => printReportHtml(data.reportHtml)}
            >
              Print
            </button>
          )}
          <Link to="/students/hub" className="btn btn-outline-secondary btn-sm">Module Hub</Link>
        </>
      )}
      notice={hasAlerts ? (
        <>
          {shellError && settings && <div className="alert alert-warning mb-0">{shellError}</div>}
          {notice && <div className="alert alert-success mb-0">{notice}</div>}
          {error && <div className="alert alert-danger mb-0">{error}</div>}
        </>
      ) : null}
    >
      {screen === 'alumni-edit' ? (
        <AlumniEditPanel data={data} busy={busy} onLoad={load} onSave={save} />
      ) : screen === 'alumni-id-card' ? (
        <AlumniIdCardPanel data={data} busy={busy} onGenerate={load} />
      ) : screen === 'collage-generate' ? (
        <CollageGeneratePanel data={data} busy={busy} onGenerate={load} />
      ) : screen === 'collage-image' ? (
        <CollageImagePanel data={data} busy={busy} onSave={save} onReload={load} />
      ) : (
      <div className="card cis-student-screen-card mb-3">
        <div className="card-body">
          {screen === 'promote' && (
            <PromotePanel data={data} busy={busy} onReload={load} onPromote={save} />
          )}
          {screen !== 'promote' && screen !== 'alumni-id-card' && screen !== 'collage-generate' && screen !== 'collage-image' && meta.type !== 'attachments' && meta.type !== 'attachments-view' && meta.type !== 'collage-image' && (
            <ScreenFilters screen={screen} meta={meta} data={data} busy={busy} onGenerate={load} onSave={save} />
          )}
          {(screen === 'attachments-upload' || screen === 'attachments-view') && (
            <StudentAttachmentsPanel
              data={data}
              busy={busy}
              onLoad={load}
              onSave={save}
              searchMore={searchMore}
              readOnly={screen === 'attachments-view'}
            />
          )}
          {meta.type === 'academic-form' && data?.academics?.length > 0 && (
            <div className="table-responsive mt-3">
              <table className="table table-bordered table-sm">
                <thead><tr><th>Year</th><th>Batch</th><th>Current Year</th><th>Type</th><th>Register</th></tr></thead>
                <tbody>
                  {data.academics.map((a) => (
                    <tr key={a.id}><td>{a.academicYear}</td><td>{a.academicBatch}</td><td>{a.currentYear}</td><td>{a.academicType}</td><td>{a.registerNo}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}
      {data?.reportHtml && meta.type !== 'upload' && screen !== 'alumni-id-card' && (
        <div className="card cis-student-report-output">
          <div className="card-body report-html" dangerouslySetInnerHTML={{ __html: data.reportHtml }} />
        </div>
      )}
    </StudentPageShell>
  );
}
