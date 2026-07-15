import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import DashboardWidgetCard from '../components/DashboardWidgetCard';
import { PageLoading } from '../components/PageShell';
import DashboardLayout from '../layouts/DashboardLayout';

// v2: widget payloads can now carry a separate `chart` field alongside `html`
// (see widgetDispatcher.js) — bumped so a v1 cache with the old shape isn't replayed.
const DASHBOARD_CACHE_KEY = 'cis_dashboard_cache_v2';
const DASHBOARD_CACHE_TTL_MS = 90_000;
const DATE_DEBOUNCE_MS = 400;

const MODULE_JUMPS = [
  { to: '/students', label: 'Students', icon: 'fa fa-graduation-cap' },
  { to: '/staff/hub', label: 'Staff', icon: 'fa fa-users' },
  { to: '/attendance', label: 'Attendance', icon: 'fa fa-calendar-check-o' },
  { to: '/fees', label: 'Fees', icon: 'fa fa-inr' },
  { to: '/academic', label: 'Academic', icon: 'fa fa-book' },
  { to: '/exam', label: 'Exam', icon: 'fa fa-pencil-square-o' },
  { to: '/payroll', label: 'Payroll', icon: 'fa fa-money' },
  { to: '/reports', label: 'Reports', icon: 'fa fa-bar-chart' },
];

function readDashboardCache() {
  try {
    const raw = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.dashboard) return null;
    return { ...parsed, stale: Date.now() - parsed.at > DASHBOARD_CACHE_TTL_MS };
  } catch {
    return null;
  }
}

