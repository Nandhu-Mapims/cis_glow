import { ModuleHub } from '../../components/PageShell';
import { useShellData } from '../../hooks/useShellData';

const SCREENS = [
  { to: '/dashboard', title: 'Attendance Dashboard', desc: 'Staff and student attendance widgets', icon: 'fa fa-dashboard' },
  { to: '/dashboard/student', title: 'Student Dashboard', desc: 'Student-focused widget board with academic year filters', icon: 'fa fa-graduation-cap' },
  { to: '/dashboard/overall-strength', title: 'Overall Strength', desc: 'Course strength by admission year', icon: 'fa fa-table' },
  { to: '/dashboard/community-strength', title: 'Community Strength', desc: 'Course strength by community category', icon: 'fa fa-users' },
  { to: '/dashboard/log', title: 'Log Dashboard', desc: 'Login statistics for admin, staff, and students', icon: 'fa fa-bar-chart' },
  { to: '/dashboard/staff-pattern', title: 'Staff Pattern', desc: 'Faculty structure and unit rosters (DCI norms)', icon: 'fa fa-sitemap' },
];

export default function DashboardHub() {
  const { settings, menu, loading, error, reload } = useShellData();

  return (
    <ModuleHub
      title="Dashboard"
      subtitle="Attendance, strength reports, and faculty pattern screens"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'All dashboards' }]}
      links={SCREENS}
      dashboardTitle="Dashboard"
      settings={settings}
      menu={menu}
      loading={loading}
      error={error}
      onRetry={reload}
    />
  );
}
