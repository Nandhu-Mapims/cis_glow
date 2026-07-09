import DashboardLayout from '../../layouts/DashboardLayout';
import { Breadcrumbs, PageError, PageHeader, PageLoading } from '../../components/PageShell';

export const STUDENT_BREADCRUMB_HUB = { label: 'Student', to: '/students/hub' };

export function legacyPageSubtitle(legacy) {
  if (!legacy) return undefined;
  return (
    <>
      Legacy:
      {' '}
      <code>{legacy}</code>
    </>
  );
}

/**
 * Shared layout for student module screens (admission, profile, reports, sub-screens).
 */
export default function StudentPageShell({
  settings,
  menu,
  loading = false,
  error = null,
  onRetry,
  dashboardTitle = 'Student',
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
      <div className="cis-page cis-student-page">
        {breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
        <PageHeader title={title} subtitle={pageSubtitle} actions={actions} />
        {notice}
        {children}
      </div>
    </DashboardLayout>
  );
}
