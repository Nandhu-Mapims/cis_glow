import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { PageLoading } from '../components/PageShell';
import DashboardLayout from '../layouts/DashboardLayout';
import { getWidgetSlotClassName } from '../utils/dashboardWidgetLayout';

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

function formatLastLogin(iso) {
  if (!iso) return 'First session';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Dashboard() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [attendanceDate, setAttendanceDate] = useState(todayIso());
  const [widgetHtml, setWidgetHtml] = useState({});
  const [widgetLoading, setWidgetLoading] = useState(false);
  const [widgetError, setWidgetError] = useState(null);
  const [academicYears, setAcademicYears] = useState({ ugr: '', uga: '', pgr: '' });

  const widgetCount = dashboard?.widgets?.length || 0;

  const loadedWidgetCount = useMemo(
    () => Object.keys(widgetHtml).filter((id) => widgetHtml[id]).length,
    [widgetHtml],
  );

  const loadWidgets = useCallback(async (shell, date, years) => {
    if (!shell?.widgetGroups || Object.keys(shell.widgetGroups).length === 0) {
      setWidgetHtml({});
      setWidgetLoading(false);
      return;
    }

    setWidgetLoading(true);
    setWidgetError(null);
    const dateUnix = Math.floor(new Date(`${date}T12:00:00`).getTime() / 1000);
    const nextHtml = {};

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
          return api.get('/api/dashboard/widgets', { params });
        }),
      );

      results.forEach((res) => {
        (res.data.widgets || []).forEach((widget) => {
          nextHtml[widget.id] = widget.html;
        });
      });

      setWidgetHtml(nextHtml);
    } catch (err) {
      setWidgetError(err.response?.data?.message || 'Failed to load dashboard widgets');
      setWidgetHtml({});
    } finally {
      setWidgetLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoadError(null);
        const [settingsRes, dashboardRes, menuRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/dashboard'),
          api.get('/api/menu'),
        ]);
        if (cancelled) return;

        setSettings(settingsRes.data);
        setDashboard(dashboardRes.data);
        setMenu(menuRes.data.menu || []);
        const date = dashboardRes.data.attendanceDate || todayIso();
        setAttendanceDate(date);
        const years = dashboardRes.data.academicYears || {
          ugr: settingsRes.data.ugAcademicYear || '',
          uga: settingsRes.data.ugaAcademicYear || '',
          pgr: settingsRes.data.pgAcademicYear || '',
        };
        setAcademicYears(years);
        setLoading(false);
        loadWidgets(dashboardRes.data, date, years);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.response?.data?.message || 'Failed to load dashboard');
          setWidgetError(err.response?.data?.message || 'Failed to load dashboard');
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [loadWidgets]);

  const handleRefresh = async () => {
    setWidgetLoading(true);
    setWidgetError(null);
    try {
      const dashboardRes = await api.get('/api/dashboard', {
        params: { attendanceDate },
      });
      setDashboard(dashboardRes.data);
      await loadWidgets(dashboardRes.data, attendanceDate, academicYears);
    } catch (err) {
      setWidgetError(err.response?.data?.message || 'Failed to refresh dashboard');
    } finally {
      setWidgetLoading(false);
    }
  };

  if (loading) {
    return <PageLoading message="Loading dashboard…" />;
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

  const institutionLabel = settings?.adminLargeTitle || settings?.institutionShortName || 'Campus';

  return (
    <DashboardLayout settings={settings} dashboard={dashboard} menu={menu}>
      <div className="cis-page cis-dash-page">
        <section className="cis-dash-hero">
          <div className="cis-dash-hero-copy">
            <h1 className="cis-dash-hero-title">
              Welcome back,
              {' '}
              {user?.memberName || dashboard?.memberName}
            </h1>
            <p className="cis-dash-hero-subtitle">
              Review attendance, faculty norms, and campus widgets for
              {' '}
              <strong>{formatDisplayDate(attendanceDate)}</strong>
              . Pick a date and refresh to load the latest data.
            </p>
            <div className="cis-dash-hero-meta">
              <span className="cis-dash-chip">
                ID
                {' '}
                <strong>{user?.memberId || dashboard?.username}</strong>
              </span>
              <span className="cis-dash-chip cis-dash-chip--accent">
                <strong>{user?.accessType || dashboard?.accessType}</strong>
              </span>
              {institutionLabel && (
                <span className="cis-dash-chip" title={institutionLabel}>
                  {institutionLabel.length > 42
                    ? `${institutionLabel.slice(0, 42)}…`
                    : institutionLabel}
                </span>
              )}
            </div>
          </div>

          <div className="cis-dash-hero-actions">
            <div className="cis-dash-action-card cis-dash-action-card--soft">
              <span className="cis-dash-action-step">Step 1</span>
              <span className="cis-dash-action-title">Attendance date</span>
              <input
                type="date"
                className="cis-dash-date-input"
                value={attendanceDate}
                max={todayIso()}
                onChange={(e) => setAttendanceDate(e.target.value)}
                aria-label="Attendance date"
              />
            </div>

            <button
              type="button"
              className="cis-dash-action-card cis-dash-action-card--primary"
              onClick={handleRefresh}
              disabled={widgetLoading}
            >
              <span className="cis-dash-action-step">Step 2</span>
              <span className="cis-dash-action-title">
                {widgetLoading ? 'Refreshing…' : 'Refresh widgets'}
              </span>
              <span className="cis-dash-action-go">GO</span>
            </button>

            <Link to="/dashboard/hub" className="cis-dash-action-card cis-dash-action-card--accent">
              <span className="cis-dash-action-step">More</span>
              <span className="cis-dash-action-title">All dashboards</span>
              <span className="cis-dash-action-go">GO</span>
            </Link>
          </div>
        </section>

        <section className="cis-dash-stats" aria-label="Dashboard summary">
          <article className="cis-dash-stat-card cis-dash-stat-card--red">
            <span className="cis-dash-stat-icon" aria-hidden="true">
              <i className="fa fa-th-large" />
            </span>
            <div className="cis-dash-stat-label">Configured widgets</div>
            <div className="cis-dash-stat-value">{widgetCount}</div>
            <div className="cis-dash-stat-foot">
              {loadedWidgetCount}
              {' '}
              loaded for this view
            </div>
          </article>

          <article className="cis-dash-stat-card cis-dash-stat-card--yellow">
            <span className="cis-dash-stat-icon" aria-hidden="true">
              <i className="fa fa-calendar" />
            </span>
            <div className="cis-dash-stat-label">Attendance date</div>
            <div className="cis-dash-stat-value">{formatDisplayDate(attendanceDate)}</div>
            <div className="cis-dash-stat-foot">Change date in Step 1 above</div>
          </article>

          <article className="cis-dash-stat-card cis-dash-stat-card--neutral">
            <span className="cis-dash-stat-icon" aria-hidden="true">
              <i className="fa fa-user" />
            </span>
            <div className="cis-dash-stat-label">Access role</div>
            <div className="cis-dash-stat-value">{user?.accessType || dashboard?.accessType || '—'}</div>
            <div className="cis-dash-stat-foot">{user?.memberName || dashboard?.memberName}</div>
          </article>

          <article className="cis-dash-stat-card cis-dash-stat-card--neutral">
            <span className="cis-dash-stat-icon" aria-hidden="true">
              <i className="fa fa-clock-o" />
            </span>
            <div className="cis-dash-stat-label">Last login</div>
            <div className="cis-dash-stat-value cis-dash-stat-value--sm">
              {formatLastLogin(dashboard?.lastLoginAt)}
            </div>
            <div className="cis-dash-stat-foot">Previous successful session</div>
          </article>
        </section>

        <section className="cis-dash-section">
          <div className="cis-dash-section-head">
            <div>
              <h2 className="cis-dash-section-title">Today&apos;s widgets</h2>
              <p className="cis-dash-section-subtitle">
                Live panels assigned to your account in dashboard access setup.
              </p>
            </div>
            <div className="cis-dash-toolbar">
              <input
                type="date"
                className="form-control"
                value={attendanceDate}
                max={todayIso()}
                onChange={(e) => setAttendanceDate(e.target.value)}
                aria-label="Attendance date"
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleRefresh}
                disabled={widgetLoading}
              >
                {widgetLoading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
          </div>

          {widgetError && (
            <div className="alert alert-danger mb-0">{widgetError}</div>
          )}

          {widgetLoading && widgetCount > 0 && (
            <div className="cis-dash-loading">
              <img src="/legacy/img/loading.gif" alt="" width="24" />
              Loading widget data…
            </div>
          )}

          <div className="row dashboard-widgets-row">
            {(dashboard?.widgets || []).map((widget) => (
              <div key={widget.id} className={getWidgetSlotClassName(widget.id)}>
                {widgetHtml[widget.id] ? (
                  <div
                    className={`legacy-widget-root legacy-widget-root--${widget.id}`}
                    dangerouslySetInnerHTML={{ __html: widgetHtml[widget.id] }}
                  />
                ) : (
                  <div className="card dashboard-widget h-100">
                    <div className="card-header dashboard-widget-header">
                      <h5 className="mb-0">{widget.label}</h5>
                    </div>
                    <div className="card-body d-flex align-items-center justify-content-center text-muted">
                      <div className="text-center">
                        {widgetLoading ? (
                          <>
                            <img src="/legacy/img/loading.gif" alt="Loading widget" width="32" className="mb-2" />
                            <div className="small">Loading…</div>
                          </>
                        ) : (
                          <div className="small">No data for this widget</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {widgetCount === 0 && (
              <div className="col-12">
                <div className="cis-dash-empty">
                  <div className="cis-dash-empty-icon">
                    <i className="fa fa-pie-chart" aria-hidden="true" />
                  </div>
                  <h3 className="h5 mb-2">No widgets configured</h3>
                  <p className="text-muted mb-0">
                    Ask an administrator to assign widgets in
                    {' '}
                    <code>dashboard_access</code>
                    .
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
