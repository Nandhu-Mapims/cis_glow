import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { Breadcrumbs, ModuleHub, PageHeader, PageLoading } from './PageShell';
import DashboardLayout from '../layouts/DashboardLayout';
import SetupAlerts from '../pages/fees/setup/SetupAlerts';
import '../pages/admin/AdminSetupPage.css';

export function createModuleSetupPage({
  moduleTitle,
  hubPath,
  metaMap,
  components,
  useSetupApi,
}) {
  return function ModuleSetupPage({ screen: screenProp, initialFields = null }) {
    const { screen: routeScreen } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const screen = screenProp || routeScreen;
    const meta = metaMap[screen];
    const ScreenComponent = components[screen];
    const initialFieldsRef = useRef(initialFields);
    const legacyLabel = searchParams.get('legacy') || meta?.legacy;

    const { data, busy, error, notice, setError, setNotice, load, save } = useSetupApi(screen);
    const [settings, setSettings] = useState(null);
    const [menu, setMenu] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      if (!meta?.legacy || searchParams.get('legacy')) return;
      setSearchParams({ legacy: meta.legacy }, { replace: true });
    }, [meta, searchParams, setSearchParams]);

    useEffect(() => {
      const init = async () => {
        if (!meta) {
          setLoading(false);
          return;
        }
        setLoading(true);
        try {
          const [settingsRes, menuRes] = await Promise.all([
            api.get('/api/settings/basic'),
            api.get('/api/menu'),
          ]);
          setSettings(settingsRes.data);
          setMenu(menuRes.data.menu || []);
          await load(initialFieldsRef.current || meta.initialLoadFields || {});
          initialFieldsRef.current = null;
        } finally {
          setLoading(false);
        }
      };
      init();
    }, [meta, load]);

    const handleLoad = useCallback((fields, query) => {
      setError(null);
      return load(fields, query);
    }, [load, setError]);

    const handleSave = useCallback((fields, files = []) => {
      setError(null);
      return save(fields, files);
    }, [save, setError]);

    if (!meta) {
      return (
        <DashboardLayout settings={settings} menu={menu}>
          <div className="alert alert-warning">Unknown screen.</div>
          <Link to={hubPath}>Back to {moduleTitle}</Link>
        </DashboardLayout>
      );
    }

    if (loading) {
      return (
        <DashboardLayout settings={settings} menu={menu}>
          <PageLoading />
        </DashboardLayout>
      );
    }

    return (
      <DashboardLayout settings={settings} menu={menu}>
        <Breadcrumbs items={[
          { label: 'Home', to: '/dashboard' },
          { label: moduleTitle, to: hubPath.replace('/setup', '') },
          { label: 'Setup', to: hubPath },
          { label: meta.title },
        ]} />
        <PageHeader
          title={meta.title}
          subtitle={meta.desc || (legacyLabel ? `Legacy: ${legacyLabel}` : undefined)}
          actions={<Link to={hubPath} className="btn btn-outline-secondary btn-sm">Back</Link>}
        />
        <SetupAlerts notice={notice} error={error} busy={busy} onDismissNotice={() => setNotice(null)} />
        {ScreenComponent ? (
          <div className="card admin-setup-card">
            <div className="card-body admin-setup-root admin-native-root">
              <ScreenComponent
                data={data}
                busy={busy}
                readOnly={meta.readOnly}
                onLoad={handleLoad}
                onSave={handleSave}
              />
            </div>
          </div>
        ) : (
          <p className="text-muted">No form available for this screen.</p>
        )}
      </DashboardLayout>
    );
  };
}

export function createModuleSetupHub({ title, basePath, metaMap, extraLinks = [], parentPath = null }) {
  return function ModuleSetupHubPage() {
    const [settings, setSettings] = useState(null);
    const [menu, setMenu] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const reload = async () => {
      setLoading(true);
      setError(null);
      try {
        const [settingsRes, menuRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load hub');
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => { reload(); }, []);

    const links = Object.entries(metaMap).map(([screen, meta]) => ({
      to: `${basePath}/setup/${screen}`,
      title: meta.title,
      desc: meta.desc || `Legacy: ${meta.legacy}`,
      icon: meta.icon || 'fa fa-cog',
      section: meta.section || 'Screens',
    }));

    return (
      <ModuleHub
        title={`${title} Setup`}
        breadcrumbs={[
          { label: 'Home', to: '/dashboard' },
          ...(parentPath ? [{ label: title, to: parentPath }] : [{ label: title }]),
          { label: 'Setup' },
        ]}
        links={[...links, ...extraLinks]}
        dashboardTitle={`${title} Setup`}
        settings={settings}
        menu={menu}
        loading={loading}
        error={error}
        onRetry={reload}
        actions={parentPath ? <Link to={parentPath} className="btn btn-outline-secondary btn-sm">Back</Link> : null}
      />
    );
  };
}

export function createModuleHub({ title, basePath, metaMap, extraLinks = [], dashboardPath = null }) {
  return function ModuleHubPage() {
    const [settings, setSettings] = useState(null);
    const [menu, setMenu] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const reload = async () => {
      setLoading(true);
      setError(null);
      try {
        const [settingsRes, menuRes] = await Promise.all([
          api.get('/api/settings/basic'),
          api.get('/api/menu'),
        ]);
        setSettings(settingsRes.data);
        setMenu(menuRes.data.menu || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load hub');
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => { reload(); }, []);

    const links = [
      ...(dashboardPath ? [{ to: dashboardPath, title: `${title} Dashboard`, desc: 'Summary view', icon: 'fa fa-dashboard', section: 'Overview' }] : []),
      { to: `${basePath}/setup`, title: `${title} Setup`, desc: 'All module screens', icon: 'fa fa-cog', section: 'Setup' },
      ...Object.entries(metaMap).map(([screen, meta]) => ({
        to: `${basePath}/setup/${screen}`,
        title: meta.title,
        desc: meta.desc || `Legacy: ${meta.legacy}`,
        icon: meta.icon || 'fa fa-file-text-o',
        section: meta.section || 'Screens',
      })),
      ...extraLinks,
    ];

    return (
      <ModuleHub
        title={title}
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: title }]}
        links={links}
        dashboardTitle={title}
        settings={settings}
        menu={menu}
        loading={loading}
        error={error}
        onRetry={reload}
      />
    );
  };
}
