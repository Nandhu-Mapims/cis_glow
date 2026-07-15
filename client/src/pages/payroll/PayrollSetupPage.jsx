import { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { SetupPageShell } from '../../components/PageShell';
import SetupAlerts from '../../components/SetupAlerts';
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
  const { settings, menu } = useOutletContext();
  const [loading, setLoading] = useState(true);

  const SetupComponent = SETUP_COMPONENTS[screen];

  useEffect(() => {
    const init = async () => {
      if (!meta) { setLoading(false); return; }
      try {
        await load();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [meta, load]);

  if (!meta) {
    return (
      <SetupPageShell
        settings={settings}
        menu={menu}
        title="Payroll"
        breadcrumbs={[
          { label: 'Home', to: '/dashboard' },
          { label: 'Payroll', to: '/payroll' },
          { label: 'Setup', to: '/payroll/setup' },
          { label: 'Unknown' },
        ]}
        backTo="/payroll/setup"
      >
        <p className="text-danger mb-0">Unknown payroll setup screen.</p>
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
        { label: 'Setup', to: '/payroll/setup' },
        { label: meta.title },
      ]}
      backTo="/payroll/setup"
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
      {SetupComponent && (
        <SetupComponent data={data} load={load} save={save} busy={busy} screen={screen} />
      )}
    </SetupPageShell>
  );
}
