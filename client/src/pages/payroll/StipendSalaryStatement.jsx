import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
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
import './stipendSalaryStatement.css';

function StipendFilterRow({ label, children, wide = false }) {
  return (
    <div className="form-group row mb-3">
      <label className="col-sm-2 col-form-label">{label}</label>
      <div className={wide ? 'col-sm-8' : 'col-sm-4'}>{children}</div>
    </div>
  );
}

export default function StipendSalaryStatement() {
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
    const label = options.label || (isGenerate ? 'Generating stipend salary statement…' : 'Refreshing…');
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
      const res = await api.post('/api/payroll/stipend/statement', { fields });
      setData(res.data);
      const selected = res.data.selected || {};
      setPayrollMonth(selected.payrollMonth || '');
      setSearchCategory(selected.searchCategory || []);
      setRowPerPage(selected.rowPerPage || 27);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to load stipend salary statement');
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
        await loadReport({}, { label: 'Loading stipend salary statement…' });
      } catch (err) {
        setError(err.message || 'Unable to initialize stipend salary statement');
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

  const handleMonthChange = async (value) => {
    setPayrollMonth(value);
    setSearchCategory([]);
    if (!value) {
      clearReport();
      return;
    }
    await loadReport({ payroll_month: value }, { label: 'Loading categories for month…' });
  };

  const generateReport = async (e) => {
    e.preventDefault();
    await loadReport({
      payroll_month: payrollMonth,
      search_category: searchCategory,
      row_per_page: rowPerPage,
      Submit: 'Generate',
    }, { label: 'Generating stipend salary statement…' });
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

  if (loading) {
    return <PayrollPageLoader label="Loading stipend salary statement…" />;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Stipend Salary Statement' }} menu={menu}>
      <div className="stipend-statement-root exam-setup-root">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb">
            <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
            <li className="breadcrumb-item"><Link to="/payroll">Payroll</Link></li>
            <li className="breadcrumb-item"><Link to="/payroll/stipend">Stipend</Link></li>
            <li className="breadcrumb-item active">Salary Statement</li>
          </ol>
        </nav>

        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h3 className="dashboard-title mb-0">Stipend Salary Statement</h3>
            <p className="text-muted small mb-0">Monthly stipend breakdown by student category</p>
          </div>
          <div className="d-flex gap-2">
            {data?.reportHtml && !busy && (
              <button type="button" className="btn btn-outline-primary btn-sm" onClick={handlePrint}>
                Print
              </button>
            )}
            <Link to="/payroll/stipend" className="btn btn-outline-secondary btn-sm">Back</Link>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        <PayrollBusyBanner busy={busyUi.showBanner} label={busyLabel} />

        <form onSubmit={generateReport} className="card shadow-sm exam-setup-card stipend-statement-filters mb-3">
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

                <StipendFilterRow label="Row Per Page">
                  <input
                    type="number"
                    className="form-control"
                    min={1}
                    max={100}
                    value={rowPerPage}
                    disabled={busy}
                    onChange={(e) => {
                      setRowPerPage(Number(e.target.value) || 27);
                      clearReport();
                    }}
                  />
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
                      disabled={!searchCategory.length}
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
          panelClassName="payroll-report-root att_report_span stipend-statement-report"
          emptyFilterMessage="No stipend payroll records for the selected month and category."
          hintMessage="Select month and category, then click Go."
        />
      </div>
    </DashboardLayout>
  );
}
