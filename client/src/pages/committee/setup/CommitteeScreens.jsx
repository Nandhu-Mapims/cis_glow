import { Fragment, useEffect, useRef, useState } from 'react';
import api from '../../../api/client';
import ChipMultiSelect from '../../../components/ChipMultiSelect';
import CheckListSelect from '../../../components/CheckListSelect';
import HtmlRichTextEditor from '../../../components/HtmlRichTextEditor';
import { DragHandle, useDragReorder } from '../../../hooks/useDragReorder';
import { printReportHtml, printTaskManageReportSection } from '../../../utils/printReport';

function tvAcademicYears() {
  const years = [];
  const end = new Date().getFullYear() + 1;
  for (let y = end; y >= 2017; y -= 1) years.push(y);
  return years;
}

function tvMonthLabel(month) {
  return new Date(2000, month - 1, 1).toLocaleString('en', { month: 'long' });
}

function TvAcademicToolbar({
  calMonth,
  calYear,
  onMonthChange,
  onYearChange,
  onGo,
  busy,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  showRejectedLegend = true,
  departments,
  onDepartmentsChange,
  departmentsList,
  onPrint,
}) {
  const years = tvAcademicYears();
  return (
    <div className="tv-academic-toolbar">
      <div className="tv-academic-toolbar-row">
        <div className="tv-academic-field">
          <label className="form-label" htmlFor="tv-cal-month">Month</label>
          <select
            id="tv-cal-month"
            className="form-select form-select-sm tv-month-select"
            value={String(calMonth)}
            onChange={(e) => onMonthChange(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={String(m)}>{tvMonthLabel(m)}</option>
            ))}
          </select>
        </div>
        <div className="tv-academic-field">
          <label className="form-label" htmlFor="tv-cal-year">Year</label>
          <select
            id="tv-cal-year"
            className="form-select form-select-sm tv-year-select"
            value={String(calYear)}
            onChange={(e) => onYearChange(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>
        {departmentsList ? (
          <div className="tv-academic-field tv-dept-field">
            <label className="form-label" htmlFor="tv-cal-dept">Department</label>
            <select
              id="tv-cal-dept"
              className="form-select form-select-sm tv-dept-select"
              multiple
              size={3}
              value={departments}
              onChange={(e) => onDepartmentsChange(Array.from(e.target.selectedOptions, (o) => o.value))}
            >
              {departmentsList.map((d) => (
                <option key={d.id} value={String(d.id)}>{d.name}</option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="tv-academic-field tv-academic-actions">
          <span className="form-label tv-academic-label-spacer" aria-hidden="true">&nbsp;</span>
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm btn-info" disabled={busy} onClick={onGo}>Go</button>
            {onPrint ? (
              <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={onPrint}>Print</button>
            ) : null}
          </div>
        </div>
      </div>
      <div className="tv-academic-toolbar-row tv-academic-toolbar-meta">
        <div className="small tv-academic-legend">
          <span className="tv-legend-created">&#9632;</span> Task Created
          <span className="tv-legend-approved">&#9632;</span> Task Approved
          {showRejectedLegend ? <><span className="tv-legend-rejected">&#9632;</span> Task Rejected </> : null}
          <span className="tv-legend-completed">&#9632;</span> Task Completed
        </div>
        <div className="small tv-academic-nav">
          <button type="button" className="btn btn-link btn-sm p-0" onClick={onPrev}>{prevLabel}</button>
          {' '}
          <button type="button" className="btn btn-link btn-sm p-0" onClick={onNext}>{nextLabel}</button>
        </div>
      </div>
    </div>
  );
}

function fileToPayload(file) {
  if (!file) return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, data: reader.result });
    reader.readAsDataURL(file);
  });
}

export function RowSetupScreen({ data, busy, onLoad, onSave, columns }) {
  const [rows, setRows] = useState([]);
  const sortable = columns.some((c) => c.key === 'order');
  const { dragHandleProps, rowDropProps, rowClassName } = useDragReorder(rows, setRows);
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.rows) setRows(data.rows); }, [data]);
  const update = (i, patch) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const deleteRow = (i) => {
    const row = rows[i];
    if (row.id) onSave({ action: 'delete', id: row.id });
    else setRows((p) => p.filter((_, j) => j !== i));
  };
  return (
    <div>
      <table className="table table-sm table-bordered">
        <thead><tr>{sortable ? <th style={{ width: '2rem' }} aria-hidden="true" /> : null}{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th /></tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || `new-${i}`} className={sortable ? rowClassName(i) : undefined} {...(sortable ? rowDropProps(i) : {})}>
              {sortable ? <td className="text-center"><DragHandle {...dragHandleProps(i)} /></td> : null}
              {columns.map((c) => (
                <td key={c.key}>
                  {c.key === 'order' && sortable ? (
                    <input className="form-control form-control-sm" value={row[c.key] ?? ''} readOnly disabled title="Drag the row's handle to reorder" />
                  ) : (
                    <input className="form-control form-control-sm" value={row[c.key] ?? ''} onChange={(e) => update(i, { [c.key]: e.target.value })} />
                  )}
                </td>
              ))}
              <td>
                <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} title="Delete row" onClick={() => deleteRow(i)}>
                  <i className="fa fa-trash" aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="d-flex align-items-center gap-2">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setRows([...rows, Object.fromEntries(columns.map((c) => [c.key, '']))])}>Add row</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => onSave({ rows })}>Save</button>
      </div>
    </div>
  );
}

export function DesignationScreen(props) {
  return <RowSetupScreen {...props} columns={[{ key: 'name', label: 'Name' }, { key: 'shortName', label: 'Short' }, { key: 'order', label: 'Order' }]} />;
}

export function TaskTypeScreen(props) {
  return <RowSetupScreen {...props} columns={[{ key: 'title', label: 'Title' }, { key: 'format', label: 'Format' }, { key: 'order', label: 'Order' }]} />;
}

export function TaskWtypeScreen(props) {
  return <RowSetupScreen {...props} columns={[{ key: 'title', label: 'Title' }, { key: 'shortName', label: 'Short name' }, { key: 'order', label: 'Order' }]} />;
}

export function TaskParticipatorScreen(props) {
  return <TaskWtypeScreen {...props} />;
}

export function TaskMiscScreen(props) {
  return <RowSetupScreen {...props} columns={[{ key: 'title', label: 'Title' }]} />;
}

export function TaskDocTypeScreen(props) {
  return <RowSetupScreen {...props} columns={[{ key: 'title', label: 'Title' }, { key: 'order', label: 'Order' }]} />;
}

export function TaskBudgetExpensesScreen(props) {
  return <TaskWtypeScreen {...props} />;
}

export function TaskEventOrgScreen(props) {
  return <TaskWtypeScreen {...props} />;
}

