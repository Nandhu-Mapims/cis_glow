import { Link } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';
import { useShellData } from '../../hooks/useShellData';
import { FEE_HUB_LINKS } from './feeModuleMeta';
import { FEE_BREADCRUMB_HUB } from './FeePageShell';

export default function FeeHub() {
  const { settings, menu, loading, error, reload } = useShellData();

  return (
    <ModuleHub
      title="Fees Module"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, FEE_BREADCRUMB_HUB]}
      links={FEE_HUB_LINKS}
      dashboardTitle="Fees"
      settings={settings}
      menu={menu}
      loading={loading}
      error={error}
      onRetry={reload}
    />
  );
}
