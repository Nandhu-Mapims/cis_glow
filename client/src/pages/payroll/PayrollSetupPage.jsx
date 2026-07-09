import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/client';
import DashboardLayout from '../../layouts/DashboardLayout';
import SetupAlerts from '../fees/setup/SetupAlerts';
import { PAYROLL_SCREEN_META } from './payrollSetupMeta';
import { usePayrollSetupApi } from './usePayrollSetupApi';
import '../exam/ExamSetupPage.css';
import IndividualSetup, { CronSetup } from './setup/IndividualSetup';
import {
  PayrollConfigSetup,
  PfEsiSetup,
  SalaryAddSetup,
  SalaryReportSetup,
  SalaryAdvanceAddSetup,
  SalaryAdvanceCloseSetup,
  SalaryArrearAddSetup,
  SalaryArrearReleaseSetup,
  OtherDeductionSetup,
  LopDeductionSetup,
  TdsAddSetup,
  ChequePaymentSetup,
  SecurityDepositAddSetup,
  SecurityDepositCloseSetup,
  PayrollCloseSetup,
} from './setup/PayrollSetupScreens';

const SETUP_COMPONENTS = {
  'individual-setup': IndividualSetup,
  'cron-setup': CronSetup,
  'payroll-config': PayrollConfigSetup,
  'pf-esi-setup': PfEsiSetup,
  'salary-add': SalaryAddSetup,
  'salary-report': SalaryReportSetup,
  'salary-advance-add': SalaryAdvanceAddSetup,
  'salary-advance-close': SalaryAdvanceCloseSetup,
  'salary-arrear-add': SalaryArrearAddSetup,
  'salary-arrear-release': SalaryArrearReleaseSetup,
  'other-deduction': OtherDeductionSetup,
  'lop-deduction': LopDeductionSetup,
  'tds-add': TdsAddSetup,
  'cheque-payment': ChequePaymentSetup,
  'security-deposit-add': SecurityDepositAddSetup,
  'security-deposit-close': SecurityDepositCloseSetup,
  'payroll-close': PayrollCloseSetup,
};

export default function PayrollSetupPage() {
  const { screen } = useParams();
  const meta = PAYROLL_SCREEN_META[screen];
  const { data, busy, error, notice, setNotice, load, save } = usePayrollSetupApi(screen);
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);

  const SetupComponent = SETUP_COMPONENTS[screen];

  useEffect(() => {
    const init = async () => {
      if (!meta) { setLoading(false); return; }
      try {
        const [settingsRes, menuRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
        await load();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [meta, load]);

  if (!meta) {
    return (
      <div className="p-4">
        <p className="text-danger">Unknown payroll setup screen.</p>
        <Link to="/payroll/setup">Back to setup hub</Link>
      </div>
    );
  }

  if (loading) return <div className="p-4 text-muted">Loading...</div>;

  return (
    <DashboardLayout settings={settings} dashboard={{ title: meta.title }} menu={menu}>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/dashboard">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/payroll">Payroll</Link></li>
          <li className="breadcrumb-item"><Link to="/payroll/setup">Setup</Link></li>
          <li className="breadcrumb-item active">{meta.title}</li>
        </ol>
      </nav>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="dashboard-title mb-0">{meta.title}</h3>
          <p className="text-muted small mb-0">Native: {meta.legacy}</p>
        </div>
        <Link to="/payroll/setup" className="btn btn-outline-secondary btn-sm">Back</Link>
      </div>

      <SetupAlerts
        notice={notice}
        error={error}
        busy={busy}
        onDismissNotice={() => setNotice(null)}
      />

      <div className="card shadow-sm exam-setup-card">
        <div className="card-body">
          {SetupComponent && (
            <SetupComponent data={data} load={load} save={save} busy={busy} screen={screen} />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
