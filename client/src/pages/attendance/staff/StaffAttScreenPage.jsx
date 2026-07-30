import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import api from '../../../api/client';
import ChipMultiSelect from '../../../components/ChipMultiSelect';
import PopoverMultiSelect from '../../../components/PopoverMultiSelect';
import DashboardLayout from '../../../layouts/DashboardLayout';
import { printReportHtml } from '../../../utils/printReport';
import './StaffAttScreenPage.css';
import AttendanceLineChart from './AttendanceLineChart';
import { STAFF_ATT_SCREEN_META } from './staffAttSetupMeta';
import { useStaffAttScreenApi } from './useStaffAttSetupApi';
import YearlyReportView from './YearlyReportView';

const APPROVAL_SCREENS = new Set(['smr-leave-approve', 'smr-permission-approve', 'smr-defaulter-approve']);
const SAVE_SCREENS = new Set(['clear-icache', 'holiday-roster', 'compensation', 'available-cl', 'att-transport', ...APPROVAL_SCREENS]);

/** The legacy att-chart pages (staff_att_chart.php et al.) are literally
 * charts — one line graph per metric, split into "Week 1..5" bands — not a
 * data table. This renders the same per-day rows as line charts (via
 * AttendanceLineChart) instead of a table, with the raw numbers still
 * available in a compact table underneath for reference. */
