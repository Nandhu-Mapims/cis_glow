import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import api from '../../../api/client';
import DashboardLayout from '../../../layouts/DashboardLayout';
import { useShellData } from '../../../hooks/useShellData';
import { printReportHtml } from '../../../utils/printReport';
import { buildPgPunchPrintHtml } from '../../../utils/attendanceReportPrint';
import { isPgPunchScreenType, resolveStudentAttScreenSlug, STUDENT_ATT_SCREEN_META } from './studentAttMeta';
import { useStudentAttScreenApi } from './useStudentAttApi';

const APPROVAL_SCREENS = new Set(['smr-leave-request', 'smr-dept-leave', 'smr-permission', 'smr-defaulter']);
const SAVE_SCREENS = new Set([
  'smr-setup', 'pg-att-setup', 'intern-att-setup', 'year-incharge',
  'pg-holiday-roster-add', 'pg-holiday-roster-edit', 'intern-holiday-roster-add', 'intern-holiday-roster-edit',
  'pg-manual-att', 'intern-manual-att',
]);

function displayDateToIso(value) {
  const raw = String(value || '').trim();
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return '';
}

function displayDatetimeToLocal(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const dmyTime = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})/.exec(raw);
  if (dmyTime) {
    const [, dd, mm, yyyy, hh, min] = dmyTime;
    return `${yyyy}-${mm}-${dd}T${String(hh).padStart(2, '0')}:${min}`;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function mergePgReportRows(html, rowsByFlag) {
  let result = html;
  Object.entries(rowsByFlag || {}).forEach(([flag, rows]) => {
    if (!rows) return;
    result = result.replace(
      new RegExp(`(<table[^>]*id="payroll_${flag}"[\\s\\S]*?<tbody>)([\\s\\S]*?)(</tbody>)`, 'i'),
      `$1$2${rows}$3`,
    );
  });
  return result;
}

function toPgDisplayDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  return `${d}-${m}-${y}`;
}

function readFilterFields(form) {
  const fd = new FormData(form);
  return {
    from_date: fd.get('from_date') || '',
    to_date: fd.get('to_date') || '',
    category: fd.get('category') || '',
    letter_date: fd.get('letter_date') || '',
    a_status: fd.get('a_status') || '0',
    a_staff: fd.get('a_staff') || '',
    student_id: fd.get('student_id') || '',
    roll_no: fd.get('roll_no') || '',
    register_no: fd.get('register_no') || '',
    machine_id: fd.get('machine_id') || '',
    course_name: fd.getAll('course_name').filter(Boolean),
    a_request: fd.getAll('a_request').filter(Boolean),
    a_status_list: fd.getAll('a_status').filter(Boolean),
    academic_year: fd.get('academic_year') || '',
    report_type: fd.get('report_type') || 'Monthly',
    cleariCache: fd.get('cleariCache') === '1',
    hideAbinfo: fd.get('hideAbinfo') === '1',
    Submit: 'Generate',
  };
}

function internStatementMaxDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function InternAttStatementForm({ data, onLoad, busy }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [category, setCategory] = useState('');
  const [rollList, setRollList] = useState('');
  const [attMessage, setAttMessage] = useState('');
  const [cardsHtml, setCardsHtml] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateLabel, setGenerateLabel] = useState('');
  const [notice, setNotice] = useState('');

  const maxDate = useMemo(() => internStatementMaxDate(), []);
  const rollCount = useMemo(
    () => rollList.split(',').map((part) => part.trim()).filter(Boolean).length,
    [rollList],
  );
  const formLocked = busy || generating;

  useEffect(() => {
    if (!data) return;
    setFromDate(displayDateToIso(data.from_date) || data.from_date || '');
    setToDate(displayDateToIso(data.to_date) || data.to_date || '');
    setCategory(data.search_category || '');
    if (data.roll_list != null) setRollList(data.roll_list);
    if (data.att_message != null) setAttMessage(data.att_message || '');
    if (data.cardsHtml) setCardsHtml(data.cardsHtml);
  }, [data]);

  const categoryGroups = useMemo(() => {
    const groups = new Map();
    for (const opt of data?.categoryOptions || []) {
      const key = opt.groupLabel || 'Courses';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(opt);
    }
    return Array.from(groups.entries());
  }, [data?.categoryOptions]);

  const handleGo = () => {
    onLoad({
      resolve_rolls: true,
      search_category: category,
      from_date: fromDate,
      to_date: toDate,
      att_message: attMessage,
    });
  };

  const handleGenerate = async () => {
    const rolls = rollList.split(',').map((part) => part.trim()).filter(Boolean);
    if (!rolls.length || !fromDate || !toDate || !category) return;
    setCardsHtml('');
    setNotice('');
    setGenerating(true);
    setGenerateLabel(`Generating ${rolls.length} attendance statement${rolls.length === 1 ? '' : 's'}…`);
    try {
      const result = await onLoad({
        generate_cards: true,
        roll_list: rolls.join(','),
        from_date: fromDate,
        to_date: toDate,
        att_message: attMessage,
        search_category: category,
      });
      setCardsHtml(result?.cardsHtml || '');
      setNotice(`${rolls.length} attendance statement${rolls.length === 1 ? '' : 's'} generated. Press Print to preview or print.`);
    } finally {
      setGenerating(false);
      setGenerateLabel('');
    }
  };

  const handlePrint = () => {
    if (!cardsHtml) return;
    printReportHtml(`<div class="intern-att-cards">${cardsHtml}</div>`, 'intern-att-statement');
  };

  return (
    <div className="intern-att-statement-form">
      <div className="card shadow-sm mb-3">
        <div className="card-header">Filter</div>
        <div className="card-body">
          <div className="row g-3 mb-3">
            <div className="col-md-3">
              <label className="form-label">From</label>
              <input type="date" className="form-control" value={fromDate} max={toDate || maxDate} disabled={formLocked} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label">To</label>
              <input type="date" className="form-control" value={toDate} min={fromDate || undefined} max={maxDate} disabled={formLocked} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
          <div className="row g-3 mb-3 align-items-end">
            <div className="col-md-5">
              <label className="form-label">Category</label>
              <select className="form-select" value={category} disabled={formLocked} onChange={(e) => setCategory(e.target.value)} required>
                <option value="">--Select Course--</option>
                {categoryGroups.map(([groupLabel, items]) => (
                  <optgroup key={groupLabel} label={groupLabel}>
                    {items.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <button type="button" className="btn btn-danger w-100" disabled={formLocked || !category || !fromDate || !toDate} onClick={handleGo}>
                Go
              </button>
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label">Roll No.</label>
            <textarea className="form-control" rows={4} value={rollList} disabled={formLocked} onChange={(e) => setRollList(e.target.value)} />
          </div>
          <div className="mb-3">
            <label className="form-label">Message</label>
            <textarea className="form-control" rows={3} value={attMessage} disabled={formLocked} onChange={(e) => setAttMessage(e.target.value)} />
          </div>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <button type="button" className="btn btn-danger btn-lg" disabled={formLocked || !category || !rollList.trim() || !fromDate || !toDate} onClick={handleGenerate}>
              Generate
            </button>
            {cardsHtml ? (
              <button type="button" className="btn btn-info" disabled={generating} onClick={handlePrint}>Print</button>
            ) : null}
          </div>
          {generating ? (
            <div className="intern-att-generating mt-3">
              <div className="d-flex align-items-center gap-3 mb-2">
                <div className="spinner-border spinner-border-sm text-danger" role="status" aria-hidden="true" />
                <div>
                  <div className="fw-semibold">{generateLabel || 'Generating…'}</div>
                  <div className="text-muted small">
                    {rollCount ? `Processing ${rollCount} student${rollCount === 1 ? '' : 's'}. Please wait.` : 'Please wait.'}
                  </div>
                </div>
              </div>
              <div className="progress progress-striped active progress-sm mb-0">
                <div
                  className="progress-bar progress-bar-success progress-bar-striped progress-bar-animated"
                  role="progressbar"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          ) : null}
          {notice && !generating ? <div className="alert alert-success mt-3 mb-0">{notice}</div> : null}
        </div>
      </div>
      {cardsHtml ? (
        <div className="intern-att-cards report-html" dangerouslySetInnerHTML={{ __html: cardsHtml }} />
      ) : null}
    </div>
  );
}

function periodAttMinDate() {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
}

function PeriodAttForm({ data, onLoad, onSave, busy }) {
  const [date, setDate] = useState('');
  const [entries, setEntries] = useState([]);
  const [loadedDate, setLoadedDate] = useState('');

  const serverDate = displayDateToIso(data?.attendanceDate) || data?.attendanceDate || '';

  useEffect(() => {
    if (!serverDate) return;
    setDate(serverDate);
    setLoadedDate(serverDate);
    setEntries(data?.entries || []);
  }, [serverDate]);

  useEffect(() => {
    if (loadedDate && serverDate === loadedDate) {
      setEntries(data?.entries || []);
    }
  }, [data?.entries, loadedDate, serverDate]);

  const baseMinDate = useMemo(() => periodAttMinDate(), []);
  const maxDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const pickerMin = useMemo(() => {
    const candidates = [baseMinDate, date, loadedDate].filter(Boolean);
    return candidates.reduce((min, value) => (value < min ? value : min), candidates[0] || baseMinDate);
  }, [baseMinDate, date, loadedDate]);

  const isLoadedForCurrentDate = Boolean(date && loadedDate && date === loadedDate && entries.length > 0);
  const showEntries = isLoadedForCurrentDate;

  const handleDateChange = (nextDate) => {
    setDate(nextDate);
    if (nextDate !== loadedDate) {
      setEntries([]);
      setLoadedDate('');
    }
  };

  const handleLoad = () => {
    if (!date || busy) return;
    onLoad({ attendance_date: date });
  };

  return (
    <div className="period-att-form">
      <div className="row g-3 mb-3 align-items-end">
        <div className="col-md-3">
          <label className="form-label">Date <span className="text-danger">*</span></label>
          <input
            type="date"
            className="form-control"
            value={date}
            min={pickerMin}
            max={maxDate}
            onChange={(e) => handleDateChange(e.target.value)}
            required
          />
        </div>
        <div className="col-md-2">
          <button
            type="button"
            className="btn btn-outline-primary w-100"
            disabled={busy || !date}
            onClick={handleLoad}
          >
            {busy ? 'Loading…' : 'Load'}
          </button>
        </div>
      </div>

      {data?.message && loadedDate === date ? (
        <div className="alert alert-warning">{data.message}</div>
      ) : null}

      {showEntries ? (
        <form onSubmit={(e) => {
          e.preventDefault();
          onSave({ attendanceDate: date, attendance_date: date, entries });
        }}>
          <p className="text-danger small mb-2">
            Note: Enter present and absent register numbers separated by comma (,). E.g. 1516,1506,5189
          </p>
          <div className="table-responsive">
            <table className="table table-bordered table-sm period-att-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Present</th>
                  <th>Absent</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row, i) => (
                  <tr
                    key={row.period}
                    className={row.hasExistingRecord ? 'period-att-row-saved' : 'period-att-row-new'}
                  >
                    <td className="fw-semibold">{row.periodLabel}</td>
                    <td>
                      <textarea
                        className="form-control form-control-sm"
                        rows={5}
                        value={entries[i]?.presentList || ''}
                        onChange={(e) => setEntries((prev) => prev.map((r, j) => (
                          j === i ? { ...r, presentList: e.target.value } : r
                        )))}
                      />
                    </td>
                    <td>
                      <textarea
                        className="form-control form-control-sm"
                        rows={5}
                        value={entries[i]?.absentList || ''}
                        onChange={(e) => setEntries((prev) => prev.map((r, j) => (
                          j === i ? { ...r, absentList: e.target.value } : r
                        )))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="submit" className="btn btn-danger btn-lg" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </form>
      ) : (
        date && date !== loadedDate ? (
          <p className="text-muted mb-0">Date changed — click Load to fetch attendance.</p>
        ) : (
          <p className="text-muted mb-0">Select a date and click Load.</p>
        )
      )}
    </div>
  );
}

function ApprovalReportSummary({ summary }) {
  if (!summary) return null;
  const rows = [
    ['Total', summary.total],
    ['Approve', summary.approve],
    ['Pending', summary.pending],
    ['Rejected', summary.rejected],
  ];
  return (
    <section className="approval-report-panel">
      <header className="approval-report-panel__head">Report</header>
      <div className="approval-report-panel__body">
        <table className="table table-bordered approval-report-table mb-0">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{value ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StudentApprovalList({ data, filterFields, onSelect, onSave, busy }) {
  const requests = data?.requests || [];
  const detail = data?.detail;

  return (
    <div className="row g-3 mt-1">
      <div className="col-lg-9">
        <div className="row">
          <div className="col-md-5">
            <div className="list-group approval-request-list" style={{ maxHeight: '50vh', overflow: 'auto' }}>
              {requests.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`list-group-item list-group-item-action${detail?.header?.id === r.id ? ' active' : ''}`}
                  onClick={() => onSelect({ ...filterFields, rid: r.id })}
                >
                  <strong>{r.registerNo}</strong> {r.studentName}
                  <br />
                  <small>
                    {r.fromDate} — {r.toDate}
                    {r.pType ? ` · ${r.pType}` : ''}
                    {r.leaveType ? ` · ${r.leaveType}` : ''}
                    {' · '}{r.statusLabel}
                  </small>
                </button>
              ))}
            </div>
        {!requests.length ? (
          <p className="text-muted mt-2 mb-0">
            No data found.
            {data?.hasDateFilter ? ' Try clearing the From/To dates to search all requests.' : ''}
          </p>
        ) : null}
          </div>
          <div className="col-md-7">
            {detail?.header ? (
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                onSave({
                  ...filterFields,
                  rid: detail.header.id,
                  att_status: fd.get('status'),
                  l_comments: fd.get('comments'),
                  comments: fd.get('comments'),
                  update: 'Confirm',
                });
              }}
              >
                <p><strong>{detail.header.registerNo}</strong> — {detail.header.studentName}</p>
                <p className="text-muted small mb-2">
                  {detail.header.requestId ? `PR${detail.header.requestId}` : `ID ${detail.header.id}`}
                  {' · '}{detail.header.fromDate} — {detail.header.toDate}
                  {detail.header.pType ? ` · ${detail.header.pType}` : ''}
                </p>
                <div className="mb-2">
                  <label className="form-label">Status</label>
                  <select name="status" className="form-select" defaultValue={String(detail.header.status)}>
                    <option value="0">Pending</option>
                    <option value="1">Approved</option>
                    <option value="2">Rejected</option>
                  </select>
                </div>
                <div className="mb-2">
                  <label className="form-label">Comments</label>
                  <textarea name="comments" className="form-control" defaultValue={detail.header.comments} rows={3} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={busy}>Confirm</button>
              </form>
            ) : (
              <p className="text-muted">Select a request to approve or reject.</p>
            )}
          </div>
        </div>
      </div>
      <div className="col-lg-3">
        <ApprovalReportSummary summary={data?.summary} />
      </div>
    </div>
  );
}

function readSmrSetupFields(form) {
  const fd = new FormData(form);
  return {
    course_type: fd.get('course_type') || 'U.G',
    od_type: fd.get('od_type') || '',
    leave_apply: fd.get('leave_apply') || '',
    r_id: fd.get('r_id') || '',
  };
}

const PG_WEEK_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function emptyPgGroup() {
  return {
    att_group: '',
    from_date: '',
    to_date: '',
    from_time: '08:30',
    to_time: '15:30',
    room_no: '',
    days: [],
    dayRows: [],
  };
}

function PgAttSetupForm({ data, onLoad, onSave, busy }) {
  const [courseKey, setCourseKey] = useState('');
  const [semester, setSemester] = useState('1');
  const [groups, setGroups] = useState([emptyPgGroup()]);

  useEffect(() => {
    if (!data) return;
    setCourseKey(data.course_key || '');
    setSemester(String(data.current_year || '1'));
    setGroups(data.groups?.length ? data.groups.map((g) => ({
      ...g,
      from_date: displayDateToIso(g.from_date) || g.from_date || '',
      to_date: displayDateToIso(g.to_date) || g.to_date || '',
      days: g.days || [],
    })) : [emptyPgGroup()]);
  }, [data]);

  const totalSemester = data?.total_semester || 1;
  const roomGroups = data?.rooms?.grouped || [];

  const updateGroup = (index, patch) => {
    setGroups((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const reload = (nextCourseKey, nextSemester) => {
    onLoad({ course_name: nextCourseKey, semester_name: nextSemester });
  };

  const submit = (e) => {
    e.preventDefault();
    if (!data?.course_id) return;
    onSave({
      tt_course: data.course_id,
      tt_ayear: data.academic_year,
      tt_cyear: semester,
      tt_cacademic: data.academic_type,
      groups: groups.map((g) => ({
        att_group: g.att_group || '',
        from_date: g.from_date,
        to_date: g.to_date,
        from_time: g.from_time,
        to_time: g.to_time,
        room_no: g.room_no,
        days: g.days,
        dayRows: g.dayRows?.length
          ? g.dayRows
          : g.days.map((day) => ({ day, id: null })),
      })),
    });
  };

  const deleteGroup = (attGroup) => {
    if (!attGroup || !window.confirm('Delete this schedule group?')) return;
    onSave({
      tt_course: data.course_id,
      tt_ayear: data.academic_year,
      tt_cyear: semester,
      tt_cacademic: data.academic_type,
      delete_group: attGroup,
    });
  };

  return (
    <form onSubmit={submit}>
      <div className="row g-3 mb-3">
        <div className="col-md-5">
          <label className="form-label">Course &amp; Academic year</label>
          <select
            className="form-select"
            value={courseKey}
            onChange={(e) => {
              const value = e.target.value;
              setCourseKey(value);
              reload(value, semester);
            }}
          >
            <option value="">-- Select Course --</option>
            {(data?.courseOptions || []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        {courseKey ? (
          <div className="col-md-7">
            <label className="form-label d-block">Year</label>
            <div className="d-flex flex-wrap gap-3">
              {Array.from({ length: totalSemester }, (_, i) => String(i + 1)).map((year) => (
                <label key={year} className="form-check-label">
                  <input
                    type="radio"
                    className="form-check-input me-1"
                    name="semester_name"
                    value={year}
                    checked={semester === year}
                    onChange={() => {
                      setSemester(year);
                      reload(courseKey, year);
                    }}
                  />
                  {year}
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {courseKey ? (
        <>
          <div className="table-responsive mb-2">
            <table className="table table-bordered table-sm align-middle">
              <thead className="table-light">
                <tr>
                  <th rowSpan={2}>S.No</th>
                  <th rowSpan={2}>From</th>
                  <th rowSpan={2}>To</th>
                  <th rowSpan={2}>Working Days</th>
                  <th colSpan={2} className="text-center">Timings (24 hrs)</th>
                  <th rowSpan={2}>Room No.</th>
                  <th rowSpan={2} />
                </tr>
                <tr>
                  <th>IN</th>
                  <th>OUT</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group, index) => (
                  <tr key={group.att_group || `new-${index}`}>
                    <td>{index + 1}</td>
                    <td>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={group.from_date || ''}
                        onChange={(e) => updateGroup(index, { from_date: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={group.to_date || ''}
                        onChange={(e) => updateGroup(index, { to_date: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        multiple
                        className="form-select form-select-sm"
                        size={4}
                        value={group.days}
                        onChange={(e) => {
                          const days = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                          const dayRows = days.map((day) => {
                            const existing = group.dayRows?.find((entry) => entry.day === day);
                            return existing || { day, id: null };
                          });
                          updateGroup(index, { days, dayRows });
                        }}
                      >
                        {PG_WEEK_DAYS.map((day) => (
                          <option key={day} value={day}>{day.charAt(0).toUpperCase() + day.slice(1)}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="time"
                        className="form-control form-control-sm"
                        value={group.from_time || ''}
                        onChange={(e) => updateGroup(index, { from_time: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        className="form-control form-control-sm"
                        value={group.to_time || ''}
                        onChange={(e) => updateGroup(index, { to_time: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={group.room_no || ''}
                        onChange={(e) => updateGroup(index, { room_no: e.target.value })}
                      >
                        <option value="">-- Sel --</option>
                        {roomGroups.map((block) => (
                          <optgroup key={block.blockId} label={block.blockName}>
                            {block.rooms.map((room) => (
                              <option key={room.id} value={room.id}>{room.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td>
                      {group.att_group ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => deleteGroup(group.att_group)}
                          disabled={busy}
                        >
                          Delete
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex justify-content-between align-items-center">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setGroups((prev) => [...prev, emptyPgGroup()])}
            >
              + Add row
            </button>
            <button type="submit" className="btn btn-danger" disabled={busy}>
              {busy ? 'Saving…' : 'Update'}
            </button>
          </div>
        </>
      ) : (
        <p className="text-muted mb-0">Select a course and academic year to configure PG attendance timings.</p>
      )}
    </form>
  );
}

function InternAttSetupForm({ data, onSave, busy }) {
  const [fields, setFields] = useState({
    late_time: '',
    permission_time: '',
    sat_time: '',
    od_type: '',
    leave_apply: '',
    defaulter_apply: '',
    inc_lr_holiday: false,
    r_id: '1',
  });
  const set = (key, value) => setFields((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!data?.setup) return;
    const setup = data.setup;
    setFields({
      late_time: setup.lateTime || '',
      permission_time: setup.permissionTime || '',
      sat_time: setup.satTime || '',
      od_type: setup.odType || '',
      leave_apply: setup.leaveApplyDays || '',
      defaulter_apply: setup.defaulterApply || '',
      inc_lr_holiday: !!setup.incLrHoliday,
      r_id: String(setup.id || '1'),
    });
  }, [data]);

  const submit = (e) => {
    e.preventDefault();
    onSave({
      p_time: fields.permission_time,
      l_time: fields.late_time,
      s_time: fields.sat_time,
      od_type: fields.od_type,
      leave_apply: fields.leave_apply,
      defaulter_apply: fields.defaulter_apply,
      inc_lr_holiday: fields.inc_lr_holiday ? 1 : 0,
      r_id: fields.r_id,
    });
  };

  if (!data?.setup) {
    return <p className="text-muted mb-0">Internship attendance setup is not configured yet.</p>;
  }

  return (
    <form onSubmit={submit} className="row g-3">
      <div className="col-md-3">
        <label className="form-label">Late Time <span className="text-danger">*</span></label>
        <input
          type="time"
          className="form-control"
          value={fields.late_time}
          onChange={(e) => set('late_time', e.target.value)}
          required
        />
      </div>
      <div className="col-md-3">
        <label className="form-label">Permission Time <span className="text-danger">*</span></label>
        <input
          type="time"
          className="form-control"
          value={fields.permission_time}
          onChange={(e) => set('permission_time', e.target.value)}
          required
        />
      </div>
      <div className="col-md-3">
        <label className="form-label">Saturday End Time <span className="text-danger">*</span></label>
        <input
          type="time"
          className="form-control"
          value={fields.sat_time}
          onChange={(e) => set('sat_time', e.target.value)}
          required
        />
      </div>
      <div className="col-md-6">
        <label className="form-label">OD Type (comma-separated)</label>
        <input className="form-control" value={fields.od_type} onChange={(e) => set('od_type', e.target.value)} />
      </div>
      <div className="col-md-3">
        <label className="form-label">Leave Apply Request (days)</label>
        <input
          type="number"
          min="0"
          className="form-control"
          value={fields.leave_apply}
          onChange={(e) => set('leave_apply', e.target.value)}
        />
      </div>
      <div className="col-md-3">
        <label className="form-label">Defaulter Request (previous working days)</label>
        <input
          type="number"
          min="0"
          className="form-control"
          value={fields.defaulter_apply}
          onChange={(e) => set('defaulter_apply', e.target.value)}
        />
      </div>
      <div className="col-12">
        <button type="submit" className="btn btn-danger" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function emptyRosterRow(isIntern = false) {
  return {
    id: null, from_date: '', to_date: '', from_time: '', to_time: '', room_no: '', ...(isIntern ? { department: '' } : {}),
  };
}

function groupRosterCourseOptions(options = []) {
  const groups = new Map();
  for (const opt of options) {
    const key = opt.groupLabel || opt.label || 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(opt);
  }
  return Array.from(groups.entries()).map(([groupLabel, items]) => ({ groupLabel, items }));
}

function rosterCourseChipLabel(option) {
  const parts = String(option.label || '').split('|').map((p) => p.trim());
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];
    if (/^Year \d+$/i.test(last)) return last;
    if (secondLast === 'Reg' || secondLast === 'Add') return `${secondLast} · ${last}`;
    return last;
  }
  return option.label || '';
}

function RosterCoursePicker({ options, selected, onChange, disabled, isIntern }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const grouped = useMemo(() => groupRosterCourseOptions(options), [options]);

  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) return grouped;
    return grouped
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (opt) => opt.label?.toLowerCase().includes(normalizedQuery)
            || group.groupLabel.toLowerCase().includes(normalizedQuery),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [grouped, normalizedQuery]);

  const toggle = (value) => {
    onChange(
      selected.includes(value)
        ? selected.filter((key) => key !== value)
        : [...selected, value],
    );
  };

  const toggleGroup = (items, selectAll) => {
    const values = items.map((opt) => opt.value);
    if (selectAll) {
      onChange([...new Set([...selected, ...values])]);
      return;
    }
    onChange(selected.filter((key) => !values.includes(key)));
  };

  const clearAll = () => onChange([]);

  return (
    <div className="roster-course-picker">
      <div className="roster-course-picker-toolbar">
        <input
          type="search"
          className="form-control form-control-sm roster-course-search"
          placeholder={isIntern ? 'Search course, year or batch…' : 'Search course or year…'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
        />
        <div className="roster-course-picker-actions">
          <span className="roster-course-count">
            {selected.length} selected
          </span>
          {selected.length > 0 ? (
            <button type="button" className="btn btn-sm btn-link p-0" onClick={clearAll} disabled={disabled}>
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="roster-course-groups" role="group" aria-label={isIntern ? 'Course, year and batch' : 'Course and year'}>
        {filteredGroups.map((group) => {
          const groupValues = group.items.map((opt) => opt.value);
          const selectedInGroup = groupValues.filter((value) => selected.includes(value)).length;
          const allSelected = selectedInGroup === groupValues.length;
          const someSelected = selectedInGroup > 0 && !allSelected;

          return (
            <section key={group.groupLabel} className="roster-course-group">
              <div className="roster-course-group-head">
                <h3 className="roster-course-group-title">{group.groupLabel}</h3>
                <button
                  type="button"
                  className="btn btn-sm btn-link roster-course-group-toggle"
                  onClick={() => toggleGroup(group.items, !allSelected)}
                  disabled={disabled}
                >
                  {allSelected ? 'Deselect all' : someSelected ? 'Select all' : 'Select all'}
                </button>
              </div>
              <div className="roster-course-chips">
                {group.items.map((opt) => {
                  const isSelected = selected.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={`roster-course-chip${isSelected ? ' is-selected' : ''}`}
                      aria-pressed={isSelected}
                      title={opt.label}
                      onClick={() => toggle(opt.value)}
                      disabled={disabled}
                    >
                      {rosterCourseChipLabel(opt)}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        {!filteredGroups.length ? (
          <p className="roster-course-empty text-muted mb-0">
            {options.length ? 'No courses match your search.' : 'No courses available.'}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function HolidayRosterForm({ screen, data, onLoad, onSave, busy }) {
  const isAdd = screen.includes('-add');
  const isIntern = screen.includes('intern-');
  const [courseKeys, setCourseKeys] = useState([]);
  const [studentList, setStudentList] = useState('');
  const [groups, setGroups] = useState([emptyRosterRow(isIntern)]);
  const [listPage, setListPage] = useState(1);

  useEffect(() => {
    if (!data) return;
    if (data.pagination?.page) setListPage(data.pagination.page);
    setStudentList(data.student_list || '');
    setCourseKeys(data.course_keys || []);
    if (data.groups?.length) {
      setGroups(data.groups.map((g) => ({
        ...g,
        from_date: displayDateToIso(g.from_date) || g.from_date || '',
        to_date: displayDateToIso(g.to_date) || g.to_date || '',
        from_time: g.from_time || '',
        to_time: g.to_time || '',
        department: g.department || '',
      })));
    } else {
      setGroups([emptyRosterRow(isIntern)]);
    }
  }, [data, isIntern]);

  const roomGroups = data?.rooms?.grouped || [];
  const courseOptions = data?.courseOptions || [];
  const departmentOptions = data?.departmentOptions || [];

  const updateGroup = (index, patch) => {
    setGroups((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const loadStudents = () => {
    if (!courseKeys.length) return;
    onLoad({ resolve_students: true, course_keys: courseKeys });
  };

  const studentCount = useMemo(() => {
    if (!studentList.trim()) return 0;
    return studentList.split(',').map((s) => s.trim()).filter(Boolean).length;
  }, [studentList]);

  const submit = (e) => {
    e.preventDefault();
    onSave({
      ref_id: data?.ref_id,
      edit_row_id: data?.ref_id,
      student_list: studentList,
      course_keys: courseKeys,
      groups,
    });
  };

  if (!isAdd && data?.view === 'list') {
    const pagination = data.pagination || {
      page: 1,
      pageSize: 20,
      total: data.rosters?.length || 0,
      totalPages: 1,
      from: data.rosters?.length ? 1 : 0,
      to: data.rosters?.length || 0,
    };

    return (
      <div>
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
          <span className="text-muted small">
            {pagination.total
              ? `Showing ${pagination.from} to ${pagination.to} of ${pagination.total} entries`
              : 'Showing 0 to 0 of 0 entries'}
          </span>
          {pagination.totalPages > 1 ? (
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${pagination.page <= 1 ? 'disabled' : ''}`}>
                <button
                  type="button"
                  className="page-link"
                  disabled={busy || pagination.page <= 1}
                  onClick={() => onLoad({ page: pagination.page - 1 })}
                >
                  Prev
                </button>
              </li>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .slice(Math.max(0, pagination.page - 3), Math.min(pagination.totalPages, pagination.page + 2))
                .map((pageNum) => (
                  <li key={pageNum} className={`page-item ${pageNum === pagination.page ? 'active' : ''}`}>
                    <button
                      type="button"
                      className="page-link"
                      disabled={busy}
                      onClick={() => onLoad({ page: pageNum })}
                    >
                      {pageNum}
                    </button>
                  </li>
                ))}
              <li className={`page-item ${pagination.page >= pagination.totalPages ? 'disabled' : ''}`}>
                <button
                  type="button"
                  className="page-link"
                  disabled={busy || pagination.page >= pagination.totalPages}
                  onClick={() => onLoad({ page: pagination.page + 1 })}
                >
                  Next
                </button>
              </li>
            </ul>
          ) : null}
        </div>
        <div className="table-responsive">
          <table className="table table-hover table-sm">
            <thead>
              <tr><th>Date</th><th className="text-end">Actions</th></tr>
            </thead>
            <tbody>
              {(data.rosters || []).map((roster) => (
                <tr key={roster.ref_id}>
                  <td>{roster.label || `Roster #${roster.ref_id}`}</td>
                  <td className="text-end text-nowrap">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary me-1"
                      disabled={busy}
                      onClick={() => {
                        setListPage(pagination.page);
                        onLoad({ ref_id: roster.ref_id });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm('Delete this roster?')) {
                          onSave({ delete_ref_id: roster.ref_id, page: pagination.page });
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!data.rosters?.length ? (
                <tr><td colSpan={2} className="text-muted">No rosters found.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {pagination.totalPages > 1 ? (
          <div className="d-flex justify-content-center mt-2">
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${pagination.page <= 1 ? 'disabled' : ''}`}>
                <button
                  type="button"
                  className="page-link"
                  disabled={busy || pagination.page <= 1}
                  onClick={() => onLoad({ page: pagination.page - 1 })}
                >
                  Prev
                </button>
              </li>
              <li className={`page-item ${pagination.page >= pagination.totalPages ? 'disabled' : ''}`}>
                <button
                  type="button"
                  className="page-link"
                  disabled={busy || pagination.page >= pagination.totalPages}
                  onClick={() => onLoad({ page: pagination.page + 1 })}
                >
                  Next
                </button>
              </li>
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="holiday-roster-form">
      {!isAdd && data?.ref_id ? (
        <div className="mb-3">
          <button type="button" className="btn btn-sm btn-link ps-0" onClick={() => onLoad({ page: listPage })}>
            ← Back to roster list
          </button>
        </div>
      ) : null}

      <div className="roster-setup-panel mb-3">
        <div className="roster-setup-panel-head">
          <div>
            <h2 className="roster-setup-panel-title">1. Select courses</h2>
            <p className="roster-setup-panel-hint mb-0">
              {isIntern
                ? 'Choose one or more course, year and batch combinations, then load register numbers.'
                : 'Choose one or more course and year combinations, then load register numbers.'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary roster-load-btn"
            onClick={loadStudents}
            disabled={busy || !courseKeys.length}
          >
            {busy ? 'Loading…' : 'Load students'}
          </button>
        </div>

        <RosterCoursePicker
          options={courseOptions}
          selected={courseKeys}
          onChange={setCourseKeys}
          disabled={busy}
          isIntern={isIntern}
        />
      </div>

      <div className="roster-students-panel mb-3">
        <div className="roster-students-panel-head">
          <div>
            <h2 className="roster-setup-panel-title">2. Student list</h2>
            <p className="roster-setup-panel-hint mb-0">
              Register numbers are loaded from the selected courses. You can edit the list if needed.
            </p>
          </div>
          {studentCount > 0 ? (
            <span className="roster-student-count">{studentCount} students</span>
          ) : null}
        </div>
        <textarea
          className="form-control roster-student-list"
          rows={5}
          value={studentList}
          onChange={(e) => setStudentList(e.target.value)}
          placeholder="Comma-separated register numbers"
          required
        />
      </div>

      <div className="table-responsive mb-2">
        <table className="table table-bordered table-sm align-middle">
          <thead className="table-light">
            <tr>
              <th rowSpan={2}>S.No</th>
              {isIntern ? <th rowSpan={2}>Department</th> : null}
              <th rowSpan={2}>From</th>
              <th rowSpan={2}>To</th>
              <th colSpan={2} className="text-center">Timings (24 hrs)</th>
              <th rowSpan={2}>Room No.</th>
              <th rowSpan={2} />
            </tr>
            <tr><th>IN</th><th>OUT</th></tr>
          </thead>
          <tbody>
            {groups.map((group, index) => (
              <tr key={group.id || `new-${index}`}>
                <td>{index + 1}</td>
                {isIntern ? (
                  <td>
                    <select
                      className="form-select form-select-sm"
                      value={group.department || ''}
                      onChange={(e) => updateGroup(index, { department: e.target.value })}
                      required
                    >
                      <option value="">-- Department --</option>
                      {departmentOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                ) : null}
                <td>
                  <input type="date" className="form-control form-control-sm" value={group.from_date || ''} onChange={(e) => updateGroup(index, { from_date: e.target.value })} />
                </td>
                <td>
                  <input type="date" className="form-control form-control-sm" value={group.to_date || ''} onChange={(e) => updateGroup(index, { to_date: e.target.value })} />
                </td>
                <td>
                  <input type="time" className="form-control form-control-sm" value={group.from_time || ''} onChange={(e) => updateGroup(index, { from_time: e.target.value })} />
                </td>
                <td>
                  <input type="time" className="form-control form-control-sm" value={group.to_time || ''} onChange={(e) => updateGroup(index, { to_time: e.target.value })} />
                </td>
                <td>
                  <select className="form-select form-select-sm" value={group.room_no || ''} onChange={(e) => updateGroup(index, { room_no: e.target.value })}>
                    <option value="">-- Sel --</option>
                    {roomGroups.map((block) => (
                      <optgroup key={block.blockId} label={block.blockName}>
                        {block.rooms.map((room) => (
                          <option key={room.id} value={room.id}>{room.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </td>
                <td>
                  {group.id ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm('Delete this row?')) return;
                        onSave({ ref_id: data?.ref_id, delete_row_id: group.id });
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="d-flex justify-content-between align-items-center">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setGroups((prev) => [...prev, emptyRosterRow(isIntern)])}>
          + Add row
        </button>
        <button type="submit" className="btn btn-danger" disabled={busy}>
          {busy ? 'Saving…' : (isAdd ? 'Save' : 'Update')}
        </button>
      </div>
    </form>
  );
}

function YearInchargeForm({ data, onLoad, onSave, busy }) {
  const [courseKey, setCourseKey] = useState('');
  const [yearRows, setYearRows] = useState([]);

  const courseGroups = useMemo(() => {
    const groups = new Map();
    for (const opt of data?.courseOptions || []) {
      const key = opt.groupLabel || 'Courses';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(opt);
    }
    return [...groups.entries()];
  }, [data?.courseOptions]);

  useEffect(() => {
    if (!data) return;
    setCourseKey(data.course_key || '');
    setYearRows(data.yearRows || []);
  }, [data]);

  const updateRow = (index, inchargeStaff) => {
    setYearRows((prev) => prev.map((row, i) => (i === index ? { ...row, incharge_staff: inchargeStaff } : row)));
  };

  const submit = (e) => {
    e.preventDefault();
    if (!courseKey || !yearRows.length) return;
    onSave({
      hd_course_id: data.course_id,
      hd_academic_year: data.academic_year,
      academic_batch: data.academic_batch,
      rows: yearRows,
    });
  };

  return (
    <form onSubmit={submit}>
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <label className="form-label">Course &amp; Academic year <span className="text-danger">*</span></label>
          <select
            className="form-select"
            value={courseKey}
            required
            onChange={(e) => {
              const value = e.target.value;
              setCourseKey(value);
              onLoad({ course_name: value });
            }}
          >
            <option value="">-- Select Course --</option>
            {courseGroups.map(([groupLabel, opts]) => (
              <optgroup key={groupLabel} label={groupLabel}>
                {opts.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {courseKey && yearRows.length ? (
        <>
          <div className="table-responsive mb-3" style={{ maxWidth: 640 }}>
            <table className="table table-bordered table-sm align-middle">
              <thead className="table-light">
                <tr>
                  <th>Year</th>
                  <th>Staff Name</th>
                </tr>
              </thead>
              <tbody>
                {yearRows.map((row, index) => (
                  <tr key={row.current_year}>
                    <td>{row.year_label} Year</td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={row.incharge_staff || ''}
                        onChange={(e) => updateRow(index, e.target.value)}
                      >
                        <option value="">-- Select Staff --</option>
                        {(data?.staffOptions || []).map((staff) => (
                          <option key={staff.id} value={staff.id}>{staff.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="submit" className="btn btn-danger" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      ) : courseKey ? (
        <p className="text-muted mb-0">No year rows found for the selected course.</p>
      ) : (
        <p className="text-muted mb-0">Select a course and academic year to assign year incharge staff.</p>
      )}
    </form>
  );
}

function PgPunchReportForm({ data, busy, onGenerate, reportHtml, isEntry }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [courseKeys, setCourseKeys] = useState([]);

  useEffect(() => {
    if (!data) return;
    setFromDate(displayDateToIso(data.from_date) || '');
    setToDate(displayDateToIso(data.to_date) || '');
    setCourseKeys(data.course_name || []);
  }, [data]);

  const submit = (e) => {
    e.preventDefault();
    if (!courseKeys.length) return;
    onGenerate({
      from_date: fromDate,
      to_date: toDate,
      course_name: courseKeys,
      Submit: 'Generate',
    });
  };

  const courseOptions = data?.courseOptions || [];
  const dateRangeLabel = fromDate && toDate
    ? `${toPgDisplayDate(fromDate)} — ${toPgDisplayDate(toDate)}`
    : null;

  return (
    <div className="pg-punch-report">
      <form onSubmit={submit} className="pg-punch-report-filters">
        <header className="pg-punch-report-head">
          <div>
            <h2 className="pg-punch-report-title">
              {isEntry ? 'Punch entry report' : 'P.G punch report'}
            </h2>
            <p className="pg-punch-report-subtitle mb-0">
              View biometric punch times by student and date for selected PG courses.
            </p>
          </div>
          {dateRangeLabel && reportHtml ? (
            <span className="pg-punch-range-badge">{dateRangeLabel}</span>
          ) : null}
        </header>

        <div className="pg-punch-date-panel">
          <div className="pg-punch-date-field">
            <label className="form-label" htmlFor="pg-punch-from">From</label>
            <input
              id="pg-punch-from"
              type="date"
              className="form-control"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              required
            />
          </div>
          <div className="pg-punch-date-field">
            <label className="form-label" htmlFor="pg-punch-to">To</label>
            <input
              id="pg-punch-to"
              type="date"
              className="form-control"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              required
            />
          </div>
        </div>

        <section className="pg-punch-courses-panel">
          <div className="pg-punch-courses-head">
            <div>
              <h3 className="pg-punch-section-title">Courses</h3>
              <p className="pg-punch-section-hint mb-0">
                Select one or more PG course years to include in the punch matrix.
              </p>
            </div>
            <span className="pg-punch-course-count">
              {courseKeys.length} selected
            </span>
          </div>
          <RosterCoursePicker
            options={courseOptions}
            selected={courseKeys}
            onChange={setCourseKeys}
            disabled={busy}
            isIntern={false}
          />
        </section>

        <div className="pg-punch-actions">
          <button
            type="submit"
            className="btn btn-danger pg-punch-generate-btn"
            disabled={busy || !courseKeys.length || !fromDate || !toDate}
          >
            {busy ? 'Generating…' : 'Generate report'}
          </button>
        </div>
      </form>

      {busy && !reportHtml ? (
        <div className="pg-punch-loading">
          <div className="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
          <span>Building punch report…</span>
        </div>
      ) : null}

      {reportHtml ? (
        <section className="pg-punch-results">
          <div className="pg-punch-results-head">
            <h3 className="pg-punch-section-title mb-0">Punch times</h3>
            <p className="pg-punch-section-hint mb-0">
              Roll number, student name, and punch times per day.
            </p>
          </div>
          <div className="pg-punch-table-wrap report-html" dangerouslySetInnerHTML={{ __html: reportHtml }} />
        </section>
      ) : !busy ? (
        <div className="pg-punch-empty">
          <p className="mb-0">Choose a date range and at least one course, then generate the report.</p>
        </div>
      ) : null}
    </div>
  );
}

function ScreenFilters({ screen, meta, data, filterFields, onGenerate, onSave, onPgBatchGenerate, busy, pgGenerating }) {
  const formRef = useRef(null);
  const [fields, setFields] = useState({
    from_date: '',
    to_date: '',
    a_status: '0',
    a_staff: '',
    course_type: 'U.G',
    od_type: '',
    leave_apply: '',
    r_id: '',
    course_name: [],
    academic_year: '',
    report_type: 'Monthly',
    cleariCache: false,
    hideAbinfo: false,
    student_id: '',
    roll_no: '',
    register_no: '',
    machine_id: '',
    category: '',
    letter_date: '',
    a_request: ['leave', 'permission', 'defaulter'],
    a_status_list: ['p', '1', '2'],
  });
  const set = (key, value) => setFields((prev) => ({ ...prev, [key]: value }));
  const toggleListValue = (key, value, checked) => {
    setFields((prev) => {
      const current = new Set(prev[key] || []);
      if (checked) current.add(value);
      else current.delete(value);
      return { ...prev, [key]: [...current] };
    });
  };

  useEffect(() => {
    if (!data) return;
    if (meta.type === 'smr-setup') {
      setFields((prev) => ({
        ...prev,
        course_type: data.course_type || prev.course_type || 'U.G',
        od_type: data.setup?.odType ?? prev.od_type ?? '',
        leave_apply: data.setup?.leaveApplyDays != null ? String(data.setup.leaveApplyDays) : (prev.leave_apply ?? ''),
        r_id: data.setup?.id != null ? String(data.setup.id) : (prev.r_id ?? ''),
      }));
      return;
    }
    setFields((prev) => ({
      ...prev,
      from_date: screen === 'biometric-report'
        ? (displayDatetimeToLocal(data.from_date) || prev.from_date || '')
        : (displayDateToIso(data.from_date) || prev.from_date || ''),
      to_date: screen === 'biometric-report'
        ? (displayDatetimeToLocal(data.to_date) || prev.to_date || '')
        : (displayDateToIso(data.to_date) || prev.to_date || ''),
      a_status: data.a_status != null ? String(data.a_status) : (prev.a_status ?? '0'),
      course_name: data.course_name || prev.course_name || [],
      academic_year: data.academic_year ?? prev.academic_year ?? '',
      report_type: data.report_type || prev.report_type || 'Monthly',
      cleariCache: Boolean(data.cleariCache ?? prev.cleariCache),
      hideAbinfo: Boolean(data.hideAbinfo ?? prev.hideAbinfo),
      student_id: data.student_id ?? prev.student_id ?? '',
      roll_no: data.roll_no ?? prev.roll_no ?? '',
      register_no: data.register_no ?? prev.register_no ?? '',
      machine_id: data.machine_id ?? prev.machine_id ?? '',
      category: data.category ?? prev.category ?? '',
      letter_date: displayDateToIso(data.letter_date) || prev.letter_date || '',
      a_request: data.a_request || prev.a_request || ['leave', 'permission', 'defaulter'],
      a_status_list: data.a_status || prev.a_status_list || ['p', '1', '2'],
    }));
  }, [data, meta.type, screen]);

  const biometricDateRow = (
    <>
      <div className="col-md-3">
        <label className="form-label">From</label>
        <input type="datetime-local" name="from_date" className="form-control" value={fields.from_date} onChange={(e) => set('from_date', e.target.value)} />
      </div>
      <div className="col-md-3">
        <label className="form-label">To</label>
        <input type="datetime-local" name="to_date" className="form-control" value={fields.to_date} onChange={(e) => set('to_date', e.target.value)} />
      </div>
    </>
  );

  const dateRow = (
    <>
      <div className="col-md-3">
        <label className="form-label">From</label>
        <input type="date" name="from_date" className="form-control" value={fields.from_date} onChange={(e) => set('from_date', e.target.value)} title="Optional — leave blank for all dates" />
      </div>
      <div className="col-md-3">
        <label className="form-label">To</label>
        <input type="date" name="to_date" className="form-control" value={fields.to_date} onChange={(e) => set('to_date', e.target.value)} title="Optional — leave blank for all dates" />
      </div>
    </>
  );

  const lpdDateRow = (
    <>
      <div className="col-md-3">
        <label className="form-label">From</label>
        <input type="date" name="from_date" className="form-control" value={fields.from_date} onChange={(e) => set('from_date', e.target.value)} required />
      </div>
      <div className="col-md-3">
        <label className="form-label">To</label>
        <input type="date" name="to_date" className="form-control" value={fields.to_date} onChange={(e) => set('to_date', e.target.value)} required />
      </div>
    </>
  );

  return (
    <form
      ref={formRef}
      className="row g-3 mb-3"
      onSubmit={(e) => {
      e.preventDefault();
        if (meta.type === 'smr-setup') {
          const payload = readSmrSetupFields(e.currentTarget);
          setFields((prev) => ({ ...prev, ...payload }));
          onSave(payload);
          return;
        }
        const payload = readFilterFields(e.currentTarget);
        if (meta.type === 'lpd-report') {
          payload.a_request = fields.a_request?.length
            ? fields.a_request
            : ['leave', 'permission', 'defaulter'];
          payload.a_status = fields.a_status_list?.length
            ? fields.a_status_list
            : ['p', '1', '2'];
          delete payload.a_status_list;
        }
        if (meta.type === 'pg-att-report') {
          payload.course_name = fields.course_name || [];
          payload.academic_year = fields.academic_year || data?.academic_year || '';
          payload.report_type = fields.report_type || 'Monthly';
          payload.cleariCache = fields.cleariCache;
          payload.hideAbinfo = fields.hideAbinfo;
        }
        if (meta.type === 'student-id-report' && !payload.student_id) {
          payload.student_id = fields.student_id || '';
        }
        if ((meta.type === 'date-roll-report' || meta.type === 'roll-report') && !payload.roll_no) {
          payload.roll_no = fields.roll_no || '';
        }
        if (meta.type === 'roll-report' && !payload.register_no) {
          payload.register_no = fields.register_no || fields.roll_no || '';
        }
        if (screen === 'biometric-report' && !payload.machine_id) {
          payload.machine_id = fields.machine_id || '';
        }
        setFields((prev) => ({ ...prev, ...payload }));
        if (meta.type === 'pg-att-report' && onPgBatchGenerate) {
          onPgBatchGenerate(payload);
          return;
        }
      if (SAVE_SCREENS.has(screen) && meta.type !== 'period-att') onSave(payload);
      else onGenerate(payload);
      }}
    >
      {(meta.type === 'date-roll-report' || meta.type === 'roll-report') && (
        <>
          {screen === 'biometric-report' ? biometricDateRow : dateRow}
          <div className="col-md-3">
            <label className="form-label">{meta.type === 'roll-report' ? 'Register No' : 'Roll No'}</label>
            <input
              name={meta.type === 'roll-report' ? 'register_no' : 'roll_no'}
              className="form-control"
              value={meta.type === 'roll-report' ? (fields.register_no || fields.roll_no) : fields.roll_no}
              onChange={(e) => set(meta.type === 'roll-report' ? 'register_no' : 'roll_no', e.target.value)}
              placeholder="Comma-separated allowed"
            />
          </div>
          {screen === 'biometric-report' && (
            <div className="col-md-3">
              <label className="form-label">Machine ID</label>
              <input name="machine_id" className="form-control" value={fields.machine_id} onChange={(e) => set('machine_id', e.target.value)} />
            </div>
          )}
        </>
      )}
      {(meta.type === 'date-category-report' || meta.type === 'date-report' || meta.type === 'pg-att-report') && dateRow}
      {meta.type === 'pg-att-report' && (
        <>
          <div className="col-md-3">
            <label className="form-label">Academic Year</label>
            <select
              name="academic_year"
              className="form-select"
              value={fields.academic_year || data?.academic_year || ''}
              onChange={(e) => {
                const nextYear = e.target.value;
                set('academic_year', nextYear);
                set('course_name', []);
                onGenerate({ academic_year: nextYear });
              }}
            >
              <option value="">--Select Year--</option>
              {(data?.academicYears || []).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="col-md-5">
            <label className="form-label">Course</label>
            <RosterCoursePicker
              options={data?.courseOptions || []}
              selected={fields.course_name || []}
              onChange={(selected) => set('course_name', selected)}
              disabled={busy}
              isIntern={false}
            />
          </div>
          <div className="col-12">
            <label className="form-label">Show</label>
            <div className="d-flex flex-wrap gap-3">
              {[
                ['Monthly', 'Monthly'],
                ['Overall', 'Over All'],
              ].map(([value, label]) => (
                <label key={value} className="d-inline-flex align-items-center gap-1 mb-0">
                  <input
                    type="radio"
                    name="report_type"
                    value={value}
                    checked={(fields.report_type || 'Monthly') === value}
                    onChange={(e) => set('report_type', e.target.value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="col-12">
            <div className="d-flex flex-wrap gap-3">
              <label className="d-inline-flex align-items-center gap-1 mb-0">
                <input
                  type="checkbox"
                  name="cleariCache"
                  value="1"
                  checked={Boolean(fields.cleariCache)}
                  onChange={(e) => set('cleariCache', e.target.checked)}
                />
                Clear Cache
              </label>
              <label className="d-inline-flex align-items-center gap-1 mb-0">
                <input
                  type="checkbox"
                  name="hideAbinfo"
                  value="1"
                  checked={Boolean(fields.hideAbinfo)}
                  onChange={(e) => set('hideAbinfo', e.target.checked)}
                />
                Hide Attendance Info
              </label>
            </div>
          </div>
        </>
      )}
      {meta.type === 'lpd-report' && (
        <>
          <div className="col-12">
            <label className="form-label">Request</label>
            <div className="d-flex flex-wrap gap-3">
              {[
                ['leave', 'Leave'],
                ['permission', 'Permission'],
                ['defaulter', 'Defaulter'],
              ].map(([value, label]) => (
                <label key={value} className="d-inline-flex align-items-center gap-1 mb-0">
                  <input
                    type="checkbox"
                    name="a_request"
                    value={value}
                    checked={(fields.a_request || []).includes(value)}
                    onChange={(e) => toggleListValue('a_request', value, e.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="col-12">
            <label className="form-label">Status</label>
            <div className="d-flex flex-wrap gap-3">
              {[
                ['p', 'Pending'],
                ['1', 'Approved'],
                ['2', 'Rejected'],
              ].map(([value, label]) => (
                <label key={value} className="d-inline-flex align-items-center gap-1 mb-0">
                  <input
                    type="checkbox"
                    name="a_status"
                    value={value}
                    checked={(fields.a_status_list || []).includes(value)}
                    onChange={(e) => toggleListValue('a_status_list', value, e.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          {lpdDateRow}
        </>
      )}
      {screen === 'holiday-report' && (
        <>
          <div className="col-md-3">
            <label className="form-label">Category</label>
            <select
              name="category"
              className="form-select"
              value={fields.category || ''}
              onChange={(e) => set('category', e.target.value)}
              required
            >
              <option value="">--Select--</option>
              {(data?.categories || []).map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">Letter Date</label>
            <input
              type="date"
              name="letter_date"
              className="form-control"
              value={fields.letter_date || ''}
              onChange={(e) => set('letter_date', e.target.value)}
              required
            />
          </div>
        </>
      )}
      {meta.type === 'student-id-report' && (
        <div className="col-md-3">
          <label className="form-label">Student ID</label>
          <input
            name="student_id"
            className="form-control"
            placeholder="Register number"
            value={fields.student_id || ''}
            onChange={(e) => set('student_id', e.target.value)}
          />
        </div>
      )}
      {meta.type === 'period-att' && (
        <div className="col-md-3"><label className="form-label">Date</label><input type="date" className="form-control" onChange={(e) => set('attendance_date', e.target.value)} /></div>
      )}
      {APPROVAL_SCREENS.has(screen) && (
        <>
          <div className="col-md-3">
            <label className="form-label">{meta.approvalFilter?.label || 'Roll No'}</label>
            <input
              name="a_staff"
              className="form-control"
              placeholder={meta.approvalFilter?.placeholder || 'Roll no (comma-separated)'}
              value={fields.a_staff}
              onChange={(e) => set('a_staff', e.target.value)}
            />
          </div>
          {dateRow}
          <div className="col-md-2">
            <label className="form-label">Status</label>
            <select name="a_status" className="form-select" value={fields.a_status ?? '0'} onChange={(e) => set('a_status', e.target.value)}>
              <option value="0">Pending</option>
              <option value="1">Approved</option>
              <option value="2">Rejected</option>
            </select>
          </div>
        </>
      )}
      {meta.type === 'smr-setup' && (
        <>
          <div className="col-md-2">
            <label className="form-label">Course</label>
            <select
              name="course_type"
              className="form-select"
              value={fields.course_type || 'U.G'}
              onChange={(e) => {
                const courseType = e.target.value;
                setFields((prev) => ({ ...prev, course_type: courseType }));
                onGenerate({ course_type: courseType });
              }}
            >
              <option value="U.G">U.G</option>
              <option value="P.G">P.G</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">OD type (comma-separated)</label>
            <input name="od_type" className="form-control" value={fields.od_type || ''} onChange={(e) => set('od_type', e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label">Leave apply days</label>
            <input name="leave_apply" type="number" min="0" className="form-control" value={fields.leave_apply || ''} onChange={(e) => set('leave_apply', e.target.value)} />
          </div>
          <input type="hidden" name="r_id" value={fields.r_id || ''} />
        </>
      )}
      {meta.type !== 'period-att' && meta.type !== 'incharge-grid' && meta.type !== 'pg-setup' && meta.type !== 'intern-setup' && meta.type !== 'roster' && (
        <div className="col-md-2 d-flex align-items-end">
          <button type="submit" className="btn btn-danger w-100" disabled={busy || pgGenerating || (meta.type === 'pg-att-report' && !(fields.course_name || []).length) || (meta.type === 'student-id-report' && !String(fields.student_id || '').trim())}>
            {SAVE_SCREENS.has(screen) && !['approval', 'date-roll-report', 'date-report', 'pg-att-report', 'lpd-report', 'roll-report', 'student-id-report', 'pg-punch', 'pg-punch-entry'].includes(meta.type) ? 'Save' : 'Generate'}
          </button>
        </div>
      )}
      {meta.type === 'period-att' && (
        <div className="col-md-2 d-flex align-items-end">
          <button type="button" className="btn btn-outline-primary w-100" disabled={busy} onClick={() => onGenerate({ attendance_date: fields.attendance_date })}>Load</button>
        </div>
      )}
    </form>
  );
}

export default function StudentAttScreenPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const screen = resolveStudentAttScreenSlug(location.pathname, searchParams.get('legacy'));
  const meta = screen ? STUDENT_ATT_SCREEN_META[screen] : null;
  const { data, busy, error, notice, clearNotice, load, save } = useStudentAttScreenApi(screen || 'biometric-report');
  const { settings, menu, loading, error: shellError } = useShellData();
  const [ready, setReady] = useState(false);
  const [filterFields, setFilterFields] = useState({ a_status: '0' });
  const [pgReportHtml, setPgReportHtml] = useState('');
  const [pgGenerating, setPgGenerating] = useState(false);
  const [pgProgress, setPgProgress] = useState(null);
  const [pgError, setPgError] = useState(null);

  useEffect(() => {
    if (!meta?.legacy || searchParams.get('legacy')) return;
    setSearchParams({ legacy: meta.legacy }, { replace: true });
  }, [meta, searchParams, setSearchParams]);

  useEffect(() => {
    if (!meta) {
      setReady(true);
      return;
    }
    setReady(false);
    setFilterFields({ a_status: '0' });
    load().then((result) => {
      if (result) setFilterFields({ a_status: result.a_status ?? '0' });
    }).finally(() => setReady(true));
  }, [screen, meta, load]);

  useEffect(() => {
    if (meta?.type !== 'pg-att-report') {
      setPgReportHtml('');
      setPgProgress(null);
      setPgError(null);
    }
  }, [meta?.type, screen]);

  if (!meta) {
    return <div className="p-4"><p className="text-danger">Unknown student attendance screen.</p><Link to="/attendance/students/hub">Back</Link></div>;
  }
  if (loading || !ready) return <div className="p-4 text-muted">Loading...</div>;

  const handleGenerate = (fields) => {
    setFilterFields(fields);
    return load(fields);
  };

  const handlePgBatchGenerate = async (fields) => {
    const courseKeys = fields.course_name || [];
    const fromDate = fields.from_date || '';
    const toDate = fields.to_date || '';
    if (!courseKeys.length) {
      setPgError('Select at least one course');
      return;
    }
    if (!fromDate || !toDate) {
      setPgError('From and To dates are required');
      return;
    }

    setFilterFields(fields);
    setPgGenerating(true);
    setPgError(null);
    setPgReportHtml('');
    setPgProgress(null);

    try {
      const setupRes = await api.post('/api/attendance/students/pg-report/setup', {
        courseKeys,
        course_name: courseKeys,
        academic_year: fields.academic_year || data?.academic_year || '',
        fromDate: toPgDisplayDate(fromDate),
        toDate: toPgDisplayDate(toDate),
        from_date: fromDate,
        to_date: toDate,
        reportType: fields.report_type || 'Monthly',
        report_type: fields.report_type || 'Monthly',
        hideAbinfo: Boolean(fields.hideAbinfo),
        cleariCache: Boolean(fields.cleariCache),
      });
      const setup = setupRes.data;
      if (setup.error) {
        setPgError(setup.error);
        return;
      }

      const total = setup.jobs?.length || 0;
      if (!total) {
        setPgError('No students found for the selected filters');
        return;
      }

      const batchSize = 1;
      let offset = 0;
      let mergedHtml = setup.headerHtml || '';

      setPgProgress({ processed: 0, total, phase: 'preparing' });
      await new Promise((resolve) => requestAnimationFrame(resolve));

      while (offset < total) {
        const genRes = await api.post('/api/attendance/students/pg-report/generate', {
          setup,
          offset,
          limit: batchSize,
          clearCache: offset === 0,
        });
        mergedHtml = mergePgReportRows(mergedHtml, genRes.data.rowsByFlag);
        offset = genRes.data.processed ?? genRes.data.nextOffset ?? offset + batchSize;
        setPgProgress({ processed: offset, total, phase: 'generating' });
        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (!genRes.data.truncated) break;
      }

      setPgReportHtml(mergedHtml);
      setPgProgress({ processed: total, total, phase: 'done' });
    } catch (err) {
      setPgError(err.response?.data?.message || 'Unable to generate PG attendance report');
      setPgReportHtml('');
    } finally {
      setPgGenerating(false);
    }
  };

  const handleSelect = (fields) => {
    setFilterFields(fields);
    load(fields);
  };

  const handleSave = async (fields) => {
    const result = await save(fields);
    if (result) {
      setFilterFields({
        from_date: displayDateToIso(result.from_date) || fields.from_date || '',
        to_date: displayDateToIso(result.to_date) || fields.to_date || '',
        a_status: result.a_status != null ? String(result.a_status) : (fields.a_status ?? '0'),
        a_staff: fields.a_staff || '',
      });
    }
  };

  const activeReportHtml = meta.type === 'pg-att-report'
    ? pgReportHtml
    : (isPgPunchScreenType(meta.type) ? null : data?.reportHtml);
  const printableReportHtml = meta.type === 'pg-att-report' ? pgReportHtml : data?.reportHtml;

  const handlePrintReport = () => {
    if (isPgPunchScreenType(meta.type) && data?.printMeta) {
      printReportHtml(
        buildPgPunchPrintHtml({
          printMeta: data.printMeta,
          bannerUrl: data.bannerUrl,
          tablesHtml: data.reportHtml,
        }),
        'pg-punch-report',
      );
      return;
    }
    printReportHtml(
      printableReportHtml,
      screen === 'holiday-report' ? 'holiday-report' : 'default',
    );
  };

  return (
    <DashboardLayout settings={settings} dashboard={{ title: meta.title }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/attendance">Attendance</Link></li>
          <li className="breadcrumb-item"><Link to="/attendance/students/hub">Student Attendance</Link></li>
          <li className="breadcrumb-item active">{meta.title}</li>
        </ol>
      </nav>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div><h3 className="dashboard-title mb-0">{meta.title}</h3><p className="text-muted small mb-0">Legacy: {meta.legacy}</p></div>
        <div className="d-flex gap-2">
          {printableReportHtml && (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={handlePrintReport}
            >
              Print
            </button>
          )}
          <Link to="/attendance/students/hub" className="btn btn-outline-secondary btn-sm">Back</Link>
        </div>
      </div>
      {shellError && <div className="alert alert-warning">{shellError}</div>}
      {notice && (
        <div className="alert alert-success alert-dismissible fade show">
          {notice}
          <button type="button" className="btn-close" aria-label="Close" onClick={clearNotice} />
        </div>
      )}
      {error && <div className="alert alert-danger">{error}</div>}
      {pgError && <div className="alert alert-danger">{pgError}</div>}
      {pgGenerating && pgProgress && (
        <div className="alert alert-info mb-3">
          <div className="mb-2">
            {pgProgress.phase === 'preparing'
              ? 'Preparing report…'
              : `Generating report… ${pgProgress.processed} / ${pgProgress.total} students`}
          </div>
          {pgProgress.phase === 'generating' && pgProgress.total > 0 && (
            <div className="progress" style={{ height: '8px' }}>
              <div
                className="progress-bar progress-bar-striped progress-bar-animated"
                role="progressbar"
                style={{ width: `${Math.min(100, Math.round((pgProgress.processed / pgProgress.total) * 100))}%` }}
                aria-valuenow={pgProgress.processed}
                aria-valuemin={0}
                aria-valuemax={pgProgress.total}
              />
            </div>
          )}
        </div>
      )}
      {busy && !pgGenerating && !isPgPunchScreenType(meta.type) && <div className="text-muted small mb-2">Loading…</div>}

      {isPgPunchScreenType(meta.type) ? (
        <PgPunchReportForm
          key={screen}
          data={data}
          busy={busy}
          onGenerate={handleGenerate}
          reportHtml={data?.reportHtml}
          isEntry={meta.type === 'pg-punch-entry'}
        />
      ) : (
      <div className="card shadow-sm mb-3"><div className="card-body">
        {meta.type === 'pg-setup' && (
          <PgAttSetupForm data={data} onLoad={handleGenerate} onSave={handleSave} busy={busy} />
        )}
        {meta.type === 'intern-setup' && (
          <InternAttSetupForm data={data} onSave={handleSave} busy={busy} />
        )}
        {meta.type === 'roster' && (
          <HolidayRosterForm screen={screen} data={data} onLoad={handleGenerate} onSave={handleSave} busy={busy} />
        )}
        {meta.type === 'incharge-grid' && (
          <YearInchargeForm data={data} onLoad={handleGenerate} onSave={handleSave} busy={busy} />
        )}
        {meta.type !== 'pg-setup' && meta.type !== 'intern-setup' && meta.type !== 'roster' && meta.type !== 'incharge-grid' && meta.type !== 'period-att' && meta.type !== 'intern-att-statement' && !isPgPunchScreenType(meta.type) && (
          <ScreenFilters
            screen={screen}
            meta={meta}
            data={data}
            filterFields={filterFields}
            busy={busy}
            pgGenerating={pgGenerating}
            onGenerate={handleGenerate}
            onSave={handleSave}
            onPgBatchGenerate={meta.type === 'pg-att-report' ? handlePgBatchGenerate : undefined}
          />
        )}
        {meta.type === 'period-att' && (
          <PeriodAttForm data={data} onLoad={handleGenerate} onSave={handleSave} busy={busy} />
        )}
        {meta.type === 'intern-att-statement' && (
          <InternAttStatementForm data={data} onLoad={handleGenerate} busy={busy} />
        )}
        {APPROVAL_SCREENS.has(screen) && (
          <StudentApprovalList
            data={data}
            filterFields={filterFields}
            busy={busy}
            onSelect={handleSelect}
            onSave={handleSave}
          />
        )}
      </div></div>
      )}

      {activeReportHtml && (
        <div className="card shadow-sm"><div className="card-body report-html" dangerouslySetInnerHTML={{ __html: activeReportHtml }} /></div>
      )}
    </DashboardLayout>
  );
}
