import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import { serializeLegacyForm } from '../../utils/legacyFormSerialize';
import { loadPayrollAssets } from '../../utils/payrollAssets';
import { printReportHtml } from '../../utils/printReport';
import '../exam/ExamSetupPage.css';

export default function StipendAjaxReportPage({
  apiPath,
  moreApiPath,
  legacyMorePattern,
  title,
  legacyFile,
  breadcrumbLabel,
  emptyHint = 'Select filters, then click Generate.',
  showPrint = false,
}) {
  const containerRef = useRef(null);
  const scriptRef = useRef(null);
  const pageStyleRef = useRef(null);
  const printStyleRef = useRef(null);
  const ajaxActiveRef = useRef(false);

  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [html, setHtml] = useState('');
  const [scripts, setScripts] = useState('');
  const [pageStyles, setPageStyles] = useState('');
  const [inlineStyles, setInlineStyles] = useState('');

  const loadForm = useCallback(async (fields = {}) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post(apiPath, { fields });
      setHtml(res.data.html || '');
      setScripts(res.data.scripts || '');
      setPageStyles(res.data.pageStyles || '');
      setInlineStyles(res.data.styles || '');
    } catch (err) {
      setError(err.response?.data?.message || `Unable to load ${title.toLowerCase()}`);
      setHtml('');
      setScripts('');
      setPageStyles('');
      setInlineStyles('');
    } finally {
      setBusy(false);
    }
  }, [apiPath, title]);

  useEffect(() => {
    const init = async () => {
      try {
        await loadPayrollAssets();
        await loadForm();
      } catch (err) {
        setError(err.message || `Unable to initialize ${title.toLowerCase()}`);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadForm, title]);

  useEffect(() => {
    if (pageStyleRef.current) {
      pageStyleRef.current.remove();
      pageStyleRef.current = null;
    }
    if (printStyleRef.current) {
      printStyleRef.current.remove();
      printStyleRef.current = null;
    }
    if (pageStyles && containerRef.current) {
      const style = document.createElement('style');
      style.textContent = pageStyles;
      containerRef.current.appendChild(style);
      pageStyleRef.current = style;
    }
    if (inlineStyles && containerRef.current) {
      const style = document.createElement('style');
      style.textContent = inlineStyles.replace(/<link[^>]*>/gi, '');
      containerRef.current.appendChild(style);
      printStyleRef.current = style;
    }
  }, [html, pageStyles, inlineStyles]);

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
    ajaxActiveRef.current = Boolean(html);
  }, [html]);

  useEffect(() => {
    if (!window.jQuery || !legacyMorePattern) return undefined;
    const $ = window.jQuery;
    const prefilter = (options) => {
      if (!ajaxActiveRef.current) return;
      const url = options.url || '';
      if (!url.includes(legacyMorePattern)) return;
      const query = url.includes('?') ? url.split('?')[1] : '';
      options.url = `${moreApiPath}${query ? `?${query}` : ''}`;
    };
    $.ajaxPrefilter(prefilter);
    return () => {
      ajaxActiveRef.current = false;
    };
  }, [legacyMorePattern, moreApiPath]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !html) return undefined;

    const form = root.querySelector('#signupForm');
    if (!form) return undefined;

    const onSubmit = async (event) => {
      event.preventDefault();
      const fields = serializeLegacyForm(form, event.submitter);
      await loadForm(fields);
    };

    form.addEventListener('submit', onSubmit);
    return () => form.removeEventListener('submit', onSubmit);
  }, [html, loadForm]);

  if (loading) {
    return <div className="p-4 text-muted">Loading...</div>;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/payroll">Payroll</Link></li>
          <li className="breadcrumb-item"><Link to="/payroll/stipend">Stipend</Link></li>
          <li className="breadcrumb-item active">{breadcrumbLabel}</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="dashboard-title mb-0">{title}</h3>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {showPrint && html && (
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
          <Link to="/payroll/stipend" className="btn btn-outline-secondary btn-sm">Back</Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {busy && <div className="text-muted small mb-2">Loading…</div>}

      <div className="card shadow-sm exam-setup-card">
        <div className="card-body stipend-ajax-report-root" ref={containerRef}>
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
