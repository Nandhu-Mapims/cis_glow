import { useOutletContext } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';
import { STAFF_HUB_LINKS } from './staffModuleMeta';

export default function StaffHub() {
  const { settings, menu } = useOutletContext();
  return (
    <ModuleHub
      title="Staff"
      subtitle="Staff profiles, certificates, inspections, publications, and setup"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Staff' }]}
      links={STAFF_HUB_LINKS}
      dashboardTitle="Staff Module"
      settings={settings}
      menu={menu}
      loading={false}
      error={null}
    />
  );
}
