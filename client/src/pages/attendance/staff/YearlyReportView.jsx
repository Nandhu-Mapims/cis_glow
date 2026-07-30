const WEEKDAY_COLS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function monthKey(dateIso) {
  return dateIso.slice(0, 7);
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function groupByMonth(days) {
  const map = new Map();
  days.forEach((d) => {
    const key = monthKey(d.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(d);
  });
  return [...map.entries()];
}

/** Tone for a day cell, derived from the raw per-session flags (not the
 * merged legacy display string, which can be any two-letter combination) —
 * absence takes priority over leave/late/permission/present/holiday so a
 * half-day absence still reads as attention-worthy. */
function dayTone(day) {
  const flags = [day.mFlag, day.eFlag];
  if (flags.includes('a')) return 'absent';
  if (flags.includes('le')) return 'leave';
  if (flags.includes('la')) return 'late';
  if (flags.includes('pe')) return 'permission';
  if (day.isHoliday) return 'holiday';
  if (flags.includes('p')) return 'present';
  return 'blank';
}

function CalendarMonth({ monthKeyValue, days }) {
  const first = days[0];
  const firstDow = new Date(`${first.date}T00:00:00`).getDay(); // 0=Sun
  const leadingBlanks = firstDow === 0 ? 6 : firstDow - 1; // Monday-first grid
  const cells = [...Array(leadingBlanks).fill(null), ...days];
  return (
    <div className="yr-cal-month">
      <div className="yr-cal-month-title">{monthLabel(monthKeyValue)}</div>
      <div className="yr-cal-grid">
        {WEEKDAY_COLS.map((w) => <div key={w} className="yr-cal-dow">{w}</div>)}
        {cells.map((d, i) => (
          d ? (
            <div key={d.date} className={`yr-cal-cell yr-tone-${dayTone(d)}`} title={`${d.display}${d.detail ? ` — ${d.detail}` : ''}`}>
              <span className="yr-cal-daynum">{Number(d.date.slice(8, 10))}</span>
              <span className="yr-cal-status">{d.status}</span>
            </div>
          ) : <div key={`blank-${i}`} className="yr-cal-cell yr-cal-cell-empty" />
        ))}
      </div>
    </div>
  );
}

function WeeklyBarChart({ weekly }) {
  const series = [
    { key: 'present', label: 'Present', color: '#059669' },
    { key: 'leave', label: 'Leave', color: '#d97706' },
    { key: 'permission', label: 'Permission', color: '#1d5fb8' },
    { key: 'late', label: 'Late', color: '#7c3aed' },
  ];
  const max = Math.max(1, ...series.map((s) => weekly[s.key]?.total || 0));
  const width = 360;
  const height = 160;
  const barW = 56;
  const gap = 28;
  const padBottom = 26;
  const padTop = 12;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="yr-bar-chart" role="img" aria-label="Weekly attendance totals">
      {series.map((s, i) => {
        const val = weekly[s.key]?.total || 0;
        const barH = (val / max) * (height - padTop - padBottom);
        const x = gap / 2 + i * (barW + gap);
        const y = height - padBottom - barH;
        return (
          <g key={s.key}>
            <rect x={x} y={y} width={barW} height={Math.max(barH, val > 0 ? 2 : 0)} rx="4" fill={s.color} />
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="yr-bar-value">{val}</text>
            <text x={x + barW / 2} y={height - 8} textAnchor="middle" className="yr-bar-label">{s.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function YearlyReportView({ data }) {
  if (!data?.days?.length) return null;
  const { staff, summary, weekly, leaveStreaks, approvals } = data;
  const months = groupByMonth(data.days);

  return (
    <div className="yr-report">
      <div className="card shadow-sm mb-3"><div className="card-body">
        <div className="yr-header">
          <div>
            <h4 className="mb-1">{staff?.name || data.staff_id}</h4>
            <div className="text-muted small">
              {staff?.staffId}{staff?.designation ? ` | ${staff.designation}` : ''}{staff?.department ? ` | ${staff.department} Department` : ''}
            </div>
            <div className="text-muted small mt-1">Attendance Report: {data.from_date} to {data.to_date}</div>
          </div>
        </div>

        <div className="yr-summary-cards">
          <div className="yr-summary-card"><div className="yr-summary-value">{summary.totalDays}</div><div className="yr-summary-label">Total no. of Days</div></div>
          <div className="yr-summary-card"><div className="yr-summary-value">{summary.workingDays}</div><div className="yr-summary-label">No. of Working Days</div></div>
          <div className="yr-summary-card"><div className="yr-summary-value">{summary.present}</div><div className="yr-summary-label">Present</div></div>
        </div>
      </div></div>

      <div className="row g-3 mb-3">
        <div className="col-lg-6">
          <div className="card shadow-sm h-100"><div className="card-body">
            <h6 className="mb-2">Weekly Breakdown</h6>
            <div className="table-responsive">
              <table className="table table-sm table-bordered mb-0 yr-weekly-table">
                <thead className="table-light">
                  <tr><th></th><th>Tot</th>{WEEKDAY_COLS.map((w) => <th key={w}>{w}</th>)}</tr>
                </thead>
                <tbody>
                  {[['W.Days', 'working'], ['Present', 'present'], ['Leave', 'leave'], ['Permission', 'permission'], ['Late', 'late']].map(([label, key]) => (
                    <tr key={key}>
                      <td>{label}</td>
                      <td><strong>{weekly[key].total}</strong></td>
                      {weekly[key].byDay.map((v, i) => <td key={i}>{v || 0}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div></div>
        </div>
        <div className="col-lg-3">
          <div className="card shadow-sm h-100"><div className="card-body">
            <h6 className="mb-2">Totals</h6>
            <WeeklyBarChart weekly={weekly} />
          </div></div>
        </div>
        <div className="col-lg-3">
          <div className="card shadow-sm h-100"><div className="card-body">
            <h6 className="mb-2">Consecutive Leave</h6>
            <table className="table table-sm table-bordered mb-3">
              <tbody>
                <tr><td>0.5 Day</td><td className="text-end">{leaveStreaks['0.5']}</td></tr>
                <tr><td>1 Day</td><td className="text-end">{leaveStreaks['1']}</td></tr>
                <tr><td>1.5 Days</td><td className="text-end">{leaveStreaks['1.5']}</td></tr>
                <tr><td>2 Days</td><td className="text-end">{leaveStreaks['2']}</td></tr>
                <tr><td>&gt; 2 Days</td><td className="text-end">{leaveStreaks['>2']}</td></tr>
              </tbody>
            </table>
            <h6 className="mb-2">Approvals</h6>
            <table className="table table-sm table-bordered mb-0">
              <tbody>
                <tr><td>OD</td><td className="text-end">{approvals.od}</td></tr>
                <tr><td>Defaulter</td><td className="text-end">{approvals.defaulter}</td></tr>
                <tr><td>Pre Approval L/Pe</td><td className="text-end">{approvals.preApprovalLeave}/{approvals.preApprovalPermission}</td></tr>
                <tr><td>Post Approval L/Pe</td><td className="text-end">{approvals.postApprovalDefaulter}/{approvals.postApprovalPermission}</td></tr>
              </tbody>
            </table>
          </div></div>
        </div>
      </div>

      <div className="card shadow-sm"><div className="card-body">
        <h6 className="mb-3">Day-by-Day</h6>
        <div className="yr-cal-scroll">
          {months.map(([key, days]) => <CalendarMonth key={key} monthKeyValue={key} days={days} />)}
        </div>
        <p className="yr-legend">
          <span className="yr-legend-item"><span className="yr-legend-dot yr-tone-present" /> Present</span>
          <span className="yr-legend-item"><span className="yr-legend-dot yr-tone-absent" /> Absent</span>
          <span className="yr-legend-item"><span className="yr-legend-dot yr-tone-leave" /> Leave</span>
          <span className="yr-legend-item"><span className="yr-legend-dot yr-tone-permission" /> Permission</span>
          <span className="yr-legend-item"><span className="yr-legend-dot yr-tone-late" /> Late</span>
          <span className="yr-legend-item"><span className="yr-legend-dot yr-tone-holiday" /> Holiday</span>
        </p>
      </div></div>
    </div>
  );
}
