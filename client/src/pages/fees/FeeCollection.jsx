import { useShellData } from '../../hooks/useShellData';
import { FEE_SCREEN_META } from './feeModuleMeta';
import FeePageShell, { feeBackAction, feeScreenBreadcrumbs } from './FeePageShell';
import FeeCollectionPanel from './FeeCollectionPanel';

const META = FEE_SCREEN_META.collection;

export default function FeeCollection() {
  const { settings, menu, loading, error: shellError, reload } = useShellData();

  return (
    <FeePageShell
      settings={settings}
      menu={menu}
      loading={loading}
      error={shellError}
      onRetry={reload}
      breadcrumbs={feeScreenBreadcrumbs('collection')}
      title={META.title}
      legacy={META.legacy}
      actions={feeBackAction()}
    >
      <FeeCollectionPanel />
    </FeePageShell>
  );
}
