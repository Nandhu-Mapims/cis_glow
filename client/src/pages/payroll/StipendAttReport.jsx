import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import ChipMultiSelect from '../../components/ChipMultiSelect';
import DashboardLayout from '../../layouts/DashboardLayout';
import { buildAttendanceReportPrintHtml } from '../../utils/attendanceReportPrint';
import { printReportHtml } from '../../utils/printReport';
import './PayrollReport.css';
import '../exam/ExamSetupPage.css';

function StipendFilterRow({ label, children, wide = false }) {
  return (
    <div className="form-group row mb-3">
      <label className="col-sm-2 col-form-label">{label}</label>
      <div className={wide ? 'col-sm-8' : 'col-sm-4'}>{children}</div>
    </div>
  );
}

export default function StipendAttReport() {
  const tableWrapRef = useRef(null);
  const tableRef = useRef(null);
  const signatureRef = useRef(null);

  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [payrollMonth, setPayrollMonth] = useState('');
  const [searchCategory, setSearchCategory] = useState([]);
  const [reportType, setReportType] = useState('Statement');
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [generating, setGenerating] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [printMeta, setPrintMeta] = useState(null);
  const [bannerUrl, setBannerUrl] = useState('');

  const loadForm = useCallback(async (fields = {}) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/api/payroll/stipend/att-report', { fields });
      setData(res.data);
      const selected = res.data.selected || {};
      setPayrollMonth(selected.payrollMonth || '');
      setSearchCategory(selected.searchCategory || []);
      setReportType(selected.reportType || 'Statement');
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load stipend attendance report');
      setData(null);
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const [settingsRes, menuRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
        await loadForm();
      } catch (err) {
        setError(err.message || 'Unable to initialize stipend attendance report');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadForm]);

  const categoryOptions = (data?.categoryOptions || []).flatMap((group) => (
    (group.items || []).map((item) => ({
      value: item.value,
      label: item.label,
      group: group.group,
    }))
  ));

  const handleMonthChange = async (value) => {
    setPayrollMonth(value);
    setSearchCategory([]);
    if (!value) return;
    await loadForm({ payroll_month: value, report_type: reportType });
  };

  const runStep = async (index, students, meta) => {
    const registerNo = students[index];
    if (!registerNo) {
      if (index < students.length) return runStep(index + 1, students, meta);
      return;
    }
    setProgress({ current: index, total: students.length, label: `${index} of ${students.length}...` });
    try {
      const res = await api.get('/api/payroll/stipend/att-report/more', {
        params: {
          flag: 1,
          id: index,
          s_staff: registerNo,
          pmonth: meta.pmonth,
          tmonth: meta.tmonth,
          ac_year: meta.acYear,
          report_type: meta.reportType,
        },
      });
      const parsed = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      const rowHtml = Array.isArray(parsed) ? parsed[0] : parsed?.body;
      if (rowHtml && tableRef.current) {
        const tbody = tableRef.current.querySelector('tbody');
        if (tbody) tbody.insertAdjacentHTML('beforeend', rowHtml);
      }
    } catch {
      setError('Report build failed');
      return;
    }
    await runStep(index + 1, students, meta);
  };

  const startReport = async (e) => {
    e.preventDefault();
    const result = await loadForm({
      payroll_month: payrollMonth,
      search_category: searchCategory,
      report_type: reportType,
      Submit: 'Generate',
    });
    const students = result?.students || [];
    if (!students.length || !result?.pmonth) return;

    const meta = {
      pmonth: result.pmonth,
      tmonth: result.tmonth,
      acYear: result.acYear || searchCategory[0]?.split('_')[2] || '',
      reportType: result.selected?.reportType || reportType,
    };

    setPrintMeta(result.printMeta || null);
    setBannerUrl(result.bannerUrl || '');
    setShowTable(true);
    setGenerating(true);
    setRowCount(0);
    if (tableWrapRef.current && result.reportHtml) {
      tableWrapRef.current.innerHTML = result.reportHtml;
      tableRef.current = tableWrapRef.current.querySelector('#payroll');
    }
    if (signatureRef.current) signatureRef.current.innerHTML = '';

    await runStep(0, students, meta);

    const rows = tableRef.current?.querySelector('tbody')?.children?.length || 0;
    setRowCount(rows);
    if (signatureRef.current && result?.signatureHtml) {
      signatureRef.current.innerHTML = result.signatureHtml;
    }
    setGenerating(false);
    setProgress({ current: students.length, total: students.length, label: 'Complete' });
  };

  const handlePrint = () => {
    const tableHtml = tableRef.current?.outerHTML || '';
    const signatureHtml = signatureRef.current?.innerHTML || '';
    const body = buildAttendanceReportPrintHtml({
      title: printMeta?.title || 'Attendance Statement',
      subtitleLine1: printMeta?.subtitleLine1 || '',
      dateRange: printMeta?.dateRange || '',
      bannerUrl,
      tablesHtml: `${tableHtml}${signatureHtml}`,
    });
    printReportHtml(body, 'stipend-attendance-report');
  };

  if (loading) {
    return <div className="p-4 text-muted">Loading...</div>;
  }

  const monthReady = Boolean(payrollMonth && data?.selected?.payrollMonthSql);
  const progressWidth = progress.total
    ? Math.max(1, Math.round((progress.current / progress.total) * 100))
    : 1;

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Stipend Attendance Report' }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/payroll">Payroll</Link></li>
          <li className="breadcrumb-item"><Link to="/payroll/stipend">Stipend</Link></li>
          <li className="breadcrumb-item active">Attendance Report</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h3 className="dashboard-title mb-0">Stipend Attendance Report</h3>
        <div className="d-flex gap-2">
          {rowCount > 0 && !generating && (
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={handlePrint}>
              Print
            </button>
          )}
          <Link to="/payroll/stipend" className="btn btn-outline-secondary btn-sm">Back</Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {busy && <div className="text-muted small mb-2">Loading…</div>}

      <form onSubmit={startReport} className="card shadow-sm exam-setup-card mb-3">
        <div className="card-body form-horizontal">
          <StipendFilterRow label="Month">
            <select
              className="form-select"
              required
              value={payrollMonth}
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
                  onChange={setSearchCategory}
                  placeholder="Select category"
                  required
                />
              </StipendFilterRow>

              <StipendFilterRow label="Show" wide>
                <div className="d-flex flex-wrap gap-3 pt-1">
                  <label className="form-check-label">
                    <input
                      type="radio"
                      name="report_type"
                      className="form-check-input me-1"
                      value="Statement"
                      checked={reportType === 'Statement'}
                      onChange={() => setReportType('Statement')}
                    />
                    Statement
                  </label>
                  <label className="form-check-label">
                    <input
                      type="radio"
                      name="report_type"
                      className="form-check-input me-1"
                      value="Report"
                      checked={reportType === 'Report'}
                      onChange={() => setReportType('Report')}
                    />
                    Report
                  </label>
                </div>
              </StipendFilterRow>
            </>
          )}

          {monthReady && (
            <StipendFilterRow label="">
              <button
                type="submit"
                className="btn btn-lg btn-danger"
                disabled={busy || generating || !payrollMonth || !searchCategory.length}
              >
                Generate
              </button>
            </StipendFilterRow>
          )}
        </div>
      </form>

      {generating && (
        <div className="mb-3">
          <div className="progress progress-striped active progress-sm" style={{ height: 25 }}>
            <div
              className="progress-bar progress-bar-success"
              role="progressbar"
              style={{ width: `${progressWidth}%` }}
            />
          </div>
          <p className="text-muted small mb-0">{progress.label}</p>
        </div>
      )}

      {showTable && (
        <div className="card shadow-sm payroll-report-root att_report_span">
          <div className="card-body">
            <div ref={tableWrapRef} />
            <div ref={signatureRef} />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
