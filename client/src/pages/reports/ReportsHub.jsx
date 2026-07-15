import { useOutletContext } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';

const REPORT_LINKS = [
  { section: 'Students', to: '/students/reports', title: 'Student export / reports', desc: 'Build and export student reports', icon: 'fa fa-graduation-cap' },
  { section: 'Staff', to: '/staff/reports', title: 'Staff export / reports', desc: 'Build and export staff reports', icon: 'fa fa-users' },
  { section: 'Attendance', to: '/attendance/staff/report', title: 'Staff attendance report', desc: 'Staff attendance summary', icon: 'fa fa-calendar-check-o' },
  { section: 'Attendance', to: '/attendance/students/report', title: 'Student attendance report', desc: 'Student attendance summary', icon: 'fa fa-calendar' },
  { section: 'Attendance', to: '/attendance/students/report/quarterly', title: 'Quarterly attendance report', desc: 'Quarterly student attendance', icon: 'fa fa-bar-chart' },
  { section: 'Fees', to: '/fees/report/collection', title: 'Fee collection report', desc: 'Collection totals and slips', icon: 'fa fa-inr' },
  { section: 'Fees', to: '/fees/delete/report', title: 'Deleted receipt report', desc: 'Deleted fee receipt audit', icon: 'fa fa-trash' },
  { section: 'Academic', to: '/academic/reports/subject-report', title: 'Subject report', desc: 'Subject setup report', icon: 'fa fa-book' },
  { section: 'Academic', to: '/academic/reports/timetable-report', title: 'Class timetable report', desc: 'Class timetable print', icon: 'fa fa-table' },
  { section: 'Academic', to: '/academic/reports/batch-timetable-report', title: 'Batch timetable report', desc: 'Batch timetable print', icon: 'fa fa-th' },
  { section: 'Examination', to: '/exam/reports/term-report', title: 'Term report', desc: 'Term exam report', icon: 'fa fa-file-text-o' },
  { section: 'Examination', to: '/exam/reports/term-statement', title: 'Result statement', desc: 'Term result statement', icon: 'fa fa-list-alt' },
  { section: 'Examination', to: '/exam/reports/progress-card', title: 'Progress card', desc: 'Student progress card', icon: 'fa fa-id-card-o' },
  { section: 'Examination', to: '/exam/reports/schedule-print', title: 'Exam schedule print', desc: 'Print exam schedule', icon: 'fa fa-print' },
  { section: 'Examination', to: '/exam/reports/invigilator-print', title: 'Invigilator schedule', desc: 'Invigilator duty print', icon: 'fa fa-user' },
  { section: 'Examination', to: '/exam/reports/report-analysis', title: 'Term report analysis', desc: 'Term analysis report', icon: 'fa fa-line-chart' },
  { section: 'Examination', to: '/exam/student-statement', title: 'Student exam statement', desc: 'Per-student exam statement', icon: 'fa fa-file-o' },
  { section: 'Payroll', to: '/payroll/dashboard', title: 'Payroll dashboard', desc: 'Payroll overview', icon: 'fa fa-dashboard' },
  { section: 'Payroll', to: '/payroll/individual-report', title: 'Individual payroll report', desc: 'Staff individual payroll', icon: 'fa fa-user' },
  { section: 'Payroll', to: '/payroll/consolidated-report', title: 'Consolidated payroll report', desc: 'Consolidated payroll', icon: 'fa fa-files-o' },
  { section: 'Payroll', to: '/payroll/salary-summary', title: 'Salary summary', desc: 'Salary summary report', icon: 'fa fa-calculator' },
  { section: 'Payroll', to: '/payroll/salary-statement', title: 'Salary statement', desc: 'Salary statement print', icon: 'fa fa-file-text' },
  { section: 'Payroll', to: '/payroll/group-report', title: 'Payroll group report', desc: 'Group payroll report', icon: 'fa fa-object-group' },
  { section: 'Payroll', to: '/payroll/stipend/report', title: 'Stipend payroll report', desc: 'Stipend payroll', icon: 'fa fa-money' },
  { section: 'Payroll', to: '/payroll/stipend/statement', title: 'Stipend salary statement', desc: 'Stipend statement', icon: 'fa fa-file-text-o' },
  { section: 'Administration', to: '/admin/users', title: 'User directory', desc: 'Web account directory', icon: 'fa fa-address-book' },
  { section: 'Administration', to: '/admin/setup/access-restriction', title: 'Login access restrictions', desc: 'Day and time access rules', icon: 'fa fa-lock' },
  { section: 'Administration', to: '/admin/setup/dept-auth', title: 'Department authentication', desc: 'Department menu access', icon: 'fa fa-sitemap' },
  { section: 'Administration', to: '/admin/setup/menu-auth', title: 'Menu permissions', desc: 'Menu authentication', icon: 'fa fa-list' },
  { section: 'Administration', to: '/admin/setup/dashboard-access', title: 'Dashboard widget access', desc: 'Dashboard widget permissions', icon: 'fa fa-th-large' },
  { section: 'Administration', to: '/admin/log-dashboard', title: 'Login dashboard (audit)', desc: 'Login audit dashboard', icon: 'fa fa-history' },
  { section: 'Administration', to: '/admin/log-details', title: 'Log details search', desc: 'Search audit log details', icon: 'fa fa-search' },
];

export default function ReportsHub() {
  const { settings, menu } = useOutletContext();

  return (
    <ModuleHub
      title="Reports"
      subtitle="Cross-module index of migrated report screens"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Reports' }]}
      links={REPORT_LINKS}
      dashboardTitle="Reports"
      settings={settings}
      menu={menu}
      loading={false}
      error={null}
    />
  );
}
