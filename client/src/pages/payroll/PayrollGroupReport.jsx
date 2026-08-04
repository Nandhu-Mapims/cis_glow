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

export default function PayrollGroupReport() {
  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Loading…');
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [payrollMonths, setPayrollMonths] = useState([]);
  const [searchCategory, setSearchCategory] = useState([]);
  const [reportFor, setReportFor] = useState('');

  const clearReport = useCallback(() => {
    setResultsVisible(false);
    setData((prev) => clearPayrollReportData(prev));
  }, []);

  const loadReport = useCallback(async (fields = {}, options = {}) => {
    const isGenerate = fields.Submit === 'Generate';
    const label = options.label || (isGenerate ? 'Generating group report…' : 'Refreshing…');
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
      const res = await api.post('/api/payroll/group-report', { fields });
      setData(res.data);
      const selected = res.data.selected || {};
      setPayrollMonths(selected.payrollMonths || []);
      setSearchCategory(selected.searchCategory || []);
      setReportFor(selected.reportFor || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load payroll group report');
      setData((prev) => ({
        ...(prev || {}),
        reportHtml: '',
        canPrint: false,
      }));
    } finally {
      setBusy(false);
    }
  }, [clearReport]);

  useEffect(() => {
    const init = async () => {
      try {
        await loadReport({}, { label: 'Loading group report…' });
      } catch (err) {
        setError(err.message || 'Unable to initialize group report');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadReport]);

  const onMonthsChange = async (e) => {
    const values = Array.from(e.target.selectedOptions).map((opt) => opt.value);
    setPayrollMonths(values);
    setSearchCategory([]);
    setReportFor('');
    if (values.length) {
      await loadReport({ payroll_month: values }, { label: 'Loading categories…' });
    } else {
      clearReport();
    }
  };

  const generateReport = async (e) => {
    e.preventDefault();
    await loadReport({
      payroll_month: payrollMonths,
      search_category: searchCategory,
      report_for: reportFor,
      Submit: 'Generate',
    }, { label: 'Generating group report…' });
  };

  const showReportPanel = resultsVisible || busy;
  const busyUi = resolvePayrollBusyUi({ busy, busyLabel, showPanel: showReportPanel });
  const canGenerate = payrollMonths.length && searchCategory.length && reportFor;

  if (loading) {
    return <PayrollPageLoader label="Loading group report…" />;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Payroll Group Report' }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/payroll">Payroll</Link></li>
          <li className="breadcrumb-item active">Group Report</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="dashboard-title mb-0">Payroll Group Report</h3>
          <p className="text-muted small mb-0">Native SQL multi-month comparison</p>
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
            <label className="form-label">Months</label>
            <select
              className="form-select"
              multiple
              required
              disabled={busy}
              value={payrollMonths}
              onChange={onMonthsChange}
              size={5}
            >
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
              disabled={busy || !payrollMonths.length}
              value={searchCategory}
              onChange={(e) => {
                setSearchCategory(Array.from(e.target.selectedOptions).map((o) => o.value));
                clearReport();
              }}
              size={5}
            >
              {!payrollMonths.length ? (
                <option value="" disabled>Select month first</option>
              ) : (
                (data?.categoryOptions || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))
              )}
            </select>
          </div>
          <div className="col-12">
            <label className="form-label d-block">Report</label>
            <div className="d-flex flex-wrap gap-3">
              {(data?.reportTypeOptions || []).filter((opt) => opt.visible).map((opt) => (
                <label key={opt.value}>
                  <input className="me-2"
                    type="radio"
                    name="report_for"
                    value={opt.value}
                    checked={reportFor === opt.value}
                    disabled={busy}
                    onChange={(e) => {
                      setReportFor(e.target.value);
                      clearReport();
                    }}
                  />
                  {' '}{opt.label}
                </label>
              ))}
            </div>
          </div>
          <div className="col-12">
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
        panelClassName="payroll-report-root"
        emptyFilterMessage="No group report data for the selected filters."
        hintMessage="Select months, category, and report type, then click Go."
      />
    </DashboardLayout>
  );
}
