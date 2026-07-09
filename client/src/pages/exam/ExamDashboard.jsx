import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useShellData } from '../../hooks/useShellData';
import { buildExamDashboardPrintHtml } from '../../utils/examDashboardPrint';
import { printReportHtml } from '../../utils/printReport';
import './ExamSetupPage.css';

const EXAM_DASHBOARD_CACHE_KEY = 'cis_exam_dashboard_v3';
const CACHE_TTL_MS = 600_000;

function readSessionCache() {
  try {
    const raw = sessionStorage.getItem(EXAM_DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.html) return null;
    return {
      html: parsed.html,
      bannerUrl: parsed.bannerUrl || '',
      printMeta: parsed.printMeta || null,
      fresh: Date.now() - parsed.at < CACHE_TTL_MS,
    };
  } catch {
    return null;
  }
}

function writeSessionCache(payload) {
  try {
    sessionStorage.setItem(EXAM_DASHBOARD_CACHE_KEY, JSON.stringify({
      at: Date.now(),
      html: payload.html,
      bannerUrl: payload.bannerUrl || '',
      printMeta: payload.printMeta || null,
    }));
  } catch {
    // ignore quota errors
  }
}

export default function ExamDashboard() {
  const { settings, menu } = useShellData();
  const initialCache = readSessionCache();
  const [busy, setBusy] = useState(!initialCache?.html);
  const [error, setError] = useState(null);
  const [html, setHtml] = useState(initialCache?.html || '');
  const [bannerUrl, setBannerUrl] = useState(initialCache?.bannerUrl || '');
  const [printMeta, setPrintMeta] = useState(initialCache?.printMeta || null);

  const fetchDashboard = useCallback(async (refresh = false, { showSpinner = true } = {}) => {
    if (showSpinner) setBusy(true);
    setError(null);

    try {
      const res = await api.get('/api/exam/dashboard', {
        params: refresh ? { refresh: '1' } : undefined,
      });
      if (res.data.error) {
        setError(res.data.error);
        return;
      }
      const nextHtml = res.data.html || '';
      setHtml(nextHtml);
      setBannerUrl(res.data.bannerUrl || '');
      setPrintMeta(res.data.printMeta || null);
      if (nextHtml) {
        writeSessionCache({
          html: nextHtml,
          bannerUrl: res.data.bannerUrl || '',
          printMeta: res.data.printMeta || null,
        });
      }
    } catch (err) {
      const message = err.response?.data?.message
        || (err.code === 'ECONNABORTED' ? 'Exam dashboard request timed out' : null)
        || (err.message?.includes('Network Error') ? 'Could not reach server — is the API running?' : null)
        || 'Unable to load exam dashboard';
      setError(message);
    } finally {
      if (showSpinner) setBusy(false);
    }
  }, []);

  useEffect(() => {
    const cache = readSessionCache();
    fetchDashboard(false, { showSpinner: !cache?.html });
  }, [fetchDashboard]);

  const handlePrint = () => {
    if (!html) return;
    const body = buildExamDashboardPrintHtml({
      title: printMeta?.title || 'Exam Report',
      subtitleLine1: printMeta?.subtitleLine1 || '',
      dateRange: printMeta?.dateRange || '',
      bannerUrl,
      tablesHtml: html,
    });
    printReportHtml(body, 'exam-dashboard');
  };

  return (
    <DashboardLayout settings={settings || {}} dashboard={{ title: 'Exam Dashboard' }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/exam">Examination</Link></li>
          <li className="breadcrumb-item active">Dashboard</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="dashboard-title mb-0">Exam Dashboard</h3>
          <p className="text-muted small mb-0">Legacy: exam_dashboard.php</p>
        </div>
        <div className="d-flex gap-2">
          {html && (
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={handlePrint}>
              Print
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => fetchDashboard(true, { showSpinner: true })}
            disabled={busy}
          >
            Refresh
          </button>
          <Link to="/exam" className="btn btn-outline-secondary btn-sm">Back</Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {busy && !html && (
        <div className="alert alert-info py-2 mb-3">
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
          Loading exam dashboard…
        </div>
      )}
      {busy && html && <div className="text-muted small mb-2">Refreshing…</div>}

      <div className="card shadow-sm exam-setup-card exam-dashboard-page">
        <div className="card-body exam-dashboard-root p-0">
          {html ? (
            <div className="exam-dashboard-content" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            !busy && !error && <p className="text-muted mb-0">No exam dashboard data returned.</p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
