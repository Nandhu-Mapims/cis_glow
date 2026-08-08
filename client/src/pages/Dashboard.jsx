import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import DashboardWidgetCard from '../components/DashboardWidgetCard';
import { PageLoading } from '../components/PageShell';
import DashboardLayout from '../layouts/DashboardLayout';
import { cachedByDate, peekSessionCache } from '../utils/idbCache';

// Shell (page frame: identity, register date, widget list/groups) and widgets (the actual
// per-panel HTML) are cached and fetched separately on purpose — the shell is cheap and
// should paint immediately, while widget queries (esp. staff attendance) can be slow. See
// loadForDate()/loadWidgets() below. v2: widget payloads can carry a `chart` field
// alongside `html` (see widgetDispatcher.js) — bumped so a v1 cache with the old shape
// isn't replayed.
const DASHBOARD_SHELL_CACHE_VERSION = 'v1';
const DASHBOARD_WIDGETS_CACHE_VERSION = 'v2';
// Today's panels can still change through the day, so we revalidate more eagerly than
// the default session TTL; a past date's panels are settled history (see idbCache.js).
const DASHBOARD_TODAY_TTL_MS = 90_000;
const DATE_DEBOUNCE_MS = 400;

function dashboardShellCacheKey(date) {
  return `dashboard-shell:${DASHBOARD_SHELL_CACHE_VERSION}:${date}`;
}

