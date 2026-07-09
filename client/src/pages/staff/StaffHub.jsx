import { ModuleHub } from '../../components/PageShell';
import { useShellData } from '../../hooks/useShellData';
import { STAFF_HUB_LINKS } from './staffModuleMeta';

export default function StaffHub() {
  const { settings, menu, loading, error, reload } = useShellData();
  return (
    <ModuleHub
      title="Staff"
      subtitle="Staff profiles, certificates, inspections, publications, and setup"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Staff' }]}
      links={STAFF_HUB_LINKS}
      dashboardTitle="Staff Module"
      settings={settings}
      menu={menu}
      loading={loading}
      error={error}
      onRetry={reload}
    />
  );
}
