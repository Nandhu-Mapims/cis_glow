import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import ChipMultiSelect from '../../components/ChipMultiSelect';
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
import './stipendPayrollReport.css';

function StipendFilterRow({ label, children, wide = false }) {
  return (
    <div className="form-group row mb-3">
      <label className="col-sm-2 col-form-label">{label}</label>
      <div className={wide ? 'col-sm-8' : 'col-sm-4'}>{children}</div>
    </div>
  );
}

function groupReportTypeOptions(options = []) {
  const groups = new Map();
  for (const opt of options) {
    const group = opt.group || 'Report';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(opt);
  }
  return Array.from(groups.entries());
}

export default function StipendPayrollReport() {
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Loading…');
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [payrollMonth, setPayrollMonth] = useState('');
  const [searchCategory, setSearchCategory] = useState([]);
  const [reportFor, setReportFor] = useState('');
  const [resultsVisible, setResultsVisible] = useState(false);

  const clearReport = useCallback(() => {
    setResultsVisible(false);
    setData((prev) => clearPayrollReportData(prev));
  }, []);

  const loadReport = useCallback(async (fields = {}, options = {}) => {
    const isGenerate = fields.Submit === 'Generate';
    const label = options.label || (isGenerate ? 'Generating stipend payroll report…' : 'Refreshing…');
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
      const res = await api.post('/api/payroll/stipend/report', { fields });
      setData(res.data);
      const selected = res.data.selected || {};
      setPayrollMonth(selected.payrollMonth || '');
      setSearchCategory(selected.searchCategory || []);
      setReportFor(selected.reportFor || res.data.reportTypeOptions?.[0]?.value || '');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to load stipend payroll report');
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
        const [settingsRes, menuRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
        await loadReport({}, { label: 'Loading stipend payroll report…' });
      } catch (err) {
        setError(err.message || 'Unable to initialize stipend payroll report');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadReport]);

  const monthReady = Boolean(payrollMonth && data?.selected?.payrollMonthSql);

  const categoryOptions = useMemo(() => (
    (data?.categoryOptions || []).flatMap((group) => (
      (group.items || []).map((item) => ({
        value: item.value,
        label: item.label,
        group: group.group,
      }))
    ))
  ), [data?.categoryOptions]);

  const reportTypeGroups = useMemo(
    () => groupReportTypeOptions(data?.reportTypeOptions || []),
    [data?.reportTypeOptions],
  );

  const handleMonthChange = async (value) => {
    setPayrollMonth(value);
    setSearchCategory([]);
    setReportFor('');
    if (!value) {
      clearReport();
      return;
    }
    await loadReport({ payroll_month: value }, { label: 'Loading categories and report types…' });
  };

  const generateReport = async (e) => {
    e.preventDefault();
    await loadReport({
      payroll_month: payrollMonth,
      search_category: searchCategory,
      report_for: reportFor,
      Submit: 'Generate',
    }, { label: 'Generating stipend payroll report…' });
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
    printReportHtml(data.reportHtml);
  };

  const showReportPanel = resultsVisible || busy;
  const busyUi = resolvePayrollBusyUi({ busy, busyLabel, showPanel: showReportPanel });
  const canGenerate = monthReady && searchCategory.length && reportFor;

  if (loading) {
    return <PayrollPageLoader label="Loading stipend payroll report…" />;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Stipend Payroll Report' }} menu={menu}>
      <div className="stipend-payroll-report-root exam-setup-root">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb">
            <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
            <li className="breadcrumb-item"><Link to="/payroll">Payroll</Link></li>
            <li className="breadcrumb-item"><Link to="/payroll/stipend">Stipend</Link></li>
            <li className="breadcrumb-item active">Payroll Report</li>
          </ol>
        </nav>

        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h3 className="dashboard-title mb-0">Stipend Payroll Report</h3>
            <p className="text-muted small mb-0">Bank transfer, deductions, and payout summary by category</p>
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

        <form onSubmit={generateReport} className="card shadow-sm exam-setup-card stipend-payroll-report-filters mb-3">
          <div className="card-body form-horizontal">
            <StipendFilterRow label="Month">
              <select
                className="form-select"
                required
                value={payrollMonth}
                disabled={busy}
                onChange={(e) => handleMonthChange(e.target.value)}
              >
                <option value="">-Select Month-</option>
                {(data?.monthOptions || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </StipendFilterRow>

            {monthReady && (
              <>
                <StipendFilterRow label="Category">
                  <ChipMultiSelect
                    options={categoryOptions}
                    value={searchCategory}
                    onChange={(value) => {
                      setSearchCategory(value);
                      clearReport();
                    }}
                    disabled={busy}
                    searchPlaceholder="Search category…"
                    emptySelectionText="Select one or more categories"
                    showSearch={categoryOptions.length > 4}
                  />
                  <p className="form-text text-muted mb-0 mt-1">
                    Categories are loaded from generated payroll for the selected month.
                  </p>
                </StipendFilterRow>

                <StipendFilterRow label="Report" wide>
                  <div className="stipend-report-type-grid">
                    {reportTypeGroups.map(([group, items]) => (
                      <div key={group} className="stipend-report-type-group">
                        <div className="stipend-report-type-group-title">{group}</div>
                        <div className="stipend-report-type-options">
                          {items.map((opt) => (
                            <label key={opt.value} className="stipend-report-type-option">
                              <input
                                type="radio"
                                name="report_for"
                                value={opt.value}
                                checked={reportFor === opt.value}
                                disabled={busy}
                                onChange={() => {
                                  setReportFor(opt.value);
                                  clearReport();
                                }}
                              />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </StipendFilterRow>

                <div className="form-group row mb-0">
                  <div className="col-sm-2" />
                  <div className="col-sm-4">
                    <PayrollGenerateButton
                      busy={busy}
                      busyLabel={busyLabel}
                      generatingPrefix="Generating"
                      compactBusy={busyUi.compactButton}
                      className="btn btn-lg btn-info"
                      disabled={!canGenerate}
                    >
                      Go
                    </PayrollGenerateButton>
                  </div>
                </div>
              </>
            )}
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
          panelClassName="payroll-report-root att_report_span stipend-payroll-report-table"
          emptyFilterMessage="No stipend payroll records for the selected filters."
          hintMessage="Select month, category, and report type, then click Go."
        />
      </div>
    </DashboardLayout>
  );
}
