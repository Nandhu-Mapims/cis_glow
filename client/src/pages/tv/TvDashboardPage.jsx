import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Breadcrumbs, PageHeader, PageLoading } from '../../components/PageShell';
import DashboardLayout from '../../layouts/DashboardLayout';

export default function TvDashboardPage() {
  const [settings, setSettings] = useState(null);
  const [menu, setMenu] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [settingsRes, menuRes, dashRes] = await Promise.all([
        api.get('/api/settings/basic'),
        api.get('/api/menu'),
        api.get('/api/tv/dashboard'),
      ]);
      setSettings(settingsRes.data);
      setMenu(menuRes.data.menu || []);
      setData(dashRes.data);
      setLoading(false);
    })();
  }, []);

  if (loading) return <DashboardLayout settings={settings} menu={menu}><PageLoading /></DashboardLayout>;

  return (
    <DashboardLayout settings={settings} menu={menu}>
      <Breadcrumbs items={[{ label: 'Home', to: '/dashboard' }, { label: 'TV', to: '/tv' }, { label: 'Dashboard' }]} />
      <PageHeader title="TV Dashboard" subtitle="Legacy: tv/dashboard.php" />
      <div className="row g-3 mb-4">
        <div className="col-md-4"><div className="card p-3"><strong>Widgets</strong><div className="fs-3">{data?.summary?.widgets ?? 0}</div></div></div>
        <div className="col-md-4"><div className="card p-3"><strong>Videos</strong><div className="fs-3">{data?.summary?.videos ?? 0}</div></div></div>
        <div className="col-md-4"><div className="card p-3"><strong>Access rules</strong><div className="fs-3">{data?.summary?.access ?? 0}</div></div></div>
      </div>
      <table className="table table-sm table-bordered">
        <thead><tr><th>Page</th><th>Operation</th><th>Status</th><th>User</th><th>When</th></tr></thead>
        <tbody>
          {(data?.recentLogs || []).map((log) => (
            <tr key={log.id}><td>{log.page}</td><td>{log.operation}</td><td>{log.status}</td><td>{log.username}</td><td>{String(log.timestamp || '').slice(0, 19)}</td></tr>
          ))}
        </tbody>
      </table>
    </DashboardLayout>
  );
}
