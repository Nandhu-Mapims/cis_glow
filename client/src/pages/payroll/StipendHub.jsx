import { Link } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';
import { useShellData } from '../../hooks/useShellData';

const LINKS = [
  { to: '/payroll/stipend/generate-payroll', title: 'Generate Payroll', desc: 'Batch generate stipend payroll', icon: 'fa fa-cogs' },
  { to: '/payroll/stipend/setup/amount-setup', title: 'Amount Setup', desc: 'Stipend amount per course type', icon: 'fa fa-inr' },
  { to: '/payroll/stipend/setup/deduction-add', title: 'Deductions', desc: 'Monthly stipend deductions', icon: 'fa fa-minus-circle' },
  { to: '/payroll/stipend/setup/payroll-close', title: 'Close Payroll', desc: 'Mark stipend payroll month complete', icon: 'fa fa-lock' },
  { to: '/payroll/stipend/att-report', title: 'Attendance Report', desc: 'Stipend attendance statement/report', icon: 'fa fa-calendar-check-o' },
  { to: '/payroll/stipend/report', title: 'Stipend Payroll Report', desc: 'Single bank/deduction report by category', icon: 'fa fa-file-text-o' },
  { to: '/payroll/stipend/statement', title: 'Stipend Salary Statement', desc: 'Department stipend statement', icon: 'fa fa-list-alt' },
  { to: '/payroll/stipend/individual-report', title: 'Stipend Individual Report', desc: 'Month-wide dashboard + statement bundle', icon: 'fa fa-user' },
  { to: '/payroll/stipend/individual-pdf', title: 'Stipend PDF', desc: 'Password-protected payslip PDF bundle', icon: 'fa fa-file-pdf-o' },
];

export default function StipendHub() {
  const { settings, menu, loading, error, reload } = useShellData();

  return (
    <ModuleHub
      title="Stipend Payroll"
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        { label: 'Payroll', to: '/payroll' },
        { label: 'Stipend' },
      ]}
      links={LINKS}
      dashboardTitle="Stipend Payroll"
      settings={settings}
      menu={menu}
      loading={loading}
      error={error}
      onRetry={reload}
      actions={<Link to="/payroll" className="btn btn-outline-secondary btn-sm">Back</Link>}
    />
  );
}
