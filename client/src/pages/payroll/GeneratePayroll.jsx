import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import '../exam/ExamSetupPage.css';

export default function GeneratePayroll() {
  const tableRef = useRef(null);
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [payrollMonth, setPayrollMonth] = useState('');
  const [searchCategory, setSearchCategory] = useState([]);
  const [gStaffList, setGStaffList] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [generating, setGenerating] = useState(false);

  const loadForm = useCallback(async (fields = {}) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/api/payroll/generate-payroll', { fields });
      setData(res.data);
      const selected = res.data.selected || {};
      setPayrollMonth(selected.payrollMonth || '');
      setSearchCategory(selected.searchCategory || []);
      setGStaffList(selected.gStaffList || '');
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load generate payroll');
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
        setError(err.message || 'Unable to initialize generate payroll');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadForm]);

  const runGenerateStep = async (index, staffList, meta) => {
    const staff = staffList[index];
    if (!staff) {
      if (index < staffList.length) return runGenerateStep(index + 1, staffList, meta);
      return;
    }
    setProgress({ current: index, total: staffList.length, label: `${index} of ${staffList.length} Generated...` });
    try {
      const res = await api.get('/api/payroll/generate-payroll/more', {
        params: { flag: 1, id: index, s_staff: staff.id, pmonth: meta.pmonth, s_cate: meta.sCate },
      });
      const parsed = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      const rowHtml = Array.isArray(parsed) ? parsed[0] : parsed?.body;
      if (rowHtml && tableRef.current) {
        const tbody = tableRef.current.querySelector('tbody');
        if (tbody) tbody.insertAdjacentHTML('beforeend', rowHtml);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Generation failed — use Refresh to retry from last row');
      return;
    }
    await runGenerateStep(index + 1, staffList, meta);
  };

  const finalizeGenerate = async (meta) => {
    setProgress((p) => ({ ...p, label: 'Updating please wait...' }));
    await api.get('/api/payroll/generate-payroll/more', {
      params: { flag: 2, pmonth: meta.pmonth, s_cate: meta.sCate },
    });
    setGenerating(false);
    setProgress({ current: 0, total: 0, label: 'Complete' });
  };

  const startGenerate = async (e) => {
    e.preventDefault();
    const result = await loadForm({
      payroll_month: payrollMonth,
      search_category: searchCategory,
      g_staff_list: gStaffList,
      Submit: 'Generate',
    });
    const staffList = result?.staff || [];
    if (!staffList.length || !result?.selected?.payrollMonthSql) return;

    const monthDate = new Date(result.selected.payrollMonthSql);
    const meta = {
      pmonth: result.selected.pmonthEpoch
        || Math.floor(new Date(`${result.selected.payrollMonthSql}T00:00:00`).getTime() / 1000),
      sCate: searchCategory.join(','),
    };

    setGenerating(true);
    setProgress({ current: 0, total: staffList.length, label: `0/${staffList.length} Generated...` });
    if (tableRef.current) {
      const tbody = tableRef.current.querySelector('tbody');
      if (tbody) tbody.innerHTML = '';
    }
    await runGenerateStep(0, staffList, meta);
    await finalizeGenerate(meta);
  };

  if (loading) return <div className="p-4 text-muted">Loading...</div>;

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Generate Payroll' }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/payroll">Payroll</Link></li>
          <li className="breadcrumb-item active">Generate Payroll</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="dashboard-title mb-0">Generate Payroll</h3>
          <p className="text-muted small mb-0">Native staff attendance via staffAttendanceCore</p>
        </div>
        <Link to="/payroll" className="btn btn-outline-secondary btn-sm">Back</Link>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {busy && <div className="text-muted small mb-2">Loading…</div>}

      <form onSubmit={startGenerate} className="card shadow-sm exam-setup-card mb-3">
        <div className="card-body row g-3">
          <div className="col-md-4">
            <label className="form-label">Month</label>
            <select className="form-select" required value={payrollMonth} onChange={(e) => setPayrollMonth(e.target.value)}>
              <option value="">-Select Month-</option>
              {(data?.monthOptions || []).map((opt) => (
                <option key={opt.value} value={opt.value} style={opt.generated ? { backgroundColor: '#96CD6D' } : undefined}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Category</label>
            <select className="form-select" multiple required value={searchCategory} onChange={(e) => setSearchCategory(Array.from(e.target.selectedOptions).map((o) => o.value))} size={6}>
              {(data?.categoryOptions || []).map((opt) => (
                <option key={opt.value} value={opt.value} style={opt.generated ? { backgroundColor: '#96CD6D' } : undefined}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Staff ID (optional)</label>
            <textarea className="form-control" rows={3} value={gStaffList} onChange={(e) => setGStaffList(e.target.value)} placeholder="Comma-separated staff IDs" />
          </div>
          <div className="col-12">
            <button type="submit" className="btn btn-lg btn-danger" disabled={busy || generating || !payrollMonth || !searchCategory.length}>
              Generate
            </button>
          </div>
        </div>
      </form>

      {generating && (
        <div className="mb-3">
          <div className="progress progress-striped active progress-sm">
            <div className="progress-bar progress-bar-success" style={{ width: progress.total ? `${Math.round((progress.current / progress.total) * 100)}%` : '1%' }} />
          </div>
          <p className="small text-muted mb-0">{progress.label}</p>
        </div>
      )}

      <div className="card shadow-sm">
        <div className="card-body table-responsive">
          <table ref={tableRef} className="table table-bordered" id="payroll">
            <thead>
              <tr>
                <th>S.No</th><th>Staff ID</th><th>Name</th><th>Period</th>
                <th>T.D</th><th>W.D</th><th>Pr</th><th>Le</th><th>Ab</th><th>La</th><th>Pe</th><th>LOP</th><th>%</th>
              </tr>
            </thead>
            <tbody />
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
