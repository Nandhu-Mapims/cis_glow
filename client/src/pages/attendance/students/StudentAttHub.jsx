import { useOutletContext } from 'react-router-dom';
import { ModuleHub } from '../../../components/PageShell';
import { STUDENT_ATT_HUB_LINKS } from './studentAttMeta';

export default function StudentAttHub() {
  const { settings, menu } = useOutletContext();
  return (
    <ModuleHub
      title="Student Attendance"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Attendance', to: '/attendance' }, { label: 'Student Attendance' }]}
      links={STUDENT_ATT_HUB_LINKS}
      dashboardTitle="Student Attendance"
      settings={settings}
      menu={menu}
      loading={false}
      error={null}
    />
  );
}
