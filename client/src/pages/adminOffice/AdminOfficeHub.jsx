import { ModuleHub } from '../../components/PageShell';
import { useShellData } from '../../hooks/useShellData';
import { ADMIN_OFFICE_HUB_LINKS } from './adminOfficeSetupMeta';

export default function AdminOfficeHub() {
  const { settings, menu, loading, error, reload } = useShellData();

  return (
    <ModuleHub
      title="Admin Office"
      subtitle="Courier, incidents, and student/staff activities"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Admin Office' }]}
      links={ADMIN_OFFICE_HUB_LINKS}
      dashboardTitle="Admin Office"
      settings={settings}
      menu={menu}
      loading={loading}
      error={error}
      onRetry={reload}
    />
  );
}
