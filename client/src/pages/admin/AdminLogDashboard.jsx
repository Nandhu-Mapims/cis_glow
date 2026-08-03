import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Breadcrumbs } from '../../components/PageShell';
import { printReportHtml } from '../../utils/printReport';

function StatPanel({ title, total, periods, live, isToday, loading = false }) {
  return (
    <div className="col-lg-4">
      <article className={`cis-log-stat-card${loading ? ' cis-log-stat-card--loading' : ''}`}>
        <div className="cis-log-stat-head">
          <h3 className="cis-log-stat-title">{title}</h3>
          <span className="cis-log-stat-total">{total}</span>
        </div>
        <div className="cis-log-stat-body">
          {loading ? (
            <div className="cis-dash-loading py-3">
              <img src="/legacy/img/loading.gif" alt="" width="24" />
              Loading stats…
            </div>
          ) : (
            <>
              <table className="table table-bordered table-sm cis-log-period-table mb-0">
                <thead>
                  <tr>
                    {periods.map((p) => <th key={p.label}>{p.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {periods.map((p) => (
                      <td key={p.label} className="text-center cis-log-period-value">{p.active ?? '—'}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
              {isToday && live != null && (
                <div className="cis-log-live">
                  <div className="cis-log-live-label">Current</div>
                  <div className="cis-log-live-value">{live}</div>
                </div>
              )}
            </>
          )}
        </div>
      </article>
    </div>
  );
}

function ActivityPanel({ title, rows }) {
  return (
    <div className="col-lg-4">
      <div className="legacy-widget-root legacy-widget-root--log-activity">
        <div className="col-sm-12 dashboard-container">
          <section className="panel">
            <div className="revenue-head">
              <span aria-hidden="true" />
              <h3>{title}</h3>
            </div>
            <div className="dashboard-panel-unit p-0">
              <table className="table table-bordered table-sm mb-0">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th className="text-end">#Success</th>
                    <th className="text-end">#Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td className="text-end">{row.success}</td>
                      <td className="text-end">{row.failed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const LOG_DASHBOARD_CACHE_KEY = 'cis_log_dashboard_v1';
const CACHE_TTL_MS = 300_000;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function readSessionCache() {
  try {
    const raw = sessionStorage.getItem(LOG_DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data?.panels) return null;
    return {
      data: parsed.data,
      fresh: Date.now() - parsed.at < CACHE_TTL_MS,
    };
  } catch {
    return null;
  }
}

function writeSessionCache(data) {
  try {
    sessionStorage.setItem(LOG_DASHBOARD_CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // ignore quota errors
  }
}

function mergeDashboardState(prev, next) {
  if (!prev) return next;
  if (!next) return prev;
  return {
    ...prev,
    ...next,
    panels: next.panels ? { ...prev.panels, ...next.panels } : prev.panels,
    activities: next.activities ?? prev.activities,
  };
}

export default function AdminLogDashboard() {
  const { settings, menu } = useOutletContext();
  const [busy, setBusy] = useState(false);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(() => readSessionCache()?.data ?? null);
  const [selectedDate, setSelectedDate] = useState(() => readSessionCache()?.data?.selectedDate || todayIso());
  const requestIdRef = useRef(0);
  const didInitRef = useRef(false);

  const loadDashboard = useCallback(async (fields = {}, options = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const showSpinner = options.showSpinner === true;

    if (showSpinner) setBusy(true);
    setError(null);

    const baseFields = { ...fields };

    try {
      const fastPanelsRes = await api.post('/api/admin/log-dashboard', {
        fields: { ...baseFields, sections: 'panels', roles: 'admin,staff' },
      });
      if (requestId !== requestIdRef.current) return;

      if (fastPanelsRes.data.error) {
        setError(fastPanelsRes.data.error);
        if (showSpinner) setData(null);
        return;
      }

      setData((prev) => mergeDashboardState(prev, fastPanelsRes.data));
      setSelectedDate(fastPanelsRes.data.selectedDate || todayIso());
      setBusy(false);

      const studentPanelsRes = await api.post('/api/admin/log-dashboard', {
        fields: { ...baseFields, sections: 'panels', roles: 'student' },
      });
      if (requestId !== requestIdRef.current) return;

      if (!studentPanelsRes.data.error) {
        setData((prev) => mergeDashboardState(prev, studentPanelsRes.data));
      }

      setActivitiesLoading(true);
      const activitiesRes = await api.post('/api/admin/log-dashboard', {
        fields: { ...baseFields, sections: 'activities' },
      });
      if (requestId !== requestIdRef.current) return;

      if (activitiesRes.data.error) {
        setError(activitiesRes.data.error);
        return;
      }

      setData((prev) => {
        const merged = mergeDashboardState(prev, activitiesRes.data);
        writeSessionCache(merged);
        return merged;
      });
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err.response?.data?.message || 'Unable to load login dashboard');
      if (showSpinner) setData(null);
    } finally {
      if (requestId === requestIdRef.current) {
        setBusy(false);
        setActivitiesLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    const cache = readSessionCache();

    if (cache?.fresh && cache.data?.panels && cache.data?.activities) {
      return;
    }

    if (cache?.data?.panels && cache.data?.activities && !cache.fresh) {
      loadDashboard({}, { showSpinner: false });
      return undefined;
    }

    if (cache?.data?.panels && !cache?.data?.activities) {
      setActivitiesLoading(true);
      api.post('/api/admin/log-dashboard', { fields: { sections: 'activities' } })
        .then((res) => {
          setData((prev) => {
            const merged = mergeDashboardState(prev, res.data);
            writeSessionCache(merged);
            return merged;
          });
        })
        .catch((err) => {
          setError(err.response?.data?.message || 'Unable to load login activity');
        })
        .finally(() => setActivitiesLoading(false));
      return undefined;
    }

    loadDashboard({}, { showSpinner: !cache?.data?.panels });
    return undefined;
  }, [loadDashboard]);

  const onDateSubmit = async (event) => {
    event.preventDefault();
    setData((prev) => (prev ? { ...prev, activities: null } : prev));
    await loadDashboard({ s_date: selectedDate }, { showSpinner: true });
  };

  const printDashboard = () => {
    const el = document.getElementById('admin-log-dashboard-print');
    if (el) printReportHtml(el.innerHTML);
  };

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Login Dashboard' }} menu={menu}>
      <div className="cis-page cis-dash-page cis-log-dash-page">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/dashboard' },
            { label: 'Admin', to: '/admin' },
            { label: 'Login Dashboard' },
          ]}
        />

        <section className="cis-dash-hero cis-dash-hero--compact">
          <div className="cis-dash-hero-copy">
            <h1 className="cis-dash-hero-title">Login Dashboard</h1>
            <p className="cis-dash-hero-subtitle">
              Active login counts and daily success/failure activity.
            </p>
            {data?.lastView && (
              <div className="cis-dash-hero-meta">
                <span className="cis-dash-chip">
                  Last view by
                  {' '}
                  <strong>{data.lastView.by}</strong>
                </span>
                <span className="cis-dash-chip cis-dash-chip--accent">
                  {new Date(data.lastView.at).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div className="cis-dash-hero-actions cis-dash-hero-actions--inline">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={printDashboard}>
              Print
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => loadDashboard({ Submit: 'Refresh', s_date: selectedDate }, { showSpinner: true })}
              disabled={busy || activitiesLoading}
            >
              Refresh
            </button>
            <Link to="/admin/log-details" className="btn btn-outline-primary btn-sm">Log details</Link>
            <Link to="/admin" className="btn btn-outline-secondary btn-sm">Back</Link>
          </div>
        </section>

        <section className="cis-dash-section">
          <form className="cis-log-date-form" onSubmit={onDateSubmit}>
            <div className="row g-2 align-items-end">
              <div className="col-auto">
                <label className="form-label" htmlFor="s_date">Date</label>
                <input
                  id="s_date"
                  type="date"
                  className="form-control"
                  max={todayIso()}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <div className="col-auto">
                <button type="submit" className="btn btn-primary" disabled={busy || activitiesLoading}>Apply</button>
              </div>
              {!data?.isToday && data?.panels && (
                <div className="col-auto">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={busy || activitiesLoading}
                    onClick={() => loadDashboard({}, { showSpinner: true })}
                  >
                    Today
                  </button>
                </div>
              )}
            </div>
          </form>

          {error && <div className="alert alert-danger mb-0">{error}</div>}
          {busy && !data?.panels && (
            <div className="cis-dash-loading">
              <img src="/legacy/img/loading.gif" alt="" width="24" />
              Loading active user stats…
            </div>
          )}

          <div id="admin-log-dashboard-print">
            {(data?.panels || busy) && (
              <>
                <div className="cis-dash-section-head">
                  <div>
                    <h2 className="cis-dash-section-title">Active users</h2>
                    <p className="cis-dash-section-subtitle">
                      Login counts by role for the selected date.
                    </p>
                  </div>
                </div>
                <div className="row dashboard-widgets-row cis-log-stats-row">
                  <StatPanel
                    title="Admin Login Active Users"
                    total={data?.panels?.admin?.total ?? '—'}
                    periods={data?.panels?.admin?.periods || []}
                    live={data?.panels?.admin?.live}
                    isToday={data?.isToday}
                    loading={!data?.panels?.admin || data.panels.admin.loading}
                  />
                  <StatPanel
                    title="Staff Login Active Users"
                    total={data?.panels?.staff?.total ?? '—'}
                    periods={data?.panels?.staff?.periods || []}
                    live={data?.panels?.staff?.live}
                    isToday={data?.isToday}
                    loading={!data?.panels?.staff || data.panels.staff.loading}
                  />
                  <StatPanel
                    title="Student Login Active Users"
                    total={data?.panels?.student?.total ?? '—'}
                    periods={data?.panels?.student?.periods || []}
                    live={data?.panels?.student?.live}
                    isToday={data?.isToday}
                    loading={!data?.panels?.student || data.panels.student.loading}
                  />
                </div>
              </>
            )}

            {data?.panels && (
              <>
                <div className="cis-dash-section-head mt-2">
                  <div>
                    <h2 className="cis-dash-section-title">Login activity</h2>
                    <p className="cis-dash-section-subtitle">
                      Success and failure counts by day.
                    </p>
                  </div>
                </div>
                {data.activities ? (
                  <div className="row dashboard-widgets-row">
                    <ActivityPanel title="Admin Login - Activities" rows={data.activities.admin} />
                    <ActivityPanel title="Staff Login - Activities" rows={data.activities.staff} />
                    <ActivityPanel title="Student Login - Activities" rows={data.activities.student} />
                  </div>
                ) : (
                  <div className="cis-dash-loading">
                    <img src="/legacy/img/loading.gif" alt="" width="24" />
                    {activitiesLoading ? 'Loading login activity…' : 'Login activity not available'}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