export function CommitteeDashboardScreen({ data, busy, onLoad, onSave }) {
  const [month, setMonth] = useState('');
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.calendarMonth) setMonth(data.calendarMonth); }, [data?.calendarMonth]);

  const loadMonth = (calendarMonth) => {
    setMonth(calendarMonth);
    onLoad({ calendarMonth, flag: null, categoryId: null, committees: [] });
  };

  const viewCommittees = (category) => {
    onLoad({
      calendarMonth: month,
      flag: 1,
      categoryId: category.id,
      categoryName: category.name,
    });
  };

  return (
    <div className="committee-dashboard-root">
      <div className="row g-2 mb-3 align-items-end">
        <div className="col-md-4">
          <label className="form-label">Month</label>
          <input type="month" className="form-control" value={month} onChange={(e) => loadMonth(e.target.value)} />
        </div>
      </div>

      <div className="row g-3 mb-4">
        {(data?.categories || []).map((c) => (
          <div key={c.id} className="col-md-4 col-lg-2">
            <div className={`committee-dash-card card h-100 ${data?.selectedCategoryId === c.id ? 'committee-dash-card-active' : ''}`}>
              <div className="committee-dash-card-header">{c.name}</div>
              <div className="card-body text-center d-flex flex-column justify-content-between">
                <div className="committee-dash-count">{c.committeeCount}</div>
                <button
                  type="button"
                  className="btn btn-link btn-sm committee-dash-link p-0"
                  disabled={busy || c.committeeCount === 0}
                  onClick={() => viewCommittees(c)}
                >
                  View committees
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {data?.categoryName && data?.committees?.length ? (
        <div className="card shadow-sm mb-3">
          <div className="card-header bg-white fw-semibold">{data.categoryName} committees</div>
          <div className="card-body p-0">
            <table className="table table-sm table-bordered mb-0">
              <thead><tr><th style={{ width: '80px' }}>#</th><th>Committee</th></tr></thead>
              <tbody>{data.committees.map((r) => <tr key={r.sno}><td>{r.sno}</td><td>{r.title}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="card shadow-sm">
        <div className="card-header bg-white fw-semibold">Month events</div>
        <div className="card-body p-0">
          <table className="table table-sm table-bordered mb-0">
            <thead><tr><th style={{ width: '130px' }}>Date</th><th>Event</th><th style={{ width: '90px' }}>Task</th></tr></thead>
        <tbody>
              {(data?.events || []).length ? (data.events || []).map((e) => (
                <tr key={e.id}><td className="text-nowrap">{e.fromDate}</td><td>{e.title}</td><td>{e.hasTask ? 'Yes' : 'No'}</td></tr>
              )) : (
                <tr><td colSpan={3} className="text-muted">No events for this month.</td></tr>
              )}
        </tbody>
      </table>
        </div>
      </div>
    </div>
  );
}

export function CommitteeAddScreen({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({ title: '', description: '', categories: [] });
  const [file, setFile] = useState(null);
  useEffect(() => { onLoad(); }, [onLoad]);
  return (
    <form onSubmit={async (e) => { e.preventDefault(); const files = file ? [await fileToPayload(file)] : []; onSave(form, files); }}>
      <div className="mb-2"><label className="form-label">Name</label><input className="form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required disabled={busy} /></div>
      <HtmlRichTextEditor
        className="mb-2"
        label="Activities"
        value={form.description}
        onChange={(description) => setForm((f) => ({ ...f, description }))}
        disabled={busy}
        required
      />
      <div className="mb-2"><label className="form-label">Logo</label><input type="file" className="form-control" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
      <div className="mb-3">
        <span className="form-label" id="committee_add_categories_label">Categories</span>
        <CheckListSelect
          aria-labelledby="committee_add_categories_label"
          options={(data?.categories || []).map((c) => ({ value: String(c.id), label: c.name }))}
          value={form.categories}
          onChange={(next) => setForm({ ...form, categories: next })}
          searchPlaceholder="Search categories..."
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>Save</button>
    </form>
  );
}

export function CommitteeEditScreen({ data, busy, onLoad, onSave }) {
  const [committeeId, setCommitteeId] = useState('');
  const [form, setForm] = useState({ title: '', description: '', categories: [], logo: '' });
  const [file, setFile] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const savedFormRef = useRef(null);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.committeeId !== undefined) setCommitteeId(String(data.committeeId || ''));
    if (data?.form) {
      const next = {
        title: data.form.title || '',
        description: data.form.description || '',
        categories: (data.form.categories || []).map(String),
        logo: data.form.logo || '',
        logoUrl: data.form.logoUrl || '',
      };
      setForm(next);
      savedFormRef.current = next;
      setFile(null);
    }
  }, [data]);

  const showForm = Boolean(committeeId);
  const showOverlay = Boolean(busy && committeeId);

  const handleReset = () => {
    if (savedFormRef.current) {
      setForm({ ...savedFormRef.current });
      setFile(null);
    }
  };

  const clearLogo = () => setForm((f) => ({ ...f, logo: '', logoUrl: '' }));

  return (
    <div className="committee-edit-root row g-3">
      <div className="col-md-4">
        <div className="list-group committee-edit-list">
          {(data?.committees || []).map((c) => (
            <button
              key={c.id}
              type="button"
              className={`list-group-item list-group-item-action ${String(c.id) === committeeId ? 'active' : ''}`}
              disabled={busy}
              onClick={() => onLoad({ committeeId: c.id })}
            >
              {c.title}
            </button>
          ))}
        </div>
      </div>

      <div className="col-md-8">
        {!committeeId && !busy && (
          <p className="text-muted mb-0">Select a committee from the list to edit.</p>
        )}

        {showForm && (
          <div className={`committee-edit-panel${showOverlay ? ' is-loading' : ''}`}>
            {showOverlay && (
              <div className="committee-edit-loading" aria-live="polite" aria-busy="true">
                <div className="loading-copy">
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  <span>Loading committee…</span>
                </div>
              </div>
            )}

            <form
              className="committee-edit-content"
              onSubmit={async (e) => {
                e.preventDefault();
                const files = file ? [await fileToPayload(file)] : [];
                onSave({ ...form, committeeId }, files);
              }}
            >
              <div className="mb-2">
                <label className="form-label">Name</label>
                <input
                  className="form-control"
                  value={form.title || ''}
                  required
                  disabled={busy}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <HtmlRichTextEditor
                className="mb-2"
                label="Activities"
                value={form.description || ''}
                onChange={(description) => setForm((f) => ({ ...f, description }))}
                disabled={busy}
                required
              />
              <div className="mb-2">
                <label className="form-label">Logo</label>
                <input
                  type="file"
                  className="form-control"
                  disabled={busy}
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                {form.logoUrl && !file && (
                  <div className="mt-2 d-flex align-items-center gap-2 flex-wrap">
                    <a href={form.logoUrl} target="_blank" rel="noreferrer">{form.logo}</a>
                    <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={clearLogo}>
                      Remove
                    </button>
                  </div>
                )}
                {file && <div className="form-text mt-1">New file selected: {file.name}</div>}
              </div>
          <div className="mb-3">
            <span className="form-label" id="committee_edit_categories_label">Categories</span>
            <CheckListSelect
              aria-labelledby="committee_edit_categories_label"
              options={(data?.categories || []).map((c) => ({ value: String(c.id), label: c.name }))}
              value={form.categories || []}
              disabled={busy}
              onChange={(next) => setForm({ ...form, categories: next })}
              searchPlaceholder="Search categories..."
            />
          </div>
              <button
                type="submit"
                className="btn btn-danger d-inline-flex align-items-center gap-2 me-2"
                disabled={busy || !committeeId}
              >
                {busy ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                    Saving…
                  </>
                ) : 'Save'}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary me-2"
                disabled={busy || !committeeId}
                onClick={handleReset}
              >
                Reset
              </button>
              <button
                type="button"
                className="btn btn-outline-danger"
                disabled={busy || !committeeId}
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </button>
        </form>
      </div>
        )}
      </div>

      {deleteOpen && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="modal-dialog modal-sm">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirm</h5>
                <button type="button" className="btn-close" aria-label="Close" disabled={busy} onClick={() => setDeleteOpen(false)} />
              </div>
              <div className="modal-body">Are you sure to delete this committee?</div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => setDeleteOpen(false)}>Close</button>
                <button
                  type="button"
                  className="btn btn-warning"
                  disabled={busy}
                  onClick={async () => {
                    await onSave({ action: 'delete', committeeId });
                    setDeleteOpen(false);
                    setCommitteeId('');
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CommitteeReportScreen({ data, busy, onLoad }) {
  const [committeeId, setCommitteeId] = useState('');
  const printRef = useRef(null);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.committeeId) setCommitteeId(String(data.committeeId));
  }, [data?.committeeId]);

  const committee = data?.committee;
  const members = data?.members || [];
  const showContent = Boolean(committeeId && (committee || busy));
  const showOverlay = Boolean(busy && committeeId);

  const handlePrint = () => {
    if (!printRef.current) return;
    const printCss = `<style>
.committee-report-header { display:flex; flex-wrap:wrap; gap:1rem; margin-bottom:1rem; max-width:980px; }
.committee-report-header-text { flex:1 1 70%; min-width:200px; }
.committee-report-title { margin:0 0 5px; padding:0; }
.committee-report-categories { margin:0; padding:0; }
.committee-report-grid { display:flex; flex-wrap:wrap; clear:both; max-width:980px; }
.committee-report-card { width:170px; min-height:250px; margin:5px; border:1px solid #000; padding:3px; box-sizing:border-box; float:left; }
.committee-report-photo { width:100%; height:165px; overflow:hidden; }
.committee-report-photo img { width:100%; height:160px; object-fit:cover; display:block; }
.committee-report-staff, .committee-report-designation { text-align:center; padding:0; margin:0; font-size:14px; line-height:15px; }
.committee-report-staff { padding-bottom:5px; }
</style>`;
    printReportHtml(`${printCss}${printRef.current.outerHTML}`);
  };

  return (
    <div className="committee-report-root">
      <div className="row g-2 mb-3 align-items-end">
        <div className="col-md-4">
          <label className="form-label">Committee</label>
          <select
            className="form-select"
            value={committeeId}
            disabled={busy}
            onChange={(e) => {
              const id = e.target.value;
              setCommitteeId(id);
              onLoad({ committeeId: id });
            }}
          >
            <option value="">--Select--</option>
            {(data?.committees || []).map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
      </div>
        <div className="col-md-3 d-flex align-items-end gap-2 pb-1">
          <button
            type="button"
            className="btn btn-primary d-inline-flex align-items-center gap-2"
            disabled={busy || !committeeId}
            onClick={() => onLoad({ committeeId })}
          >
            {busy ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                Loading…
              </>
            ) : 'Go'}
          </button>
          {committee && !busy && (
            <button type="button" className="btn btn-info" onClick={handlePrint}>
              Print
            </button>
          )}
        </div>
      </div>

      {!committeeId && !busy && (
        <p className="text-muted mb-0">Select a committee and click Go to view member information.</p>
      )}

      {showContent && (
        <div className={`committee-report-panel${showOverlay ? ' is-loading' : ''}`}>
          {showOverlay && (
            <div className="committee-report-loading" aria-live="polite" aria-busy="true">
              <div className="loading-copy">
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                <span>Loading committee information…</span>
              </div>
            </div>
          )}

          {committee ? (
            <div id="committee_details_span" ref={printRef} className="committee-report-print-area">
              <div className="committee-report-header">
                <div className="committee-report-header-text">
                  <h3 className="committee-report-title">{committee.title}</h3>
                  {committee.categories && (
                    <p className="committee-report-categories"><small>{committee.categories}</small></p>
                  )}
                </div>
                {committee.logoUrl && (
                  <div className="committee-report-logo">
                    <img src={committee.logoUrl} alt="" width={100} />
                  </div>
                )}
              </div>
              {committee.description && (
                <div
                  className="committee-report-description"
                  dangerouslySetInnerHTML={{ __html: committee.description }}
                />
              )}
              {members.length > 0 ? (
                <div className="committee-report-grid">
                  {members.map((m) => (
                    <div key={m.id} className="committee-report-card">
                      <div className="committee-report-photo">
                        {m.photoUrl ? (
                          <img
                            src={m.photoUrl}
                            alt={m.staffName || m.staffId}
                            onError={(e) => {
                              if (m.photoUrlAlt && e.currentTarget.src !== m.photoUrlAlt) {
                                e.currentTarget.src = m.photoUrlAlt;
                              }
                            }}
                          />
                        ) : null}
                      </div>
                      <p className="committee-report-staff">
                        <strong>{m.staffId}</strong>
                        <br />
                        {m.staffName}
                      </p>
                      <p className="committee-report-designation"><strong>{m.designation}</strong></p>
                    </div>
                  ))}
                </div>
              ) : !busy ? (
                <p className="committee-report-empty text-muted">No current members found for this committee.</p>
              ) : null}
            </div>
          ) : (
            <div className="committee-report-placeholder" aria-hidden="true" />
          )}
        </div>
      )}
    </div>
  );
}

export function CommitteeMemberScreen({ data, busy, onLoad, onSave }) {
  const [committeeId, setCommitteeId] = useState('');
  const [rows, setRows] = useState([]);
  const [deleteId, setDeleteId] = useState(null);
  const savedRowsRef = useRef([]);
  const { dragHandleProps, rowDropProps, rowClassName } = useDragReorder(rows, setRows);

  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.committeeId !== undefined) setCommitteeId(String(data.committeeId || ''));
    if (data?.rows) {
      setRows(data.rows);
      savedRowsRef.current = data.rows;
    }
  }, [data]);

  const update = (i, patch) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const showPanel = Boolean(committeeId);
  const showOverlay = Boolean(busy && committeeId);

  const addRow = () => {
    setRows((r) => [...r, {
      staffId: '',
      designation: '',
      fromDate: '',
      toDate: '',
      order: r.length + 1,
      owner: false,
    }]);
  };

  const handleReset = () => {
    setRows(savedRowsRef.current.length
      ? savedRowsRef.current.map((row) => ({ ...row }))
      : [{ staffId: '', designation: '', fromDate: '', toDate: '', order: 1, owner: false }]);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await onSave({ action: 'delete', rowId: deleteId, committeeId });
    setDeleteId(null);
  };

  return (
    <div className="committee-member-root">
      <div className="row g-2 mb-3">
        <div className="col-md-5">
          <label className="form-label">Committee</label>
          <select
            className="form-select"
            value={committeeId}
            disabled={busy}
            onChange={(e) => {
              const id = e.target.value;
              setCommitteeId(id);
              onLoad({ committeeId: id });
            }}
          >
            <option value="">--Select--</option>
            {(data?.committees || []).map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
      </select>
        </div>
      </div>

      {!committeeId && !busy && (
        <p className="text-muted mb-0">Select a committee to manage members.</p>
      )}

      {showPanel && (
        <div className={`committee-member-panel${showOverlay ? ' is-loading' : ''}`}>
          {showOverlay && (
            <div className="committee-member-loading" aria-live="polite" aria-busy="true">
              <div className="loading-copy">
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                <span>Loading members…</span>
              </div>
            </div>
          )}

          <div className="committee-member-content">
            <div className="table-responsive">
              <table className="table table-bordered committee-member-table mb-0">
                <thead>
                  <tr>
                    <th style={{ width: '2rem' }} aria-hidden="true" />
                    <th>Order</th>
                    <th>Staff</th>
                    <th>Designation</th>
                    <th>Meeting Owner</th>
                    <th>From</th>
                    <th>To</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || `new-${i}`} className={rowClassName(i)} {...rowDropProps(i)}>
                      <td className="text-center"><DragHandle {...dragHandleProps(i)} /></td>
                      <td className="committee-member-order">
                        <input
                          className="form-control form-control-sm"
                          value={row.order ?? ''}
                          readOnly
                          disabled
                          title="Drag the row's handle to reorder"
                        />
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={String(row.staffId || '')}
                          disabled={busy}
                          onChange={(e) => update(i, { staffId: e.target.value })}
                        >
                          <option value="">--Select--</option>
                          {(data?.staffOptions || []).map((s) => (
                            <option key={s.id} value={String(s.id)}>{s.label}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={String(row.designation || '')}
                          disabled={busy}
                          onChange={(e) => update(i, { designation: e.target.value })}
                        >
                          <option value="">--Select--</option>
                          {(data?.designations || []).map((d) => (
                            <option key={d.id} value={String(d.id)}>{d.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="text-center committee-member-owner">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={Boolean(row.owner)}
                          disabled={busy}
                          onChange={(e) => update(i, { owner: e.target.checked })}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={row.fromDate || ''}
                          max={row.toDate || undefined}
                          disabled={busy}
                          onChange={(e) => update(i, { fromDate: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={row.toDate || ''}
                          min={row.fromDate || undefined}
                          disabled={busy}
                          onChange={(e) => update(i, { toDate: e.target.value })}
                        />
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          disabled={busy}
                          title="Delete"
                          onClick={() => (row.id ? setDeleteId(row.id) : setRows((p) => p.filter((_, j) => j !== i)))}
                        >
                          <i className="fa fa-trash" aria-hidden="true" />
                        </button>
                      </td>
            </tr>
          ))}
        </tbody>
      </table>
            </div>

            <div className="committee-member-actions mt-3 d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={busy}
                onClick={addRow}
              >
                Add row
              </button>
              <button
                type="button"
                className="btn btn-danger d-inline-flex align-items-center gap-2"
                disabled={busy || !committeeId}
                onClick={() => onSave({ committeeId, rows })}
              >
                {busy ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                    Saving…
                  </>
                ) : 'Save'}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={busy || !committeeId}
                onClick={handleReset}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId ? (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="modal-dialog modal-sm">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirm</h5>
                <button type="button" className="btn-close" aria-label="Close" disabled={busy} onClick={() => setDeleteId(null)} />
              </div>
              <div className="modal-body">Are you sure to delete this member?</div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => setDeleteId(null)}>Close</button>
                <button type="button" className="btn btn-warning" disabled={busy} onClick={confirmDelete}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function EventTypeScreen({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({});
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.form) setForm(data.form); }, [data]);
  return (
    <div>
      <select className="form-select mb-3" value={form.eventTypeId || ''} onChange={(e) => onLoad({ eventTypeId: e.target.value })}>
        <option value="">Select event type</option>
        {(data?.eventTypes || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        <option value="add_new">Add new</option>
      </select>
      {form.eventTypeId ? (
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
          <div className="mb-2"><input className="form-control" placeholder="Name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="mb-2"><input type="number" className="form-control" placeholder="Order" value={form.order || ''} onChange={(e) => setForm({ ...form, order: e.target.value })} /></div>
          <div className="list-group mb-3">
            {(data?.flagOptions || []).map((flag) => (
              <label key={flag} className="list-group-item">
                <input type="checkbox" checked={(form.enabledFlags || []).includes(flag)} onChange={(e) => {
                  const flags = form.enabledFlags || [];
                  setForm({ ...form, enabledFlags: e.target.checked ? [...flags, flag] : flags.filter((f) => f !== flag) });
                }} /> {flag}
              </label>
            ))}
          </div>
          <button type="submit" className="btn btn-primary me-2" disabled={busy}>Save</button>
          {form.eventTypeId !== 'add_new' ? <button type="button" className="btn btn-outline-danger" onClick={() => onSave({ action: 'delete', eventTypeId: form.eventTypeId })}>Delete</button> : null}
        </form>
      ) : null}
    </div>
  );
}

export function TaskCategoryScreen({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({});
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.form) setForm(data.form); }, [data]);
  return (
    <div>
      <select className="form-select mb-3" value={form.categoryId || ''} onChange={(e) => onLoad({ categoryId: e.target.value })}>
        <option value="">Select category</option>
        {(data?.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        <option value="add_new">Add new</option>
      </select>
      {form.categoryId ? (
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
          <div className="mb-2"><input className="form-control" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="d-flex flex-wrap gap-2 mb-3">
            {(data?.workTypes || []).map((w) => (
              <label key={w.id}><input type="checkbox" checked={(form.workTypeIds || []).includes(String(w.id))} onChange={(e) => {
                const id = String(w.id);
                const ids = form.workTypeIds || [];
                setForm({ ...form, workTypeIds: e.target.checked ? [...ids, id] : ids.filter((x) => x !== id) });
              }} /> {w.title}</label>
            ))}
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>Save</button>
        </form>
      ) : null}
    </div>
  );
}

export function ClientFormScreen({ data, busy, onLoad, onSave, isEdit }) {
  const [form, setForm] = useState({});
  const [file, setFile] = useState(null);
  const [clientId, setClientId] = useState('');
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => {
    if (data?.form) setForm(data.form);
    if (data?.clientId) setClientId(String(data.clientId));
  }, [data]);
  const submit = async (e) => {
    e.preventDefault();
    const files = file ? [await fileToPayload(file)] : [];
    onSave(isEdit ? { ...form, clientId } : form, files);
  };
  return (
    <div className="row g-3">
      {isEdit ? (
        <div className="col-md-4">
          <div className="list-group">
            {(data?.clients || []).map((c) => (
              <button key={c.id} type="button" className={`list-group-item list-group-item-action ${String(c.id) === clientId ? 'active' : ''}`} onClick={() => onLoad({ clientId: c.id })}>{c.name}</button>
            ))}
          </div>
        </div>
      ) : null}
      <div className={isEdit ? 'col-md-8' : 'col-12'}>
        <form onSubmit={submit}>
          {['name', 'type', 'email', 'phone'].map((k) => (
            <div key={k} className="mb-2"><label className="form-label">{k}</label><input className="form-control" value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
          ))}
          <div className="mb-2"><label className="form-label">Address</label><textarea className="form-control" rows={2} value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="mb-2"><label className="form-label">About</label><textarea className="form-control" rows={3} value={form.about || ''} onChange={(e) => setForm({ ...form, about: e.target.value })} /></div>
          <div className="mb-2"><label className="form-label">Logo</label><input type="file" className="form-control" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
          <button type="submit" className="btn btn-primary" disabled={busy}>{isEdit ? 'Update' : 'Save'}</button>
        </form>
      </div>
    </div>
  );
}

export function ColourSetupScreen({ data, busy, onLoad, onSave }) {
  const [colours, setColours] = useState({});
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.colours) setColours(data.colours); }, [data]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(colours); }}>
      {(data?.groups || []).map((group) => (
        <div key={group} className="mb-3">
          <h6 className="text-capitalize">{group}</h6>
          <div className="d-flex gap-2 flex-wrap">
            {(colours[group] || []).map((c, i) => (
              <input key={`${group}-${i}`} type="color" value={c || '#ffffff'} onChange={(e) => {
                const next = { ...colours, [group]: [...(colours[group] || [])] };
                next[group][i] = e.target.value;
                setColours(next);
              }} />
            ))}
          </div>
        </div>
      ))}
      <button type="submit" className="btn btn-primary" disabled={busy}>Save colours</button>
    </form>
  );
}

export function TimesheetSetupScreen({ data, busy, onLoad, onSave }) {
  const [form, setForm] = useState({});
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.form) setForm(data.form); }, [data]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      {['memberLabel', 'miscellaneous', 'workingHour', 'workingComments', 'workingInout'].map((k) => (
        <div key={k} className="mb-2"><label className="form-label">{k}</label><input className="form-control" value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
      ))}
      <button type="submit" className="btn btn-primary" disabled={busy}>Save</button>
    </form>
  );
}

export function TaskPickerScreen({ data, busy, onLoad, onSave, taskField = 'taskId', children }) {
  const [taskId, setTaskId] = useState('');
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.[taskField]) setTaskId(String(data[taskField])); }, [data, taskField]);
  return (
    <div>
      <select className="form-select mb-3" value={taskId} onChange={(e) => { setTaskId(e.target.value); onLoad({ [taskField]: e.target.value }); }}>
        <option value="">Select task</option>
        {(data?.tasks || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      {taskId && children ? children({ data, busy, onLoad, onSave, taskId }) : null}
    </div>
  );
}

export function TaskDashboardScreen({ data, busy, onLoad }) {
  const [date, setDate] = useState('');
  useEffect(() => { onLoad(); }, [onLoad]);
  useEffect(() => { if (data?.attendanceDate) setDate(data.attendanceDate); }, [data]);
  return (
    <div>
      <input type="date" className="form-control mb-3 w-auto" value={date} onChange={(e) => { setDate(e.target.value); onLoad({ attendanceDate: e.target.value }); }} />
      <table className="table table-sm table-bordered">
        <thead><tr><th>Task</th><th>Client</th><th>Start</th><th>Target</th></tr></thead>
        <tbody>{(data?.tasks || []).map((t) => <tr key={t.id}><td>{t.name}</td><td>{t.clientName}</td><td>{t.startDate}</td><td>{t.targetDate}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export function TaskAllocationScreen({ data, busy, onLoad, onSave }) {
  const [tab, setTab] = useState('open');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('0');
  const [departments, setDepartments] = useState([]);
  const [manageId, setManageId] = useState('');
  const [detail, setDetail] = useState({});

  const loadList = (overrides = {}) => onLoad({
    tab,
    fromDate,
    toDate,
    title,
    eventType,
    departments,
    manageId: '',
    ...overrides,
  });

  useEffect(() => {
    if (!data) return;
    if (data.tab) setTab(data.tab);
    if (data.fromDate !== undefined) setFromDate(data.fromDate || '');
    if (data.toDate !== undefined) setToDate(data.toDate || '');
    if (data.title !== undefined) setTitle(data.title || '');
    if (data.eventType !== undefined) setEventType(data.eventType || '0');
    if (data.departments) setDepartments(data.departments);
    if (data.manageId) setManageId(data.manageId);
    else if (!data.detail) setManageId('');
    if (data.detail) setDetail(data.detail);
  }, [data]);

  if (data?.detail) {
    const isEvent = data.detail.kind === 'event';
    const activeManageId = data.manageId || manageId;
  return (
      <div className="task-manage-root">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">{isEvent ? 'Approved Event' : 'Manage Task'}</h5>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadList()}>Back to list</button>
      </div>
        {isEvent ? (
          <div className="alert alert-info">This approved academic event can be converted into a task using the legacy Manage Task workflow. Review details below.</div>
        ) : null}
        <form onSubmit={(e) => {
          e.preventDefault();
          if (isEvent) return;
          onSave({
            ...detail,
            manageId: activeManageId,
            tab,
            fromDate,
            toDate,
            title,
            eventType,
            departments,
          });
        }}>
      <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Category</label>
              <input className="form-control" value={detail.clientName || ''} readOnly />
          </div>
            <div className="col-md-6">
              <label className="form-label">Task Name</label>
              <input className="form-control" value={detail.taskName || ''} readOnly={isEvent} onChange={(e) => setDetail({ ...detail, taskName: e.target.value })} />
        </div>
            <div className="col-md-6">
              <label className="form-label">Start Date</label>
              <input type="datetime-local" className="form-control" value={String(detail.startDate || '').replace(' ', 'T').slice(0, 16)} readOnly={isEvent} onChange={(e) => setDetail({ ...detail, startDate: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Target Date</label>
              <input type={isEvent ? 'datetime-local' : 'date'} className="form-control" value={String(detail.targetDate || '').replace(' ', 'T').slice(0, isEvent ? 16 : 10)} readOnly={isEvent} onChange={(e) => setDetail({ ...detail, targetDate: e.target.value })} />
            </div>
            {!isEvent ? (
              <>
                <div className="col-md-4">
                  <label className="form-label">Priority</label>
                  <input className="form-control" value={detail.priority || ''} onChange={(e) => setDetail({ ...detail, priority: e.target.value })} />
                </div>
                <div className="col-md-8">
                  <label className="form-label">Staff</label>
                  <input className="form-control" value={detail.staffId || ''} onChange={(e) => setDetail({ ...detail, staffId: e.target.value })} />
                </div>
              </>
          ) : null}
            <div className="col-12">
              <label className="form-label">{isEvent ? 'Description' : 'Circular Notes'}</label>
              <textarea className="form-control" rows={4} value={detail.circularNotes || ''} readOnly={isEvent} onChange={(e) => setDetail({ ...detail, circularNotes: e.target.value })} />
        </div>
            {!isEvent ? (
              <div className="col-12">
                <label className="form-label">Minutes of Meeting</label>
                <textarea className="form-control" rows={3} value={detail.minutesMeeting || ''} onChange={(e) => setDetail({ ...detail, minutesMeeting: e.target.value })} />
      </div>
            ) : null}
          </div>
          {!isEvent ? (
            <button type="submit" className="btn btn-primary mt-3" disabled={busy}>Save task</button>
          ) : null}
        </form>
    </div>
  );
}

  return (
    <div className="task-manage-root">
      <div className="task-manage-filters mb-3">
        <div className="d-flex flex-wrap align-items-end gap-3 mb-3">
    <div>
            <span className="form-label d-block">Task Status</span>
            <div className="btn-group">
              {['open', 'completed'].map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`btn btn-sm ${tab === t ? 'btn-info' : 'btn-outline-secondary'}`}
                  onClick={() => { setTab(t); loadList({ tab: t, manageId: '' }); }}
                >
                  {t === 'open' ? 'Open' : 'Completed'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="form-label">From Date</label>
            <input type="date" className="form-control form-control-sm" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label">To Date</label>
            <input type="date" className="form-control form-control-sm" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Department</label>
            <select className="form-select form-select-sm tv-dept-select" multiple size={3} value={departments} onChange={(e) => setDepartments(Array.from(e.target.selectedOptions, (o) => o.value))}>
              {(data?.departmentsList || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
          </div>
        <div>
            <label className="form-label">Title</label>
            <input className="form-control form-control-sm" placeholder="Search by title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
          <div>
            <label className="form-label">Event Type</label>
            <select className="form-select form-select-sm" value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option value="0">All</option>
              {(data?.eventTypes || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => loadList()}>Go</button>
          </div>
        </div>
      </div>

      {(data?.items || []).length ? (
        <div className="row g-3">
          {data.items.map((item) => (
            <div key={item.key} className="col-md-6 col-xl-3">
              <div className="ft-mtask">
                <div className="ft-mtask-content">
                  <div className="row-wrapper">
                    <p className="mtask-categroy">{item.categoryName}</p>
                    <h2 className="mtask-title">{item.title}</h2>
                  </div>
                  <ul className="mtask-details list-unstyled">
                    <li className="mtask-details-item">
                      <span className="title">Program Date</span>
                      <span className="value">{item.programDate || '—'}</span>
                    </li>
                    {item.approvedOn ? (
                      <li className="mtask-details-item">
                        <span className="title">Approved On</span>
                        <span className="value">{item.approvedOn}</span>
                      </li>
                    ) : (
                      <li className="mtask-details-item">
                        <span className="title">&nbsp;</span>
                        <span className="value">&nbsp;</span>
                      </li>
                    )}
                  </ul>
                  <button
                    type="button"
                    className="btn btn-primary w-100 ft-submit-btn"
                    onClick={() => onLoad({ tab, fromDate, toDate, title, eventType, departments, manageId: item.manageId })}
                  >
                    Manage Task
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted py-4">{busy ? 'Loading...' : 'No tasks found for the selected filters.'}</div>
      )}
    </div>
  );
}

export function TaskManageReportScreen({ data, busy, onLoad }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [departments, setDepartments] = useState([]);
  const [eventStatus, setEventStatus] = useState('1');
  const [taskStatus, setTaskStatus] = useState('Open');
  const [eventType, setEventType] = useState('0');
  const [previewOpen, setPreviewOpen] = useState(false);

  const loadList = (overrides = {}) => onLoad({
    fromDate,
    toDate,
    departments,
    eventStatus,
    taskStatus,
    eventType,
    section: '',
    taskId: '',
    eventId: '',
    ...overrides,
  });

  const loadSection = (item, section) => onLoad({
    fromDate,
    toDate,
    departments,
    eventStatus,
    taskStatus,
    eventType,
    section,
    taskId: item.taskId ? String(item.taskId) : '',
    eventId: String(item.eventId),
    deptLabel: item.deptLabel || '',
  });

  useEffect(() => {
    if (!data) return;
    if (data.fromDate !== undefined) setFromDate(data.fromDate || '');
    if (data.toDate !== undefined) setToDate(data.toDate || '');
    if (data.departments) setDepartments(data.departments);
    if (data.eventStatus) setEventStatus(data.eventStatus);
    if (data.taskStatus) setTaskStatus(data.taskStatus);
    if (data.eventType !== undefined) setEventType(data.eventType || '0');
    if (data.view === 'preview' && data.previewHtml) setPreviewOpen(true);
    if (data.view === 'list') setPreviewOpen(false);
  }, [data]);

  const badgeClass = (tone) => {
    if (tone === 'approved') return 'bg-success';
    if (tone === 'open') return 'bg-primary';
    if (tone === 'pending') return 'bg-warning text-dark';
    if (tone === 'rejected') return 'bg-danger';
    return 'bg-secondary';
  };

  const sectionNeedsTask = (key) => !['event', 'reschedule'].includes(key);

  return (
    <div className="task-manage-root">
      {previewOpen && data?.previewHtml ? (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{data.previewTitle || 'Task Report'}</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => { setPreviewOpen(false); loadList(); }} />
              </div>
              <div className="modal-body p-0">
                {data.previewUseTaskManagePrint ? (
                  <style>{`
                    .task-report-print-preview .div_a4 { min-height: 842px; }
                    .task-report-print-preview { margin: 0 40px 0 60px; font-family: Arial, Helvetica, sans-serif; }
                    .task-report-print-preview .title_1 { font-size: 36px; text-align: right; border-top: 4px solid #000; border-bottom: 8px solid #000; line-height: 80px; }
                    .task-report-print-preview .title_2 { font-size: 18px; text-align: right; line-height: 50px; }
                    .task-report-print-preview .table_1 { margin-left: 10px; width: 98%; }
                    .task-report-print-preview .pbody { width: 94% !important; border-bottom: none; line-height: 20px; min-height: 500px; font-size: 13px !important; margin-top: 30px; margin-left: 20px; }
                    .task-report-print-preview .pbody h3 { font-size: 16px; margin: 16px 0 8px; }
                    .task-report-print-preview .signature { font-size: 14px; line-height: 20px; margin-top: 100px; margin-left: 30px; }
                  `}</style>
      ) : null}
                {data.previewUseCircularCss ? <link href="/legacy/css/circular.css" rel="stylesheet" /> : null}
                <div
                  className={`p-3 report-html${data.previewUseCircularCss ? ' task-report-circular' : ''}${data.previewUseTaskManagePrint ? ' task-report-print-preview' : ''}`}
                  dangerouslySetInnerHTML={{ __html: data.previewHtml }}
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => printTaskManageReportSection(data.previewHtml, {
                    title: data.previewTitle,
                    useCircularCss: data.previewUseCircularCss,
                    useTaskManagePrint: data.previewUseTaskManagePrint,
                  })}
                >
                  Print
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={() => { setPreviewOpen(false); loadList(); }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="task-manage-filters mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-md-3">
            <label className="form-label">From Date</label>
            <input type="date" className="form-control form-control-sm" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label">To Date</label>
            <input type="date" className="form-control form-control-sm" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label">Department</label>
            <select className="form-select form-select-sm tv-dept-select" multiple size={3} value={departments} onChange={(e) => setDepartments(Array.from(e.target.selectedOptions, (o) => o.value))}>
              {(data?.departmentsList || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">Event Status</label>
            <select className="form-select form-select-sm" value={eventStatus} onChange={(e) => setEventStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="1">Approved</option>
              <option value="3">Pending</option>
              <option value="2">Reject</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">Task Status</label>
            <select className="form-select form-select-sm" value={taskStatus} onChange={(e) => setTaskStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="Open">Open</option>
              <option value="Completed">Completed</option>
              <option value="Onhold">Onhold</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Not Yet Started">Not Yet Started</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">Event Type</label>
            <select className="form-select form-select-sm" value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option value="0">All</option>
              {(data?.eventTypes || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => loadList()}>Go</button>
          </div>
        </div>
      </div>

      {(data?.items || []).length ? (
        <div className="row g-3 report_con">
          {data.items.map((item) => (
            <div key={`${item.eventId}-${item.taskId || 0}`} className="col-md-6 col-xl-3">
              <div className="ft-mtask">
                <div className="d-flex flex-wrap gap-1 p-2">
                  {(item.statusBadges || []).map((badge) => (
                    <span key={badge.label} className={`badge ${badgeClass(badge.tone)}`}>{badge.label}</span>
                  ))}
                </div>
                <div className="ft-mtask-content">
                  <div className="row-wrapper">
                    <p className="mtask-categroy">{item.categoryName}{item.eventTypeName ? ` | ${item.eventTypeName}` : ''}</p>
                    <h2 className="mtask-title">{item.title}</h2>
                  </div>
                  <div className="small text-muted mb-2">
                    Created at {item.eventDate || '—'}<br />
                    {item.deptLabel || '—'}<br />
                    {item.rescheduleLabel}: {item.scheduleLabel || '—'}<br />
                    {item.statusDetail || ''}
                  </div>
                  <table className="table table-sm table-bordered nopadding mb-0">
                    <tbody>
                      {(item.sections || []).map((section) => (
                        <tr key={section.key}>
                          <td>{section.detail || section.label}</td>
                          <td className="text-nowrap">
                            {section.key === 'consolidate' && section.pdfUrl ? (
                              <>
                                <a href={section.pdfUrl} target="_blank" rel="noreferrer" className="me-2">PDF</a>
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm p-0"
                                  onClick={() => loadSection(item, 'consolidate')}
                                >
                                  Print
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-link btn-sm p-0"
                                disabled={sectionNeedsTask(section.key) && !item.taskId}
                                onClick={() => loadSection(item, section.key)}
                              >
                                Print
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-muted py-4">{busy ? 'Loading...' : 'No task reports found for the selected filters.'}</div>
      )}
    </div>
  );
}

export function TaskDocumentScreen({ data, busy, onLoad, onSave }) {
  const [taskId, setTaskId] = useState('');
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);

  const loadList = () => onLoad({ taskId: '' });

  useEffect(() => {
    if (!data) return;
    if (data.taskId) setTaskId(String(data.taskId));
    else setTaskId('');
    if (data.documents) setDocs(data.documents);
    else if (data.view === 'list') setDocs([]);
  }, [data]);

  const handleUpload = async (fileList) => {
    const files = await Promise.all(Array.from(fileList || []).map((f) => fileToPayload(f)));
    if (!files.length || !taskId) return;
    setUploading(true);
    try {
      await onSave({ taskId, documents: docs }, files.filter(Boolean));
    } finally {
      setUploading(false);
    }
  };

  if (data?.view === 'detail' && taskId) {
  return (
      <div className="task-manage-root task-budget-root">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0">{data.taskName || 'Task Documents'}</h4>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={loadList}>Back</button>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <label className="form-label">Select Document</label>
            <input
              type="file"
              className="form-control"
              accept=".jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif"
              multiple
              disabled={busy || uploading}
              onChange={(e) => { handleUpload(e.target.files); e.target.value = ''; }}
            />
            <span className="small text-muted">Supported: jpg, jpeg, png, gif</span>
          </div>
        </div>

          <table className="table table-sm table-bordered">
          <thead>
            <tr className="table-light">
              <th style={{ width: '10%' }}>Order</th>
              <th style={{ width: '30%' }}>Title</th>
              <th style={{ width: '20%' }}>Type</th>
              <th style={{ width: '30%' }}>Attachment</th>
              <th style={{ width: '10%' }} />
            </tr>
          </thead>
            <tbody>
            {docs.length ? docs.map((d, i) => (
                <tr key={d.id || i}>
                <td>
                  <input
                    className="form-control form-control-sm"
                    value={d.order}
                    onChange={(e) => setDocs(docs.map((x, j) => (j === i ? { ...x, order: e.target.value } : x)))}
                  />
                </td>
                <td>
                  <input
                    className="form-control form-control-sm"
                    value={d.title}
                    onChange={(e) => setDocs(docs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                  />
                </td>
                <td>
                  <select
                    className="form-select form-select-sm"
                    value={d.typeId || ''}
                    onChange={(e) => setDocs(docs.map((x, j) => (j === i ? { ...x, typeId: e.target.value } : x)))}
                  >
                    <option value="">--Type--</option>
                    {(data?.docTypes || []).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </td>
                <td>
                  {d.attachmentUrl ? (
                    <a href={d.attachmentUrl} target="_blank" rel="noreferrer">Attachment</a>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    disabled={busy}
                    onClick={() => onSave({ action: 'delete', taskId, docId: d.id })}
                  >
                    Delete
                  </button>
                </td>
                </tr>
            )) : (
              <tr>
                <td colSpan={5} className="text-muted text-center py-3">
                  No documents uploaded yet. Use the file picker above to add attachments.
                </td>
              </tr>
            )}
            </tbody>
          </table>

        {docs.length ? (
          <button type="button" className="btn btn-danger" disabled={busy || uploading} onClick={() => onSave({ taskId, documents: docs })}>
            Save
          </button>
      ) : null}
      </div>
    );
  }

  return (
    <div className="task-manage-root task-budget-root">
      {(data?.items || []).length ? (
        <div className="row g-3">
          {data.items.map((item) => (
            <div key={item.taskId} className="col-md-6 col-xl-3">
              <div className="ft-mtask">
                <div className="ft-mtask-content">
                  <div className="row-wrapper">
                    <p className="mtask-categroy">{item.categoryName}</p>
                    <h2 className="mtask-title">{item.taskId}: {item.title}</h2>
                  </div>
                  <ul className="mtask-details list-unstyled">
                    <li className="mtask-details-item">
                      <span className="title">Program Date</span>
                      <span className="value">{item.programDate || '—'}</span>
                    </li>
                  </ul>
                  <button
                    type="button"
                    className="btn btn-primary w-100 ft-submit-btn"
                    onClick={() => onLoad({ taskId: String(item.taskId) })}
                  >
                    Upload Document
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted py-4">{busy ? 'Loading...' : 'No open tasks available for document upload.'}</p>
      )}
    </div>
  );
}

export function TaskBudgetScreen({ data, busy, onLoad, onSave }) {
  const [taskId, setTaskId] = useState('');
  const [detail, setDetail] = useState(null);
  const [aStatus, setAStatus] = useState(0);
  const [fStatus, setFStatus] = useState(false);

  const loadList = () => onLoad({ taskId: '' });

  useEffect(() => {
    if (!data) return;
    if (data.taskId) setTaskId(String(data.taskId));
    else setTaskId('');
    if (data.summary) {
      setDetail({
        lines: data.lines || [],
        summary: data.summary,
        taskName: data.taskName || '',
      });
      const s = data.summary;
      if (s.budgetFstatus === 1) {
        setFStatus(true);
        setAStatus(1);
      } else if (s.budgetRstatus === 1 && s.rsendApproval === 0) {
        setAStatus(2);
      } else if (s.budgetStatus === 1) {
        setAStatus(1);
      } else {
        setAStatus(0);
      }
    } else {
      setDetail(null);
    }
  }, [data]);

  const formatMoney = (value) => Number(value || 0).toLocaleString('en-IN');

  const updateRevisedLine = (id, revisedAmount) => {
    if (!detail) return;
    const lines = detail.lines.map((line) => (line.id === id ? { ...line, revisedAmount: Number(revisedAmount) || 0 } : line));
    const totalRevised = lines.reduce((sum, line) => sum + (Number(line.revisedAmount) || 0), 0);
    const income = detail.summary.income || 0;
    setDetail({
      ...detail,
      lines,
      summary: {
        ...detail.summary,
        revisedExpenses: totalRevised,
        revisedGain: income - totalRevised,
        revisedPending: totalRevised - (detail.summary.revisedRequired || 0),
      },
    });
  };

  if (detail && data?.view === 'detail') {
    const { summary, lines, taskName } = detail;
    const showRevised = summary.showRevised || summary.canEditRevised;
    const showFinal = summary.showFinal;

  return (
      <div className="task-manage-root task-budget-root">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="mb-0">{taskName}</h4>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={loadList}>Back</button>
        </div>

        <h5 className="mb-3">Expenses</h5>
      <table className="table table-sm table-bordered">
          <thead>
            <tr className="table-light">
              <th>#</th>
              <th>Title</th>
              <th>Detail</th>
              <th className="text-end">Request</th>
              {showRevised ? <th className="text-end">Revised</th> : null}
              {showFinal ? <th className="text-end">Final</th> : null}
            </tr>
          </thead>
        <tbody>
            {lines.map((line, idx) => (
              <tr key={line.id}>
                <td>{idx + 1}</td>
                <td>{line.titleName}</td>
                <td>{line.details}</td>
                <td className="text-end">{formatMoney(line.requestAmount)}</td>
                {showRevised ? (
                  <td className="text-end">
                    {summary.canEditRevised ? (
                      <input
                        type="number"
                        className="form-control form-control-sm text-end"
                        value={line.revisedAmount}
                        onChange={(e) => updateRevisedLine(line.id, e.target.value)}
                      />
                    ) : formatMoney(line.revisedAmount)}
                  </td>
                ) : null}
                {showFinal ? <td className="text-end">{formatMoney(line.finalAmount)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>

        <table className="table table-sm table-bordered w-auto">
          <tbody>
            <tr><td>Total Expenses</td><td className="text-end">{formatMoney(summary.expenses)}</td>{showRevised ? <td className="text-end">{formatMoney(summary.revisedExpenses)}</td> : null}{showFinal ? <td className="text-end">{formatMoney(summary.finalExpenses)}</td> : null}</tr>
            <tr><td>Total Income</td><td className="text-end">{formatMoney(summary.income)}</td>{showRevised ? <td className="text-end">{formatMoney(summary.income)}</td> : null}{showFinal ? <td className="text-end">{formatMoney(summary.income)}</td> : null}</tr>
            <tr><td>Gain</td><td className="text-end">{formatMoney(summary.gain)}</td>{showRevised ? <td className="text-end">{formatMoney(summary.revisedGain)}</td> : null}{showFinal ? <td className="text-end">{formatMoney(summary.finalGain)}</td> : null}</tr>
            <tr>
              <td>Required Advance</td>
              <td className="text-end">{formatMoney(summary.required)}</td>
              {showRevised ? (
                <td className="text-end">
                  {summary.canEditRevised ? (
                    <input
                      type="number"
                      className="form-control form-control-sm text-end"
                      value={summary.revisedRequired}
                      onChange={(e) => setDetail({
                        ...detail,
                        summary: {
                          ...summary,
                          revisedRequired: Number(e.target.value) || 0,
                          revisedPending: (summary.revisedExpenses || 0) - (Number(e.target.value) || 0),
                        },
                      })}
                    />
                  ) : formatMoney(summary.revisedRequired)}
                </td>
              ) : null}
              {showFinal ? <td className="text-end">{formatMoney(summary.finalRequired)}</td> : null}
            </tr>
            <tr><td>Pending Advance</td><td className="text-end">{formatMoney(summary.pending)}</td>{showRevised ? <td className="text-end">{formatMoney(summary.revisedPending)}</td> : null}{showFinal ? <td className="text-end">{formatMoney(summary.finalPending)}</td> : null}</tr>
            <tr><td>Required Whom</td><td colSpan={1 + (showRevised ? 1 : 0) + (showFinal ? 1 : 0)}>{summary.requiredWhom || '—'}</td></tr>
          </tbody>
        </table>

        <div className="mt-4">
          <label className="form-label">Status</label>
          <div className="d-flex flex-wrap gap-3">
            {!summary.showFinal ? (
              <>
                <label><input type="radio" className="form-check-input me-1" checked={aStatus === 0} onChange={() => setAStatus(0)} /> Pending</label>
                <label><input type="radio" className="form-check-input me-1" checked={aStatus === 1} onChange={() => setAStatus(1)} /> Approved</label>
                <label><input type="radio" className="form-check-input me-1" checked={aStatus === 2} onChange={() => setAStatus(2)} /> Revised &amp; Approved</label>
              </>
            ) : null}
            {summary.showFinal ? (
              <label><input type="checkbox" className="form-check-input me-1" checked={fStatus} onChange={(e) => setFStatus(e.target.checked)} /> Final Approved</label>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary mt-3"
          disabled={busy}
          onClick={() => onSave({
            taskId,
            aStatus: fStatus ? 1 : aStatus,
            fStatus,
            lines: detail.lines,
            totalRevisedExpenses: summary.revisedExpenses,
            totalIncome: summary.income,
            totalGain: summary.revisedGain,
            revisedRequired: summary.revisedRequired,
          })}
        >
          Save
        </button>
      </div>
    );
  }

  return (
    <div className="task-manage-root task-budget-root">
      {(data?.items || []).length ? (
        <div className="row g-3">
          {data.items.map((item) => (
            <div key={item.taskId} className="col-md-6 col-xl-3">
              <div className="ft-mtask">
                <span className={`task-budget-badge task-budget-badge-${item.badgeTone}`}>{item.badgeLabel}</span>
                <div className="ft-mtask-content">
                  <div className="row-wrapper">
                    <p className="mtask-categroy">{item.categoryName}</p>
                    <h2 className="mtask-title">{item.title}</h2>
                  </div>
                  <ul className="mtask-details list-unstyled">
                    <li className="mtask-details-item">
                      <span className="title">{item.dateLabel}</span>
                      <span className="value">{item.dateValue || '—'}</span>
                    </li>
                  </ul>
                  <button
                    type="button"
                    className="btn btn-primary w-100 ft-submit-btn"
                    onClick={() => onLoad({ taskId: String(item.taskId) })}
                  >
                    Budget View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted py-4">{busy ? 'Loading...' : 'No budget approvals pending.'}</p>
      )}
    </div>
  );
}

export function ApproveEventScreen({ data, busy, onLoad, onSave }) {
  const [status, setStatus] = useState('0');
  useEffect(() => { onLoad({ aStatus: status }); }, [onLoad, status]);
  return (
    <div>
      <select className="form-select mb-3 w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="0">Pending</option><option value="1">Approved</option><option value="all">All</option>
      </select>
      <table className="table table-sm table-bordered">
        <thead><tr><th>Title</th><th>From</th><th>To</th><th>Status</th><th /></tr></thead>
        <tbody>
          {(data?.events || []).map((e) => (
            <tr key={e.id}>
              <td>{e.title}</td><td>{e.fromDate}</td><td>{e.toDate}</td><td>{e.aStatus}</td>
              <td>{e.aStatus !== 1 ? <button type="button" className="btn btn-sm btn-success" disabled={busy} onClick={() => onSave({ eventId: e.id, aStatus: 1 })}>Approve</button> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ApproveEventReportScreen({ data, busy, onLoad }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  useEffect(() => { onLoad(); }, [onLoad]);
  return (
    <div>
      <div className="row g-2 mb-3">
        <div className="col-md-3"><input type="date" className="form-control" value={fromDate} onChange={(e) => { setFromDate(e.target.value); onLoad({ fromDate: e.target.value, toDate }); }} /></div>
        <div className="col-md-3"><input type="date" className="form-control" value={toDate} onChange={(e) => { setToDate(e.target.value); onLoad({ fromDate, toDate: e.target.value }); }} /></div>
      </div>
      <table className="table table-sm table-bordered">
        <thead><tr><th>Title</th><th>From</th><th>Status</th><th>Task</th></tr></thead>
        <tbody>{(data?.events || []).map((e) => <tr key={e.id}><td>{e.title}</td><td>{e.fromDate}</td><td>{e.aStatus}</td><td>{e.refId ? 'Yes' : 'No'}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export function ApproveRescheduleScreen({ data, busy, onLoad, onSave }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [eventId, setEventId] = useState('');
  const [detail, setDetail] = useState(null);

  const loadList = (overrides = {}) => onLoad({
    fromDate,
    toDate,
    page,
    eventId: '',
    ...overrides,
  });

  useEffect(() => {
    if (!data) return;
    if (data.fromDate !== undefined) setFromDate(data.fromDate || '');
    if (data.toDate !== undefined) setToDate(data.toDate || '');
    if (data.page) setPage(data.page);
    if (data.eventId) setEventId(String(data.eventId));
    else if (!data.detail) setEventId('');
    if (data.detail) setDetail(data.detail);
    else setDetail(null);
  }, [data]);

  const openEvent = (id) => onLoad({ fromDate, toDate, page, eventId: id });

  if (detail) {
    const deptOptions = [
      ...(data?.departments || []).map((d) => ({ ...d, group: 'Department' })),
      ...(data?.committees || []).map((d) => ({ ...d, group: 'Committee' })),
    ];
  return (
      <div className="reschedule-approve-root">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">Re-Schedule Event</h5>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadList()}>Back to list</button>
        </div>
        <form onSubmit={(e) => {
          e.preventDefault();
          onSave({
            eventId: detail.eventId,
            title: detail.title,
            eventType: detail.eventType,
            category: detail.category,
            departments: detail.departments,
            fromDate: detail.fromDate,
            toDate: detail.toDate,
            description: detail.description,
            inCampus: detail.inCampus,
            inLocation: detail.inLocation,
            outCampus: detail.outCampus,
            outLocation: detail.outLocation,
            taskOwner: detail.taskOwner,
            requestOwner: detail.requestOwner,
            aStatus: detail.aStatus,
            reason: detail.reason,
            listFromDate: fromDate,
            listToDate: toDate,
            page,
          });
        }}>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Requested Date On</label>
              <input className="form-control" value={detail.createdAt || ''} readOnly />
            </div>
            <div className="col-md-8">
              <label className="form-label">Title</label>
              <input className="form-control" value={detail.title || ''} onChange={(e) => setDetail({ ...detail, title: e.target.value })} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Event Type</label>
              <select className="form-select" value={detail.eventType || ''} onChange={(e) => setDetail({ ...detail, eventType: e.target.value })}>
                <option value="">--Type--</option>
                {(data?.eventTypes || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="col-md-8">
              <label className="form-label">Department</label>
              <ChipMultiSelect
                options={deptOptions.map((d) => ({ value: d.id, label: d.name, group: d.group }))}
                value={detail.departments || []}
                onChange={(next) => setDetail({ ...detail, departments: next })}
                emptySelectionText="No departments selected"
                emptySearchText="No departments match your search."
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">From Date</label>
              <input type="datetime-local" className="form-control" value={detail.fromDate || ''} max={detail.toDate || undefined} onChange={(e) => setDetail({ ...detail, fromDate: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label">To Date</label>
              <input type="datetime-local" className="form-control" value={detail.toDate || ''} min={detail.fromDate || undefined} onChange={(e) => setDetail({ ...detail, toDate: e.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Location (In)</label>
              <div className="d-flex gap-2 align-items-center">
                <input type="checkbox" checked={!!detail.inCampus} onChange={(e) => setDetail({ ...detail, inCampus: e.target.checked })} />
                <select className="form-select" value={detail.inLocation || ''} onChange={(e) => setDetail({ ...detail, inLocation: e.target.value })}>
                  <option value="">--Location--</option>
                  {(data?.locations || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
            <div className="col-md-6">
              <label className="form-label">Location (Out)</label>
              <div className="d-flex gap-2 align-items-center">
                <input type="checkbox" checked={!!detail.outCampus} onChange={(e) => setDetail({ ...detail, outCampus: e.target.checked })} />
                <input className="form-control" value={detail.outLocation || ''} onChange={(e) => setDetail({ ...detail, outLocation: e.target.value })} placeholder="Outside location" />
              </div>
            </div>
            <div className="col-md-6">
              <label className="form-label">Requested Owner</label>
              <input className="form-control" value={detail.requestOwnerName || ''} readOnly />
            </div>
            <div className="col-md-6">
              <label className="form-label">Task Owner</label>
              <select className="form-select" value={detail.taskOwner || ''} onChange={(e) => setDetail({ ...detail, taskOwner: e.target.value })}>
                <option value="">--Task Owner--</option>
                {(detail.staffOptions || []).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="col-12">
              <label className="form-label">Status</label>
              <div className="d-flex flex-wrap gap-3">
                {(data?.statusLabels || ['Pending', 'Approved', 'Rejected', 'OnHold']).map((label, idx) => (
                  <label key={label} className="form-check-label">
                    <input
                      type="radio"
                      className="form-check-input me-1"
                      name="aStatus"
                      checked={Number(detail.aStatus) === idx}
                      onChange={() => setDetail({ ...detail, aStatus: idx })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="col-12">
              <label className="form-label">Reason</label>
              <textarea className="form-control" rows={3} value={detail.reason || ''} onChange={(e) => setDetail({ ...detail, reason: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn btn-danger mt-3" disabled={busy}>Confirm</button>
        </form>
      </div>
    );
  }

  return (
    <div className="reschedule-approve-root">
      <div className="card mb-3">
        <div className="card-header py-2">Filter</div>
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label">From Date</label>
              <input type="date" className="form-control form-control-sm" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label">To Date</label>
              <input type="date" className="form-control form-control-sm" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div className="col-md-3">
              <button type="button" className="btn btn-sm btn-info" disabled={busy} onClick={() => loadList({ page: 1 })}>Search</button>
            </div>
          </div>
        </div>
      </div>

      <p className="text-muted small mb-2">
        Showing {(data?.events || []).length ? ((data.page - 1) * data.pageSize + 1) : 0} to {Math.min(data?.page * data?.pageSize || 0, data?.total || 0)} of {data?.total || 0} entries
      </p>

      <table className="table table-sm table-bordered reschedule-approve-table">
        <thead>
          <tr className="table-light">
            <th style={{ width: '35%' }}>Title</th>
            <th style={{ width: '25%' }}>Department</th>
            <th style={{ width: '20%' }}>Schedule</th>
            <th style={{ width: '10%' }}>Status</th>
            <th style={{ width: '10%' }} />
          </tr>
        </thead>
      <tbody>
        {(data?.events || []).map((e) => (
          <tr key={e.id}>
              <td>
                <strong>{e.title}</strong>
                <div className="small text-muted">{e.categoryName} | {e.typeName} | Created at {e.eventDate}</div>
              </td>
              <td>{e.department || '—'}</td>
              <td>{e.schedule || '—'}</td>
              <td>{e.statusLabel}</td>
              <td>
                <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => openEvent(e.id)}>Re-Schedule</button>
              </td>
          </tr>
        ))}
      </tbody>
    </table>

      {!busy && !(data?.events || []).length ? (
        <p className="text-danger">No data found...</p>
      ) : null}

      {(data?.totalPages || 1) > 1 ? (
        <div className="d-flex justify-content-end gap-2 mt-2">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page <= 1 || busy} onClick={() => { const p = page - 1; setPage(p); loadList({ page: p }); }}>Previous</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page >= (data?.totalPages || 1) || busy} onClick={() => { const p = page + 1; setPage(p); loadList({ page: p }); }}>Next</button>
        </div>
      ) : null}
    </div>
  );
}

export function TvAcademicEventScreen({ data, busy, onLoad, onSave }) {
  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [view, setView] = useState('calendar');
  const [eventDate, setEventDate] = useState('');
  const [events, setEvents] = useState([]);
  const [descIndex, setDescIndex] = useState(null);
  const [descText, setDescText] = useState('');
  const [staffByRow, setStaffByRow] = useState({});
  const [calendarData, setCalendarData] = useState(null);
  const returningToCalendarRef = useRef(false);

  const applyCalendarData = (payload) => {
    if (!payload?.daysInMonth) return;
    setCalendarData({
      daysInMonth: payload.daysInMonth,
      startWeekday: payload.startWeekday,
      eventsByDay: payload.eventsByDay,
    });
    if (payload.calMonth) setCalMonth(payload.calMonth);
    if (payload.calYear) setCalYear(payload.calYear);
  };

  const loadCalendar = (month, year) => {
    returningToCalendarRef.current = true;
    setView('calendar');
    setEventDate('');
    onLoad({ view: 'calendar', calMonth: month, calYear: year });
  };

  useEffect(() => { loadCalendar(calMonth, calYear); }, []);

  useEffect(() => {
    if (!data) return;

    if (returningToCalendarRef.current) {
      if (data.view === 'calendar') {
        returningToCalendarRef.current = false;
        setView('calendar');
        applyCalendarData(data);
      }
      return;
    }

    if (data.view === 'calendar') {
      setView('calendar');
      applyCalendarData(data);
    }
    if (data.view === 'day') {
      setView('day');
      if (data.eventDate) setEventDate(data.eventDate);
      if (data.calMonth) setCalMonth(data.calMonth);
      if (data.calYear) setCalYear(data.calYear);
      if (data.events) {
        setEvents(data.events.map((ev) => ({ ...ev, prevTask: ev.task })));
        setStaffByRow({});
        data.events.forEach((ev, i) => {
          if (ev.departments?.length) {
            api.post('/api/committee/setup/tv-academic-event/load', {
              fields: { staffForDepts: ev.departments, staffRowIndex: i },
            }).then((res) => {
              if (res.data?.staffOptions) {
                setStaffByRow((prev) => ({ ...prev, [i]: res.data.staffOptions }));
              }
            }).catch(() => {});
          }
        });
      }
    }
  }, [data]);

  const openDay = (date) => {
    returningToCalendarRef.current = false;
    setEventDate(date);
    setView('day');
    onLoad({ view: 'day', eventDate: date, calMonth, calYear });
  };

  const handleSave = async () => {
    const res = await onSave({ eventDate, events, calMonth, calYear });
    if (res && res.success !== false) {
      returningToCalendarRef.current = false;
      await onLoad({ view: 'day', eventDate, calMonth, calYear });
    }
  };

  const updateEvent = (i, patch) => {
    setEvents((rows) => rows.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  };

  const onDeptChange = async (i, selected) => {
    updateEvent(i, { departments: selected });
    try {
      const res = await api.post('/api/committee/setup/tv-academic-event/load', {
        fields: { staffForDepts: selected, staffRowIndex: i },
      });
      if (res.data?.staffOptions) {
        setStaffByRow((prev) => ({ ...prev, [i]: res.data.staffOptions }));
      }
    } catch {
      setStaffByRow((prev) => ({ ...prev, [i]: [] }));
    }
  };

  const addRow = () => {
    const ymd = eventDate.replace(/-/g, '').slice(2);
    const eventId = `${ymd}${String(events.length + 1).padStart(2, '0')}`;
    setEvents([...events, {
      eventId,
      title: '',
      type: '',
      category: data?.categories?.[0]?.id || '',
      departments: [],
      fromDate: `${eventDate}T09:00`,
      toDate: `${eventDate}T17:00`,
      description: '',
      inCampus: false,
      inLocation: '',
      outCampus: false,
      outLocation: '',
      task: false,
      taskOwner: '',
      approved: false,
      prevTask: false,
    }]);
  };

  const statusClass = {
    created: 'tv-event-created',
    approved: 'tv-event-approved',
    rejected: 'tv-event-rejected',
    completed: 'tv-event-completed',
  };

  const buildCalendarRows = () => {
    const source = data?.view === 'calendar' && data?.daysInMonth ? data : calendarData;
    if (!source?.daysInMonth) return [];
    const rows = [];
    let day = 1;
    const totalCells = Math.ceil((source.startWeekday + source.daysInMonth) / 7) * 7;
    for (let cell = 0; cell < totalCells; cell += 1) {
      if (cell % 7 === 0) rows.push([]);
      const row = rows[rows.length - 1];
      if (cell < source.startWeekday || day > source.daysInMonth) {
        row.push(null);
      } else {
        const d = day;
        const date = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        row.push({ day: d, date, events: source.eventsByDay?.[d] || [] });
        day += 1;
      }
    }
    return rows;
  };

  const formatDayTitle = (d) => {
    if (!d) return '';
    const dt = new Date(`${d}T12:00:00`);
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const shiftMonth = (delta) => {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setCalMonth(m);
    setCalYear(y);
    loadCalendar(m, y);
  };

  if (view === 'calendar') {
  return (
      <div className="tv-academic-root">
        <TvAcademicToolbar
          calMonth={calMonth}
          calYear={calYear}
          onMonthChange={setCalMonth}
          onYearChange={setCalYear}
          onGo={() => loadCalendar(calMonth, calYear)}
          busy={busy}
          onPrev={() => shiftMonth(-1)}
          onNext={() => shiftMonth(1)}
          prevLabel={`<< ${tvMonthLabel(calMonth === 1 ? 12 : calMonth - 1)} ${calMonth === 1 ? calYear - 1 : calYear}`}
          nextLabel={`${tvMonthLabel(calMonth === 12 ? 1 : calMonth + 1)} ${calMonth === 12 ? calYear + 1 : calYear} >>`}
        />

        <table className="table table-bordered tv-academic-calendar mb-0">
          <thead>
            <tr className="table-light">
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                <th key={d} width="14.3%">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {buildCalendarRows().map((week, wi) => (
              <tr key={wi}>
                {week.map((cell, ci) => (
                  <td key={ci} className={cell ? 'tv-calendar-day' : 'tv-calendar-empty'} onClick={cell ? () => openDay(cell.date) : undefined}>
                    {cell ? (
                      <>
                        <div className="tv-calendar-day-num">{String(cell.day).padStart(2, '0')}</div>
                        {cell.events.length ? (
                          <ol className="tv-calendar-events mb-0">
                            {cell.events.map((ev) => (
                              <li key={ev.id} className={statusClass[ev.statusKey] || ''}>{ev.title}</li>
                            ))}
                          </ol>
                        ) : (
                          <div className="tv-calendar-add text-muted small">+ Add Event</div>
                        )}
                      </>
                    ) : '\u00a0'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
    );
  }

  return (
    <div className="tv-academic-root">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Date: {formatDayTitle(eventDate)}</h5>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadCalendar(calMonth, calYear)}>Back to calendar</button>
      </div>

      <div className="table-responsive">
        <table className="table table-bordered table-sm tv-academic-event-table">
          <thead className="table-secondary">
            <tr>
              <th style={{ width: '4%' }}>#</th>
              <th style={{ width: '14%' }}>Event Type</th>
              <th style={{ width: '16%' }}>Department</th>
              <th style={{ width: '22%' }}>Title</th>
              <th style={{ width: '14%' }}>From Time</th>
              <th style={{ width: '14%' }}>To Time</th>
              <th style={{ width: '8%' }} />
            </tr>
          </thead>
          <tbody>
            {events.map((ev, i) => (
              <Fragment key={ev.id || `new-${i}`}>
                <tr className={ev.approved ? 'tv-event-row-approved' : ''}>
                  <td rowSpan={2}>{i + 1}</td>
                  <td>
                    <select className="form-select form-select-sm" value={ev.type} disabled={ev.approved} onChange={(e) => updateEvent(i, { type: e.target.value })}>
                      <option value="">--Type--</option>
                      {(data?.eventTypes || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select
                      className="form-select form-select-sm"
                      multiple
                      size={3}
                      value={ev.departments}
                      disabled={ev.approved}
                      onChange={(e) => onDeptChange(i, Array.from(e.target.selectedOptions, (o) => o.value))}
                    >
                      <optgroup label="Department">
                        {(data?.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </optgroup>
                      <optgroup label="Committee">
                        {(data?.committees || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </optgroup>
                    </select>
                  </td>
                  <td>
                    <input className="form-control form-control-sm" value={ev.title} disabled={ev.approved} onChange={(e) => updateEvent(i, { title: e.target.value })} placeholder="Event title" />
                  </td>
                  <td>
                    <input type="datetime-local" className="form-control form-control-sm" value={ev.fromDate} disabled={ev.approved} onChange={(e) => updateEvent(i, { fromDate: e.target.value })} />
                  </td>
                  <td>
                    <input type="datetime-local" className="form-control form-control-sm" value={ev.toDate} disabled={ev.approved} onChange={(e) => updateEvent(i, { toDate: e.target.value })} />
                  </td>
                  <td rowSpan={2} className="align-middle">
                    {ev.approved ? <span className="text-danger small">Approved</span> : (
                      ev.id ? (
                        <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => onSave({ action: 'delete', eventId: ev.id, eventDate, calMonth, calYear })}>Del</button>
                      ) : null
                    )}
                  </td>
                </tr>
                <tr className={ev.approved ? 'tv-event-row-approved' : ''}>
                  <td colSpan={5} className="p-0">
                    <table className="table table-bordered table-sm mb-0 tv-academic-sub-table">
                      <tbody>
                        <tr>
                          <td>
                            <button type="button" className="btn btn-link btn-sm p-0" disabled={ev.approved} onClick={() => { setDescIndex(i); setDescText(ev.description || ''); }}>Description</button>
                          </td>
                          <td>
                            <label className="small mb-0"><input type="checkbox" checked={ev.inCampus} disabled={ev.approved} onChange={(e) => updateEvent(i, { inCampus: e.target.checked })} /> In</label>
                          </td>
                          <td>
                            <select className="form-select form-select-sm" value={ev.inLocation} disabled={ev.approved} onChange={(e) => updateEvent(i, { inLocation: e.target.value })}>
                              <option value="">--Location--</option>
                              {(data?.eventLocations || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                          </td>
                          <td>
                            <label className="small mb-0"><input type="checkbox" checked={ev.outCampus} disabled={ev.approved} onChange={(e) => updateEvent(i, { outCampus: e.target.checked })} /> Out</label>
                          </td>
                          <td>
                            <input className="form-control form-control-sm" value={ev.outLocation} disabled={ev.approved} onChange={(e) => updateEvent(i, { outLocation: e.target.value })} placeholder="Out location" />
                          </td>
                          <td>
                            <label className="small mb-0"><input type="checkbox" checked={ev.task} disabled={ev.approved} onChange={(e) => updateEvent(i, { task: e.target.checked })} /> Create Task</label>
                          </td>
                          <td>
                            <select className="form-select form-select-sm" value={ev.taskOwner} disabled={ev.approved} onChange={(e) => updateEvent(i, { taskOwner: e.target.value })}>
                              <option value="">--Task Owner--</option>
                              {(staffByRow[i] || []).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="d-flex justify-content-between mt-3">
        <div>
          <button type="button" className="btn btn-sm btn-info me-2" onClick={addRow}>+ Add row</button>
        </div>
        <div>
          <button type="button" className="btn btn-outline-secondary me-2" onClick={() => loadCalendar(calMonth, calYear)}>Back to calendar</button>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={handleSave}>Save</button>
        </div>
      </div>

      {descIndex !== null && (
        <div className="modal show d-block" tabIndex={-1} style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Event Description #{descIndex + 1}: {events[descIndex]?.title || ''}</h5>
                <button type="button" className="btn-close" onClick={() => setDescIndex(null)} />
              </div>
              <div className="modal-body">
                <textarea className="form-control" rows={8} value={descText} onChange={(e) => setDescText(e.target.value)} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setDescIndex(null)}>Close</button>
                <button type="button" className="btn btn-danger" onClick={() => { updateEvent(descIndex, { description: descText }); setDescIndex(null); }}>Update</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TvAcademicPrintScreen({ data, busy, onLoad }) {
  const now = new Date();
  const printRef = useRef(null);
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [departments, setDepartments] = useState([]);
  const [view, setView] = useState('calendar');
  const [eventDate, setEventDate] = useState('');
  const [headerText, setHeaderText] = useState('Monthly Planner');
  const [footerText, setFooterText] = useState('');
  const [calendarData, setCalendarData] = useState(null);
  const returningToCalendarRef = useRef(false);

  const loadFields = (overrides = {}) => ({
    view: 'calendar',
    calMonth,
    calYear,
    departments,
    ...overrides,
  });

  const loadCalendar = (month, year, deptList = departments) => {
    returningToCalendarRef.current = true;
    setView('calendar');
    setEventDate('');
    onLoad(loadFields({ view: 'calendar', calMonth: month, calYear: year, departments: deptList }));
  };

  useEffect(() => { onLoad(loadFields()); }, []);

  useEffect(() => {
    if (!data) return;
    if (returningToCalendarRef.current) {
      if (data.view === 'calendar') {
        returningToCalendarRef.current = false;
        setView('calendar');
        if (data.calMonth) setCalMonth(data.calMonth);
        if (data.calYear) setCalYear(data.calYear);
        if (data.departments) setDepartments(data.departments);
        if (data.daysInMonth) {
          setCalendarData({
            daysInMonth: data.daysInMonth,
            startWeekday: data.startWeekday,
            eventsByDay: data.eventsByDay,
          });
        }
      }
      return;
    }
    if (data.view === 'calendar') {
      setView('calendar');
      if (data.calMonth) setCalMonth(data.calMonth);
      if (data.calYear) setCalYear(data.calYear);
      if (data.departments) setDepartments(data.departments);
      if (data.daysInMonth) {
        setCalendarData({
          daysInMonth: data.daysInMonth,
          startWeekday: data.startWeekday,
          eventsByDay: data.eventsByDay,
        });
      }
    }
    if (data.view === 'day') {
      setView('day');
      if (data.eventDate) setEventDate(data.eventDate);
      if (data.calMonth) setCalMonth(data.calMonth);
      if (data.calYear) setCalYear(data.calYear);
      if (data.departments) setDepartments(data.departments);
    }
  }, [data]);

  const openDay = (date) => {
    returningToCalendarRef.current = false;
    setEventDate(date);
    setView('day');
    onLoad({ view: 'day', eventDate: date, calMonth, calYear, departments });
  };

  const monthLabel = tvMonthLabel;

  const shiftMonth = (delta, deptList = departments) => {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setCalMonth(m);
    setCalYear(y);
    loadCalendar(m, y, deptList);
  };

  const statusClass = {
    created: 'tv-event-created',
    approved: 'tv-event-approved',
    rejected: 'tv-event-rejected',
    completed: 'tv-event-completed',
  };

  const buildCalendarRows = () => {
    const source = data?.view === 'calendar' && data?.daysInMonth ? data : calendarData;
    if (!source?.daysInMonth) return [];
    const rows = [];
    let day = 1;
    const totalCells = Math.ceil((source.startWeekday + source.daysInMonth) / 7) * 7;
    for (let cell = 0; cell < totalCells; cell += 1) {
      if (cell % 7 === 0) rows.push([]);
      const row = rows[rows.length - 1];
      if (cell < source.startWeekday || day > source.daysInMonth) {
        row.push(null);
      } else {
        const d = day;
        const date = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        row.push({ day: d, date, events: source.eventsByDay?.[d] || [] });
        day += 1;
      }
    }
    return rows;
  };

  const formatDayTitle = (d) => {
    if (!d) return '';
    const dt = new Date(`${d}T12:00:00`);
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const monthTitle = `${monthLabel(calMonth)} ${calYear}`;
    const html = `
      <h3 style="text-align:center;margin-bottom:4px;">${headerText}</h3>
      <h4 style="text-align:center;margin-top:0;">${monthTitle}</h4>
      ${printRef.current.innerHTML}
      ${footerText ? `<div style="margin-top:16px;">${footerText}</div>` : ''}
    `;
    printReportHtml(html);
  };

  const handlePrintDay = () => {
    const rows = (data?.events || []).map((e) => `
      <tr>
        <td>${e.fromDate}</td>
        <td>${e.title}</td>
        <td>${e.approved ? 'Yes' : 'No'}</td>
        <td>${e.hasTask ? 'Yes' : 'No'}</td>
      </tr>
    `).join('');
    const html = `
      <h3 style="text-align:center;">${headerText}</h3>
      <h4 style="text-align:center;">${formatDayTitle(eventDate)}</h4>
      <table border="1" cellpadding="6" cellspacing="0" width="100%" style="border-collapse:collapse;">
        <thead><tr><th>Time</th><th>Event</th><th>Approved</th><th>Task</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${footerText ? `<div style="margin-top:16px;">${footerText}</div>` : ''}
    `;
    printReportHtml(html);
  };

  if (view === 'day') {
  return (
      <div className="tv-academic-root">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">Date: {formatDayTitle(eventDate)}</h5>
    <div>
            <button type="button" className="btn btn-sm btn-outline-secondary me-2" onClick={() => loadCalendar(calMonth, calYear)}>Back to calendar</button>
            <button type="button" className="btn btn-sm btn-primary" onClick={handlePrintDay}>Print</button>
          </div>
        </div>
      <table className="table table-sm table-bordered">
          <thead className="table-light">
            <tr><th>Time</th><th>Event</th><th>Approved</th><th>Task</th></tr>
          </thead>
          <tbody>
            {(data?.events || []).map((e) => (
              <tr key={e.id}>
                <td>{e.fromDate}</td>
                <td>{e.title}</td>
                <td>{e.approved ? 'Yes' : 'No'}</td>
                <td>{e.hasTask ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
      </table>
      </div>
    );
  }

  return (
    <div className="tv-academic-root">
      <TvAcademicToolbar
        calMonth={calMonth}
        calYear={calYear}
        onMonthChange={setCalMonth}
        onYearChange={setCalYear}
        onGo={() => loadCalendar(calMonth, calYear, departments)}
        busy={busy}
        onPrint={handlePrint}
        showRejectedLegend={false}
        departments={departments}
        onDepartmentsChange={setDepartments}
        departmentsList={data?.departmentsList}
        onPrev={() => shiftMonth(-1)}
        onNext={() => shiftMonth(1)}
        prevLabel={`<< ${tvMonthLabel(calMonth === 1 ? 12 : calMonth - 1)} ${calMonth === 1 ? calYear - 1 : calYear}`}
        nextLabel={`${tvMonthLabel(calMonth === 12 ? 1 : calMonth + 1)} ${calMonth === 12 ? calYear + 1 : calYear} >>`}
      />

      <div ref={printRef}>
        <table className="table table-bordered tv-academic-calendar mb-0">
          <thead>
            <tr className="table-light">
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                <th key={d} width="14.3%">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {buildCalendarRows().map((week, wi) => (
              <tr key={wi}>
                {week.map((cell, ci) => (
                  <td key={ci} className={cell ? 'tv-calendar-day' : 'tv-calendar-empty'} onClick={cell ? () => openDay(cell.date) : undefined}>
                    {cell ? (
                      <>
                        <div className="tv-calendar-day-num">{String(cell.day).padStart(2, '0')}</div>
                        {cell.events.length ? (
                          <ol className="tv-calendar-events mb-0">
                            {cell.events.map((ev) => (
                              <li key={ev.id} className={statusClass[ev.statusKey] || ''}>{ev.title}</li>
                            ))}
                          </ol>
                        ) : null}
                      </>
                    ) : '\u00a0'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row g-3 mt-3">
        <div className="col-md-6">
          <label className="form-label">Header</label>
          <textarea className="form-control" rows={2} value={headerText} onChange={(e) => setHeaderText(e.target.value)} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Footer</label>
          <textarea className="form-control" rows={2} value={footerText} onChange={(e) => setFooterText(e.target.value)} />
        </div>
      </div>
    </div>
  );
}
