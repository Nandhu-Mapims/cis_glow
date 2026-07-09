import { ModuleHub } from '../../components/PageShell';
import { useShellData } from '../../hooks/useShellData';
import { STUDENT_HUB_LINKS } from './studentModuleMeta';

export default function StudentHub() {
  const { settings, menu, loading, error, reload } = useShellData();
  return (
    <ModuleHub
      title="Student"
      subtitle="Profiles, admissions, alumni, attachments, and student reports"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Student' }]}
      links={STUDENT_HUB_LINKS}
      dashboardTitle="Student Module"
      settings={settings}
      menu={menu}
      loading={loading}
      error={error}
      onRetry={reload}
    />
  );
}
