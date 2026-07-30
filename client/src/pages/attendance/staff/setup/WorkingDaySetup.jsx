import { useEffect, useState } from 'react';
import PopoverMultiSelect from '../../../../components/PopoverMultiSelect';

function toRowState(day) {
  return {
    id: day.id || '',
    academic_date: day.academic_date,
    academic_events: day.academic_events || 'Working',
    academic_category: (day.academic_category || []).map(String),
    comments: day.comments || '',
  };
}

/** Matches staff_academic_calendar.php: a month picker drives a full-month
 * grid (Date / Event / Category / Comment), one row per calendar day, with
 * a day defaulting to "Working" until the user marks it a holiday. Saving
 * writes every row — including untouched "Working" days — same as legacy. */
export default function WorkingDaySetup({ data, busy, onLoad, onSave }) {
  const [month, setMonth] = useState(data?.calendar_month || new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (data?.calendar_month) setMonth(data.calendar_month);
    setRows((data?.days || []).map(toRowState));
  }, [data]);

  const updateRow = (date, patch) => setRows((prev) => prev.map((r) => (r.academic_date === date ? { ...r, ...patch } : r)));

  const handleMonthChange = (value) => {
    setMonth(value);
    onLoad({ calendar_month: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ calendar_month: month, days: rows, Submit: 'Update' });
  };

  const eventOptions = data?.eventTypes || [];
  const categoryOptions = (data?.categories || []).map((c) => ({ value: String(c.id), label: c.name }));

  return (
    <form onSubmit={handleSubmit}>
      <div className="row g-3 mb-3">
        <div className="col-md-3">
          <label className="form-label">Month</label>
          <input
            type="month"
            className="form-control"
            value={month}
            onChange={(e) => handleMonthChange(e.target.value)}
          />
        </div>
      </div>

      <div className="table-responsive" style={{ maxHeight: '65vh' }}>
        <table className="table table-sm table-bordered align-middle mb-0">
          <thead className="table-light sticky-top">
            <tr>
              <th style={{ minWidth: 150 }}>Date</th>
              <th style={{ minWidth: 150 }}>Event</th>
              <th style={{ minWidth: 220 }}>Category</th>
              <th style={{ minWidth: 200 }}>Comment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const d = new Date(`${row.academic_date}T00:00:00`);
              const label = Number.isNaN(d.getTime())
                ? row.academic_date
                : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'short' });
              const isHoliday = row.academic_events.toLowerCase().startsWith('holiday');
              return (
                <tr key={row.academic_date} className={isHoliday ? 'table-warning' : undefined}>
                  <td className="text-nowrap">{label}</td>
                  <td>
                    <select
                      className="form-select form-select-sm"
                      value={row.academic_events}
                      onChange={(e) => updateRow(row.academic_date, { academic_events: e.target.value })}
                    >
                      {!eventOptions.some((ev) => ev.name === row.academic_events) && (
                        <option value={row.academic_events}>{row.academic_events}</option>
                      )}
                      {eventOptions.map((ev) => <option key={ev.id} value={ev.name}>{ev.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <PopoverMultiSelect
                      options={categoryOptions}
                      value={row.academic_category}
                      onChange={(next) => updateRow(row.academic_date, { academic_category: next })}
                      placeholder="All categories"
                      emptySelectionText="Applies to all categories"
                    />
                  </td>
                  <td>
                    <input
                      className="form-control form-control-sm"
                      maxLength={155}
                      value={row.comments}
                      onChange={(e) => updateRow(row.academic_date, { comments: e.target.value })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="submit" className="btn btn-danger mt-3" disabled={busy}>Save Month</button>
    </form>
  );
}
