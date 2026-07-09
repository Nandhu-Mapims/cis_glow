import { Link } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';
import { useShellData } from '../../hooks/useShellData';
import { ACADEMIC_SETTINGS_LINKS, SETTINGS_SCREEN_META } from './settingsSetupMeta';

const NATIVE_LINKS = Object.entries(SETTINGS_SCREEN_META).map(([screen, meta]) => ({
  to: `/settings/setup/${screen}`,
  title: meta.title,
  desc: `Legacy: ${meta.legacy}`,
  icon: 'fa fa-cog',
  section: meta.section,
}));

export default function SettingsSetupHub() {
  const { settings, menu, loading, error, reload } = useShellData();

  return (
    <ModuleHub
      title="Settings Setup"
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        { label: 'Settings', to: '/settings' },
        { label: 'Setup' },
      ]}
      links={[...NATIVE_LINKS, ...ACADEMIC_SETTINGS_LINKS]}
      dashboardTitle="Settings Setup"
      settings={settings}
      menu={menu}
      loading={loading}
      error={error}
      onRetry={reload}
      actions={<Link to="/settings" className="btn btn-outline-secondary btn-sm">Back</Link>}
    />
  );
}
