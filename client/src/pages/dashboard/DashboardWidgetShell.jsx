import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import DashboardWidgetCard from '../../components/DashboardWidgetCard';
import { Breadcrumbs, PageLoading } from '../../components/PageShell';
import DashboardLayout from '../../layouts/DashboardLayout';

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

export default function DashboardWidgetShell({
  shellPath,
  title,
  breadcrumbLabel,
  showYearPickers = false,
}) {
  const { user } = useAuth();
  const { settings, menu } = useOutletContext();
  const [shell, setShell] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [attendanceDate, setAttendanceDate] = useState(todayIso());
  const [academicYears, setAcademicYears] = useState({ ugr: '', uga: '', pgr: '' });
  const [widgetHtml, setWidgetHtml] = useState({});
  // Widget ids currently in flight — each group's panels flip from skeleton to content the
  // moment their own request lands, independent of slower sibling groups.
  const [pendingWidgetIds, setPendingWidgetIds] = useState(() => new Set());
  const [widgetError, setWidgetError] = useState(null);

  const widgetLoading = pendingWidgetIds.size > 0;
  const widgetCount = shell?.widgets?.length || 0;

  const loadedWidgetCount = useMemo(
    () => Object.keys(widgetHtml).filter((id) => widgetHtml[id]).length,
    [widgetHtml],
  );

  const loadWidgets = useCallback(async (shellData, date, years) => {
    const groups = Object.values(shellData?.widgetGroups || {});
    if (groups.length === 0) {
      setWidgetHtml({});
      setPendingWidgetIds(new Set());
      return;
    }

    setPendingWidgetIds(new Set(groups.flat()));
    setWidgetError(null);
    const dateUnix = Math.floor(new Date(`${date}T12:00:00`).getTime() / 1000);
    const failedGroups = [];

    // Groups are independent panels — one slow/heavy group (e.g. staff attendance) shouldn't
    // hold up already-arrived panels, and a group that fails shouldn't blank the rest.
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

        try {
          const res = await api.get('/api/dashboard/widgets', { params });
          const groupHtml = {};
          (res.data.widgets || []).forEach((widget) => {
            groupHtml[widget.id] = widget.html;
          });
          setWidgetHtml((prev) => ({ ...prev, ...groupHtml }));
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
  }, []);

  const fetchShell = useCallback(async (params = {}) => {
    const res = await api.get(shellPath, { params });
    return res.data;
  }, [shellPath]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        setLoadError(null);
        const shellRes = await fetchShell();
        if (cancelled) return;

        setShell(shellRes);
        const date = shellRes.attendanceDate || todayIso();
        setAttendanceDate(date);
        const years = shellRes.academicYears || {
          ugr: settings?.ugAcademicYear || '',
          uga: settings?.ugaAcademicYear || '',
          pgr: settings?.pgAcademicYear || '',
        };
        setAcademicYears(years);
        setLoading(false);
        loadWidgets(shellRes, date, years);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.response?.data?.message || 'Failed to load dashboard');
          setLoading(false);
        }
      }
    };

    init();
    return () => { cancelled = true; };
  }, [fetchShell, loadWidgets]);

  const handleRefresh = async () => {
    setWidgetError(null);
    try {
      const shellRes = await fetchShell({
        attendanceDate,
        ugr: academicYears.ugr,
        uga: academicYears.uga,
        pgr: academicYears.pgr,
      });
      setShell(shellRes);
      await loadWidgets(shellRes, attendanceDate, academicYears);
    } catch (err) {
      setWidgetError(err.response?.data?.message || 'Failed to refresh dashboard');
    }
  };

  const applyYears = async (nextYears) => {
    setAcademicYears(nextYears);
    try {
      const shellRes = await fetchShell({
        attendanceDate,
        ugr: nextYears.ugr,
        uga: nextYears.uga,
        pgr: nextYears.pgr,
      });
      setShell(shellRes);
      await loadWidgets(shellRes, attendanceDate, nextYears);
    } catch (err) {
      setWidgetError(err.response?.data?.message || 'Failed to apply academic years');
    }
  };

  if (loading) return <PageLoading message="Loading dashboard…" />;

  if (loadError && !shell) {
    return (
      <div className="cis-page-loading">
        <div className="alert alert-danger mb-0">{loadError}</div>
      </div>
    );
  }

  const institutionLabel = settings?.adminLargeTitle || settings?.institutionShortName || 'Campus';

  return (
    <DashboardLayout settings={settings} dashboard={shell} menu={menu}>
      <div className="cis-page cis-dash-page">
        <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard/hub' }, { label: breadcrumbLabel || title }]} />

        <section className="cis-dash-hero">
          <div className="cis-dash-hero-copy">
            <h1 className="cis-dash-hero-title">{title || shell?.title}</h1>
            <p className="cis-dash-hero-subtitle">
              Review widgets for
              {' '}
              <strong>{formatDisplayDate(attendanceDate)}</strong>
              . Pick a date and refresh to load the latest data.
            </p>
            <div className="cis-dash-hero-meta">
              <span className="cis-dash-chip">
                ID
                {' '}
                <strong>{user?.memberId || shell?.username}</strong>
              </span>
              <span className="cis-dash-chip cis-dash-chip--accent">
                <strong>{user?.accessType || shell?.accessType}</strong>
              </span>
              {showYearPickers && academicYears.ugr && (
                <span className="cis-dash-chip" title="U.G regular year">
                  U.G
                  {' '}
                  <strong>{academicYears.ugr}</strong>
                </span>
              )}
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

          {showYearPickers && (
            <article className="cis-dash-stat-card cis-dash-stat-card--neutral">
              <span className="cis-dash-stat-icon" aria-hidden="true">
                <i className="fa fa-graduation-cap" />
              </span>
              <div className="cis-dash-stat-label">Academic years</div>
              <div className="cis-dash-stat-value cis-dash-stat-value--sm">
                {academicYears.ugr || '—'}
              </div>
              <div className="cis-dash-stat-foot">
                Add.
                {' '}
                {academicYears.uga || '—'}
                {' '}
                · P.G
                {' '}
                {academicYears.pgr || '—'}
              </div>
            </article>
          )}

          <article className="cis-dash-stat-card cis-dash-stat-card--neutral">
            <span className="cis-dash-stat-icon" aria-hidden="true">
              <i className="fa fa-user" />
            </span>
            <div className="cis-dash-stat-label">Access role</div>
            <div className="cis-dash-stat-value">{user?.accessType || shell?.accessType || '—'}</div>
            <div className="cis-dash-stat-foot">{user?.memberName || shell?.memberName}</div>
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

          {showYearPickers && shell?.yearOptions && (
            <div className="row g-2 align-items-stretch">
              <div className="col-md-4">
                <div className="cis-dash-year-card h-100">
                  <label className="form-label">U.G (Regular)</label>
                  <select
                    className="form-select"
                    value={academicYears.ugr}
                    onChange={(e) => applyYears({ ...academicYears, ugr: e.target.value })}
                  >
                    {(shell.yearOptions.ugRegular || []).map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="col-md-4">
                <div className="cis-dash-year-card h-100">
                  <label className="form-label">U.G (Additional)</label>
                  <select
                    className="form-select"
                    value={academicYears.uga}
                    onChange={(e) => applyYears({ ...academicYears, uga: e.target.value })}
                  >
                    {(shell.yearOptions.ugAdditional || []).map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="col-md-4">
                <div className="cis-dash-year-card h-100">
                  <label className="form-label">P.G</label>
                  <select
                    className="form-select"
                    value={academicYears.pgr}
                    onChange={(e) => applyYears({ ...academicYears, pgr: e.target.value })}
                  >
                    {(shell.yearOptions.pgRegular || []).map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {widgetError && (
            <div className="alert alert-danger mb-0">{widgetError}</div>
          )}

          {widgetLoading && widgetCount > 0 && (
            <div className="cis-dash-loading">
              <span className="cis-dash-loading-dot" aria-hidden="true" />
              Loading panel data…
            </div>
          )}

          <div className={`cis-widget-grid${widgetLoading ? ' is-refreshing' : ''}`}>
            {(shell?.widgets || []).map((widget) => (
              <DashboardWidgetCard
                key={widget.id}
                widget={widget}
                html={widgetHtml[widget.id]}
                loading={pendingWidgetIds.has(widget.id)}
              />
            ))}

            {widgetCount === 0 && (
              <div className="cis-widget-grid-empty">
                <div className="cis-dash-empty">
                  <div className="cis-dash-empty-icon">
                    <i className="fa fa-pie-chart" aria-hidden="true" />
                  </div>
                  <h3 className="h5 mb-2">No panels assigned</h3>
                  <p className="text-muted mb-0">
                    Ask an administrator to assign widgets in Dashboard widget access.
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
