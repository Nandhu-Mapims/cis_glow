import { useEffect, useState } from 'react';
import SetupAlerts from '../../fees/setup/SetupAlerts';
import { useAcademicSetupApi } from './useAcademicSetupApi';
import { printReportHtml } from '../../../utils/printReport';

export default function AcademicCalendarSetup() {
  const { data, busy, error, notice, clearNotice, load, save } = useAcademicSetupApi('academic-calendar');
  const [calendarMonth, setCalendarMonth] = useState('');
  const [rows, setRows] = useState([]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data?.calendarMonth) setCalendarMonth(data.calendarMonth);
    if (data?.rows) setRows(data.rows);
  }, [data]);

  const onMonthChange = async (value) => {
    setCalendarMonth(value);
    await load({ calendarMonth: value });
  };

  const updateRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const toggleCourseType = (index, value) => {
    setRows((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      const set = new Set(row.courseTypes || []);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...row, courseTypes: Array.from(set) };
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await save({
      calendarMonth,
      rows: rows.map((row) => ({
        id: row.id,
        date: row.date,
        event: row.event,
        courseTypes: row.courseTypes,
        comment: row.comment,
      })),
    });
  };

  const monthOptions = data?.monthOptions || [];
  const groupedMonths = monthOptions.reduce((acc, opt) => {
    if (!acc[opt.year]) acc[opt.year] = [];
    acc[opt.year].push(opt);
    return acc;
  }, {});

  return (
    <>
      <SetupAlerts notice={notice} error={error} busy={busy} onDismissNotice={clearNotice} />
      <div className="row g-3">
        <div className="col-md-3">
          <label className="form-label">Month</label>
          <select className="form-select" value={calendarMonth} onChange={(e) => onMonthChange(e.target.value)}>
            <option value="">--Select Month--</option>
            {Object.entries(groupedMonths).map(([year, opts]) => (
              <optgroup key={year} label={year}>
                {opts.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="col-md-9">
          {data?.monthLabel ? (
            <div className="d-flex justify-content-between align-items-center mt-4">
              <h5 className="mb-0">{data.monthLabel}</h5>
              <button type="button" className="btn btn-outline-secondary" disabled={!data?.printHtml} onClick={() => printReportHtml(data.printHtml, 'academic-calendar')}>Print</button>
            </div>
          ) : null}
          {rows.length ? (
            <form onSubmit={handleSave} className="mt-3">
              <div className="table-responsive">
                <table className="table table-bordered align-middle">
                  <thead className="table-secondary">
                    <tr>
                      <th>Date</th>
                      <th>Event</th>
                      <th>Course</th>
                      <th>Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.date}>
                        <td>{row.dateLabel}</td>
                        <td>
                          <select className="form-select" value={row.event} onChange={(e) => updateRow(index, { event: e.target.value })}>
                            <option value="">--Events--</option>
                            {(data?.eventOptions || []).map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-2">
                            {(data?.courseTypeOptions || []).map((opt) => (
                              <label key={opt.value} className="me-2">
                                <input
                                  type="checkbox"
                                  checked={(row.courseTypes || []).includes(opt.value)}
                                  onChange={() => toggleCourseType(index, opt.value)}
                                />
                                {' '}
                                {opt.label}
                              </label>
                            ))}
                          </div>
                        </td>
                        <td>
                          <input className="form-control" value={row.comment} onChange={(e) => updateRow(index, { comment: e.target.value })} maxLength={155} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="submit" className="btn btn-danger" disabled={busy}>Save</button>
            </form>
          ) : null}
        </div>
      </div>
    </>
  );
}
