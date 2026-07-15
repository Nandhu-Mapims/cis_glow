import { useOutletContext } from 'react-router-dom';
import { ModuleHub } from '../../../components/PageShell';
import { STAFF_ATT_LINKS } from './staffAttSetupMeta';

export default function StaffAttHub() {
  const { settings, menu } = useOutletContext();
  return (
    <ModuleHub
      title="Staff Attendance"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Attendance', to: '/attendance' }, { label: 'Staff Attendance' }]}
      links={STAFF_ATT_LINKS}
      dashboardTitle="Staff Attendance"
      settings={settings}
      menu={menu}
      loading={false}
      error={null}
    />
  );
}
