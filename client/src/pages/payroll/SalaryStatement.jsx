import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import { printReportHtml } from '../../utils/printReport';
import '../exam/ExamSetupPage.css';
import './PayrollReport.css';
import {
  clearPayrollReportData,
  PayrollBusyBanner,
  PayrollGenerateButton,
  PayrollPageLoader,
  PayrollReportResults,
  resolvePayrollBusyUi,
} from './PayrollReportLoading';

export default function SalaryStatement() {
  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Loading…');
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [payrollMonth, setPayrollMonth] = useState('');
  const [searchCategory, setSearchCategory] = useState([]);
  const [rowPerPage, setRowPerPage] = useState(27);
  const [resultsVisible, setResultsVisible] = useState(false);

  const clearReport = useCallback(() => {
    setResultsVisible(false);
    setData((prev) => clearPayrollReportData(prev));
  }, []);

  const loadReport = useCallback(async (fields = {}, options = {}) => {
    const isGenerate = fields.Submit === 'Generate';
    const label = options.label || (isGenerate ? 'Generating salary statement…' : 'Refreshing…');
    setBusy(true);
    setBusyLabel(label);
    setError(null);
    if (isGenerate || fields.payroll_month) {
      clearReport();
    }
    if (isGenerate) {
      setResultsVisible(true);
    }
    try {
      const res = await api.post('/api/payroll/salary-statement', { fields });
      setData(res.data);
      const selected = res.data.selected || {};
      setPayrollMonth(selected.payrollMonth || '');
      setSearchCategory(selected.searchCategory || []);
      setRowPerPage(selected.rowPerPage || 27);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to load salary statement');
      setData((prev) => ({
        ...(prev || {}),
        reportHtml: '',
        canPrint: false,
        reportEmpty: false,
        reportMessage: '',
      }));
    } finally {
      setBusy(false);
    }
  }, [clearReport]);

  useEffect(() => {
    const init = async () => {
      try {
        await loadReport({}, { label: 'Loading salary statement…' });
      } catch (err) {
        setError(err.message || 'Unable to initialize salary statement');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadReport]);

  const onMonthChange = async (value) => {
    setPayrollMonth(value);
    setSearchCategory([]);
    await loadReport({ payroll_month: value }, { label: 'Loading categories…' });
  };

  const generateReport = async (e) => {
    e.preventDefault();
    await loadReport({
      payroll_month: payrollMonth,
      search_category: searchCategory,
      row_per_page: rowPerPage,
      Submit: 'Generate',
    }, { label: 'Generating salary statement…' });
  };

  const showReportPanel = resultsVisible || busy;
  const busyUi = resolvePayrollBusyUi({ busy, busyLabel, showPanel: showReportPanel });
  const categoryPlaceholder = busy && payrollMonth ? 'Loading categories…' : 'Select categories';

  if (loading) {
    return <PayrollPageLoader label="Loading salary statement…" />;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Salary Statement' }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/payroll">Payroll</Link></li>
          <li className="breadcrumb-item active">Salary Statement</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="dashboard-title mb-0">Salary Statement</h3>
          <p className="text-muted small mb-0">Native SQL per-staff statement</p>
        </div>
        <div className="d-flex gap-2">
          {data?.reportHtml && !busy && (
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => printReportHtml(data.reportHtml)}>Print</button>
          )}
          <Link to="/payroll" className="btn btn-outline-secondary btn-sm">Back</Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      <PayrollBusyBanner busy={busyUi.showBanner} label={busyLabel} />

      <form onSubmit={generateReport} className="card shadow-sm exam-setup-card mb-3">
        <div className="card-body row g-3">
          <div className="col-md-4">
            <label className="form-label">Month</label>
            <select
              className="form-select"
              required
              value={payrollMonth}
              disabled={busy}
              onChange={(e) => onMonthChange(e.target.value)}
            >
              <option value="">-Select Month-</option>
              {(data?.monthOptions || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              multiple
              required
              disabled={busy || !payrollMonth}
              value={searchCategory}
              onChange={(e) => {
                setSearchCategory(Array.from(e.target.selectedOptions).map((o) => o.value));
                clearReport();
              }}
              size={5}
            >
              {!payrollMonth ? (
                <option value="" disabled>Select month first</option>
              ) : !(data?.categoryOptions || []).length && busy ? (
                <option value="" disabled>{categoryPlaceholder}</option>
              ) : (
                (data?.categoryOptions || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))
              )}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label">Row Per Page</label>
            <input
              className="form-control"
              value={rowPerPage}
              disabled={busy}
              onChange={(e) => {
                setRowPerPage(e.target.value);
                clearReport();
              }}
            />
          </div>
          <div className="col-12">
            <PayrollGenerateButton
              busy={busy}
              busyLabel={busyLabel}
              generatingPrefix="Generating"
              compactBusy={busyUi.compactButton}
              disabled={!payrollMonth || !searchCategory.length}
            />
          </div>
        </div>
      </form>

      <PayrollReportResults
        busy={busy}
        overlayBusy={busyUi.overlayBusy}
        busyLabel={busyLabel}
        showPanel={showReportPanel}
        reportHtml={data?.reportHtml}
        reportEmpty={data?.reportEmpty}
        reportMessage={data?.reportMessage}
        emptyFilterMessage="No salary statement data for the selected filters."
        hintMessage="Select month and category, then click Go."
      />
    </DashboardLayout>
  );
}
