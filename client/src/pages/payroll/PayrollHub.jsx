import { ModuleHub } from '../../components/PageShell';
import { useShellData } from '../../hooks/useShellData';

const REPORT_LINKS = [
  { to: '/payroll/dashboard', title: 'Payroll Dashboard', desc: 'Monthly salary summary by category', icon: 'fa fa-dashboard' },
  { to: '/payroll/individual-report', title: 'Individual Report', desc: 'Payslips, bank/PF/ESI export', icon: 'fa fa-user' },
  { to: '/payroll/individual-bundle', title: 'Individual Bundle', desc: 'Payroll DB + salary statement (legacy report1)', icon: 'fa fa-file-pdf-o' },
  { to: '/payroll/consolidated-report', title: 'Consolidated Report', desc: 'Multi-month payroll summary', icon: 'fa fa-files-o' },
  { to: '/payroll/salary-summary', title: 'Salary Summary', desc: 'Category comparison summary', icon: 'fa fa-bar-chart' },
  { to: '/payroll/salary-statement', title: 'Salary Statement', desc: 'Department salary statement', icon: 'fa fa-file-text-o' },
  { to: '/payroll/group-report', title: 'Group Report', desc: 'Multi-month group payroll report', icon: 'fa fa-users' },
  { to: '/payroll/generate-payroll', title: 'Generate Payroll', desc: 'Batch attendance payroll generation', icon: 'fa fa-cogs' },
  { to: '/payroll/att-report', title: 'Attendance Report', desc: 'Statement / summary attendance', icon: 'fa fa-calendar' },
  { to: '/payroll/monthly-report', title: 'Monthly Report', desc: 'Multi-month deduction matrix', icon: 'fa fa-table' },
  { to: '/payroll/tax-report', title: 'Tax Report', desc: 'TDS and professional tax', icon: 'fa fa-money' },
  { to: '/payroll/stipend', title: 'Stipend Payroll', desc: 'Stipend reports and statements', icon: 'fa fa-graduation-cap' },
];

const SETUP_LINK = { to: '/payroll/setup', title: 'Payroll Setup', desc: 'Config, salary, deductions, advances', icon: 'fa fa-cog' };

export default function PayrollHub() {
  const { settings, menu, loading, error, reload } = useShellData();

  return (
    <ModuleHub
      title="Payroll Module"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Payroll' }]}
      links={[SETUP_LINK, ...REPORT_LINKS]}
      dashboardTitle="Payroll"
      settings={settings}
      menu={menu}
      loading={loading}
      error={error}
      onRetry={reload}
    />
  );
}
