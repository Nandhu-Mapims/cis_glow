import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import ChipMultiSelect from '../../components/ChipMultiSelect';
import DashboardLayout from '../../layouts/DashboardLayout';
import { buildAttendanceReportPrintHtml } from '../../utils/attendanceReportPrint';
import { printReportHtml } from '../../utils/printReport';
import './PayrollReport.css';
import '../exam/ExamSetupPage.css';

export default function StipendNativeReportPage({
  apiPath,
  title,
  breadcrumbLabel,
  showReportTypes = false,
  variant = 'report',
}) {
  const isStatement = variant === 'statement';

  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [payrollMonth, setPayrollMonth] = useState('');
  const [searchCategory, setSearchCategory] = useState([]);
  const [reportFor, setReportFor] = useState('bank');
  const [rowPerPage, setRowPerPage] = useState(27);

  const loadReport = useCallback(async (fields = {}) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post(apiPath, { fields });
      setData(res.data);
      const selected = res.data.selected || {};
      setPayrollMonth(selected.payrollMonth || '');
      setSearchCategory(selected.searchCategory || []);
      setReportFor(selected.reportFor || 'bank');
      setRowPerPage(selected.rowPerPage || 27);
    } catch (err) {
      setError(err.response?.data?.message || `Unable to load ${title.toLowerCase()}`);
      setData(null);
    } finally {
      setBusy(false);
    }
  }, [apiPath, title]);

  useEffect(() => {
    const init = async () => {
      try {
        await loadReport();
      } catch (err) {
        setError(err.message || `Unable to initialize ${title.toLowerCase()}`);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadReport, title]);

  const onMonthChange = async (value) => {
    setPayrollMonth(value);
    setSearchCategory([]);
    await loadReport({ payroll_month: value });
  };

  const generateReport = async (e) => {
    e.preventDefault();
    await loadReport({
      payroll_month: payrollMonth,
      search_category: searchCategory,
      report_for: reportFor,
      row_per_page: rowPerPage,
      Submit: 'Generate',
    });
  };

  const handlePrint = () => {
    if (!data?.reportHtml) return;
    if (isStatement && data.printMeta) {
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

  if (loading) {
    return <div className="p-4 text-muted">Loading...</div>;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/payroll">Payroll</Link></li>
          <li className="breadcrumb-item"><Link to="/payroll/stipend">Stipend</Link></li>
          <li className="breadcrumb-item active">{breadcrumbLabel}</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h3 className="dashboard-title mb-0">{title}</h3>
        <div className="d-flex gap-2">
          {data?.reportHtml && (
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={handlePrint}>Print</button>
          )}
          <Link to="/payroll/stipend" className="btn btn-outline-secondary btn-sm">Back</Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {busy && <div className="text-muted small mb-2">Loading…</div>}

      <form onSubmit={generateReport} className="card shadow-sm exam-setup-card mb-3">
        <div className="card-body row g-3">
          <div className="col-md-4">
            <label className="form-label">Month</label>
            <select className="form-select" required value={payrollMonth} onChange={(e) => onMonthChange(e.target.value)}>
              <option value="">-Select Month-</option>
              {(data?.monthOptions || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-8">
            <label className="form-label">Category</label>
            <ChipMultiSelect
              options={(data?.categoryOptions || []).flatMap((group) => (group.items || []).map((item) => ({ value: item.value, label: item.label, group: group.group })))}
              value={searchCategory}
              onChange={setSearchCategory}
              emptySelectionText="No categories selected"
              emptySearchText="No categories match your search."
            />
          </div>
          {isStatement && (
            <div className="col-md-2">
              <label className="form-label">Row Per Page</label>
              <input
                type="number"
                className="form-control"
                min={1}
                value={rowPerPage}
                onChange={(e) => setRowPerPage(Number(e.target.value) || 27)}
              />
            </div>
          )}
          {showReportTypes && (
            <div className="col-12">
              <label className="form-label d-block">Report</label>
              <div className="d-flex flex-wrap gap-3">
                {['bank', 'gross_pay', 'lop_amount', 'pf', 'esi', 'tds_amount', 'prof_tax'].map((value) => (
                  <label key={value}>
                    <input type="radio" name="report_for" value={value} checked={reportFor === value} onChange={(e) => setReportFor(e.target.value)} />
                    {' '}{value.replace(/_/g, ' ')}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="col-12">
            <button type="submit" className="btn btn-danger" disabled={busy || !payrollMonth || !searchCategory.length}>Go</button>
          </div>
        </div>
      </form>

      {data?.reportHtml ? (
        <div className="card shadow-sm">
          <div className="card-body payroll-report-root att_report_span" dangerouslySetInnerHTML={{ __html: data.reportHtml }} />
        </div>
      ) : (
        !busy && <p className="text-muted">Select month and category, then click Go.</p>
      )}
    </DashboardLayout>
  );
}
