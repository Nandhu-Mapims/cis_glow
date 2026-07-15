import { Link, useOutletContext } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';
import { FEE_SETUP_HUB_LINKS, FEE_SETUP_BREADCRUMB } from './feeModuleMeta';
import { FEE_BREADCRUMB_HUB } from './FeePageShell';

export default function FeeSetupHub() {
  const { settings, menu } = useOutletContext();

  return (
    <ModuleHub
      title="Fee Setup"
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        FEE_BREADCRUMB_HUB,
        FEE_SETUP_BREADCRUMB,
      ]}
      links={FEE_SETUP_HUB_LINKS}
      dashboardTitle="Fee Setup"
      settings={settings}
      menu={menu}
      loading={false}
      error={null}
      actions={<Link to="/fees" className="btn btn-outline-secondary btn-sm">Back</Link>}
    />
  );
}
