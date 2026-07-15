import { useOutletContext } from 'react-router-dom';
import { FEE_SCREEN_META } from './feeModuleMeta';
import FeePageShell, { feeBackAction, feeScreenBreadcrumbs } from './FeePageShell';
import FeeCollectionPanel from './FeeCollectionPanel';

const META = FEE_SCREEN_META.collection;

export default function FeeCollection() {
  const { settings, menu } = useOutletContext();

  return (
    <FeePageShell
      settings={settings}
      menu={menu}
      loading={false}
      error={null}
      breadcrumbs={feeScreenBreadcrumbs('collection')}
      title={META.title}
      legacy={META.legacy}
      actions={feeBackAction()}
    >
      <FeeCollectionPanel />
    </FeePageShell>
  );
}
