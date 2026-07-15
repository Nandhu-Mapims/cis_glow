import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import { printReportHtml } from '../../utils/printReport';
import './PayrollReport.css';
import '../exam/ExamSetupPage.css';

function splitConsolidatedReportHtml(html) {
  if (!html) return { headerHtml: '', tableHtml: '', signatureHtml: '' };
  const signatureStart = html.search(/<table[^>]*class="[^"]*signature_table/i);
  const body = signatureStart >= 0 ? html.slice(0, signatureStart).trim() : html;
  const signatureHtml = signatureStart >= 0 ? html.slice(signatureStart).trim() : '';
  const tableStart = body.search(/<table/i);
  if (tableStart < 0) {
    return { headerHtml: body, tableHtml: '', signatureHtml };
  }
  return {
    headerHtml: body.slice(0, tableStart).trim(),
    tableHtml: body.slice(tableStart).trim(),
    signatureHtml,
  };
}

export default function PayrollConsolidatedReport() {
  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const reportRef = useRef(null);

  const loadReport = useCallback(async (fields = {}) => {
    setBusy(true);
    setError(null);
    if (fields.Submit === 'Generate') {
      setData((prev) => (prev ? { ...prev, reportHtml: '' } : prev));
    }
    try {
      const res = await api.post('/api/payroll/consolidated-report', { fields });
      setData(res.data);
      setSelectedMonths(res.data.selectedMonths || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load consolidated payroll report');
      setData(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await loadReport();
      } catch (err) {
        setError(err.message || 'Unable to initialize consolidated report');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadReport]);

  const onMonthChange = (e) => {
    const values = Array.from(e.target.selectedOptions).map((opt) => opt.value);
    setSelectedMonths(values);
  };

  const generateReport = async (e) => {
    e.preventDefault();
    await loadReport({ payroll_month: selectedMonths, Submit: 'Generate' });
  };

  const reportParts = useMemo(
    () => splitConsolidatedReportHtml(data?.reportHtml || ''),
    [data?.reportHtml],
  );

  if (loading) {
    return <div className="p-4 text-muted">Loading...</div>;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Payroll Consolidated Report' }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/payroll">Payroll</Link></li>
          <li className="breadcrumb-item active">Consolidated Report</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="dashboard-title mb-0">Payroll Consolidated Report</h3>
          <p className="text-muted small mb-0">Native SQL from staff_payroll_tb</p>
        </div>
        <div className="d-flex gap-2">
          {data?.reportHtml && (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={() => {
                const el = reportRef.current;
                if (el) printReportHtml(el.innerHTML, 'payroll-consolidated');
              }}
            >
              Print
            </button>
          )}
          <Link to="/payroll" className="btn btn-outline-secondary btn-sm">Back</Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {busy && <div className="text-muted small mb-2">Loading…</div>}

      <form onSubmit={generateReport} className="card shadow-sm exam-setup-card mb-3">
        <div className="card-body row g-3 align-items-end">
          <div className="col-md-6">
            <label className="form-label">Month (multi-select)</label>
            <select
              className="form-select"
              multiple
              required
              value={selectedMonths}
              onChange={onMonthChange}
              size={Math.min(8, Math.max(4, (data?.monthOptions || []).length))}
            >
              {(data?.monthOptions || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <button type="submit" className="btn btn-danger" disabled={busy || !selectedMonths.length}>
              {busy ? 'Generating…' : 'Go'}
            </button>
          </div>
        </div>
      </form>

      {data?.reportHtml ? (
        <div className="card shadow-sm payroll-consolidated-report-root" ref={reportRef}>
          <div className="card-body">
            {reportParts.headerHtml ? (
              <div dangerouslySetInnerHTML={{ __html: reportParts.headerHtml }} />
            ) : null}
            <div className="payroll-report-table-scroll">
              <div dangerouslySetInnerHTML={{ __html: reportParts.tableHtml }} />
            </div>
            {reportParts.signatureHtml ? (
              <div dangerouslySetInnerHTML={{ __html: reportParts.signatureHtml }} />
            ) : null}
          </div>
        </div>
      ) : busy && selectedMonths.length ? (
        <div className="card shadow-sm">
          <div className="card-body text-muted small">Generating report…</div>
        </div>
      ) : (
        !busy && <p className="text-muted">Select one or more months, then click Go.</p>
      )}
    </DashboardLayout>
  );
}
