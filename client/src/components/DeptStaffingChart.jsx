/**
 * Bar = available faculty, marker = sanctioned norm, red = short of norms.
 * Plain HTML/CSS bars (no chart lib) — see dashboard.css `.cis-chart-*`.
 */
export default function DeptStaffingChart({ rows }) {
  if (!rows || rows.length === 0) return null;

  const maxValue = Math.max(1, ...rows.flatMap((row) => [row.sanctioned, row.available]));

  return (
    <div className="cis-chart-staffing">
      <p className="cis-chart-caption">
        Bar is available faculty, the marker is the sanctioned norm. Red means short of norms.
      </p>
      <div className="cis-chart-rows">
        {rows.map((row) => {
          const short = row.vacant > 0;
          const barPct = Math.min(100, (row.available / maxValue) * 100);
          const targetPct = Math.min(100, (row.sanctioned / maxValue) * 100);
          const deltaLabel = short
            ? `−${row.vacant} short`
            : row.surplus > 0
              ? `+${row.surplus}`
              : 'On target';

          return (
            <div className="cis-chart-row" key={row.department}>
              <span className="cis-chart-row-label" title={row.department}>{row.department}</span>
              <span className={`cis-chart-track${short ? ' is-short' : ''}`}>
                <span
                  className="cis-chart-bar"
                  style={{ width: `${barPct}%` }}
                  title={`${row.available} available of ${row.sanctioned} sanctioned`}
                />
                <span className="cis-chart-target" style={{ left: `${targetPct}%` }} aria-hidden="true" />
              </span>
              <span className={`cis-chart-delta${short ? ' is-short' : row.surplus > 0 ? ' is-surplus' : ''}`}>
                {deltaLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
