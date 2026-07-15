import { Link } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Breadcrumbs, PageError, PageHeader, PageLoading } from '../../components/PageShell';
import { FEE_SCREEN_META } from './feeModuleMeta';

export const FEE_BREADCRUMB_HUB = { label: 'Fees', to: '/fees' };

export function legacyPageSubtitle() {
  return undefined;
}

/**
 * Shared layout for fee module screens (dashboard, collection, setup, delete workflow).
 */
export default function FeePageShell({
  settings,
  menu,
  loading = false,
  error = null,
  onRetry,
  dashboardTitle = 'Fees',
  breadcrumbs = [],
  title,
  legacy,
  subtitle,
  actions,
  notice,
  children,
}) {
  if (loading) {
    return <PageLoading message="Loading…" />;
  }

  if (error && !settings) {
    return <PageError message={error} onRetry={onRetry} />;
  }

  const pageSubtitle = subtitle ?? legacyPageSubtitle(legacy);

  return (
    <DashboardLayout settings={settings} dashboard={{ title: dashboardTitle }} menu={menu}>
      <div className="cis-page cis-fee-page">
        {breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
        <PageHeader title={title} subtitle={pageSubtitle} actions={actions} />
        {notice}
        {children}
      </div>
    </DashboardLayout>
  );
}

export function feeBackAction(to = '/fees') {
  return (
    <Link to={to} className="btn btn-outline-secondary btn-sm">
      Back
    </Link>
  );
}

export function feeHomeBreadcrumbs(...trail) {
  return [
    { label: 'Home', to: '/dashboard' },
    FEE_BREADCRUMB_HUB,
    ...trail,
  ];
}

export function feeScreenBreadcrumbs(screenKey) {
  const meta = FEE_SCREEN_META[screenKey];
  if (!meta) return feeHomeBreadcrumbs();
  const trail = [];
  if (meta.parentBreadcrumb) trail.push(meta.parentBreadcrumb);
  trail.push({ label: meta.breadcrumbLabel });
  return feeHomeBreadcrumbs(...trail);
}
