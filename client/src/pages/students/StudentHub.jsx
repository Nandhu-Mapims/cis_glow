import { useOutletContext } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';
import { STUDENT_HUB_LINKS } from './studentModuleMeta';

export default function StudentHub() {
  const { settings, menu } = useOutletContext();
  return (
    <ModuleHub
      title="Student"
      subtitle="Profiles, admissions, alumni, attachments, and student reports"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Student' }]}
      links={STUDENT_HUB_LINKS}
      dashboardTitle="Student Module"
      settings={settings}
      menu={menu}
      loading={false}
      error={null}
    />
  );
}
