import { Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { Breadcrumbs, PageError, PageLoading } from './PageShell';

export function ListPageHero({ title, subtitle, actions }) {
  return (
    <section className="cis-list-hero">
      <div>
        <h1 className="cis-list-hero-title">{title}</h1>
        {subtitle && <p className="cis-list-hero-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="cis-list-hero-actions">{actions}</div>}
    </section>
  );
}

export function ListFilterCard({ title = 'Filter', children }) {
  return (
    <aside className="cis-list-filter">
      <div className="cis-list-filter-head">{title}</div>
      <div className="cis-list-filter-body">{children}</div>
    </aside>
  );
}

export function ListRadioOption({ name, value, checked, onChange, label }) {
  return (
    <label className="cis-list-radio">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
      />
      <span>{label}</span>
    </label>
  );
}

export function ListResultCard({ to, primary, secondary, selected, icon = 'fa fa-user' }) {
  return (
    <Link to={to} className={`cis-list-result-card${selected ? ' is-selected' : ''}`}>
      <span className="cis-list-result-avatar" aria-hidden="true">
        <i className={icon} />
      </span>
      <span className="cis-list-result-body">
        <span className="cis-list-result-primary">{primary}</span>
        {secondary && <span className="cis-list-result-secondary">{secondary}</span>}
      </span>
      <span className="cis-list-result-arrow" aria-hidden="true">›</span>
    </Link>
  );
}

export function ListResultsPanel({
  title = 'Results',
  count,
  loading,
  loadingMessage = 'Searching…',
  error,
  empty,
  emptyMessage = 'No records found.',
  showEmpty,
  children,
  footnote,
}) {
  return (
    <section className="cis-list-results">
      <div className="cis-list-results-head">
        <h2 className="cis-list-results-title">{title}</h2>
        {typeof count === 'number' && count > 0 && (
          <span className="cis-list-results-count">
            {count}
            {' '}
            found
          </span>
        )}
      </div>

      {error && <div className="alert alert-danger mb-0">{error}</div>}

      {loading && (
        <div className="cis-list-status cis-list-status--loading">{loadingMessage}</div>
      )}

      {!loading && showEmpty && (
        <div className="cis-list-status cis-list-status--empty">{emptyMessage}</div>
      )}

      {!loading && !empty && children}

      {footnote && <p className="cis-list-footnote">{footnote}</p>}
    </section>
  );
}

export function ListSearchPage({
  breadcrumbs,
  title,
  subtitle,
  actions,
  filter,
  results,
  settings,
  menu,
  dashboardTitle,
  loading,
  pageError,
  onRetry,
}) {
  if (loading) {
    return <PageLoading message="Loading…" />;
  }

  if (pageError) {
    return <PageError message={pageError} onRetry={onRetry} />;
  }

  return (
    <DashboardLayout settings={settings} dashboard={{ title: dashboardTitle || title }} menu={menu}>
      <div className="cis-page cis-list-page">
        {breadcrumbs?.length > 0 && <Breadcrumbs items={breadcrumbs} />}
        <ListPageHero title={title} subtitle={subtitle} actions={actions} />
        <div className="cis-list-layout">
          {filter}
          {results}
        </div>
      </div>
    </DashboardLayout>
  );
}
