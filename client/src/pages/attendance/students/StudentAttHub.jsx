import { ModuleHub } from '../../../components/PageShell';
import { useShellData } from '../../../hooks/useShellData';
import { STUDENT_ATT_HUB_LINKS } from './studentAttMeta';

export default function StudentAttHub() {
  const { settings, menu, loading, error, reload } = useShellData();
  return (
    <ModuleHub
      title="Student Attendance"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Attendance', to: '/attendance' }, { label: 'Student Attendance' }]}
      links={STUDENT_ATT_HUB_LINKS}
      dashboardTitle="Student Attendance"
      settings={settings}
      menu={menu}
      loading={loading}
      error={error}
      onRetry={reload}
    />
  );
}
