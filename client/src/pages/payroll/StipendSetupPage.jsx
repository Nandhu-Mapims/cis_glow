import { useCallback, useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import api from '../../api/client';
import { SetupPageShell } from '../../components/PageShell';
import SetupAlerts from '../../components/SetupAlerts';
import { useTransientNotice } from '../../hooks/useTransientNotice';
import StipendDeductionSetup from './setup/StipendDeductionSetup';
import '../exam/ExamSetupPage.css';

const SCREEN_META = {
  'amount-setup': { title: 'Stipend Amount Setup', apiScreen: 'stipend-amount-setup' },
  'deduction-add': { title: 'Stipend Deductions', apiScreen: 'stipend-deduction-add' },
  'payroll-close': { title: 'Close Stipend Payroll', apiScreen: 'stipend-payroll-close' },
};

export default function StipendSetupPage() {
  const { screen } = useParams();
  const meta = SCREEN_META[screen];

  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useTransientNotice();
  const [data, setData] = useState(null);
  const [payrollMonth, setPayrollMonth] = useState('');
  const [payrollComplete, setPayrollComplete] = useState(false);
  const [courseType, setCourseType] = useState('');

  const loadForm = useCallback(async (fields = {}) => {
    if (!meta) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post(`/api/payroll/setup/${meta.apiScreen}/load`, { fields });
      const { message, success, ...payload } = res.data || {};
      setData(payload);
      if (payload.selected) {
        setPayrollMonth(payload.selected.payrollMonth || payload.selected.payrollMonthSql || '');
      }
      if (payload.selectedCourseType) setCourseType(payload.selectedCourseType);
      if (payload.selectedId) {
        setPayrollMonth(payload.selectedId);
        setPayrollComplete(Boolean(payload.payrollComplete));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load stipend setup form');
      setData(null);
    } finally {
      setBusy(false);
    }
  }, [meta]);

  useEffect(() => {
    const init = async () => {
      if (!meta) {
        setLoading(false);
        return;
      }
      try {
        await loadForm();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [meta, loadForm]);

  const save = async (fields) => {
    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      const res = await api.post(`/api/payroll/setup/${meta.apiScreen}/save`, { fields });
      if (res.data.success === false) {
        setError(res.data.message || 'Save failed.');
      } else if (res.data.message) {
        setNotice(res.data.message);
      }
      const { message, success, ...payload } = res.data || {};
      setData((prev) => {
        const next = { ...(prev || {}), ...payload };
        if (payload.selectedId != null && payload.payrollComplete != null && prev?.monthOptions) {
          next.monthOptions = prev.monthOptions.map((opt) => (
            opt.value === String(payload.selectedId)
              ? { ...opt, payrollComplete: payload.payrollComplete }
              : opt
          ));
        }
        if (payload.selectedId != null) {
          setPayrollComplete(Boolean(payload.payrollComplete));
        }
        return next;
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  if (!meta) {
    return (
      <SetupPageShell
        settings={settings}
        menu={menu}
        title="Stipend"
        breadcrumbs={[
          { label: 'Home', to: '/dashboard' },
          { label: 'Payroll', to: '/payroll' },
          { label: 'Stipend', to: '/payroll/stipend' },
          { label: 'Unknown' },
        ]}
        backTo="/payroll/stipend"
      >
        <p className="text-danger mb-0">Unknown stipend setup screen.</p>
      </SetupPageShell>
    );
  }

  return (
    <SetupPageShell
      settings={settings}
      menu={menu}
      title={meta.title}
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        { label: 'Payroll', to: '/payroll' },
        { label: 'Stipend', to: '/payroll/stipend' },
        { label: meta.title },
      ]}
      backTo="/payroll/stipend"
      loading={loading}
      alerts={(
        <SetupAlerts
          notice={notice}
          error={error}
          busy={busy}
          onDismissNotice={() => setNotice(null)}
        />
      )}
      cardClassName="cis-setup-card exam-setup-card"
      rootClassName="cis-setup-root exam-setup-root"
    >
      {screen === 'amount-setup' && (
        <form onSubmit={(e) => { e.preventDefault(); save({ course_type: courseType, leave_apply: e.target.leave_apply.value, r_id: data?.record?.id || '', Submit: 'Update' }); }}>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Stipend Type</label>
              <select className="form-select" value={courseType} onChange={async (e) => { setCourseType(e.target.value); await loadForm({ course_type: e.target.value }); }}>
                <option value="">--Select--</option>
                {(data?.courseTypeOptions || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Amount</label>
              <input
                key={`${courseType}-${data?.record?.id || 'new'}-${data?.record?.stipendAmount || ''}`}
                name="leave_apply"
                className="form-control"
                defaultValue={data?.record?.stipendAmount || ''}
              />
            </div>
            <div className="col-12">
              <button type="submit" className="btn btn-primary" disabled={busy || !courseType}>Update</button>
            </div>
          </div>
        </form>
      )}

      {screen === 'payroll-close' && (
        <form onSubmit={(e) => { e.preventDefault(); save({ payroll_month: payrollMonth, payroll_complete: payrollComplete ? '1' : '0', Submit: 'Update' }); }}>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Month</label>
              <select
                className="form-select"
                value={payrollMonth}
                onChange={(e) => {
                  const monthId = e.target.value;
                  setPayrollMonth(monthId);
                  const option = (data?.monthOptions || []).find((opt) => opt.value === monthId);
                  setPayrollComplete(Boolean(option?.payrollComplete));
                }}
              >
                <option value="">-Select Month-</option>
                {(data?.monthOptions || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4 d-flex align-items-end">
              <label className="form-check-label">
                <input
                  type="checkbox"
                  name="payroll_complete"
                  className="form-check-input me-2"
                  checked={payrollComplete}
                  onChange={(e) => setPayrollComplete(e.target.checked)}
                />
                Payroll Complete
              </label>
            </div>
            <div className="col-12">
              <button type="submit" className="btn btn-primary" disabled={busy || !payrollMonth}>Update</button>
            </div>
          </div>
        </form>
      )}

      {screen === 'deduction-add' && (
        <StipendDeductionSetup data={data} load={loadForm} save={save} busy={busy} />
      )}
    </SetupPageShell>
  );
}
