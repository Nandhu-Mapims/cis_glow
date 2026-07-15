import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../../api/client';
import ChipMultiSelect from '../../components/ChipMultiSelect';
import DashboardLayout from '../../layouts/DashboardLayout';
import '../exam/ExamSetupPage.css';
import './stipendGeneratePayroll.css';

function StipendFilterRow({ label, children, wide = false }) {
  return (
    <div className="form-group row mb-3">
      <label className="col-sm-2 col-form-label">{label}</label>
      <div className={wide ? 'col-sm-8' : 'col-sm-4'}>{children}</div>
    </div>
  );
}

export default function StipendGeneratePayroll() {
  const tableRef = useRef(null);
  const generateMetaRef = useRef(null);
  const studentsRef = useRef([]);

  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [payrollMonth, setPayrollMonth] = useState('');
  const [searchCategory, setSearchCategory] = useState([]);
  const [gStaffList, setGStaffList] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [generating, setGenerating] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [showRefresh, setShowRefresh] = useState(false);
  const [resumeIndex, setResumeIndex] = useState(0);

  const loadForm = useCallback(async (fields = {}) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/api/payroll/stipend/generate-payroll', { fields });
      setData(res.data);
      const selected = res.data.selected || {};
      setPayrollMonth(selected.payrollMonth || '');
      setSearchCategory(selected.searchCategory || []);
      setGStaffList(selected.gStaffList || '');
      return res.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load stipend generate payroll');
      setData(null);
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await loadForm();
      } catch (err) {
        setError(err.message || 'Unable to initialize stipend generate payroll');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadForm]);

  const monthReady = Boolean(payrollMonth && data?.selected?.payrollMonthSql);

  const categoryOptions = useMemo(() => {
    const opts = [];
    for (const group of data?.categoryOptions || []) {
      for (const item of group.items || []) {
        opts.push({
          value: item.value,
          label: item.label,
          group: group.group,
        });
      }
    }
    return opts;
  }, [data?.categoryOptions]);

  const handleMonthChange = async (value) => {
    setPayrollMonth(value);
    setSearchCategory([]);
    if (!value) return;
    await loadForm({ payroll_month: value });
  };

  const runGenerateStep = async (index, students, meta) => {
    if (index >= students.length) return true;

    const registerNo = students[index];
    if (!registerNo) return runGenerateStep(index + 1, students, meta);

    setResumeIndex(index);
    setProgress({
      current: index,
      total: students.length,
      label: `${index} of ${students.length} Generated...`,
    });

    try {
      const res = await api.get('/api/payroll/stipend/generate-payroll/more', {
        params: {
          flag: 1,
          id: index,
          s_staff: registerNo,
          pmonth: meta.pmonth,
          tmonth: meta.tmonth,
          ac_year: meta.acYear,
          s_cate: meta.sCate,
        },
      });
      const parsed = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      const rowHtml = Array.isArray(parsed) ? parsed[0] : parsed?.body;
      if (rowHtml && tableRef.current) {
        const tbody = tableRef.current.querySelector('tbody');
        if (tbody) tbody.insertAdjacentHTML('beforeend', rowHtml);
      }
      setShowRefresh(false);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Generation failed — use Refresh to retry from last row');
      setShowRefresh(true);
      setGenerating(false);
      return false;
    }

    return runGenerateStep(index + 1, students, meta);
  };

  const finalizeGenerate = async (meta) => {
    setProgress((p) => ({ ...p, label: 'Updating please wait...' }));
    try {
      await api.get('/api/payroll/stipend/generate-payroll/more', {
        params: { flag: 2, pmonth: meta.pmonth, tmonth: meta.tmonth, s_cate: meta.sCate },
      });
      setGenerating(false);
      setShowRefresh(false);
      setProgress({ current: 0, total: 0, label: 'Complete' });
    } catch (err) {
      setGenerating(false);
      setError(err.response?.data?.message || err.message || 'Finalize failed after generating rows');
    }
  };

  const beginGeneration = async (students, meta) => {
    studentsRef.current = students;
    generateMetaRef.current = meta;
    setShowTable(true);
    setGenerating(true);
    setShowRefresh(false);
    setError(null);
    setProgress({ current: 0, total: students.length, label: `0/${students.length} Generated...` });
    if (tableRef.current) {
      const tbody = tableRef.current.querySelector('tbody');
      if (tbody) tbody.innerHTML = '';
    }
    const completed = await runGenerateStep(0, students, meta);
    if (completed) await finalizeGenerate(meta);
  };

  const startGenerate = async (e) => {
    e.preventDefault();
    const result = await loadForm({
      payroll_month: payrollMonth,
      search_category: searchCategory,
      g_staff_list: gStaffList,
      Submit: 'Generate',
    });
    const students = result?.students || [];
    if (!students.length || !result?.selected?.payrollMonthSql) return;

    const monthDate = new Date(`${result.selected.payrollMonthSql}T00:00:00`);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    const meta = {
      pmonth: Math.floor(monthDate.getTime() / 1000),
      tmonth: Math.floor(monthEnd.getTime() / 1000),
      acYear: searchCategory[0]?.split('_')[2] || '',
      sCate: searchCategory.join(','),
    };

    await beginGeneration(students, meta);
  };

  const handleRefresh = async () => {
    const students = studentsRef.current;
    const meta = generateMetaRef.current;
    if (!students.length || !meta) return;
    setError(null);
    setGenerating(true);
    setShowRefresh(false);
    const completed = await runGenerateStep(resumeIndex, students, meta);
    if (completed) await finalizeGenerate(meta);
  };

  if (loading) {
    return <div className="p-4 text-muted">Loading...</div>;
  }

  const progressWidth = progress.total
    ? Math.max(1, Math.round((progress.current / progress.total) * 100))
    : 1;

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Generate Stipend Payroll' }} menu={menu}>
      <div className="stipend-generate-root exam-setup-root">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb">
            <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
            <li className="breadcrumb-item"><Link to="/payroll">Payroll</Link></li>
            <li className="breadcrumb-item"><Link to="/payroll/stipend">Stipend</Link></li>
            <li className="breadcrumb-item active">Generate Payroll</li>
          </ol>
        </nav>

        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h3 className="dashboard-title mb-0">Generate Stipend Payroll</h3>
          <Link to="/payroll/stipend" className="btn btn-outline-secondary btn-sm">Back</Link>
        </div>

        {error ? <div className="alert alert-danger">{error}</div> : null}

        <form onSubmit={startGenerate} className="card shadow-sm exam-setup-card mb-3">
          <div className="card-body form-horizontal">
            <StipendFilterRow label="Month">
              <select
                className="form-select"
                required
                value={payrollMonth}
                disabled={busy || generating}
                onChange={(e) => handleMonthChange(e.target.value)}
              >
                <option value="">-Select Month-</option>
                {(data?.monthOptions || []).map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    className={opt.generated ? 'month-option-generated' : undefined}
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
            </StipendFilterRow>

            {monthReady ? (
              <>
                <StipendFilterRow label="Category">
                  <ChipMultiSelect
                    options={categoryOptions}
                    value={searchCategory}
                    onChange={setSearchCategory}
                    disabled={busy || generating}
                    searchPlaceholder="Search category..."
                    emptySelectionText="Select one or more categories"
                    showSearch={categoryOptions.length > 4}
                  />
                </StipendFilterRow>

                <StipendFilterRow label="Register No">
                  <textarea
                    className="form-control"
                    rows={3}
                    value={gStaffList}
                    disabled={busy || generating}
                    onChange={(e) => setGStaffList(e.target.value)}
                    placeholder="Optional — comma-separated register numbers"
                  />
                </StipendFilterRow>

                {!generating ? (
                  <div className="form-group row mb-0">
                    <div className="col-sm-2" />
                    <div className="col-sm-4">
                      <button
                        type="submit"
                        className="btn btn-lg btn-danger"
                        disabled={busy || !searchCategory.length}
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {generating ? (
              <div className="form-group row mb-0">
                <div className="col-sm-2" />
                <div className="col-sm-6">
                  <div className="progress progress-striped active progress-sm">
                    <div
                      className="progress-bar progress-bar-success"
                      role="progressbar"
                      style={{ width: `${progressWidth}%` }}
                    />
                  </div>
                  <p className="small text-muted mb-0">{progress.label}</p>
                </div>
                {showRefresh ? (
                  <div className="col-sm-2">
                    <button type="button" className="btn btn-default btn-xs" onClick={handleRefresh}>
                      Refresh
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </form>

        {showTable ? (
          <div className="card shadow-sm att-report-span">
            <div className="card-body p-0">
              <table
                ref={tableRef}
                className="table table-bordered mb-0"
                id="payroll"
              >
                <thead>
                  <tr>
                    <th style={{ width: 30 }}>S.No</th>
                    <th style={{ width: 100 }}>Register No</th>
                    <th style={{ width: 200 }}>Student Name</th>
                    <th style={{ width: 40 }}>T.D</th>
                    <th style={{ width: 40 }}>W.D</th>
                    <th style={{ width: 40 }}>Pr</th>
                    <th style={{ width: 40 }}>Ab</th>
                    <th style={{ width: 40 }}>La</th>
                    <th style={{ width: 40 }}>Pe</th>
                    <th style={{ width: 40 }}>Le</th>
                    <th style={{ width: 40 }}>LOP</th>
                    <th style={{ width: 40 }}>%</th>
                  </tr>
                </thead>
                <tbody />
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
