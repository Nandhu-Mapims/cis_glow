import { Link } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';
import { useShellData } from '../../hooks/useShellData';
import { ACADEMIC_SETTINGS_LINKS, SETTINGS_SCREEN_META } from './settingsSetupMeta';

const NATIVE_LINKS = Object.entries(SETTINGS_SCREEN_META).map(([screen, meta]) => ({
  to: `/settings/setup/${screen}`,
  title: meta.title,
  desc: `Legacy: ${meta.legacy}`,
  icon: 'fa fa-wrench',
  section: meta.section,
}));

const ALL_LINKS = [...NATIVE_LINKS, ...ACADEMIC_SETTINGS_LINKS];

export default function SettingsHub() {
  const { settings, menu, loading, error, reload } = useShellData();

  return (
    <ModuleHub
      title="Settings"
      subtitle="Institution setup, academic configuration, and system preferences"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Settings' }]}
      links={ALL_LINKS}
      dashboardTitle="Settings"
      settings={settings}
      menu={menu}
      loading={loading}
      error={error}
      onRetry={reload}
      actions={<Link to="/settings/setup" className="btn btn-outline-primary btn-sm">All setup screens</Link>}
    />
  );
}
