import { useOutletContext } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';

const SCREENS = [
  {
    to: '/dashboard',
    title: 'Attendance dashboard',
    desc: 'Home board — staff and student attendance widgets',
    icon: 'fa fa-dashboard',
    section: 'Boards',
  },
  {
    to: '/dashboard/student',
    title: 'Student dashboard',
    desc: 'Student-focused widget board with academic year filters',
    icon: 'fa fa-graduation-cap',
    section: 'Boards',
  },
  {
    to: '/dashboard/overall-strength',
    title: 'Overall strength',
    desc: 'Course strength by admission year',
    icon: 'fa fa-table',
    section: 'Strength',
  },
  {
    to: '/dashboard/community-strength',
    title: 'Community strength',
    desc: 'Course strength by community category',
    icon: 'fa fa-users',
    section: 'Strength',
  },
  {
    to: '/dashboard/log',
    title: 'Log dashboard',
    desc: 'Login statistics for admin, staff, and students',
    icon: 'fa fa-bar-chart',
    section: 'Audit',
  },
  {
    to: '/dashboard/staff-pattern',
    title: 'Staff pattern',
    desc: 'Faculty structure and unit rosters (DCI norms)',
    icon: 'fa fa-sitemap',
    section: 'Faculty',
  },
];

export default function DashboardHub() {
  const { settings, menu } = useOutletContext();

  return (
    <ModuleHub
      title="All dashboards"
      subtitle="Attendance boards, strength reports, login audit, and faculty pattern"
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        { label: 'All dashboards' },
      ]}
      links={SCREENS}
      dashboardTitle="All dashboards"
      settings={settings}
      menu={menu}
      loading={false}
      error={null}
    />
  );
}
