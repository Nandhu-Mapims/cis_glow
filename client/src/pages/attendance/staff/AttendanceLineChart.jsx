/** Pure-SVG line chart for the staff attendance chart screens
 * (att-chart / att-chart-modified / att-chart-combined) — the legacy pages
 * (staff_att_chart.php et al.) render an actual per-day line chart split
 * into "Week 1..5" bands with a smoothed trend line, not a data table. No
 * charting library is in this app's dependencies, so this draws the SVG by
 * hand rather than pulling one in for a single screen. */

function weekBands(rows) {
  const bands = [];
  rows.forEach((row, idx) => {
    const week = Math.ceil(Number(row.day) / 7) || 1;
    const last = bands[bands.length - 1];
    if (last && last.week === week) last.endIdx = idx;
    else bands.push({ week, startIdx: idx, endIdx: idx });
  });
  return bands;
}

function movingAverage(values, window = 5) {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

export default function AttendanceLineChart({ rows, metricKey, label, color = '#a61a1a' }) {
  if (!rows?.length) return null;

  const values = rows.map((r) => Number(r[metricKey]) || 0);
  const total = values.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...values);
  const trend = movingAverage(values);
  const bands = weekBands(rows);

  const width = Math.max(560, rows.length * 34);
  const height = 220;
  const padTop = 22;
  const padBottom = 26;
  const padLeft = 34;
  const padRight = 12;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const xFor = (i) => padLeft + (rows.length === 1 ? plotW / 2 : (i / (rows.length - 1)) * plotW);
  const yFor = (v) => padTop + plotH - (v / max) * plotH;

  const linePath = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`).join(' ');
  const trendPath = trend.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`).join(' ');
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  return (
    <div className="att-chart-block">
      <h5 className="att-chart-title">{label}</h5>
      <div className="att-chart-scroll">
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="att-chart-svg" role="img" aria-label={`${label} chart`}>
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={padLeft} x2={width - padRight} y1={yFor(t)} y2={yFor(t)} className="att-chart-gridline" />
              <text x={padLeft - 6} y={yFor(t) + 4} textAnchor="end" className="att-chart-axis-label">{t}</text>
            </g>
          ))}
          {bands.map((band, i) => (
            <g key={band.week}>
              {i > 0 && (
                <line
                  x1={(xFor(band.startIdx) + xFor(band.startIdx - 1)) / 2}
                  x2={(xFor(band.startIdx) + xFor(band.startIdx - 1)) / 2}
                  y1={padTop}
                  y2={height - padBottom}
                  className="att-chart-weekline"
                />
              )}
              <text x={(xFor(band.startIdx) + xFor(band.endIdx)) / 2} y={padTop - 8} textAnchor="middle" className="att-chart-week-label">
                Week {band.week}
              </text>
            </g>
          ))}
          <path d={trendPath} className="att-chart-trend" fill="none" />
          <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" />
          {values.map((v, i) => (
            <circle key={rows[i].date} cx={xFor(i)} cy={yFor(v)} r="3" fill={color} />
          ))}
          {rows.map((r, i) => (
            <text key={r.date} x={xFor(i)} y={height - padBottom + 16} textAnchor="middle" className="att-chart-axis-label">
              {r.day}
            </text>
          ))}
        </svg>
      </div>
      <p className="att-chart-total">Total {label}: <strong>{total}</strong></p>
    </div>
  );
}
