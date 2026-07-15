import { Link, useOutletContext } from 'react-router-dom';
import { ModuleHub } from '../../components/PageShell';
import { FEE_DELETE_HUB_LINKS, FEE_DELETE_BREADCRUMB } from './feeModuleMeta';
import { FEE_BREADCRUMB_HUB } from './FeePageShell';

export default function FeeDeleteHub() {
  const { settings, menu } = useOutletContext();

  return (
    <ModuleHub
      title="Receipt Delete Workflow"
      breadcrumbs={[
        { label: 'Home', to: '/dashboard' },
        FEE_BREADCRUMB_HUB,
        FEE_DELETE_BREADCRUMB,
      ]}
      links={FEE_DELETE_HUB_LINKS}
      dashboardTitle="Fee Delete"
      settings={settings}
      menu={menu}
      loading={false}
      error={null}
      actions={<Link to="/fees" className="btn btn-outline-secondary btn-sm">Back</Link>}
    />
  );
}
