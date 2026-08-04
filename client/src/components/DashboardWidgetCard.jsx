import { useEffect, useMemo, useState } from 'react';
import { getWidgetSlotClassName } from '../utils/dashboardWidgetLayout';
import DeptStaffingChart from './DeptStaffingChart';

const CHART_COMPONENTS = {
  'dept-staffing': DeptStaffingChart,
};

const WIDGET_META = {
  staff_details: { icon: 'fa fa-users', tone: 'crimson', kind: 'Staff' },
  staff_unit: { icon: 'fa fa-sitemap', tone: 'crimson', kind: 'Faculty' },
  staff_unit_1: { icon: 'fa fa-users', tone: 'crimson', kind: 'Faculty' },
  staff_unit_2: { icon: 'fa fa-users', tone: 'crimson', kind: 'Faculty' },
  staff_attendance: { icon: 'fa fa-calendar-check-o', tone: 'gold', kind: 'Attendance' },
  staff_attendance_incampus: { icon: 'fa fa-building', tone: 'gold', kind: 'Attendance' },
  staff_leave_absent: { icon: 'fa fa-user-times', tone: 'gold', kind: 'Attendance' },
  staff_current: { icon: 'fa fa-clock-o', tone: 'gold', kind: 'Live' },
  staff_permission: { icon: 'fa fa-key', tone: 'crimson', kind: 'Access' },
  student_details: { icon: 'fa fa-graduation-cap', tone: 'ink', kind: 'Students' },
  ug_attendance: { icon: 'fa fa-calendar', tone: 'ink', kind: 'U.G' },
  ug_attendance_add: { icon: 'fa fa-calendar-plus-o', tone: 'ink', kind: 'U.G' },
  pg_attendance: { icon: 'fa fa-calendar', tone: 'ink', kind: 'P.G' },
  pg_attendance_dept: { icon: 'fa fa-calendar', tone: 'ink', kind: 'P.G' },
  pg_leave_absent: { icon: 'fa fa-user-times', tone: 'ink', kind: 'P.G' },
  pg_permission: { icon: 'fa fa-key', tone: 'ink', kind: 'P.G' },
  internship_attendance: { icon: 'fa fa-stethoscope', tone: 'ink', kind: 'Internship' },
  student_hostel: { icon: 'fa fa-bed', tone: 'gold', kind: 'Hostel' },
  gents_hostel_attendance: { icon: 'fa fa-bed', tone: 'gold', kind: 'Hostel' },
  ladies_hostel_attendance: { icon: 'fa fa-bed', tone: 'gold', kind: 'Hostel' },
  student_scholarship: { icon: 'fa fa-inr', tone: 'gold', kind: 'Fees' },
  feedback_analysis: { icon: 'fa fa-comments', tone: 'crimson', kind: 'Feedback' },
};

function metaFor(id) {
  return WIDGET_META[id] || { icon: 'fa fa-th-large', tone: 'crimson', kind: 'Panel' };
}

// These widgets are read at a glance (Faculty Structure norms/vacancy table) rather than
// previewed-then-opened, so they always render in full and skip the collapse toggle.
const ALWAYS_EXPANDED_WIDGET_IDS = new Set(['staff_unit']);

