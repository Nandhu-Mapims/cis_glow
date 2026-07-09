import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import { serializeLegacyForm } from '../../utils/legacyFormSerialize';
import { loadPayrollAssets } from '../../utils/payrollAssets';
import { printReportHtml } from '../../utils/printReport';
import '../exam/ExamSetupPage.css';

export default function PayrollLegacyReportPage({
  apiPath,
  title,
  legacyFile,
  breadcrumbLabel,
  hubPath = '/payroll',
  hubLabel = 'Payroll',
  emptyHint = 'Select filters, then click Go.',
}) {
  const containerRef = useRef(null);
  const scriptRef = useRef(null);
  const styleRef = useRef(null);

  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [html, setHtml] = useState('');
  const [scripts, setScripts] = useState('');
  const [inlineStyles, setInlineStyles] = useState('');

  const loadReport = useCallback(async (fields = {}) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post(apiPath, { fields });
      setHtml(res.data.html || '');
      setScripts(res.data.scripts || '');
      setInlineStyles(res.data.styles || '');
    } catch (err) {
      setError(err.response?.data?.message || `Unable to load ${title.toLowerCase()}`);
      setHtml('');
      setScripts('');
      setInlineStyles('');
    } finally {
      setBusy(false);
    }
  }, [apiPath, title]);

  useEffect(() => {
    const init = async () => {
      try {
        await loadPayrollAssets();
        const [settingsRes, menuRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
        await loadReport();
      } catch (err) {
        setError(err.message || `Unable to initialize ${title.toLowerCase()}`);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadReport, title]);

  useEffect(() => {
    if (styleRef.current) {
      styleRef.current.remove();
      styleRef.current = null;
    }
    if (inlineStyles) {
      const style = document.createElement('style');
      style.textContent = inlineStyles.replace(/<link[^>]*>/gi, '');
      containerRef.current?.appendChild(style);
      styleRef.current = style;
    }
  }, [html, inlineStyles]);

  useEffect(() => {
    if (scriptRef.current) {
      scriptRef.current.remove();
      scriptRef.current = null;
    }
    if (!scripts || !containerRef.current) return;
    const script = document.createElement('script');
    script.textContent = scripts;
    containerRef.current.appendChild(script);
    scriptRef.current = script;
  }, [html, scripts]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !html) return undefined;

    const form = root.querySelector('#signupForm');
    if (!form) return undefined;

    const onSubmit = async (event) => {
      event.preventDefault();
      const fields = serializeLegacyForm(form, event.submitter);
      await loadReport(fields);
    };

    form.addEventListener('submit', onSubmit);
    return () => form.removeEventListener('submit', onSubmit);
  }, [html, loadReport]);

  if (loading) {
    return <div className="p-4 text-muted">Loading...</div>;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/payroll">Payroll</Link></li>
          {hubPath !== '/payroll' && (
            <li className="breadcrumb-item"><Link to={hubPath}>{hubLabel}</Link></li>
          )}
          <li className="breadcrumb-item active">{breadcrumbLabel}</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="dashboard-title mb-0">{title}</h3>
          <p className="text-muted small mb-0">Legacy: {legacyFile}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {html && (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={() => {
                const el = containerRef.current?.querySelector('#att_report_span');
                if (el) printReportHtml(el.innerHTML);
              }}
            >
              Print
            </button>
          )}
          <Link to={hubPath} className="btn btn-outline-secondary btn-sm">Back</Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {busy && <div className="text-muted small mb-2">Loading…</div>}

      <div className="card shadow-sm exam-setup-card">
        <div className="card-body payroll-legacy-report-root" ref={containerRef}>
          {html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            !busy && <p className="text-muted mb-0">{emptyHint}</p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
