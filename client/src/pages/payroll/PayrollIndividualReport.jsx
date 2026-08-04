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

export default function PayrollIndividualReport() {
  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Loading…');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [resultsVisible, setResultsVisible] = useState(false);

  const [payrollMonth, setPayrollMonth] = useState('');
  const [searchCategory, setSearchCategory] = useState([]);
  const [rowPerPage, setRowPerPage] = useState(27);
  const [reportFor, setReportFor] = useState('');
  const [copyType, setCopyType] = useState('Original Copy');

  const clearReport = useCallback(() => {
    setResultsVisible(false);
    setData((prev) => (prev ? { ...prev, reportHtml: '', exportMeta: null } : prev));
  }, []);

  const loadReport = useCallback(async (fields = {}, options = {}) => {
    const isGenerate = fields.Submit === 'Generate';
    const label = options.label || (isGenerate ? 'Generating individual payroll report…' : 'Refreshing…');
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
      const res = await api.post('/api/payroll/individual-report', { fields });
      setData(res.data);
      const selected = res.data.selected || {};
      setPayrollMonth(selected.payrollMonth || '');
      setSearchCategory(selected.searchCategory || []);
      setRowPerPage(selected.rowPerPage || 27);
      setReportFor(selected.reportFor || '');
      setCopyType(selected.copyType || 'Original Copy');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load payroll report');
      setData((prev) => ({
        ...(prev || {}),
        reportHtml: '',
        exportMeta: null,
      }));
    } finally {
      setBusy(false);
    }
  }, [clearReport]);

  useEffect(() => {
    const init = async () => {
      try {
        await loadReport({}, { label: 'Loading individual payroll report…' });
      } catch (err) {
        setError(err.message || 'Unable to initialize payroll report');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadReport]);

  const onMonthChange = async (value) => {
    setPayrollMonth(value);
    setSearchCategory([]);
    setReportFor('');
    await loadReport({ payroll_month: value }, { label: 'Loading categories…' });
  };

  const onCategoryChange = (e) => {
    setSearchCategory(Array.from(e.target.selectedOptions).map((opt) => opt.value));
    clearReport();
  };

  const generateReport = async (e) => {
    e.preventDefault();
    await loadReport({
      payroll_month: payrollMonth,
      search_category: searchCategory,
      row_per_page: rowPerPage,
      report_for: reportFor,
      copy_type: copyType,
      Submit: 'Generate',
    }, { label: 'Generating individual payroll report…' });
  };

  const exportExcel = async (flag) => {
    if (!data?.exportMeta?.payroll_month) return;
    setExporting(true);
    setError(null);
    try {
      const res = await api.get('/api/payroll/individual-report/export', {
        params: {
          flag,
          payroll_month: data.exportMeta.payroll_month,
          transfer_ref: data.exportMeta.transfer_ref || '',
          search_category: data.exportMeta.search_category || '',
        },
      });
      if (res.data.downloadUrl) window.open(res.data.downloadUrl, '_blank');
      else setError('Excel file was not created');
    } catch (err) {
      setError(err.response?.data?.message || 'Excel export failed');
    } finally {
      setExporting(false);
    }
  };

  const showReportPanel = resultsVisible || busy;
  const busyUi = resolvePayrollBusyUi({ busy, busyLabel, showPanel: showReportPanel });
  const categoryPlaceholder = busy && payrollMonth ? 'Loading categories…' : 'Select categories';
  const reportType = data?.exportMeta?.title || '';

  if (loading) {
    return <PayrollPageLoader label="Loading individual payroll report…" />;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Individual Payroll Report' }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/payroll">Payroll</Link></li>
          <li className="breadcrumb-item active">Individual Report</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="dashboard-title mb-0">Individual Payroll Report</h3>
          <p className="text-muted small mb-0">Native SQL from staff_payroll_tb</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {data?.exportMeta && reportType === 'bank' && !busy && (
            <button type="button" className="btn btn-success btn-sm" disabled={exporting} onClick={() => exportExcel(1)}>Export XLS</button>
          )}
          {data?.exportMeta && reportType === 'pf' && !busy && (
            <button type="button" className="btn btn-success btn-sm" disabled={exporting} onClick={() => exportExcel(2)}>Export XLS</button>
          )}
          {data?.exportMeta && reportType === 'esi' && !busy && (
            <button type="button" className="btn btn-success btn-sm" disabled={exporting} onClick={() => exportExcel(3)}>Export XLS</button>
          )}
          {data?.reportHtml && !busy && (
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => printReportHtml(data.reportHtml)}>Print</button>
          )}
          <Link to="/payroll" className="btn btn-outline-secondary btn-sm">Back</Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      <PayrollBusyBanner busy={busyUi.showBanner} label={busyLabel} />
      {exporting && (
        <div className="alert alert-info py-2 d-flex align-items-center">
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
          Exporting Excel…
        </div>
      )}

      <form onSubmit={generateReport} className="card shadow-sm exam-setup-card mb-3">
        <div className="card-body row g-3">
          <div className="col-md-4">
            <label className="form-label">Month</label>
            <select
              className="form-select"
              required
              disabled={busy || exporting}
              value={payrollMonth}
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
              disabled={busy || exporting || !payrollMonth}
              value={searchCategory}
              onChange={onCategoryChange}
              size={Math.min(6, Math.max(3, (data?.categoryOptions || []).length || 3))}
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
              disabled={busy || exporting}
              onChange={(e) => {
                setRowPerPage(e.target.value);
                clearReport();
              }}
            />
          </div>
          <div className="col-12">
            <label className="form-label d-block">Report</label>
            <div className="d-flex flex-wrap gap-3">
              {(data?.reportTypeOptions || []).filter((opt) => opt.visible).map((opt) => (
                <label key={opt.value} className="form-check-label">
                  <input
                    type="radio"
                    className="form-check-input me-1"
                    name="report_for"
                    value={opt.value}
                    checked={reportFor === opt.value}
                    disabled={busy || exporting}
                    onChange={(e) => {
                      setReportFor(e.target.value);
                      clearReport();
                    }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div className="col-12">
            <label className="form-label d-block">Copy</label>
            {['Original Copy', 'Duplicate Copy', 'Default Copy'].map((value) => (
              <label key={value} className="me-3">
                <input className="me-2"
                  type="radio"
                  name="copy_type"
                  value={value}
                  checked={copyType === value}
                  disabled={busy || exporting}
                  onChange={(e) => {
                    setCopyType(e.target.value);
                    clearReport();
                  }}
                />
                {' '}{value.replace(' Copy', '')}
              </label>
            ))}
          </div>
          <div className="col-12">
            <PayrollGenerateButton
              busy={busy}
              busyLabel={busyLabel}
              generatingPrefix="Generating"
              compactBusy={busyUi.compactButton}
              className="btn btn-danger"
              disabled={!payrollMonth || !searchCategory.length || !reportFor || exporting}
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
        panelClassName="payroll-individual-report-root"
        emptyFilterMessage="No individual payroll report data for the selected filters."
        hintMessage="Select month, category, and report type, then click Go."
      />
    </DashboardLayout>
  );
}
