import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import '../exam/ExamSetupPage.css';

const PDF_GENERATE_TIMEOUT_MS = 120000;

export default function StipendIndividualPdfReport() {
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [payrollMonth, setPayrollMonth] = useState('');
  const [copyType, setCopyType] = useState('Original Copy');

  const loadReport = useCallback(async (fields = {}, { generating = false } = {}) => {
    if (generating) {
      setBusy(true);
    } else {
      setFormLoading(true);
    }
    setError(null);
    try {
      const request = generating
        ? api.post('/api/payroll/stipend/individual-pdf', { fields }, { timeout: PDF_GENERATE_TIMEOUT_MS })
        : api.get('/api/payroll/stipend/individual-pdf');
      const res = await request;
      setData(res.data);
      const selected = res.data.selected || {};
      setPayrollMonth(selected.payrollMonth || '');
      setCopyType(selected.copyType || 'Original Copy');
      if (res.data.downloadUrl) {
        window.open(res.data.downloadUrl, '_blank');
      }
    } catch (err) {
      const message = err.code === 'ECONNABORTED'
        ? 'PDF generation timed out. Try again or choose a month with fewer students.'
        : (err.response?.data?.message || 'Unable to generate stipend PDF');
      setError(message);
      if (!generating) setData(null);
    } finally {
      if (generating) setBusy(false);
      else setFormLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const [settingsRes, menuRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
          loadReport(),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
      } catch (err) {
        setError(err.message || 'Unable to initialize stipend PDF report');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadReport]);

  const generatePdf = async (e) => {
    e.preventDefault();
    await loadReport({
      payroll_month: payrollMonth,
      copy_type: copyType,
      Submit: 'Generate',
    }, { generating: true });
  };

  if (loading) {
    return <div className="p-4 text-muted">Loading...</div>;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Stipend PDF Report' }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/payroll">Payroll</Link></li>
          <li className="breadcrumb-item"><Link to="/payroll/stipend">Stipend</Link></li>
          <li className="breadcrumb-item active">PDF</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="dashboard-title mb-0">Stipend Individual PDF</h3>
          <p className="text-muted small mb-0">Password-protected payslip PDF bundle</p>
        </div>
        <Link to="/payroll/stipend" className="btn btn-outline-secondary btn-sm">Back</Link>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {busy && (
        <div className="alert alert-info py-2">
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
          Building PDF bundle — this can take 10–30 seconds for a full month.
        </div>
      )}

      {data?.generated && data?.downloadUrl && (
        <div className="alert alert-success">
          PDF ready:{' '}
          <a href={data.downloadUrl} target="_blank" rel="noreferrer">{data.filename}</a>
          {data.passwordHint && (
            <div className="small mt-1">
              Password: first 3 letters of month + 4-digit year (e.g. <code>{data.passwordHint}</code>)
            </div>
          )}
        </div>
      )}

      <form onSubmit={generatePdf} className="card shadow-sm exam-setup-card mb-3">
        <div className="card-body row g-3">
          <div className="col-md-4">
            <label className="form-label">Month</label>
            <select
              className="form-select"
              required
              value={payrollMonth}
              onChange={(e) => setPayrollMonth(e.target.value)}
              disabled={formLoading || busy}
            >
              <option value="">{formLoading ? 'Loading months…' : '-Select Month-'}</option>
              {(data?.monthOptions || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="col-12">
            <label className="form-label d-block">Copy</label>
            {['Original Copy', 'Duplicate Copy', 'Default Copy'].map((value) => (
              <label key={value} className="me-3">
                <input
                  type="radio"
                  name="copy_type"
                  value={value}
                  checked={copyType === value}
                  onChange={(e) => setCopyType(e.target.value)}
                  disabled={busy}
                />
                {' '}{value.replace(' Copy', '')}
              </label>
            ))}
          </div>
          <div className="col-12">
            <button type="submit" className="btn btn-danger" disabled={busy || formLoading || !payrollMonth}>
              {busy ? 'Generating…' : 'Go'}
            </button>
          </div>
          <div className="col-12">
            <p className="text-muted small mb-0">
              Note: Password for the output file is the first 3 characters of the month followed by the 4-digit year
              (e.g. jan2017, dec2016).
            </p>
          </div>
        </div>
      </form>
    </DashboardLayout>
  );
}
