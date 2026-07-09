import { ModuleHub } from '../../components/PageShell';
import { useShellData } from '../../hooks/useShellData';

const LINKS = [
  { to: '/attendance/staff/hub', title: 'Staff Attendance Hub', desc: 'All 26 staff attendance screens (calendar, SMR, reports, setup)', icon: 'fa fa-users' },
  { to: '/attendance/students/hub', title: 'Student Attendance Hub', desc: 'All 27 student attendance screens (UG, PG, internship, SMR)', icon: 'fa fa-graduation-cap' },
  { to: '/attendance/staff', title: 'Staff Calendar', desc: 'Monthly attendance calendar by staff category', icon: 'fa fa-calendar' },
  { to: '/attendance/staff/report', title: 'Staff Report', desc: 'Date-range staff attendance report', icon: 'fa fa-file-text-o' },
  { to: '/attendance/staff/punch', title: 'Live Punch', desc: 'Real-time staff punch in/out', icon: 'fa fa-clock-o' },
  { to: '/attendance/students/daily', title: 'U.G Manual Attendance', desc: 'Mark daily UG student attendance', icon: 'fa fa-check-square-o' },
  { to: '/attendance/students/report', title: 'U.G Reports Att', desc: 'Standard student attendance report', icon: 'fa fa-bar-chart' },
  { to: '/attendance/students/report/quarterly', title: 'Quarterly Report', desc: 'Quarterly student attendance summary', icon: 'fa fa-calendar-check-o' },
];

export default function AttendanceHub() {
  const { settings, menu, loading, error, reload } = useShellData();

  return (
    <ModuleHub
      title="Attendance"
      subtitle="Staff and student attendance calendars, reports, and live punch"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Attendance' }]}
      links={LINKS}
      dashboardTitle="Attendance"
      settings={settings}
      menu={menu}
      loading={loading}
      error={error}
      onRetry={reload}
    />
  );
}
