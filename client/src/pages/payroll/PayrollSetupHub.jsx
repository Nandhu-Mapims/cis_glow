import { Link, useOutletContext } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';

const LINKS = [
  { to: '/payroll/setup/individual-setup', title: 'Cover Page Images', desc: 'Payslip cover page banner images', icon: 'fa fa-image' },
  { to: '/payroll/setup/cron-setup', title: 'Cron Email Setup', desc: 'Scheduled payroll email recipients (also in Settings)', icon: 'fa fa-envelope' },
  { to: '/payroll/setup/payroll-config', title: 'Payroll Group Setup', desc: 'Attendance and salary policy per category', icon: 'fa fa-sliders' },
  { to: '/payroll/setup/pf-esi-setup', title: 'PF / ESI Rates', desc: 'Employer PF and ESI rate slabs', icon: 'fa fa-bank' },
  { to: '/payroll/setup/salary-add', title: 'Staff Salary Setup', desc: 'Salary bands and bank details', icon: 'fa fa-money' },
  { to: '/payroll/setup/salary-report', title: 'Salary Setup Report', desc: 'Print salary configuration by category', icon: 'fa fa-print' },
  { to: '/payroll/setup/salary-advance-add', title: 'Salary Advance Add', desc: 'New salary advance / loan', icon: 'fa fa-plus' },
  { to: '/payroll/setup/salary-advance-close', title: 'Salary Advance Close', desc: 'Edit or close advances', icon: 'fa fa-check' },
  { to: '/payroll/setup/salary-arrear-add', title: 'Salary Arrear Add', desc: 'Add arrear entry', icon: 'fa fa-plus-circle' },
  { to: '/payroll/setup/salary-arrear-release', title: 'Salary Arrear Release', desc: 'Release arrear schedule', icon: 'fa fa-unlock' },
  { to: '/payroll/setup/other-deduction', title: 'Other Deduction', desc: 'Monthly other deductions grid', icon: 'fa fa-minus' },
  { to: '/payroll/setup/lop-deduction', title: 'LOP Deduction', desc: 'Manual LOP deduction entry', icon: 'fa fa-minus-circle' },
  { to: '/payroll/setup/tds-add', title: 'TDS Entry', desc: 'Monthly TDS overrides', icon: 'fa fa-percent' },
  { to: '/payroll/setup/cheque-payment', title: 'Cheque Payment', desc: 'Mark cheque payment staff', icon: 'fa fa-credit-card' },
  { to: '/payroll/setup/security-deposit-add', title: 'Security Deposit Add', desc: 'New security deposit', icon: 'fa fa-lock' },
  { to: '/payroll/setup/security-deposit-close', title: 'Security Deposit Close', desc: 'Close security deposits', icon: 'fa fa-unlock-alt' },
  { to: '/payroll/setup/payroll-close', title: 'Payroll Close', desc: 'Mark payroll month complete', icon: 'fa fa-flag-checkered' },
];

export default function PayrollSetupHub() {
  const { settings, menu } = useOutletContext();

  return (
    <ModuleHub
      title="Payroll Setup"
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        { label: 'Payroll', to: '/payroll' },
        { label: 'Setup' },
      ]}
      links={LINKS}
      dashboardTitle="Payroll Setup"
      settings={settings}
      menu={menu}
      loading={false}
      error={null}
      actions={<Link to="/payroll" className="btn btn-outline-secondary btn-sm">Back</Link>}
    />
  );
}
