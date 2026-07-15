import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { PageError, PageLoading } from '../components/PageShell';
import { useShellData } from '../hooks/useShellData';
import DashboardLayout from './DashboardLayout';

export default function AppShellLayout() {
  const { settings, menu, loading, error, reload } = useShellData();

  if (loading) {
    return <PageLoading message="Loading…" />;
  }

  if (error) {
    return <PageError message={error} onRetry={reload} />;
  }

  return (
    <DashboardLayout settings={settings} menu={menu}>
      <Suspense fallback={<PageLoading message="Loading…" />}>
        <Outlet context={{ settings, menu }} />
      </Suspense>
    </DashboardLayout>
  );
}
