import DashboardLayout from '../../layouts/DashboardLayout';
import { Breadcrumbs, PageError, PageHeader, PageLoading } from '../../components/PageShell';

export const STAFF_BREADCRUMB_HUB = { label: 'Staff', to: '/staff/hub' };

/**
 * Shared layout for staff module screens (admission, profile, reports, sub-screens).
 * Mirrors StudentPageShell so the two high-traffic profile modules stay visually consistent.
 */
export default function StaffPageShell({
  settings,
  menu,
  loading = false,
  error = null,
  onRetry,
  dashboardTitle = 'Staff',
  breadcrumbs = [],
  title,
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

  return (
    <DashboardLayout settings={settings} dashboard={{ title: dashboardTitle }} menu={menu}>
      <div className="cis-page cis-staff-page">
        {breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
        <PageHeader title={title} subtitle={subtitle} actions={actions} />
        {notice}
        {children}
      </div>
    </DashboardLayout>
  );
}
