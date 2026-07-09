import { useEffect, useMemo, useState } from 'react';
import ReportPrintBar from '../../../components/ReportPrintBar';
import { buildSubjectSchedulePrintHtml } from '../../../utils/subjectSchedulePrint';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useAcademicSetupApi } from './useAcademicSetupApi';

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function SubjectScheduleSetup() {
  const { data, busy, error, notice, load, save } = useAcademicSetupApi('subject-schedule');
  const [courseYearKey, setCourseYearKey] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [rows, setRows] = useState([]);

  const courseOptionsByGroup = useMemo(() => {
    const grouped = {};
    for (const opt of data?.courseYearOptions || []) {
      if (!grouped[opt.group]) grouped[opt.group] = [];
      grouped[opt.group].push(opt);
    }
    return grouped;
  }, [data?.courseYearOptions]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (data?.courseYearKey) setCourseYearKey(data.courseYearKey);
    if (data?.subjectId) setSubjectId(data.subjectId);
    if (data?.month) setMonth(data.month);
    if (data?.scheduleRows) setRows(data.scheduleRows);
  }, [data]);

  const reload = (patch = {}) => load({
    course_name: patch.courseYearKey ?? courseYearKey,
    subject_id: patch.subjectId ?? subjectId,
    month: patch.month ?? month,
    alignMonth: patch.alignMonth,
  });

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const printHtml = useMemo(() => {
    if (!data?.printMeta || !data?.scope) return '';
    return buildSubjectSchedulePrintHtml({
      title: data.printMeta.title,
      subtitle: data.printMeta.subtitle,
      subjectLabel: data.printMeta.subjectLabel,
      monthLabel: formatMonthLabel(month),
      bannerUrl: data.bannerUrl,
      rows,
      staffOptions: data.staffOptions || [],
      topicOptions: data.topicOptions || [],
    });
  }, [data?.printMeta, data?.scope, data?.bannerUrl, data?.staffOptions, data?.topicOptions, rows, month]);

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} />
      <div className="mb-3 row g-2">
        <label className="col-sm-2 col-form-label">Course &amp; Academic year</label>
        <div className="col-sm-5">
          <select
            className="form-select"
            value={courseYearKey}
            disabled={busy}
            onChange={async (e) => {
              const value = e.target.value;
              setCourseYearKey(value);
              setSubjectId('');
              await reload({ courseYearKey: value, subjectId: '' });
            }}
          >
            <option value="">--Select Course--</option>
            {Object.entries(courseOptionsByGroup).map(([group, options]) => (
              <optgroup key={group} label={group}>
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {data?.selection ? (
        <div className="mb-3 row g-2">
          <label className="col-sm-2 col-form-label">Subject</label>
          <div className="col-sm-6">
            <select
              className="form-select"
              value={subjectId}
              disabled={busy}
              onChange={async (e) => {
                setSubjectId(e.target.value);
                await reload({ subjectId: e.target.value });
              }}
            >
              <option value="">--Select Subject--</option>
              {(data?.subjectOptions || []).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {data?.scope ? (
        <>
          <div className="d-flex align-items-center gap-2 mb-3">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={async () => {
              const prev = shiftMonth(month, -1);
              setMonth(prev);
              await reload({ month: prev, alignMonth: false });
            }}>Prev</button>
            <span className="fw-semibold">{formatMonthLabel(month)}</span>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={async () => {
              const next = shiftMonth(month, 1);
              setMonth(next);
              await reload({ month: next, alignMonth: false });
            }}>Next</button>
            <div className="ms-auto">
              <ReportPrintBar html={printHtml} label="Print" printMode="academic-subject-schedule" />
            </div>
          </div>

          {data?.monthAligned ? (
            <div className="alert alert-info py-2 small">
              Showing {formatMonthLabel(month)} — the first month with timetable templates for this subject.
              {data?.templateDateRange?.from && data?.templateDateRange?.to ? (
                <> Template period: {data.templateDateRange.from} to {data.templateDateRange.to}.</>
              ) : null}
            </div>
          ) : null}

          {!rows.length && data?.templateDateRange ? (
            <div className="alert alert-warning py-2 small">
              No periods in {formatMonthLabel(month)}.
              Template data runs from {data.templateDateRange.from} to {data.templateDateRange.to || 'open'}.
              Use Prev/Next to find a month with scheduled periods.
            </div>
          ) : null}

          <form onSubmit={async (e) => {
            e.preventDefault();
            await save({
              scope: data.scope,
              courseYearKey,
              month,
              rows,
            });
          }}>
            <div className="table-responsive">
              <table className="table table-bordered align-middle">
                <thead className="table-secondary">
                  <tr><th>Date</th><th>Day</th><th>Period</th><th>Batch</th><th>Staff</th><th>Topic</th></tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.dateIso}-${row.period}-${row.batch}`}>
                      <td>{row.date}</td>
                      <td>{row.day}</td>
                      <td>{row.period}</td>
                      <td>{row.batch}</td>
                      <td>
                        <select className="form-select form-select-sm" value={row.staffId} onChange={(e) => updateRow(index, { staffId: e.target.value })}>
                          <option value="">--</option>
                          {(data?.staffOptions || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="form-select form-select-sm" value={row.topicId} onChange={(e) => updateRow(index, { topicId: e.target.value })}>
                          <option value="">--</option>
                          {(data?.topicOptions || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-end">
              <button type="submit" className="btn btn-danger" disabled={busy || !rows.length}>Save</button>
            </div>
          </form>
        </>
      ) : null}
    </>
  );
}
