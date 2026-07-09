import { ModuleHub } from '../../components/PageShell';
import { useShellData } from '../../hooks/useShellData';

const LINKS = [
  { to: '/academic/curriculum', title: 'Curriculum Module', desc: 'Periods, timetables, feedback, internship, and curriculum reports', icon: 'fa fa-book' },
  { to: '/academic/reports/subject-dashboard', title: 'Subject Dashboard', desc: 'Live period status by date/time', icon: 'fa fa-dashboard' },
  { to: '/academic/setup', title: 'Academic Setup', desc: 'Courses, subjects, calendar, timetable, and master data', icon: 'fa fa-cog' },
  { to: '/academic/reports', title: 'Academic Reports', desc: 'Subject, class, and batch timetable reports', icon: 'fa fa-file-text-o' },
  { to: '/academic/courses', title: 'Course Directory', desc: 'Browse courses and open the edit form', icon: 'fa fa-book' },
  { to: '/academic/setup/subject-schedule', title: 'Subject Timetable', desc: 'Schedule staff and periods', icon: 'fa fa-calendar' },
  { to: '/academic/setup/academic-calendar', title: 'Academic Calendar', desc: 'Institution calendar events', icon: 'fa fa-calendar-check-o' },
];

export default function AcademicHub() {
  const { settings, menu, loading, error, reload } = useShellData();

  return (
    <ModuleHub
      title="Academic Module"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Academic' }]}
      links={LINKS}
      dashboardTitle="Academic"
      settings={settings}
      menu={menu}
      loading={loading}
      error={error}
      onRetry={reload}
    />
  );
}
