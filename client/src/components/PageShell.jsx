import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { LEGACY_ROUTE_MAP } from '../utils/legacyRoutes';

// Reverse of LEGACY_ROUTE_MAP: modern route -> set of legacy php filenames that lead there.
const ROUTE_TO_LEGACY = (() => {
  const map = new Map();
  Object.entries(LEGACY_ROUTE_MAP).forEach(([php, route]) => {
    const base = route.split('?')[0];
    if (!map.has(base)) map.set(base, new Set());
    map.get(base).add(php);
  });
  return map;
})();

function buildAllowedLegacyLinks(menu) {
  const set = new Set();
  (menu || []).forEach((category) => {
    (category.mainMenus || []).forEach((mainMenu) => {
      (mainMenu.subMenus || []).forEach((sub) => {
        if (sub.link) set.add(String(sub.link).trim().toLowerCase());
      });
    });
  });
  return set;
}

// Hide a hub tile only when we can positively confirm the user lacks access to every
// legacy screen behind it. Routes with no known legacy mapping, or while permission
// data hasn't loaded yet, are left visible — false negatives (wrongly hiding a screen
// the user can use) are worse than false positives here.
function filterLinksByPermission(links, menu) {
  const allowed = buildAllowedLegacyLinks(menu);
  if (allowed.size === 0) return links;
  return links.filter((item) => {
    const base = String(item.to || '').split('?')[0];
    const legacyFiles = ROUTE_TO_LEGACY.get(base);
    if (!legacyFiles) return true;
    return [...legacyFiles].some((php) => allowed.has(php));
  });
}

export function PageLoading({ message = 'Loading…' }) {
  return (
    <div className="cis-page-loading">
      <div className="spinner-border" role="status">
        <span className="visually-hidden">{message}</span>
      </div>
      <span>{message}</span>
    </div>
  );
}

export function PageError({ message, onRetry }) {
  return (
    <div className="cis-page-loading">
      <div className="alert alert-danger mb-0">{message}</div>
      {onRetry && (
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;

  return (
    <nav aria-label="breadcrumb">
      <ol className="breadcrumb">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const key = `${item.label}-${index}`;
          if (isLast || !item.to) {
            return (
              <li key={key} className="breadcrumb-item active" aria-current="page">
                {item.label}
              </li>
            );
          }
          return (
            <li key={key} className="breadcrumb-item">
              <Link to={item.to}>{item.label}</Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="cis-page-header">
      <div>
        <h1 className="cis-page-title">{title}</h1>
        {subtitle && <p className="cis-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="cis-page-actions">{actions}</div>}
    </div>
  );
}

/**
 * Shared chrome for setup / report screens across modules.
 * Wraps DashboardLayout + breadcrumbs + PageHeader + optional alerts + card body.
 */
export function SetupPageShell({
  settings,
  menu,
  title,
  subtitle,
  breadcrumbs = [],
  backTo,
  backLabel = 'Back',
  actions = null,
  loading = false,
  alerts = null,
  cardClassName = 'cis-setup-card',
  rootClassName = 'cis-setup-root',
  bodyRef = null,
  children,
}) {
  if (loading) {
    return (
      <DashboardLayout settings={settings} dashboard={{ title }} menu={menu}>
        <PageLoading />
      </DashboardLayout>
    );
  }

  const headerActions = actions ?? (
    backTo ? (
      <Link to={backTo} className="btn btn-outline-secondary btn-sm">
        {backLabel}
      </Link>
    ) : null
  );

  return (
    <DashboardLayout settings={settings} dashboard={{ title }} menu={menu}>
      <div className="cis-page">
        <Breadcrumbs items={breadcrumbs} />
        <PageHeader title={title} subtitle={subtitle} actions={headerActions} />
        {alerts}
        <div className={`card ${cardClassName}`}>
          <div className={`card-body ${rootClassName}`} ref={bodyRef}>{children}</div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function normalizeHubLink(item) {
  const title = item.title || item.label || 'Screen';
  const desc = item.desc || 'Open this screen';
  const icon = item.icon || 'fa fa-angle-right';
  return { ...item, title, desc, icon };
}

function groupHubLinks(links) {
  const normalized = links.map(normalizeHubLink);
  const hasSections = normalized.some((item) => item.section);
  if (!hasSections) {
    return [{ section: null, links: normalized }];
  }

  const groups = new Map();
  normalized.forEach((item) => {
    const key = item.section || 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  return Array.from(groups.entries()).map(([section, sectionLinks]) => ({
    section,
    links: sectionLinks,
  }));
}

export function HubCard({ to, title, desc, icon = 'fa fa-angle-right', legacy }) {
  const link = normalizeHubLink({ to, title, desc, icon, legacy });
  return (
    <Link to={link.to} className="cis-hub-tile">
      <span className="cis-hub-tile-icon" aria-hidden="true">
        <i className={link.icon} />
      </span>
      <span className="cis-hub-tile-body">
        <span className="cis-hub-tile-title">{link.title}</span>
        <span className="cis-hub-tile-desc">{link.desc}</span>
      </span>
      <span className="cis-hub-tile-arrow" aria-hidden="true">›</span>
    </Link>
  );
}

function HubLinkGrid({ links }) {
  return (
    <div className="cis-hub-grid">
      {links.map((item) => (
        <HubCard
          key={item.to}
          to={item.to}
          title={item.title}
          desc={item.desc}
          icon={item.icon}
          legacy={item.legacy}
        />
      ))}
    </div>
  );
}

export function ModuleHub({
  title,
  subtitle,
  breadcrumbs = [],
  links = [],
  actions,
  dashboardTitle,
  settings,
  menu,
  loading,
  error,
  onRetry,
  children,
}) {
  if (loading) {
    return <PageLoading />;
  }

  if (error) {
    return <PageError message={error} onRetry={onRetry} />;
  }

  const visibleLinks = useMemo(() => filterLinksByPermission(links, menu), [links, menu]);
  const normalizedLinks = visibleLinks.map(normalizeHubLink);
  const sections = groupHubLinks(visibleLinks);
  const screenCount = normalizedLinks.length;
  const heroSubtitle = subtitle || `Choose a screen below — ${screenCount} available in this module.`;

  return (
    <DashboardLayout settings={settings} dashboard={{ title: dashboardTitle || title }} menu={menu}>
      <div className="cis-page cis-hub-page">
        <Breadcrumbs items={breadcrumbs} />

        <section className="cis-hub-hero">
          <div className="cis-hub-hero-copy">
            <h1 className="cis-hub-hero-title">{title}</h1>
            <p className="cis-hub-hero-subtitle">{heroSubtitle}</p>
          </div>
          <div className="cis-hub-hero-aside">
            {actions}
            <div className="cis-hub-hero-stat" aria-label={`${screenCount} screens`}>
              <strong>{screenCount}</strong>
              <span>screens</span>
            </div>
          </div>
        </section>

        {children || (
          sections.length === 1 && !sections[0].section ? (
            <HubLinkGrid links={sections[0].links} />
          ) : (
            sections.map(({ section, links: sectionLinks }) => (
              <section key={section || 'default'} className="cis-hub-section">
                {section && <h2 className="cis-hub-section-title">{section}</h2>}
                <HubLinkGrid links={sectionLinks} />
              </section>
            ))
          )
        )}
      </div>
    </DashboardLayout>
  );
}
