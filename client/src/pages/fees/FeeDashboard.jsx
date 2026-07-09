import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../api/client';
import { useShellData } from '../../hooks/useShellData';
import { printReportHtml } from '../../utils/printReport';
import { FEE_SCREEN_META } from './feeModuleMeta';
import FeePageShell, { feeBackAction, feeScreenBreadcrumbs } from './FeePageShell';

const META = FEE_SCREEN_META.dashboard;

const FEE_DASHBOARD_CACHE_KEY = 'cis_fee_dashboard_v3';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toDisplayDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

function readSessionCache(dateIso) {
  try {
    const raw = sessionStorage.getItem(FEE_DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.html || parsed.dateIso !== dateIso) return null;
    if (Date.now() - parsed.at > 120_000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionCache(dateIso, html, styles) {
  try {
    sessionStorage.setItem(FEE_DASHBOARD_CACHE_KEY, JSON.stringify({
      at: Date.now(),
      dateIso,
      html,
      styles,
    }));
  } catch {
    // ignore quota errors
  }
}

function injectSummaryTable(html, summaryTable) {
  return html.replace(
    '<div class="dashboard-panel text-muted p-3">Loading course summary…</div>',
    `<div class="dashboard-panel">${summaryTable}</div>`,
  );
}

function injectQuickSummary(html, quickSummaryHtml) {
  if (!quickSummaryHtml) return html;
  if (html.includes('<!--FEE_QUICK_SUMMARY_BODY-->')) {
    return html.replace(
      /<div class="col-sm-4" id="fee-quick-summary-panel">[\s\S]*?<\/div>\s*(?=<\/div>\s*$)/,
      quickSummaryHtml,
    );
  }
  if (html.includes('<!--FEE_QUICK_SUMMARY-->')) {
    return html.replace('<!--FEE_QUICK_SUMMARY-->', quickSummaryHtml);
  }
  return html.replace(
    /<div class="col-sm-4" id="fee-quick-summary-panel">[\s\S]*?<\/div>(?=\s*<\/div>\s*$)/,
    quickSummaryHtml,
  );
}

function FeeDashboardSkeleton() {
  return (
    <div className="cis-fee-dashboard-skeleton card shadow-sm">
      <div className="card-body p-4">
        <div className="cis-fee-skeleton-bar" />
        <div className="row g-3">
          <div className="col-md-4"><div className="cis-fee-skeleton-panel" /></div>
          <div className="col-md-4"><div className="cis-fee-skeleton-panel" /></div>
          <div className="col-md-4"><div className="cis-fee-skeleton-panel" /></div>
        </div>
        <div className="cis-fee-skeleton-table" aria-hidden="true" />
      </div>
    </div>
  );
}

export default function FeeDashboard() {
  const { settings, menu, loading: shellLoading, error: shellError, reload } = useShellData();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [attendanceDate, setAttendanceDate] = useState(todayIso);
  const [html, setHtml] = useState('');
  const [extraStyles, setExtraStyles] = useState('');
  const reportRef = useRef(null);
  const requestIdRef = useRef(0);

  const openDrilldown = useCallback(async (params) => {
    try {
      const res = await api.post('/api/fees/dashboard/report', params);
      printReportHtml(res.data.html || '');
    } catch (err) {
      window.alert(err.response?.data?.message || 'Unable to open fee drill-down report');
    }
  }, []);

  reportRef.current = openDrilldown;

  useEffect(() => {
    window.call_fee_report = (yearIndex) => {
      const checkbox = document.getElementById(`fee_report_${yearIndex}`);
      const detail = document.getElementById(`fee_detail_${yearIndex}`);
      const summary = document.getElementById(`feedetail_${yearIndex}`);
      const showDetail = checkbox?.checked === true;
      if (detail) detail.style.display = showDetail ? 'block' : 'none';
      if (summary) summary.style.display = showDetail ? 'none' : 'block';
    };

    window.callFeeReport = (
      course,
      ayear,
      atype,
      cyear,
      cdate,
      ctype,
      fcat,
      hostel,
      examination,
      stationary,
    ) => {
      reportRef.current?.({
        course,
        ayear,
        atype,
        cyear,
        cdate,
        ctype,
        fcat: fcat || '',
        hostel: hostel ?? '0',
        examination: examination ?? '0',
        stationary: stationary ?? '0',
      });
    };

    return () => {
      delete window.call_fee_report;
      delete window.callFeeReport;
    };
  }, []);

  const loadDashboard = useCallback(async (dateIso, options = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const showSpinner = options.showSpinner !== false;
    const cached = readSessionCache(dateIso);

    if (cached?.html) {
      setHtml(cached.html);
      setExtraStyles(cached.styles || '');
      if (!options.forceRefresh) return;
    }

    if (showSpinner) setGenerating(true);
    setError(null);

    try {
      const summaryRes = await api.post('/api/fees/dashboard', {
        attendanceDate: toDisplayDate(dateIso),
        phase: 'summary',
      });
      if (requestId !== requestIdRef.current) return;

      setHtml(summaryRes.data.html || '');
      setExtraStyles(summaryRes.data.styles || '');

      const tablePromise = api.post('/api/fees/dashboard', {
        attendanceDate: toDisplayDate(dateIso),
        phase: 'table',
      });
      const kpisPromise = api.post('/api/fees/dashboard', {
        attendanceDate: toDisplayDate(dateIso),
        phase: 'kpis',
      });

      const tableRes = await tablePromise;
      if (requestId !== requestIdRef.current) return;

      const partialHtml = injectSummaryTable(summaryRes.data.html || '', tableRes.data.summaryTable || '');
      setHtml(partialHtml);
      if (showSpinner) setGenerating(false);

      const kpisRes = await kpisPromise;
      if (requestId !== requestIdRef.current) return;

      const mergedHtml = injectQuickSummary(partialHtml, kpisRes.data.quickSummaryHtml || '');
      setHtml(mergedHtml);
      writeSessionCache(dateIso, mergedHtml, summaryRes.data.styles || '');
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err.response?.data?.message || 'Unable to load fee dashboard');
      if (!cached?.html) {
        setHtml('');
        setExtraStyles('');
      }
    } finally {
      if (requestId === requestIdRef.current && showSpinner) setGenerating(false);
    }
  }, []);

  useEffect(() => {
    if (!shellLoading) {
      const initialDate = todayIso();
      const cached = readSessionCache(initialDate);
      loadDashboard(initialDate, { showSpinner: !cached?.html });
    }
    return () => {
      requestIdRef.current += 1;
    };
  }, [shellLoading, loadDashboard]);

  return (
    <FeePageShell
      settings={settings}
      menu={menu}
      loading={shellLoading}
      error={shellError}
      onRetry={reload}
      dashboardTitle={META.title}
      breadcrumbs={feeScreenBreadcrumbs('dashboard')}
      title={META.title}
      legacy={META.legacy}
      actions={feeBackAction()}
    >
      <form
        className="card shadow-sm cis-fee-dashboard-filter"
        onSubmit={(e) => {
          e.preventDefault();
          loadDashboard(attendanceDate, { forceRefresh: true });
        }}
      >
        <div className="card-body row g-3 align-items-end">
          <div className="col-md-4 col-lg-3">
            <label className="form-label" htmlFor="fee-dashboard-date">As on date</label>
            <input
              id="fee-dashboard-date"
              type="date"
              className="form-control"
              max={todayIso()}
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
            />
          </div>
          <div className="col-md-4 col-lg-3">
            <button type="submit" className="btn btn-primary" disabled={generating}>
              {generating ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>
      </form>

      {(error || shellError) && <div className="alert alert-danger">{error || shellError}</div>}

      <div className={`cis-fee-dashboard-body ${generating ? 'is-loading' : ''}`}>
        {generating && html && (
          <div className="cis-fee-dashboard-progress" role="status">
            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
            Updating dashboard…
          </div>
        )}

        {generating && !html && <FeeDashboardSkeleton />}

        {html && (
          <div className="fee-dashboard-root legacy-widget-root card shadow-sm">
            {extraStyles ? <style>{extraStyles}</style> : null}
            <div className="card-body p-0" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        )}
      </div>
    </FeePageShell>
  );
}
