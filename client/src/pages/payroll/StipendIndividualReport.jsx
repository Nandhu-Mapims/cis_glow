import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import { buildAttendanceReportPrintHtml } from '../../utils/attendanceReportPrint';
import { printReportHtml } from '../../utils/printReport';
import '../exam/ExamSetupPage.css';
import {
  clearPayrollReportData,
  PayrollBusyBanner,
  PayrollGenerateButton,
  PayrollPageLoader,
  PayrollReportResults,
  resolvePayrollBusyUi,
} from './PayrollReportLoading';
import './PayrollReport.css';
import './stipendIndividualReport.css';

export default function StipendIndividualReport() {
  const reportRef = useRef(null);
  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Loading…');
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [payrollMonth, setPayrollMonth] = useState('');
  const [copyType, setCopyType] = useState('Original Copy');

  const clearReport = useCallback(() => {
    setResultsVisible(false);
    setData((prev) => clearPayrollReportData(prev));
  }, []);

  const loadReport = useCallback(async (fields = {}, options = {}) => {
    const isGenerate = fields.Submit === 'Generate';
    const label = options.label || (isGenerate ? 'Generating stipend individual report…' : 'Refreshing…');
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
      const res = await api.post('/api/payroll/stipend/individual-report', { fields });
      setData(res.data);
      const selected = res.data.selected || {};
      setPayrollMonth(selected.payrollMonth || '');
      setCopyType(selected.copyType || 'Original Copy');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to load stipend individual report');
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
        await loadReport({}, { label: 'Loading stipend individual report…' });
      } catch (err) {
        setError(err.message || 'Unable to initialize stipend individual report');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadReport]);

  const generateReport = async (e) => {
    e.preventDefault();
    await loadReport({
      payroll_month: payrollMonth,
      copy_type: copyType,
      Submit: 'Generate',
    }, { label: 'Generating stipend individual report…' });
  };

  const handlePrint = () => {
    if (!data?.reportHtml) return;
    if (data.printMeta) {
      const body = buildAttendanceReportPrintHtml({
        title: data.printMeta.title,
        subtitleLine1: data.printMeta.subtitleLine1,
        dateRange: data.printMeta.dateRange,
        bannerUrl: data.bannerUrl || '',
        tablesHtml: data.reportHtml,
      });
      printReportHtml(body, 'stipend-attendance-report');
      return;
    }
    const el = reportRef.current;
    if (el) printReportHtml(el.innerHTML, 'stipend-attendance-report');
  };

  const showReportPanel = resultsVisible || busy;
  const busyUi = resolvePayrollBusyUi({ busy, busyLabel, showPanel: showReportPanel });

  if (loading) {
    return <PayrollPageLoader label="Loading stipend individual report…" />;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Stipend Individual Report' }} menu={menu}>
      <div className="stipend-individual-report-root exam-setup-root">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb">
            <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
            <li className="breadcrumb-item"><Link to="/payroll">Payroll</Link></li>
            <li className="breadcrumb-item"><Link to="/payroll/stipend">Stipend</Link></li>
            <li className="breadcrumb-item active">Individual Report</li>
          </ol>
        </nav>

        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h3 className="dashboard-title mb-0">Stipend Individual Report</h3>
            <p className="text-muted small mb-0">
              Month-wide payroll dashboard and salary statement bundle.
            </p>
          </div>
          <div className="d-flex gap-2">
            {data?.reportHtml && data?.canPrint !== false && !busy && (
              <button type="button" className="btn btn-outline-primary btn-sm" onClick={handlePrint}>
                Print
              </button>
            )}
            <Link to="/payroll/stipend" className="btn btn-outline-secondary btn-sm">Back</Link>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        <PayrollBusyBanner busy={busyUi.showBanner} label={busyLabel} />

        <form onSubmit={generateReport} className="card shadow-sm exam-setup-card stipend-individual-report-filters mb-3">
          <div className="card-body row g-3 align-items-end">
            <div className="col-md-4">
              <label className="form-label">Month</label>
              <select
                className="form-select"
                required
                disabled={busy}
                value={payrollMonth}
                onChange={(e) => {
                  setPayrollMonth(e.target.value);
                  clearReport();
                }}
              >
                <option value="">-Select Month-</option>
                {(data?.monthOptions || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-5">
              <label className="form-label d-block">Copy</label>
              <div className="d-flex flex-wrap gap-3 stipend-copy-type-options">
                {['Original Copy', 'Duplicate Copy', 'Default Copy'].map((value) => (
                  <label key={value} className="stipend-copy-type-option">
                    <input
                      type="radio"
                      name="copy_type"
                      value={value}
                      checked={copyType === value}
                      disabled={busy}
                      onChange={(e) => {
                        setCopyType(e.target.value);
                        clearReport();
                      }}
                    />
                    <span>{value.replace(' Copy', '')}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="col-md-3">
              <PayrollGenerateButton
                busy={busy}
                busyLabel={busyLabel}
                generatingPrefix="Generating"
                compactBusy={busyUi.compactButton}
                className="btn btn-lg btn-info"
                disabled={!payrollMonth}
              >
                Go
              </PayrollGenerateButton>
            </div>
          </div>
        </form>

        <div ref={reportRef}>
          <PayrollReportResults
            busy={busy}
            overlayBusy={busyUi.overlayBusy}
            busyLabel={busyLabel}
            showPanel={showReportPanel}
            reportHtml={data?.reportHtml}
            reportEmpty={data?.reportEmpty}
            reportMessage={data?.reportMessage}
            panelClassName="payroll-individual-report-root att_report_span stipend-individual-report-table"
            emptyFilterMessage="No stipend payroll records for the selected month."
            hintMessage="Select month and click Go to generate the dashboard and salary statement bundle."
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
