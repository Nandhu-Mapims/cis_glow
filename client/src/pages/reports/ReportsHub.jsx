import { Link } from 'react-router-dom';
import { Breadcrumbs, PageError, PageHeader, PageLoading } from '../../components/PageShell';
import { useShellData } from '../../hooks/useShellData';
import DashboardLayout from '../../layouts/DashboardLayout';

const SECTIONS = [
  {
    title: 'Students',
    links: [
      { to: '/students/reports', label: 'Student export / reports' },
    ],
  },
  {
    title: 'Staff',
    links: [
      { to: '/staff/reports', label: 'Staff export / reports' },
    ],
  },
  {
    title: 'Attendance',
    links: [
      { to: '/attendance/staff/report', label: 'Staff attendance report' },
      { to: '/attendance/students/report', label: 'Student attendance report' },
      { to: '/attendance/students/report/quarterly', label: 'Quarterly attendance report' },
    ],
  },
  {
    title: 'Fees',
    links: [
      { to: '/fees/report/collection', label: 'Fee collection report' },
      { to: '/fees/delete/report', label: 'Deleted receipt report' },
    ],
  },
  {
    title: 'Academic',
    links: [
      { to: '/academic/reports/subject-report', label: 'Subject report' },
      { to: '/academic/reports/timetable-report', label: 'Class timetable report' },
      { to: '/academic/reports/batch-timetable-report', label: 'Batch timetable report' },
    ],
  },
  {
    title: 'Examination',
    links: [
      { to: '/exam/reports/term-report', label: 'Term report' },
      { to: '/exam/reports/term-statement', label: 'Result statement' },
      { to: '/exam/reports/progress-card', label: 'Progress card' },
      { to: '/exam/reports/schedule-print', label: 'Exam schedule print' },
      { to: '/exam/reports/invigilator-print', label: 'Invigilator schedule' },
      { to: '/exam/reports/report-analysis', label: 'Term report analysis' },
      { to: '/exam/student-statement', label: 'Student exam statement' },
    ],
  },
  {
    title: 'Payroll',
    links: [
      { to: '/payroll/dashboard', label: 'Payroll dashboard' },
      { to: '/payroll/individual-report', label: 'Individual payroll report' },
      { to: '/payroll/consolidated-report', label: 'Consolidated payroll report' },
      { to: '/payroll/salary-summary', label: 'Salary summary' },
      { to: '/payroll/salary-statement', label: 'Salary statement' },
      { to: '/payroll/group-report', label: 'Payroll group report' },
      { to: '/payroll/stipend/report', label: 'Stipend payroll report' },
      { to: '/payroll/stipend/statement', label: 'Stipend salary statement' },
    ],
  },
  {
    title: 'Administration',
    links: [
      { to: '/admin/users', label: 'User directory' },
      { to: '/admin/setup/access-restriction', label: 'Login access restrictions' },
      { to: '/admin/setup/dept-auth', label: 'Department authentication' },
      { to: '/admin/setup/menu-auth', label: 'Menu permissions' },
      { to: '/admin/setup/dashboard-access', label: 'Dashboard widget access' },
      { to: '/admin/log-dashboard', label: 'Login dashboard (audit)' },
      { to: '/admin/log-details', label: 'Log details search' },
    ],
  },
];

export default function ReportsHub() {
  const { settings, menu, loading, error, reload } = useShellData();

  if (loading) {
    return <PageLoading message="Loading reports…" />;
  }

  if (error) {
    return <PageError message={error} onRetry={reload} />;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title: 'Reports' }} menu={menu}>
      <div className="cis-page">
        <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'Reports' }]} />
        <PageHeader
          title="Reports"
          subtitle="Cross-module index of migrated report screens"
        />
        <div className="row g-3">
          {SECTIONS.map((section) => (
            <div className="col-md-6 col-lg-4" key={section.title}>
              <div className="card h-100">
                <div className="card-header">{section.title}</div>
                <div className="card-body">
                  <ul className="list-unstyled mb-0">
                    {section.links.map((link) => (
                      <li key={link.to} className="mb-2">
                        <Link to={link.to} className="text-decoration-none fw-medium">
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
