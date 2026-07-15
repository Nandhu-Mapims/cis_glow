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

function PayrollFilterReport({ title, apiPath, legacy, reportTypeField = null }) {
  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Loading…');
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [payrollMonth, setPayrollMonth] = useState('');
  const [payrollFmonth, setPayrollFmonth] = useState('');
  const [payrollTmonth, setPayrollTmonth] = useState('');
  const [searchCategory, setSearchCategory] = useState([]);
  const [reportType, setReportType] = useState('Statement');
  const [reportFor, setReportFor] = useState([]);
  const [resultsVisible, setResultsVisible] = useState(false);

  const isMonthly = apiPath.includes('monthly');
  const generateLabel = `Generating ${title.toLowerCase()}…`;

  const clearReport = useCallback(() => {
    setResultsVisible(false);
    setData((prev) => clearPayrollReportData(prev));
  }, []);

  const loadReport = useCallback(async (fields = {}, options = {}) => {
    const isGenerate = fields.Submit === 'Generate';
    const label = options.label || (isGenerate ? generateLabel : 'Refreshing…');
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
      const res = await api.post(apiPath, { fields });
      setData(res.data);
      const sel = res.data.selected || {};
      setPayrollMonth(sel.payrollMonth || '');
      setPayrollFmonth(sel.payrollFmonth || '');
      setPayrollTmonth(sel.payrollTmonth || '');
      setSearchCategory(sel.searchCategory || []);
      setReportType(sel.reportType || 'Statement');
      setReportFor(sel.reportFor || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load report');
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
  }, [apiPath, clearReport, generateLabel]);

  useEffect(() => {
    const init = async () => {
      try {
        await loadReport({}, { label: `Loading ${title.toLowerCase()}…` });
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadReport, title]);

  const generate = async (e) => {
    e.preventDefault();
    const fields = { Submit: 'Generate', search_category: searchCategory };
    if (isMonthly) {
      fields.payroll_fmonth = payrollFmonth;
      fields.payroll_tmonth = payrollTmonth;
      fields.report_for = reportFor;
    } else {
      fields.payroll_month = payrollMonth;
      if (reportTypeField) fields[reportTypeField] = reportType || 'Statement';
    }
    await loadReport(fields, { label: generateLabel });
  };

  const onMonthChange = async (month) => {
    setPayrollMonth(month);
    setSearchCategory([]);
    const fields = { payroll_month: month };
    if (reportTypeField && reportType) fields[reportTypeField] = reportType;
    await loadReport(fields, { label: 'Loading categories…' });
  };

  const showReportPanel = resultsVisible || busy;
  const busyUi = resolvePayrollBusyUi({ busy, busyLabel, showPanel: showReportPanel });
  const categoryPlaceholder = busy && payrollMonth ? 'Loading categories…' : 'Select categories';
  const canGenerate = isMonthly
    ? payrollFmonth && payrollTmonth && reportFor.length
    : payrollMonth && searchCategory.length;

  if (loading) {
    return <PayrollPageLoader label={`Loading ${title.toLowerCase()}…`} />;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/payroll">Payroll</Link></li>
          <li className="breadcrumb-item active">{title}</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="dashboard-title mb-0">{title}</h3>
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

      <form onSubmit={generate} className="card shadow-sm exam-setup-card mb-3">
        <div className="card-body row g-3 align-items-end">
          {isMonthly ? (
            <>
              <div className="col-md-3">
                <label className="form-label">From Month</label>
                <select
                  className="form-select"
                  required
                  disabled={busy}
                  value={payrollFmonth}
                  onChange={(e) => {
                    setPayrollFmonth(e.target.value);
                    clearReport();
                  }}
                >
                  <option value="">-From-</option>
                  {(data?.monthOptions || []).map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">To Month</label>
                <select
                  className="form-select"
                  required
                  disabled={busy}
                  value={payrollTmonth}
                  onChange={(e) => {
                    setPayrollTmonth(e.target.value);
                    clearReport();
                  }}
                >
                  <option value="">-To-</option>
                  {(data?.monthOptions || []).map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Report Columns</label>
                <select
                  className="form-select"
                  multiple
                  required
                  disabled={busy}
                  value={reportFor}
                  onChange={(e) => {
                    setReportFor(Array.from(e.target.selectedOptions).map((o) => o.value));
                    clearReport();
                  }}
                  size={4}
                >
                  {(data?.reportForOptions || []).map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            </>
          ) : (
            <div className="col-md-4">
              <label className="form-label">Month</label>
              <select
                className="form-select"
                required
                disabled={busy}
                value={payrollMonth}
                onChange={(e) => onMonthChange(e.target.value)}
              >
                <option value="">-Select-</option>
                {(data?.monthOptions || []).map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          )}
          <div className="col-md-4">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              multiple
              required
              disabled={busy || (!isMonthly && !payrollMonth)}
              value={searchCategory}
              onChange={(e) => {
                setSearchCategory(Array.from(e.target.selectedOptions).map((o) => o.value));
                clearReport();
              }}
              size={4}
            >
              {!isMonthly && !payrollMonth ? (
                <option value="" disabled>Select month first</option>
              ) : !(data?.categoryOptions || []).length && busy && !isMonthly ? (
                <option value="" disabled>{categoryPlaceholder}</option>
              ) : (
                (data?.categoryOptions || []).map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)
              )}
            </select>
          </div>
          {reportTypeField && (
            <div className="col-md-4">
              <label className="form-label d-block">Show</label>
              <div className="d-flex flex-wrap gap-3 pt-1">
                {(data?.reportTypeOptions || [
                  { value: 'Statement', label: 'Statement' },
                  { value: 'Report', label: 'Report' },
                ]).map((opt) => (
                  <label key={opt.value} className="form-check-label">
                    <input
                      type="radio"
                      className="form-check-input me-1"
                      name="report_type"
                      value={opt.value}
                      checked={reportType === opt.value}
                      disabled={busy}
                      onChange={(e) => {
                        setReportType(e.target.value);
                        clearReport();
                      }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="col-md-2">
            <PayrollGenerateButton
              busy={busy}
              busyLabel={busyLabel}
              generatingPrefix="Generating"
              compactBusy={busyUi.compactButton}
              className="btn btn-danger"
              disabled={!canGenerate}
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
        panelClassName="payroll-report-root att_report_span"
        emptyFilterMessage={`No ${title.toLowerCase()} data for the selected filters.`}
        hintMessage="Select filters and click Go to generate the report."
      />
    </DashboardLayout>
  );
}

export function PayrollAttReport() {
  return (
    <PayrollFilterReport
      title="Attendance Report"
      apiPath="/api/payroll/att-report"
      legacy="payroll_report.php"
      reportTypeField="report_type"
    />
  );
}

export function PayrollMonthlyReport() {
  return (
    <PayrollFilterReport
      title="Monthly Payroll Report"
      apiPath="/api/payroll/monthly-report"
      legacy="payroll_monthly_report.php"
    />
  );
}

export function PayrollTaxReport() {
  return (
    <PayrollFilterReport
      title="Tax Report"
      apiPath="/api/payroll/tax-report"
      legacy="staff_tax_report.php"
      reportTypeField="report_type"
    />
  );
}

export default PayrollAttReport;
