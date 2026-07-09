import { ModuleHub } from '../../../components/PageShell';
import { useShellData } from '../../../hooks/useShellData';
import { STAFF_ATT_LINKS } from './staffAttSetupMeta';

export default function StaffAttHub() {
  const { settings, menu, loading, error, reload } = useShellData();
  return (
    <ModuleHub
      title="Staff Attendance"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Attendance', to: '/attendance' }, { label: 'Staff Attendance' }]}
      links={STAFF_ATT_LINKS}
      dashboardTitle="Staff Attendance"
      settings={settings}
      menu={menu}
      loading={loading}
      error={error}
      onRetry={reload}
    />
  );
}
