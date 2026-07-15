import { useOutletContext } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';

const LINKS = [
  { to: '/exam/dashboard', title: 'Exam Dashboard', desc: 'Active exam summary and mark status', icon: 'fa fa-dashboard' },
  { to: '/exam/setup', title: 'Exam Setup', desc: 'Exam names, term setup, batches, and mark entry', icon: 'fa fa-cog' },
  { to: '/exam/reports', title: 'Exam Reports', desc: 'Term reports, statements, and progress cards', icon: 'fa fa-file-text-o' },
  { to: '/exam/student-statement', title: 'Student Statement', desc: 'Per-student CIA marks view', icon: 'fa fa-user' },
  { to: '/exam/setup/mark-entry', title: 'Mark Entry', desc: 'CIA mark entry by exam and subject', icon: 'fa fa-pencil-square-o' },
];

export default function ExamHub() {
  const { settings, menu } = useOutletContext();

  return (
    <ModuleHub
      title="Examination Module"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Examination' }]}
      links={LINKS}
      dashboardTitle="Examination"
      settings={settings}
      menu={menu}
      loading={false}
      error={null}
    />
  );
}
