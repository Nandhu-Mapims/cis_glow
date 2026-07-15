import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { ModuleHub, PageError, SetupPageShell } from './PageShell';
import SetupAlerts from './SetupAlerts';
import { cleanLegacyKey } from '../utils/legacyRoutes';
import '../pages/admin/AdminSetupPage.css';

export function createModuleSetupPage({
  moduleTitle,
  hubPath,
  metaMap,
  components,
  useSetupApi,
}) {
  return function ModuleSetupPage({ screen: screenProp, initialFields = null }) {
    const { settings, menu } = useOutletContext();
    const { screen: routeScreen } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const screen = screenProp || routeScreen;
    const meta = metaMap[screen];
    const ScreenComponent = components[screen];
    const initialFieldsRef = useRef(initialFields);

    const { data, busy, error, notice, setError, setNotice, load, save } = useSetupApi(screen);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      if (!meta?.legacy || searchParams.get('view')) return;
      setSearchParams({ view: cleanLegacyKey(meta.legacy) }, { replace: true });
    }, [meta, searchParams, setSearchParams]);

    useEffect(() => {
      const init = async () => {
        if (!meta) {
          setLoading(false);
          return;
        }
        setLoading(true);
        try {
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
        <SetupPageShell
          settings={settings}
          menu={menu}
          title={moduleTitle}
          breadcrumbs={[
            { label: 'Home', to: '/dashboard' },
            { label: moduleTitle, to: hubPath.replace('/setup', '') },
            { label: 'Setup', to: hubPath },
            { label: 'Unknown' },
          ]}
          backTo={hubPath}
        >
          <PageError message="Unknown screen." />
          <Link to={hubPath}>Back to {moduleTitle}</Link>
        </SetupPageShell>
      );
    }

    return (
      <SetupPageShell
        settings={settings}
        menu={menu}
        title={meta.title}
        subtitle={meta.desc}
        breadcrumbs={[
          { label: 'Home', to: '/dashboard' },
          { label: moduleTitle, to: hubPath.replace('/setup', '') },
          { label: 'Setup', to: hubPath },
          { label: meta.title },
        ]}
        backTo={hubPath}
        loading={loading}
        alerts={(
          <SetupAlerts
            notice={notice}
            error={error}
            busy={busy}
            onDismissNotice={() => setNotice(null)}
          />
        )}
        cardClassName="cis-setup-card admin-setup-card"
        rootClassName="cis-setup-root admin-setup-root admin-native-root"
      >
        {ScreenComponent ? (
          <ScreenComponent
            data={data}
            busy={busy}
            readOnly={meta.readOnly}
            onLoad={handleLoad}
            onSave={handleSave}
          />
        ) : (
          <p className="text-muted mb-0">No form available for this screen.</p>
        )}
      </SetupPageShell>
    );
  };
}

export function createModuleSetupHub({ title, basePath, metaMap, extraLinks = [], parentPath = null }) {
  return function ModuleSetupHubPage() {
    const { settings, menu } = useOutletContext();

    const links = Object.entries(metaMap).map(([screen, meta]) => ({
      to: `${basePath}/setup/${screen}`,
      title: meta.title,
      desc: meta.desc,
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
        loading={false}
        error={null}
        actions={parentPath ? <Link to={parentPath} className="btn btn-outline-secondary btn-sm">Back</Link> : null}
      />
    );
  };
}

export function createModuleHub({ title, basePath, metaMap, extraLinks = [], dashboardPath = null }) {
  return function ModuleHubPage() {
    const { settings, menu } = useOutletContext();

    const links = [
      ...(dashboardPath ? [{ to: dashboardPath, title: `${title} Dashboard`, desc: 'Summary view', icon: 'fa fa-dashboard', section: 'Overview' }] : []),
      { to: `${basePath}/setup`, title: `${title} Setup`, desc: 'All module screens', icon: 'fa fa-cog', section: 'Setup' },
      ...Object.entries(metaMap).map(([screen, meta]) => ({
        to: `${basePath}/setup/${screen}`,
        title: meta.title,
        desc: meta.desc,
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
        loading={false}
        error={null}
      />
    );
  };
}
