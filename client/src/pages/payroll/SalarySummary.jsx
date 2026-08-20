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

export default function SalarySummary() {
  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Loading…');
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [payrollMonth, setPayrollMonth] = useState('');
  const [searchCategory1, setSearchCategory1] = useState([]);
  const [searchCategory2, setSearchCategory2] = useState([]);
  const [categoryTitle1, setCategoryTitle1] = useState('');
  const [categoryTitle2, setCategoryTitle2] = useState('');
  const [resultsVisible, setResultsVisible] = useState(false);

  const clearReport = useCallback(() => {
    setResultsVisible(false);
    setData((prev) => clearPayrollReportData(prev));
  }, []);

  const loadReport = useCallback(async (fields = {}, options = {}) => {
    const isGenerate = fields.Submit === 'Generate';
    const label = options.label || (isGenerate ? 'Generating salary summary…' : 'Refreshing…');
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
      const res = await api.post('/api/payroll/salary-summary', { fields });
      setData(res.data);
      const selected = res.data.selected || {};
      setPayrollMonth(selected.payrollMonth || '');
      setSearchCategory1(selected.searchCategory1 || []);
      setSearchCategory2(selected.searchCategory2 || []);
      setCategoryTitle1(selected.categoryTitle1 || '');
      setCategoryTitle2(selected.categoryTitle2 || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load salary summary');
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
        await loadReport({}, { label: 'Loading salary summary…' });
      } catch (err) {
        setError(err.message || 'Unable to initialize salary summary');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadReport]);

  const onMonthChange = async (value) => {
    setPayrollMonth(value);
    setSearchCategory1([]);
    setSearchCategory2([]);
    await loadReport({ payroll_month: value }, { label: 'Loading categories…' });
  };

  const onCategoryChange = (setter) => (e) => {
    setter(Array.from(e.target.selectedOptions).map((o) => o.value));
    clearReport();
  };

  const generateReport = async (e) => {
    e.preventDefault();
    await loadReport({
      payroll_month: payrollMonth,
      search_category_1: searchCategory1,
      search_category_2: searchCategory2,
      category_title_1: categoryTitle1,
      category_title_2: categoryTitle2,
      Submit: 'Generate',
    }, { label: 'Generating salary summary…' });
  };

  const showReportPanel = resultsVisible || busy;
  const busyUi = resolvePayrollBusyUi({ busy, busyLabel, showPanel: showReportPanel });
  const categoryPlaceholder = busy && payrollMonth ? 'Loading categories…' : 'Select categories';
  const canGenerate = payrollMonth && (searchCategory1.length || searchCategory2.length);

  if (loading) {
    return <PayrollPageLoader label="Loading salary summary…" />;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Salary Summary' }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/payroll">Payroll</Link></li>
          <li className="breadcrumb-item active">Salary Summary</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="dashboard-title mb-0">Salary Summary</h3>
          <p className="text-muted small mb-0">Native SQL category comparison</p>
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
            <label className="form-label">Category 1</label>
            <select
              className="form-select"
              multiple
              required
              disabled={busy || !payrollMonth}
              value={searchCategory1}
              onChange={onCategoryChange(setSearchCategory1)}
              size={4}
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
            <input
              className="form-control mt-2"
              placeholder="Title"
              value={categoryTitle1}
              disabled={busy}
              onChange={(e) => {
                setCategoryTitle1(e.target.value);
                clearReport();
              }}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Category 2</label>
            <select
              className="form-select"
              multiple
              required
              disabled={busy || !payrollMonth}
              value={searchCategory2}
              onChange={onCategoryChange(setSearchCategory2)}
              size={4}
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
            <input
              className="form-control mt-2"
              placeholder="Title"
              value={categoryTitle2}
              disabled={busy}
              onChange={(e) => {
                setCategoryTitle2(e.target.value);
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
        panelClassName="payroll-report-root payroll-report-table-scroll"
        emptyFilterMessage="No salary summary data for the selected filters."
        hintMessage="Select month and category groups, then click Go."
      />
    </DashboardLayout>
  );
}