/** Pull a useful headline number from legacy widget HTML when present. */
function extractBadge(html) {
  if (typeof html !== 'string' || !html) return null;

  const rev = html.match(/rev-combo[^>]*>\s*([\d,]+)/i);
  if (rev?.[1]) return { value: rev[1], label: 'Total' };

  const degrees = [...html.matchAll(/class="degree[^"]*"[^>]*>\s*([\d,]+)/gi)]
    .map((m) => m[1])
    .filter(Boolean);
  if (degrees.length >= 2) {
    return { value: `${degrees[0]} / ${degrees[1]}`, label: 'In · Out' };
  }
  if (degrees.length === 1) {
    return { value: degrees[0], label: 'Count' };
  }

  const ofMatch = html.match(/of\s+(\d+)\s*\|\s*(\d+)/i);
  if (ofMatch) {
    return { value: ofMatch[1], label: `Working · ${ofMatch[2]} leave` };
  }

  return null;
}

function rowCount(html) {
  if (typeof html !== 'string' || !html) return 0;
  const rows = html.match(/<tr[\s>]/gi);
  return rows ? Math.max(0, rows.length - 1) : 0;
}

/**
 * Modern card shell around legacy widget HTML (data unchanged, chrome modernized).
 */
export default function DashboardWidgetCard({
  widget,
  html,
  chart,
  loading = false,
  expandAllTick = 0,
  collapseAllTick = 0,
}) {
  // Guards against a stale cache entry or a widget generator returning the
  // wrong shape — never let a bad payload crash the whole dashboard.
  const safeHtml = typeof html === 'string' ? html : '';
  const slotClass = getWidgetSlotClassName(widget.id);
  const meta = metaFor(widget.id);
  const badge = useMemo(() => extractBadge(safeHtml), [safeHtml]);
  const rows = useMemo(() => rowCount(safeHtml), [safeHtml]);
  const status = loading ? 'Updating…' : safeHtml ? (rows > 0 ? `${rows} rows` : 'Ready') : 'No data';
  const ChartComponent = chart && CHART_COMPONENTS[chart.type];
  const alwaysExpanded = ALWAYS_EXPANDED_WIDGET_IDS.has(widget.id);

  // Every panel starts collapsed to a short preview so the dashboard reads as a
  // uniform grid of compact cards; "Show full panel" (or "Show detailed table"
  // for chart widgets) opens the full legacy table on demand. A few widgets
  // (see ALWAYS_EXPANDED_WIDGET_IDS) are exceptions and never collapse.
  const [collapsed, setCollapsed] = useState(!alwaysExpanded);

  useEffect(() => {
    if (alwaysExpanded) return;
    if (expandAllTick > 0) setCollapsed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandAllTick]);

  useEffect(() => {
    if (alwaysExpanded) return;
    if (collapseAllTick > 0) setCollapsed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapseAllTick]);

  // Wide/dense widgets only need the full row when actually open; collapsed,
  // they sit in the grid like any other card so panels can run side by side.
  const spansFullWidth = safeHtml && !collapsed;

  return (
    <article className={`${slotClass} cis-widget cis-widget--${meta.tone}${loading ? ' is-loading' : ''}${safeHtml ? '' : ' is-empty'}${spansFullWidth ? ' cis-widget--full' : ''}`}>
      <header className="cis-widget-head">
        <span className="cis-widget-icon" aria-hidden="true">
          <i className={meta.icon} />
        </span>
        <div className="cis-widget-head-copy">
          <div className="cis-widget-kicker">{meta.kind}</div>
          <h3 className="cis-widget-title">{widget.label}</h3>
          <p className="cis-widget-meta">{status}</p>
        </div>
        {badge && (
          <div className="cis-widget-badge" title={badge.label}>
            <span className="cis-widget-badge-value">{badge.value}</span>
            <span className="cis-widget-badge-label">{badge.label}</span>
          </div>
        )}
        {safeHtml && !alwaysExpanded && (
          <button
            type="button"
            className="cis-widget-toggle"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((prev) => !prev)}
          >
            <i className={`fa fa-chevron-${collapsed ? 'down' : 'up'}`} aria-hidden="true" />
            <span className="visually-hidden">{collapsed ? 'Expand panel' : 'Collapse panel'}</span>
          </button>
        )}
      </header>

      {ChartComponent && <ChartComponent rows={chart.rows} />}

      {safeHtml ? (
        <div className="cis-widget-collapse mt-3">
          {/* Chart widgets hide their (possibly huge) table until asked for; every
              other widget shows the full — but shrunk & scrollable — table so it can
              be read in place without expanding. */}
          {!(collapsed && ChartComponent) && (
            <div
              className={`cis-widget-body legacy-widget-root legacy-widget-root--${widget.id}${collapsed ? ' is-scroll' : ''}`}
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          )}
          {collapsed && ChartComponent && (
            <button type="button" className="cis-widget-more" onClick={() => setCollapsed(false)}>
              Show detailed table
            </button>
          )}
        </div>
      ) : (
        <div className="cis-widget-body cis-widget-body--empty">
          {loading ? (
            <div className="cis-widget-skeleton-stack" aria-hidden="true">
              <div className="cis-widget-skeleton" />
              <div className="cis-widget-skeleton cis-widget-skeleton--short" />
              <div className="cis-widget-skeleton cis-widget-skeleton--mid" />
            </div>
          ) : (
            <div className="cis-widget-empty">
              <i className="fa fa-inbox" aria-hidden="true" />
              <p className="cis-widget-empty-copy">Nothing to show for the selected date.</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