function writeDashboardCache(data) {
  try {
    sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({ at: Date.now(), ...data }));
  } catch {
    // ignore quota errors
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(iso) {
  if (!iso) return '—';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatStampParts(iso) {
  const d = new Date(`${iso || todayIso()}T12:00:00`);
  return {
    day: d.toLocaleDateString('en-IN', { day: '2-digit' }),
    month: d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase(),
    year: d.toLocaleDateString('en-IN', { year: 'numeric' }),
    weekday: d.toLocaleDateString('en-IN', { weekday: 'long' }),
  };
}

function greetingForHour(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  const { settings, menu } = useOutletContext();
  const cached = readDashboardCache();
  const [dashboard, setDashboard] = useState(cached?.dashboard ?? null);
  const [loading, setLoading] = useState(!cached);
  const [loadError, setLoadError] = useState(null);
  const [attendanceDate, setAttendanceDate] = useState(cached?.attendanceDate ?? todayIso());
  const [widgetHtml, setWidgetHtml] = useState(cached?.widgetHtml ?? {});
  const [widgetCharts, setWidgetCharts] = useState(cached?.widgetCharts ?? {});
  const [widgetLoading, setWidgetLoading] = useState(false);
  const [widgetError, setWidgetError] = useState(null);
  const [academicYears, setAcademicYears] = useState(
    cached?.academicYears ?? { ugr: '', uga: '', pgr: '' },
  );
  const [statusNotice, setStatusNotice] = useState(null);
  const [expandAllTick, setExpandAllTick] = useState(0);
  const [collapseAllTick, setCollapseAllTick] = useState(0);

  const bootstrappedRef = useRef(false);
  const dateRefreshTimer = useRef(null);
  const loadedDateRef = useRef(cached?.attendanceDate ?? null);
  const academicYearsRef = useRef(academicYears);
  const dashboardRef = useRef(dashboard);

  academicYearsRef.current = academicYears;
  dashboardRef.current = dashboard;

  const widgetCount = dashboard?.widgets?.length || 0;
  const memberName = user?.memberName || dashboard?.memberName || 'there';
  const greeting = greetingForHour(new Date().getHours());
  const stamp = formatStampParts(attendanceDate);
  const isToday = attendanceDate === todayIso();
  const institutionLabel = settings?.adminLargeTitle || settings?.institutionShortName || 'Campus';

  const loadedWidgetCount = useMemo(
    () => Object.keys(widgetHtml).filter((id) => widgetHtml[id]).length,
    [widgetHtml],
  );

  const loadWidgets = useCallback(async (shell, date, years, forceRefresh = false) => {
    if (!shell?.widgetGroups || Object.keys(shell.widgetGroups).length === 0) {
      setWidgetHtml({});
      setWidgetCharts({});
      setWidgetLoading(false);
      return { html: {}, chart: {} };
    }

    setWidgetLoading(true);
    setWidgetError(null);
    const dateUnix = Math.floor(new Date(`${date}T12:00:00`).getTime() / 1000);
    const nextHtml = {};
    const nextCharts = {};

    try {
      const groups = Object.values(shell.widgetGroups);
      const results = await Promise.all(
        groups.map((widgetIds) => {
          const hasStaffCurrent = widgetIds.includes('staff_current');
          const params = {
            w: widgetIds.join(','),
            d: hasStaffCurrent ? date : dateUnix,
            ugr: years.ugr,
            uga: years.uga,
            pgr: years.pgr,
          };
          if (hasStaffCurrent) {
            params.c = '1';
            params.t = new Date().toTimeString().slice(0, 5);
          }
          if (forceRefresh) params.cRefresh = 1;
          return api.get('/api/dashboard/widgets', { params });
        }),
      );

      results.forEach((res) => {
        (res.data.widgets || []).forEach((widget) => {
          nextHtml[widget.id] = widget.html;
          if (widget.chart) nextCharts[widget.id] = widget.chart;
        });
      });

      setWidgetHtml(nextHtml);
      setWidgetCharts(nextCharts);
      return { html: nextHtml, chart: nextCharts };
    } catch (err) {
      setWidgetError(err.response?.data?.message || 'Could not load dashboard widgets');
      setWidgetHtml({});
      setWidgetCharts({});
      return { html: {}, chart: {} };
    } finally {
      setWidgetLoading(false);
    }
  }, []);

  const refreshForDate = useCallback(async (date, { force = false, announce = false } = {}) => {
    setWidgetLoading(true);
    setWidgetError(null);
    try {
      const dashboardRes = await api.get('/api/dashboard', {
        params: { attendanceDate: date },
      });
      setDashboard(dashboardRes.data);
      const years = academicYearsRef.current;
      const { html, chart } = await loadWidgets(dashboardRes.data, date, years, force);
      loadedDateRef.current = date;
      writeDashboardCache({
        dashboard: dashboardRes.data,
        attendanceDate: date,
        academicYears: years,
        widgetHtml: html,
        widgetCharts: chart,
      });
      if (announce) {
        setStatusNotice(`Updated panels for ${formatDisplayDate(date)}`);
      }
    } catch (err) {
      setWidgetError(err.response?.data?.message || 'Could not refresh dashboard');
    } finally {
      setWidgetLoading(false);
    }
  }, [loadWidgets]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoadError(null);
        const dashboardRes = await api.get('/api/dashboard');
        if (cancelled) return;

        setDashboard(dashboardRes.data);
        const date = dashboardRes.data.attendanceDate || todayIso();
        setAttendanceDate(date);
        const years = dashboardRes.data.academicYears || {
          ugr: settings?.ugAcademicYear || '',
          uga: settings?.ugaAcademicYear || '',
          pgr: settings?.pgAcademicYear || '',
        };
        setAcademicYears(years);
        setLoading(false);
        const { html, chart } = await loadWidgets(dashboardRes.data, date, years);
        if (!cancelled) {
          loadedDateRef.current = date;
          writeDashboardCache({
            dashboard: dashboardRes.data,
            attendanceDate: date,
            academicYears: years,
            widgetHtml: html,
            widgetCharts: chart,
          });
          bootstrappedRef.current = true;
        }
      } catch (err) {
        if (!cancelled) {
          if (!dashboardRef.current) {
            setLoadError(err.response?.data?.message || 'Could not load dashboard');
            setWidgetError(err.response?.data?.message || 'Could not load dashboard');
          } else {
            bootstrappedRef.current = true;
          }
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadWidgets]);

  // Auto-load widgets when the user changes the attendance date.
  useEffect(() => {
    if (!bootstrappedRef.current) return undefined;
    if (loadedDateRef.current === attendanceDate) return undefined;
    if (dateRefreshTimer.current) clearTimeout(dateRefreshTimer.current);
    dateRefreshTimer.current = setTimeout(() => {
      refreshForDate(attendanceDate, { announce: true });
    }, DATE_DEBOUNCE_MS);
    return () => {
      if (dateRefreshTimer.current) clearTimeout(dateRefreshTimer.current);
    };
  }, [attendanceDate, refreshForDate]);

  useEffect(() => {
    if (!statusNotice) return undefined;
    const t = setTimeout(() => setStatusNotice(null), 3200);
    return () => clearTimeout(t);
  }, [statusNotice]);

  const handleManualRefresh = () => {
    refreshForDate(attendanceDate, { force: true, announce: true });
  };

  const handleUseToday = () => {
    const today = todayIso();
    if (attendanceDate === today) {
      refreshForDate(today, { force: true, announce: true });
      return;
    }
    setAttendanceDate(today);
  };

  if (loading) {
    return <PageLoading message="Opening your register…" />;
  }

  if (loadError && !dashboard) {
    return (
      <div className="cis-page-loading">
        <div className="alert alert-danger mb-0">{loadError}</div>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <DashboardLayout settings={settings} dashboard={dashboard} menu={menu}>
      <div className="cis-page cis-dash-page">
        {/* Identity strip */}
        <header className="cis-dash-identity">
          <div className="cis-dash-identity-copy">
            <p className="cis-dash-identity-college">{institutionLabel}</p>
            <h1 className="cis-dash-identity-title">
              {greeting},
              {' '}
              <span>{memberName}</span>
            </h1>
          </div>
          <dl className="cis-dash-identity-meta">
            <div>
              <dt>ID</dt>
              <dd>{user?.memberId || dashboard?.username || '—'}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{user?.accessType || dashboard?.accessType || '—'}</dd>
            </div>
            <div>
              <dt>Panels</dt>
              <dd>
                {loadedWidgetCount}
                /
                {widgetCount || 0}
              </dd>
            </div>
          </dl>
        </header>

        {/* Signature: register date stamp — the page thesis */}
        <section className="cis-dash-register" aria-label="Attendance register">
          <div className="cis-dash-stamp" aria-hidden="true">
            <span className="cis-dash-stamp-weekday">{stamp.weekday}</span>
            <span className="cis-dash-stamp-day">{stamp.day}</span>
            <span className="cis-dash-stamp-month">
              {stamp.month}
              {' '}
              {stamp.year}
            </span>
          </div>

          <div className="cis-dash-register-body">
            <p className="cis-dash-register-kicker">Attendance register</p>
            <h2 className="cis-dash-register-title">
              {isToday ? 'Today’s campus panels' : `Panels for ${formatDisplayDate(attendanceDate)}`}
            </h2>
            <p className="cis-dash-register-hint">
              Change the date to reload your assigned widgets. No extra click needed.
            </p>

            <div className="cis-dash-register-controls">
              <label className="cis-dash-date-field">
                <span className="cis-dash-date-label">Show panels for</span>
                <input
                  type="date"
                  className="cis-dash-date-control"
                  value={attendanceDate}
                  max={todayIso()}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                />
              </label>

              <button
                type="button"
                className={`cis-dash-btn cis-dash-btn--ghost${isToday ? ' is-active' : ''}`}
                onClick={handleUseToday}
                disabled={widgetLoading && isToday}
              >
                Today
              </button>

              <button
                type="button"
                className="cis-dash-btn cis-dash-btn--primary"
                onClick={handleManualRefresh}
                disabled={widgetLoading}
              >
                {widgetLoading ? 'Updating…' : 'Refresh panels'}
              </button>

              <Link to="/dashboard/hub" className="cis-dash-btn cis-dash-btn--accent">
                All dashboards
              </Link>
            </div>

            <p className="cis-dash-register-status" role="status" aria-live="polite">
              {widgetLoading
                ? `Loading panels for ${formatDisplayDate(attendanceDate)}…`
                : statusNotice
                  || `Showing ${loadedWidgetCount} of ${widgetCount} assigned panels`}
            </p>
          </div>
        </section>

        {/* Module hubs */}
        <nav className="cis-dash-jumps" aria-label="Module hubs">
          <div className="cis-dash-jumps-head">
            <h2 className="cis-dash-jumps-title">Go to a module</h2>
            <p className="cis-dash-jumps-subtitle">Open a hub to browse setup and report screens</p>
          </div>
          <div className="cis-dash-jumps-grid">
            {MODULE_JUMPS.map((item) => (
              <Link key={item.to} to={item.to} className="cis-dash-jump">
                <span className="cis-dash-jump-icon" aria-hidden="true">
                  <i className={item.icon} />
                </span>
                <span className="cis-dash-jump-label">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* Widget deck */}
        <section className="cis-dash-section">
          <div className="cis-dash-section-head">
            <div>
              <h2 className="cis-dash-section-title">Your panels</h2>
              <p className="cis-dash-section-subtitle">
                Modern live cards for the selected attendance day.
              </p>
            </div>
            {widgetCount > 0 && (
              <div className="cis-dash-panel-toolbar">
                <button
                  type="button"
                  className="cis-dash-btn cis-dash-btn--ghost"
                  onClick={() => setExpandAllTick((t) => t + 1)}
                >
                  Expand all
                </button>
                <button
                  type="button"
                  className="cis-dash-btn cis-dash-btn--ghost"
                  onClick={() => setCollapseAllTick((t) => t + 1)}
                >
                  Collapse all
                </button>
              </div>
            )}
          </div>

          {widgetError && (
            <div className="alert alert-danger mb-0">
              {widgetError}
              {' '}
              <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={handleManualRefresh}>
                Try again
              </button>
            </div>
          )}

          {widgetLoading && widgetCount > 0 && (
            <div className="cis-dash-loading">
              <span className="cis-dash-loading-dot" aria-hidden="true" />
              Updating panels for
              {' '}
              {formatDisplayDate(attendanceDate)}
              …
            </div>
          )}

          <div className={`cis-widget-grid${widgetLoading ? ' is-refreshing' : ''}`}>
            {(dashboard?.widgets || []).map((widget) => (
              <DashboardWidgetCard
                key={widget.id}
                widget={widget}
                html={widgetHtml[widget.id]}
                chart={widgetCharts[widget.id]}
                loading={widgetLoading}
                expandAllTick={expandAllTick}
                collapseAllTick={collapseAllTick}
              />
            ))}

            {widgetCount === 0 && (
              <div className="cis-widget-grid-empty">
                <div className="cis-dash-empty">
                  <div className="cis-dash-empty-icon">
                    <i className="fa fa-pie-chart" aria-hidden="true" />
                  </div>
                  <h3 className="h5 mb-2">No panels assigned</h3>
                  <p className="text-muted mb-3">
                    Ask an administrator to assign widgets in Dashboard widget access.
                  </p>
                  <Link to="/admin/setup/dashboard-access" className="btn btn-outline-primary btn-sm">
                    Open dashboard access
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