function AttChartTable({ rows, title }) {
  if (!rows?.length) return null;
  return (
    <div className="card shadow-sm">
      {title ? <div className="card-header py-2"><strong>{title}</strong></div> : null}
      <div className="card-body">
        <AttendanceLineChart rows={rows} metricKey="absent" label="Leave" color="#b71c1c" />
        <AttendanceLineChart rows={rows} metricKey="late" label="Late" color="#d97706" />
        <AttendanceLineChart rows={rows} metricKey="permission" label="Permission" color="#1d5fb8" />
        <AttendanceLineChart rows={rows} metricKey="present" label="Present" color="#059669" />

        <details className="mt-2">
          <summary className="text-muted small">View day-by-day data</summary>
          <div className="table-responsive mt-2">
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
        </details>
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
    if (screen === 'smr-lpd-report') {
      submitted.a_request = fd.getAll('a_request');
      submitted.a_status = fd.getAll('a_status');
    }
    onGenerate({ ...fields, ...submitted, Submit: 'Generate' });
  };

  const commonDateRow = (
    <>
      <div className="col-md-3"><label className="form-label">From Date</label><input type="date" className="form-control" value={fields.from_date || ''} max={fields.to_date || undefined} onChange={(e) => set('from_date', e.target.value)} /></div>
      <div className="col-md-3"><label className="form-label">To Date</label><input type="date" className="form-control" value={fields.to_date || ''} min={fields.from_date || undefined} onChange={(e) => set('to_date', e.target.value)} /></div>
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
      {screen === 'smr-lpd-report' && (
        <div className="col-12">
          <label className="form-label d-block">Request</label>
          {[['leave', 'Leave'], ['permission', 'Permission'], ['defaulter', 'Defaulter']].map(([val, label]) => (
            <label key={val} className="form-check form-check-inline">
              <input
                type="checkbox"
                name="a_request"
                value={val}
                className="form-check-input"
                defaultChecked={data?.a_request ? data.a_request.includes(val) : true}
              />
              <span className="form-check-label">{label}</span>
            </label>
          ))}
        </div>
      )}
      {(screen === 'smr-acknowledge' || screen === 'smr-lpd-report' || APPROVAL_SCREENS.has(screen)) && commonDateRow}
      {screen === 'smr-lpd-report' && (
        <div className="col-12">
          <label className="form-label d-block">Status</label>
          {[['p', 'Pending'], ['1', 'Approved'], ['2', 'Rejected']].map(([val, label]) => (
            <label key={val} className="form-check form-check-inline">
              <input
                type="checkbox"
                name="a_status"
                value={val}
                className="form-check-input"
                defaultChecked={data?.a_status ? data.a_status.includes(val) : true}
              />
              <span className="form-check-label">{label}</span>
            </label>
          ))}
        </div>
      )}
      {APPROVAL_SCREENS.has(screen) && (
        <div className="col-md-3"><label className="form-label">Status</label>
          <select className="form-select" onChange={(e) => set('a_status', e.target.value)} defaultValue="0">
            <option value="0">Pending</option><option value="1">Approved</option><option value="2">Rejected</option>
          </select>
        </div>
      )}
      {(screen === 'attendance-report' || screen === 'teaching-month-report' || screen.startsWith('att-chart')) && (
        <>
          <div className="col-md-6"><label className="form-label">Category</label>
            <ChipMultiSelect
              options={(data?.categories || []).map((c) => ({ value: c.id, label: c.name }))}
              value={fields.search_category || (data?.search_category || []).map(String)}
              onChange={(next) => set('search_category', next)}
              emptySelectionText="No categories selected"
              emptySearchText="No categories match your search."
              listHeight={240}
            />
          </div>
          {screen.startsWith('att-chart')
            ? <div className="col-md-3"><label className="form-label">Month</label><input type="month" name="from_month" className="form-control" defaultValue={data?.from_month || ''} onChange={(e) => set('from_month', e.target.value)} /></div>
            : commonDateRow}
        </>
      )}
      {screen === 'available-leave' && (
        <>
          <div className="col-md-3"><label className="form-label">As of Date</label><input type="date" className="form-control" onChange={(e) => set('from_date', e.target.value)} /></div>
          <div className="col-md-6"><label className="form-label">Department</label>
            <ChipMultiSelect
              options={(data?.departments || []).map((d) => ({ value: d.id, label: d.name }))}
              value={fields.search_dept || []}
              onChange={(next) => set('search_dept', next)}
              emptySelectionText="No departments selected"
              emptySearchText="No departments match your search."
              listHeight={240}
            />
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
        <button type="submit" className="btn btn-danger w-100">
          {screen === 'clear-icache' ? 'Go' : screen === 'smr-lpd-report' ? 'Search' : 'Generate'}
        </button>
      </div>
    </form>
  );
}

const STATUS_META = {
  0: { label: 'Pending', tone: 'pending' },
  1: { label: 'Approved', tone: 'approved' },
  2: { label: 'Rejected', tone: 'rejected' },
  3: { label: 'Cancelled', tone: 'cancelled' },
};

function statusTone(status) {
  return (STATUS_META[Number(status)] || STATUS_META[0]).tone;
}

function StatusBadge({ status }) {
  const meta = STATUS_META[Number(status)] || { label: status, tone: 'pending' };
  return <span className={`att-status-badge att-status-${meta.tone}`}>{meta.label}</span>;
}

/** Detail-panel dates come straight off the raw SQL row (ISO datetime string
 * once JSON-serialized), unlike the list rows which are pre-formatted
 * server-side — so this needs its own light dd-mm-yyyy formatter. */
function formatDetailDate(value) {
  if (!value) return '';
  const raw = String(value);
  if (raw.startsWith('0000-00-00')) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function ApprovalStats({ counts }) {
  const items = [
    { key: 'total', label: 'Total', tone: 'total' },
    { key: 'pending', label: 'Pending', tone: 'pending' },
    { key: 'approved', label: 'Approved', tone: 'approved' },
    { key: 'rejected', label: 'Rejected', tone: 'rejected' },
    { key: 'cancelled', label: 'Cancelled', tone: 'cancelled' },
  ];
  return (
    <div className="att-approval-stats">
      {items.map((it) => (
        <div key={it.key} className={`att-stat-card att-stat-${it.tone}`}>
          <span className="att-stat-value">{counts?.[it.key] ?? 0}</span>
          <span className="att-stat-label">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

const DAY_TYPES = ['LOP', 'CL', 'EL', 'OD', 'OFF'];
const DAY_TYPE_BALANCE_KEY = { CL: 'a_cl', EL: 'a_el', OD: 'a_od', OFF: 'a_off' };

/** Half-day sessions (FN/AN) count as 0.5 against a leave balance; full-day
 * rows count as 1 — mirrors the legacy `$l_lmt` calculation. */
function dayRowWeight(row) {
  return row.r_session && String(row.r_session).toLowerCase() !== 'fullday' ? 0.5 : 1;
}

/** Editable per-day LOP/CL/EL/OD/OFF picker for a leave request, matching
 * the legacy staff_leave_approve.php "Days" section: an "Ava." balance row
 * plus one radio group per date, where CL/EL/OD/OFF options disable once
 * the running total for that type (across all rows) would exceed what's
 * available — same guard as the legacy page's validateApproval() JS. */
function LeaveDaysEditor({ moreRows, balances, requestId, selections, onChange }) {
  useEffect(() => {
    const init = {};
    moreRows.forEach((row) => { init[row.id] = String(row.m_att || 'LOP').toUpperCase(); });
    onChange(init);
    // Reset only when switching to a different request's day list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const totals = { CL: 0, EL: 0, OD: 0, OFF: 0 };
  moreRows.forEach((row) => {
    const sel = selections[row.id];
    if (sel && totals[sel] !== undefined) totals[sel] += dayRowWeight(row);
  });

  const isDisabled = (row, type) => {
    if (type === 'LOP' || !balances) return false;
    const key = DAY_TYPE_BALANCE_KEY[type];
    const avail = balances[key];
    if (avail === 'Unlimited' || avail == null) return false;
    const selectedElsewhere = totals[type] - (selections[row.id] === type ? dayRowWeight(row) : 0);
    return selectedElsewhere + dayRowWeight(row) > Number(avail);
  };

  return (
    <div className="att-days-editor">
      {balances && (
        <div className="att-balance-row">
          <span className="att-balance-chip att-balance-cl">CL {String(balances.a_cl)}</span>
          <span className="att-balance-chip att-balance-el">EL {String(balances.a_el)}</span>
          <span className="att-balance-chip att-balance-od">OD {String(balances.a_od)}</span>
          <span className="att-balance-chip att-balance-off">OFF {String(balances.a_off)}</span>
        </div>
      )}
      <div className="att-day-rows">
        {moreRows.map((row) => (
          <div key={row.id} className="att-day-row">
            <div className="att-day-row-date">
              {formatDetailDate(row.req_date)}
              {row.r_session && String(row.r_session).toLowerCase() !== 'fullday' ? ` (${String(row.r_session).charAt(0).toUpperCase()})` : ''}
            </div>
            <div className="att-day-row-options" role="radiogroup">
              {DAY_TYPES.map((type) => (
                <label
                  key={type}
                  className={`att-day-option att-day-option-${type.toLowerCase()}${selections[row.id] === type ? ' is-checked' : ''}${isDisabled(row, type) ? ' is-disabled' : ''}`}
                >
                  <input
                    type="radio"
                    name={`att_m_${row.id}`}
                    value={type}
                    checked={selections[row.id] === type}
                    disabled={isDisabled(row, type)}
                    onChange={() => onChange((prev) => ({ ...prev, [row.id]: type }))}
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Legacy value casing (p/la/pe lowercase, LOP/H/CL/EL/OD/OFF upper) is kept
// verbatim so it round-trips through att_defaulter_more.m_att/e_att unchanged.
const DEFAULTER_TYPES = [
  { value: 'p', label: 'P' },
  { value: 'la', label: 'La' },
  { value: 'pe', label: 'Pe' },
  { value: 'LOP', label: 'LOP' },
  { value: 'H', label: 'HD' },
  { value: 'CL', label: 'CL' },
  { value: 'EL', label: 'EL' },
  { value: 'OD', label: 'OD' },
  { value: 'OFF', label: 'OFF' },
];

/** A defaulter row covers a full day (FN + AN), or just one session — same
 * split the legacy page renders (`fullday||forenoon` for FN, `fullday||
 * afternoon` for AN). */
function defaulterSessionsForRow(row) {
  const session = String(row.r_session || '').toLowerCase();
  if (session === 'fullday') return ['fn', 'an'];
  if (session === 'afternoon') return ['an'];
  return ['fn'];
}

/** Sums a defaulter row's two half-day session picks into the day-type
 * totals att_defaulter_more actually stores — mirrors the legacy page's
 * inline PHP right before its UPDATE query (only lop/cl/el/od/off/h count;
 * p/la/pe don't consume any leave balance). */
function computeDefaulterDayTotals(mAtt, eAtt) {
  const totals = { cl: 0, el: 0, od: 0, lop: 0, off: 0, h: 0 };
  [mAtt, eAtt].forEach((val) => {
    const v = String(val || '').toLowerCase();
    if (v === 'lop') totals.lop += 0.5;
    else if (v === 'cl') totals.cl += 0.5;
    else if (v === 'el') totals.el += 0.5;
    else if (v === 'od') totals.od += 0.5;
    else if (v === 'off') totals.off += 0.5;
    else if (v === 'h') totals.h += 0.5;
  });
  return totals;
}

/** Editable FN/AN attendance-type picker for a defaulter request, matching
 * the legacy staff_defaulter_approve.php "Days" section: each date gets one
 * radio group per applicable session (forenoon/afternoon), and CL/EL/OD/OFF
 * disable once the running total for that type — across every session slot
 * in the request — would exceed the available balance. */
function DefaulterDaysEditor({ moreRows, balances, requestId, selections, onChange }) {
  useEffect(() => {
    const init = {};
    moreRows.forEach((row) => {
      init[`${row.id}_fn`] = row.m_att || '';
      init[`${row.id}_an`] = row.e_att || '';
    });
    onChange(init);
    // Reset only when switching to a different request's day list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const totals = { CL: 0, EL: 0, OD: 0, OFF: 0 };
  moreRows.forEach((row) => {
    defaulterSessionsForRow(row).forEach((slot) => {
      const sel = String(selections[`${row.id}_${slot}`] || '').toUpperCase();
      if (totals[sel] !== undefined) totals[sel] += 0.5;
    });
  });

  const isDisabled = (row, slot, type) => {
    const key = DAY_TYPE_BALANCE_KEY[type.toUpperCase()];
    if (!key || !balances) return false;
    const avail = balances[key];
    if (avail === 'Unlimited' || avail == null) return false;
    const slotKey = `${row.id}_${slot}`;
    const current = String(selections[slotKey] || '').toUpperCase();
    const selectedElsewhere = totals[type.toUpperCase()] - (current === type.toUpperCase() ? 0.5 : 0);
    return selectedElsewhere + 0.5 > Number(avail);
  };

  return (
    <div className="att-days-editor">
      {balances && (
        <div className="att-balance-row">
          <span className="att-balance-chip att-balance-cl">CL {String(balances.a_cl)}</span>
          <span className="att-balance-chip att-balance-el">EL {String(balances.a_el)}</span>
          <span className="att-balance-chip att-balance-od">OD {String(balances.a_od)}</span>
          <span className="att-balance-chip att-balance-off">OFF {String(balances.a_off)}</span>
        </div>
      )}
      <div className="att-day-rows">
        {moreRows.map((row) => (
          <div key={row.id} className="att-day-row att-day-row-stacked">
            <div className="att-day-row-date">
              {formatDetailDate(row.req_date)}
              {String(row.r_session || '').toLowerCase() !== 'fullday' ? ` (${String(row.r_session || '').charAt(0).toUpperCase()}N)` : ''}
            </div>
            {defaulterSessionsForRow(row).map((slot) => (
              <div key={slot} className="att-day-row-options" role="radiogroup">
                <span className="att-day-slot-label">{slot.toUpperCase()}</span>
                {DEFAULTER_TYPES.map((opt) => {
                  const checked = String(selections[`${row.id}_${slot}`] || '').toUpperCase() === opt.value.toUpperCase();
                  const disabled = isDisabled(row, slot, opt.value);
                  return (
                    <label
                      key={opt.value}
                      className={`att-day-option att-day-option-${opt.value.toLowerCase()}${checked ? ' is-checked' : ''}${disabled ? ' is-disabled' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`att_${slot}_${row.id}`}
                        value={opt.value}
                        checked={checked}
                        disabled={disabled}
                        onChange={() => onChange((prev) => ({ ...prev, [`${row.id}_${slot}`]: opt.value }))}
                      />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Master-detail approval screen: the request list stays visible on the
 * left and picking a row opens its detail on the right in the same view,
 * instead of the legacy page's swap-the-whole-panel flow. */
function ApprovalList({ data, screen, onSelect, onClose, onSave, busy }) {
  const requests = data?.requests || [];
  const detail = data?.detail;
  const header = detail?.header;
  const selectedId = header ? Number(header.id) : null;
  const moreRows = Array.isArray(detail?.more) ? detail.more : [];
  const balances = detail?.balances;
  const editableLeaveDays = screen === 'smr-leave-approve' && moreRows.length > 0;
  const editableDefaulterDays = screen === 'smr-defaulter-approve' && moreRows.length > 0;
  const [daySelections, setDaySelections] = useState({});

  return (
    <div className="att-approval">
      <ApprovalStats counts={data?.statusCounts} />
      <div className="att-approval-split">
        <div className="att-approval-list">
          {requests.length === 0 && <p className="text-muted small px-2 py-3 mb-0">No requests match this filter.</p>}
          {requests.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`att-request-card att-status-${statusTone(r.status)}${selectedId === r.id ? ' is-selected' : ''}`}
              onClick={() => onSelect(r.id)}
            >
              <div className="att-request-card-top">
                <span className="att-request-id">#{r.requestId ?? r.id}</span>
                <StatusBadge status={r.status} />
              </div>
              <div className="att-request-staff">{r.staffId} · {r.staffName}</div>
              <div className="att-request-dates">
                <i className="fa fa-calendar-o" aria-hidden="true" />
                {r.fromDate}{r.toDate && r.toDate !== r.fromDate ? ` – ${r.toDate}` : ''}
              </div>
            </button>
          ))}
        </div>

        <div className={`att-approval-detail${header ? ' has-detail' : ''}`}>
          {!header && (
            <div className="att-detail-empty">
              <i className="fa fa-hand-o-left" aria-hidden="true" />
              <p>Select a request on the left to review and act on it.</p>
            </div>
          )}
          {header && (
            <form
              className="att-detail-form"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const payload = { rid: header.id, att_status: fd.get('status'), l_comments: fd.get('comments'), update: 'Confirm' };
                if (editableLeaveDays) {
                  payload.more = moreRows.map((row) => ({
                    id: row.id,
                    m_att: daySelections[row.id] || 'LOP',
                    ref_day: dayRowWeight(row),
                  }));
                } else if (editableDefaulterDays) {
                  payload.more = moreRows.map((row) => {
                    const sessions = defaulterSessionsForRow(row);
                    const mAtt = sessions.includes('fn') ? (daySelections[`${row.id}_fn`] || '') : '';
                    const eAtt = sessions.includes('an') ? (daySelections[`${row.id}_an`] || '') : '';
                    const totals = computeDefaulterDayTotals(mAtt, eAtt);
                    return {
                      id: row.id,
                      m_att: mAtt,
                      e_att: eAtt,
                      cl_days: totals.cl,
                      el_days: totals.el,
                      od_days: totals.od,
                      lop_days: totals.lop,
                      off_days: totals.off,
                      h_days: totals.h,
                    };
                  });
                }
                onSave(payload);
              }}
            >
              <div className="att-detail-header">
                <div>
                  <div className="att-detail-name">{header.staff_name || header.emp_id}</div>
                  <div className="att-detail-sub">{header.emp_id || header.staff_id} · Request #{header.request_id ?? header.id}</div>
                </div>
                <button type="button" className="att-detail-close" aria-label="Close detail" onClick={onClose}>
                  <i className="fa fa-times" aria-hidden="true" />
                </button>
              </div>

              <div className="att-detail-dates">
                <i className="fa fa-calendar" aria-hidden="true" />
                {formatDetailDate(header.from_date) || '—'}
                {header.to_date && formatDetailDate(header.to_date) !== formatDetailDate(header.from_date)
                  ? ` – ${formatDetailDate(header.to_date)}` : ''}
              </div>

              {editableLeaveDays ? (
                <LeaveDaysEditor
                  moreRows={moreRows}
                  balances={balances}
                  requestId={header.id}
                  selections={daySelections}
                  onChange={setDaySelections}
                />
              ) : editableDefaulterDays ? (
                <DefaulterDaysEditor
                  moreRows={moreRows}
                  balances={balances}
                  requestId={header.id}
                  selections={daySelections}
                  onChange={setDaySelections}
                />
              ) : (
                <>
                  {moreRows.length > 0 && (
                    <div className="att-detail-days">
                      {moreRows.map((row) => (
                        <span key={row.id} className="att-day-chip">
                          {formatDetailDate(row.req_date)}
                          {row.r_session && String(row.r_session).toLowerCase() !== 'fullday' ? ` (${String(row.r_session).charAt(0).toUpperCase()})` : ''}
                          <strong>{row.m_att || 'LOP'}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                  {balances && (
                    <div className="att-balance-row">
                      <span className="att-balance-chip att-balance-cl">CL {String(balances.a_cl)}</span>
                      <span className="att-balance-chip att-balance-el">EL {String(balances.a_el)}</span>
                      <span className="att-balance-chip att-balance-od">OD {String(balances.a_od)}</span>
                      <span className="att-balance-chip att-balance-off">OFF {String(balances.a_off)}</span>
                    </div>
                  )}
                </>
              )}

              <div className="att-detail-field">
                <label className="form-label">Status</label>
                <div className="att-status-toggle" role="radiogroup">
                  {[[0, 'Pending', 'pending'], [1, 'Approved', 'approved'], [2, 'Rejected', 'rejected']].map(([val, label, tone]) => (
                    <label key={val} className={`att-toggle-pill att-toggle-${tone}`}>
                      <input type="radio" name="status" value={val} defaultChecked={Number(header.status) === val} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="att-detail-field">
                <label className="form-label">Comments</label>
                <textarea name="comments" className="form-control" defaultValue={header.comments} rows={3} />
              </div>

              <button type="submit" className="att-confirm-btn" disabled={busy}>
                <i className="fa fa-check" aria-hidden="true" /> Confirm
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/** L/P/D Report results table — matches the legacy staff_lpd_report.php
 * column set (#, R.ID, Staff, Date & Request, Status, Remarks) with the
 * same colorful status badges used on the approval screens. */
function LpdReportTable({ rows }) {
  if (!rows?.length) return <p className="text-muted small mb-0">No requests match this filter.</p>;
  return (
    <div className="table-responsive">
      <table className="table table-bordered table-sm align-middle mb-0">
        <thead className="table-light">
          <tr><th>#</th><th>R.ID</th><th>Staff</th><th>Date &amp; Request</th><th>Status</th><th>Remarks</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.type}-${r.requestLabel}-${r.serial}`}>
              <td>{r.serial}</td>
              <td>
                {r.type}: <strong>{r.requestLabel}</strong>
                <br /><small className="text-muted">@{r.createdAt}</small>
              </td>
              <td><strong>{r.staffName}</strong><br />{r.staffId}</td>
              <td><strong>{r.dateRange}{r.subLabel ? ` | ${r.subLabel}` : ''}</strong></td>
              <td><StatusBadge status={r.status} /></td>
              <td>{r.comments}</td>
            </tr>
          ))}
        </tbody>
      </table>
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

const HOLIDAY_ROSTER_DAYS = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
];

function ddmmyyyyToInputDate(value) {
  if (!value) return '';
  const [dd, mm, yyyy] = String(value).split('-');
  if (!dd || !mm || !yyyy) return '';
  return `${yyyy}-${mm}-${dd}`;
}

let holidayRowKeySeq = 0;
function nextHolidayRowKey() {
  holidayRowKeySeq += 1;
  return `hroster-row-${holidayRowKeySeq}`;
}

function emptyHolidayRow(defaults = {}) {
  return {
    key: nextHolidayRowKey(),
    attGroup: '',
    category: '',
    staffIds: [],
    fromDate: defaults.fromDate || '',
    toDate: defaults.toDate || '',
    fromTime: '09:00',
    toTime: '17:00',
    offCal: false,
    days: [],
  };
}

/** Matches staff_holiday_roster.php: a "Select Holiday" dropdown (plus "Add
 * New Date") drives a header date range and a per-group table (category ->
 * multi-select staff -> date range -> working days -> IN/OUT time -> OFF Cal
 * flag), with soft-delete-and-reinsert semantics per row group. */
function HolidayRosterEditor({ data, busy, load, save }) {
  const [selectedRef, setSelectedRef] = useState('');
  const [hFromDate, setHFromDate] = useState('');
  const [hToDate, setHToDate] = useState('');
  const [rows, setRows] = useState([]);
  const [staffOptionsByCategory, setStaffOptionsByCategory] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadStaffOptions = async (categoryId) => {
    if (!categoryId) return;
    try {
      const res = await api.post('/api/attendance/staff/holiday-roster/more', { query: { category: categoryId, limit: 500 } });
      const opts = (res.data.staff || []).map((s) => ({ value: String(s.id), label: `${s.staffId} | ${s.name}` }));
      setStaffOptionsByCategory((prev) => ({ ...prev, [String(categoryId)]: opts }));
    } catch {
      // best-effort — chip select falls back to raw ids if this fails
    }
  };

  useEffect(() => {
    const refId = data?.ref_id ?? '';
    setSelectedRef(refId === '' ? '' : String(refId));
    const fromInput = ddmmyyyyToInputDate(data?.h_from_date);
    const toInput = ddmmyyyyToInputDate(data?.h_to_date);
    setHFromDate(fromInput);
    setHToDate(toInput);

    const groups = data?.groups || [];
    if (groups.length) {
      setRows(groups.map((g) => ({
        key: nextHolidayRowKey(),
        attGroup: String(g.attGroup ?? ''),
        category: g.category ? String(g.category) : '',
        staffIds: g.staffIds || [],
        fromDate: ddmmyyyyToInputDate(g.fromDate),
        toDate: ddmmyyyyToInputDate(g.toDate),
        fromTime: g.fromTime || '09:00',
        toTime: g.toTime || '17:00',
        offCal: !!g.offCal,
        days: g.days || [],
      })));

      const staffLabels = data?.staffLabels || {};
      setStaffOptionsByCategory((prev) => {
        const next = { ...prev };
        groups.forEach((g) => {
          if (!g.category) return;
          const cat = String(g.category);
          const existing = next[cat] ? [...next[cat]] : [];
          const seen = new Set(existing.map((o) => o.value));
          (g.staffIds || []).forEach((id) => {
            if (!seen.has(id)) {
              existing.push({ value: id, label: staffLabels[id] || id });
              seen.add(id);
            }
          });
          next[cat] = existing;
        });
        return next;
      });

      [...new Set(groups.map((g) => g.category).filter(Boolean))].forEach((cat) => loadStaffOptions(cat));
    } else if (refId !== '') {
      setRows([emptyHolidayRow({ fromDate: fromInput, toDate: toInput })]);
    } else {
      setRows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const updateRow = (key, patch) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const handleCategoryChange = (row, categoryId) => {
    updateRow(row.key, { category: categoryId, staffIds: [] });
    if (categoryId && !staffOptionsByCategory[String(categoryId)]) loadStaffOptions(categoryId);
  };

  const addRow = () => setRows((prev) => [...prev, emptyHolidayRow({ fromDate: hFromDate, toDate: hToDate })]);

  const removeRow = (row) => {
    if (row.attGroup) setDeleteTarget(row);
    else setRows((prev) => prev.filter((r) => r.key !== row.key));
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    save({ ref_id: selectedRef, delete_group_id: deleteTarget.attGroup });
    setDeleteTarget(null);
  };

  const handleSelectChange = (value) => {
    setSelectedRef(value);
    load({ academic_date: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    save({
      ref_id: selectedRef === 'new' ? '' : selectedRef,
      config: { id: selectedRef === 'new' || !selectedRef ? '' : selectedRef, from_date: hFromDate, to_date: hToDate },
      groups: rows.map((r) => ({
        attGroup: r.attGroup,
        category: r.category,
        staffIds: r.staffIds,
        fromDate: r.fromDate,
        toDate: r.toDate,
        fromTime: r.fromTime,
        toTime: r.toTime,
        offCal: r.offCal,
        days: r.days,
      })),
    });
  };

  const showTable = selectedRef !== '';

  return (
    <div className="holiday-roster-editor">
      <form onSubmit={handleSubmit}>
        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <label className="form-label">Select Holiday <span className="text-danger">*</span></label>
            <select className="form-select" value={selectedRef} onChange={(e) => handleSelectChange(e.target.value)} required>
              <option value="">--Select--</option>
              <option value="new">Add New Date</option>
              {(data?.configs || []).map((c) => (
                <option key={c.id} value={String(c.id)}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {showTable && (
          <>
            <div className="row g-3 mb-3">
              <div className="col-md-3">
                <label className="form-label">From date <span className="text-danger">*</span></label>
                <input type="date" className="form-control" value={hFromDate} max={hToDate || undefined} required onChange={(e) => setHFromDate(e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label">To date <span className="text-danger">*</span></label>
                <input type="date" className="form-control" value={hToDate} min={hFromDate || undefined} required onChange={(e) => setHToDate(e.target.value)} />
              </div>
            </div>

            <div className="hroster-rows mb-3">
              {rows.map((row, idx) => (
                <div className="hroster-row-card" key={row.key}>
                  <div className="hroster-row-header">
                    <span className="hroster-row-badge">Group {idx + 1}</span>
                    <button type="button" className="btn btn-sm btn-outline-danger" title="Delete group" onClick={() => removeRow(row)}>
                      <i className="fa fa-trash" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="hroster-row-grid">
                    <div className="hroster-field hroster-field-category">
                      <label className="form-label">Category</label>
                      <select
                        className="form-select form-select-sm"
                        value={row.category}
                        onChange={(e) => handleCategoryChange(row, e.target.value)}
                      >
                        <option value="">--Select--</option>
                        {(data?.categories || []).map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="hroster-field hroster-field-staffs">
                      <label className="form-label">Staffs</label>
                      <PopoverMultiSelect
                        options={staffOptionsByCategory[String(row.category)] || []}
                        value={row.staffIds}
                        onChange={(next) => updateRow(row.key, { staffIds: next })}
                        disabled={!row.category}
                        placeholder={row.category ? 'Select staff...' : 'Select a category first'}
                        emptySelectionText="No staff selected"
                        searchPlaceholder="Search staff..."
                      />
                    </div>
                    <div className="hroster-field">
                      <label className="form-label">From</label>
                      <input type="date" className="form-control form-control-sm" value={row.fromDate} onChange={(e) => updateRow(row.key, { fromDate: e.target.value })} />
                    </div>
                    <div className="hroster-field">
                      <label className="form-label">To</label>
                      <input type="date" className="form-control form-control-sm" value={row.toDate} onChange={(e) => updateRow(row.key, { toDate: e.target.value })} />
                    </div>
                    <div className="hroster-field hroster-field-days">
                      <label className="form-label">Working Days</label>
                      <PopoverMultiSelect
                        options={HOLIDAY_ROSTER_DAYS}
                        value={row.days}
                        onChange={(next) => updateRow(row.key, { days: next })}
                        showSearch={false}
                        placeholder="Select days..."
                        emptySelectionText="No days selected"
                      />
                    </div>
                    <div className="hroster-field">
                      <label className="form-label">IN</label>
                      <input type="time" className="form-control form-control-sm" value={row.fromTime} onChange={(e) => updateRow(row.key, { fromTime: e.target.value })} />
                    </div>
                    <div className="hroster-field">
                      <label className="form-label">OUT</label>
                      <input type="time" className="form-control form-control-sm" value={row.toTime} onChange={(e) => updateRow(row.key, { toTime: e.target.value })} />
                    </div>
                    <div className="hroster-field hroster-field-offcal">
                      <label className="form-label">OFF Cal.</label>
                      <label className="form-check form-switch">
                        <input type="checkbox" className="form-check-input" role="switch" checked={row.offCal} onChange={(e) => updateRow(row.key, { offCal: e.target.checked })} />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-3">
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={addRow}>
                <i className="fa fa-plus" aria-hidden="true" /> Add Row
              </button>
            </div>

            <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
          </>
        )}
      </form>

      {deleteTarget && (
        <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header"><h5 className="modal-title">Confirm</h5></div>
              <div className="modal-body">Are you sure to delete...</div>
              <div className="modal-footer">
                <button type="button" className="btn btn-default" onClick={() => setDeleteTarget(null)}>Close</button>
                <button type="button" className="btn btn-warning" onClick={confirmDelete}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StaffAttScreenPage() {
  const { screen } = useParams();
  const meta = STAFF_ATT_SCREEN_META[screen];
  const { data, busy, error, notice, load, save } = useStaffAttScreenApi(screen);
  const { settings, menu } = useOutletContext();
  const [ready, setReady] = useState(false);
  const [lastFilters, setLastFilters] = useState({});

  useEffect(() => {
    if (!meta) { setReady(true); return; }
    load().finally(() => setReady(true));
  }, [meta, load]);

  if (!meta) {
    return <div className="p-4"><p className="text-danger">Unknown staff attendance screen.</p><Link to="/attendance/staff/hub">Back</Link></div>;
  }
  if (!ready) return <div className="p-4 text-muted">Loading...</div>;

  const handleGenerate = (fields) => {
    if (screen === 'clear-icache') { save(fields); return; }
    setLastFilters(fields);
    load(fields);
  };

  // Approval screens keep the request list and its detail panel on one
  // screen, so picking/closing a row re-runs the load with whatever search
  // filters are already active instead of resetting them.
  const handleSelectRequest = (rid) => load({ ...lastFilters, rid });
  const handleCloseDetail = () => load({ ...lastFilters, rid: undefined });
  const handleSaveApproval = (fields) => save({ ...lastFilters, ...fields });

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
        <div><h3 className="dashboard-title mb-0">{meta.title}</h3></div>
        <div className="d-flex gap-2">
          {data?.reportHtml && <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => printReportHtml(data.reportHtml)}>Print</button>}
          <Link to="/attendance/staff/hub" className="btn btn-outline-secondary btn-sm">Back</Link>
        </div>
      </div>
      {notice && <div className="alert alert-success">{notice}</div>}
      {data?.infoMessage && !data?.reportHtml && !(data?.rows?.length) && !(data?.dayRows?.length) && <div className="alert alert-info py-2">{data.infoMessage}</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {busy && (
        <div className="alert alert-light border py-2 mb-2">
          {screen === 'daily-attendance'
            ? 'Generating daily attendance — this can take 1–2 minutes for large staff lists. Please wait…'
            : screen === 'attendance-report'
              ? 'Generating attendance report — this can take a minute or more for a wide date range. Please wait…'
              : screen === 'yearly-report'
                ? 'Generating yearly report — this can take a minute or more for a wide date range. Please wait…'
                : screen.startsWith('att-chart')
                ? 'Generating attendance chart — select categories first; this may take a minute. Please wait…'
                : 'Loading…'}
        </div>
      )}

      <div className="card shadow-sm mb-3"><div className="card-body">
        {screen !== 'holiday-roster' && <ReportFilters screen={screen} data={data} onGenerate={handleGenerate} />}
        {APPROVAL_SCREENS.has(screen) && (
          <ApprovalList
            data={data}
            screen={screen}
            busy={busy}
            onSelect={handleSelectRequest}
            onClose={handleCloseDetail}
            onSave={handleSaveApproval}
          />
        )}
        {screen === 'available-cl' && <ClElGrid data={data} onSave={save} busy={busy} />}
        {screen === 'compensation' && data?.staff && (
          <p className="text-muted">Compensation rows for {data.staff.staff_name}: {(data.rows || []).length}</p>
        )}
        {screen === 'holiday-roster' && (
          <HolidayRosterEditor data={data} busy={busy} load={load} save={save} />
        )}
      </div></div>

      {screen === 'daily-attendance' && data?.rows?.length > 0 && (
        <DailyAttendanceTable rows={data.rows} title={data.title} />
      )}

      {screen.startsWith('att-chart') && data?.dayRows?.length > 0 && (
        <AttChartTable rows={data.dayRows} title={data.title} />
      )}

      {screen === 'smr-lpd-report' && (
        <div className="card shadow-sm"><div className="card-body"><LpdReportTable rows={data?.rows} /></div></div>
      )}

      {screen === 'yearly-report' && <YearlyReportView data={data} />}

      {screen !== 'daily-attendance' && screen !== 'smr-lpd-report' && screen !== 'yearly-report' && !screen.startsWith('att-chart') && data?.reportHtml && (
        <div className="card shadow-sm"><div className="card-body report-html" dangerouslySetInnerHTML={{ __html: data.reportHtml }} /></div>
      )}
    </DashboardLayout>
  );
}