function dashboardWidgetsCacheKey(date) {
  return `dashboard-widgets:${DASHBOARD_WIDGETS_CACHE_VERSION}:${date}`;
}

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
  // Only "today" is synchronously peekable (sessionStorage); a past date's cached shell/
  // widgets live in IndexedDB and only arrive once the load effect below has run.
  const cachedShell = peekSessionCache(dashboardShellCacheKey(todayIso()));
  const cachedWidgets = peekSessionCache(dashboardWidgetsCacheKey(todayIso()));
  const [dashboard, setDashboard] = useState(cachedShell?.dashboard ?? null);
  const [loading, setLoading] = useState(!cachedShell);
  const [loadError, setLoadError] = useState(null);
  const [attendanceDate, setAttendanceDate] = useState(cachedShell?.attendanceDate ?? todayIso());
  const [widgetHtml, setWidgetHtml] = useState(cachedWidgets?.widgetHtml ?? {});
  const [widgetCharts, setWidgetCharts] = useState(cachedWidgets?.widgetCharts ?? {});
  // Widget ids currently in flight — each group's panels flip from skeleton to content the
  // moment their own request lands, independent of slower sibling groups (see loadWidgets).
  const [pendingWidgetIds, setPendingWidgetIds] = useState(() => new Set());
  const [widgetError, setWidgetError] = useState(null);
  const [academicYears, setAcademicYears] = useState(
    cachedShell?.academicYears ?? { ugr: '', uga: '', pgr: '' },
  );
  const [statusNotice, setStatusNotice] = useState(null);
  const [expandAllTick, setExpandAllTick] = useState(0);
  const [collapseAllTick, setCollapseAllTick] = useState(0);

  const bootstrappedRef = useRef(false);
  const dateRefreshTimer = useRef(null);
  const loadedDateRef = useRef(cachedShell?.attendanceDate ?? null);
  const academicYearsRef = useRef(academicYears);
  const dashboardRef = useRef(dashboard);
  const settingsRef = useRef(settings);

  academicYearsRef.current = academicYears;
  dashboardRef.current = dashboard;
  settingsRef.current = settings;

  const widgetLoading = pendingWidgetIds.size > 0;
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

  // Fetches widget panels one group at a time and reveals each as it lands — a slow/heavy
  // group (e.g. staff attendance on a date with lots of records) shouldn't hold the whole
  // grid on skeletons while every other panel is already sitting in memory. Wrapped in the
  // same stale-while-revalidate cache as the shell so a revisit paints instantly and just
  // quietly reconfirms in the background.
  const loadWidgets = useCallback(async (shell, date, years, forceRefresh = false) => {
    const groups = Object.values(shell?.widgetGroups || {});
    if (groups.length === 0) {
      setWidgetHtml({});
      setWidgetCharts({});
      setPendingWidgetIds(new Set());
      return { widgetHtml: {}, widgetCharts: {} };
    }

    return cachedByDate(
      dashboardWidgetsCacheKey(date),
      date,
      async () => {
        setPendingWidgetIds(new Set(groups.flat()));
        setWidgetError(null);
        const dateUnix = Math.floor(new Date(`${date}T12:00:00`).getTime() / 1000);
        const nextHtml = {};
        const nextCharts = {};
        const failedGroups = [];

        await Promise.allSettled(
          groups.map(async (widgetIds) => {
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

            try {
              const res = await api.get('/api/dashboard/widgets', { params, timeout: 90000 });
              const groupHtml = {};
              const groupCharts = {};
              (res.data.widgets || []).forEach((widget) => {
                groupHtml[widget.id] = widget.html;
                nextHtml[widget.id] = widget.html;
                if (widget.chart) {
                  groupCharts[widget.id] = widget.chart;
                  nextCharts[widget.id] = widget.chart;
                }
              });
              // Reveal this group's panels the moment they land instead of waiting for
              // every group to finish — this is what makes the grid fill in one-by-one.
              setWidgetHtml((prev) => ({ ...prev, ...groupHtml }));
              setWidgetCharts((prev) => ({ ...prev, ...groupCharts }));
            } catch {
              failedGroups.push(...widgetIds);
            } finally {
              setPendingWidgetIds((prev) => {
                if (prev.size === 0) return prev;
                const next = new Set(prev);
                widgetIds.forEach((id) => next.delete(id));
                return next;
              });
            }
          }),
        );

        setWidgetError(
          failedGroups.length
            ? `${failedGroups.length} panel${failedGroups.length > 1 ? 's' : ''} took too long to load and were skipped — try refreshing.`
            : null,
        );

        return { widgetHtml: nextHtml, widgetCharts: nextCharts };
      },
      {
        ttlMs: forceRefresh ? 0 : (date === todayIso() ? DASHBOARD_TODAY_TTL_MS : undefined),
        onCache: (cachedPayload) => {
          // Paint instantly from a prior visit; the fetcher above (still running unless the
          // cache is fresh enough to skip it) will quietly confirm/update group-by-group.
          setWidgetHtml(cachedPayload.widgetHtml || {});
          setWidgetCharts(cachedPayload.widgetCharts || {});
        },
      },
    );
  }, []);

  // Fetches (or serves from cache) just the page shell — identity, register date, widget
  // list/groups — for one attendance date. This is cheap (metadata only) and is what
  // unblocks first paint; widget content loads separately and progressively via
  // loadWidgets(). Today's shell is cached in sessionStorage with a short TTL (still
  // changing through the day); any other date is cached in IndexedDB with a long TTL,
  // since a closed day's shell isn't expected to change — see idbCache.js.
  const loadForDate = useCallback(async (date, { dashboardOverride, force = false, announce = false } = {}) => {
    setWidgetError(null);
    try {
      const applyShell = (shellPayload, isFresh) => {
        setDashboard(shellPayload.dashboard);
        setAttendanceDate(shellPayload.attendanceDate);
        setAcademicYears(shellPayload.academicYears || academicYearsRef.current);
        loadedDateRef.current = shellPayload.attendanceDate;
        setLoading(false);
        if (isFresh && announce) {
          setStatusNotice(`Updated panels for ${formatDisplayDate(shellPayload.attendanceDate)}`);
        }
      };

      const shellPayload = await cachedByDate(
        dashboardShellCacheKey(date),
        date,
        async () => {
          const dashboardData = dashboardOverride
            || (await api.get('/api/dashboard', { params: { attendanceDate: date } })).data;
          const years = dashboardData.academicYears || academicYearsRef.current || {
            ugr: settingsRef.current?.ugAcademicYear || '',
            uga: settingsRef.current?.ugaAcademicYear || '',
            pgr: settingsRef.current?.pgAcademicYear || '',
          };
          return { dashboard: dashboardData, attendanceDate: date, academicYears: years };
        },
        {
          ttlMs: force ? 0 : (date === todayIso() ? DASHBOARD_TODAY_TTL_MS : undefined),
          onCache: (cachedShellPayload) => applyShell(cachedShellPayload, false),
          onFresh: (freshShellPayload) => applyShell(freshShellPayload, true),
        },
      );

      bootstrappedRef.current = true;
      setLoading(false);

      const { widgetHtml: html, widgetCharts: chart } = await loadWidgets(
        shellPayload.dashboard,
        shellPayload.attendanceDate,
        shellPayload.academicYears,
        force,
      );
      return { ...shellPayload, widgetHtml: html, widgetCharts: chart };
    } catch (err) {
      if (!dashboardRef.current) {
        setLoadError(err.response?.data?.message || 'Could not load dashboard');
      }
      setWidgetError(err.response?.data?.message || 'Could not load dashboard');
      bootstrappedRef.current = true;
      setLoading(false);
      return null;
    }
  }, [loadWidgets]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoadError(null);
        const dashboardRes = await api.get('/api/dashboard');
        if (cancelled) return;
        const date = dashboardRes.data.attendanceDate || todayIso();
        await loadForDate(date, { dashboardOverride: dashboardRes.data });
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.response?.data?.message || 'Could not load dashboard');
          setWidgetError(err.response?.data?.message || 'Could not load dashboard');
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadForDate]);

  // Auto-load widgets when the user changes the attendance date.
  useEffect(() => {
    if (!bootstrappedRef.current) return undefined;
    if (loadedDateRef.current === attendanceDate) return undefined;
    if (dateRefreshTimer.current) clearTimeout(dateRefreshTimer.current);
    dateRefreshTimer.current = setTimeout(() => {
      loadForDate(attendanceDate, { announce: true });
    }, DATE_DEBOUNCE_MS);
    return () => {
      if (dateRefreshTimer.current) clearTimeout(dateRefreshTimer.current);
    };
  }, [attendanceDate, loadForDate]);

  useEffect(() => {
    if (!statusNotice) return undefined;
    const t = setTimeout(() => setStatusNotice(null), 3200);
    return () => clearTimeout(t);
  }, [statusNotice]);

  const handleManualRefresh = () => {
    loadForDate(attendanceDate, { force: true, announce: true });
  };

  const handleUseToday = () => {
    const today = todayIso();
    if (attendanceDate === today) {
      loadForDate(today, { force: true, announce: true });
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
                loading={pendingWidgetIds.has(widget.id)}
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
