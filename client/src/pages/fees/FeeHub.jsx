import { useOutletContext } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';
import { FEE_HUB_LINKS } from './feeModuleMeta';
import { FEE_BREADCRUMB_HUB } from './FeePageShell';

export default function FeeHub() {
  const { settings, menu } = useOutletContext();

  return (
    <ModuleHub
      title="Fees Module"
      breadcrumbs={[{ label: 'Home', to: '/dashboard' }, FEE_BREADCRUMB_HUB]}
      links={FEE_HUB_LINKS}
      dashboardTitle="Fees"
      settings={settings}
      menu={menu}
      loading={false}
      error={null}
    />
  );
}
