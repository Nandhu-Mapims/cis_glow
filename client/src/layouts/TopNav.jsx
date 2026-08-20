import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import CommandPaletteTrigger from '../components/CommandPaletteTrigger';
import ThemeControlMenu from '../components/ThemeControlMenu';
import UserMenu from '../components/UserMenu';
import { isMenuLinkActive, buildMenuHref } from '../utils/legacyRoutes';
import { normalizeMenuQuery, searchMenuItems } from '../utils/menuUtils';

function MenuLink({ link, className, children, onNavigate }) {
  const modern = buildMenuHref(link);
  if (modern) {
    return (
      <Link to={modern} className={className} onClick={onNavigate}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={`#legacy-${link}`}
      className={className}
      title="Legacy module — migration pending"
      onClick={onNavigate}
    >
      {children}
    </a>
  );
}

function TopNavSearch({ value, onChange, results, pathname, search }) {
  const searching = Boolean(normalizeMenuQuery(value));
  return (
    <div className="cis-topnav-search cis-topnav-search--compact">
      <label className="visually-hidden" htmlFor="cis-topnav-search-desktop">
        Search menu
      </label>
      <i className="fa fa-search cis-topnav-search-icon" aria-hidden="true" />
      <input
        id="cis-topnav-search-desktop"
        type="search"
        className="cis-topnav-search-input"
        placeholder="Search menu…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      {value ? (
        <button
          type="button"
          className="cis-topnav-search-clear"
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          <i className="fa fa-times" aria-hidden="true" />
        </button>
      ) : null}
      {searching ? (
        <div className="cis-topnav-search-results" role="listbox">
          {results.length ? results.map((item) => {
            const active = isMenuLinkActive(item.link, pathname, search);
            return (
              <MenuLink
                key={item.id}
                link={item.link}
                className={`cis-topnav-panel-link${active ? ' is-active' : ''}`}
                onNavigate={() => onChange('')}
              >
                <i className={item.categoryIcon || item.icon || 'fa fa-circle-o'} aria-hidden="true" />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.category}</small>
                </span>
              </MenuLink>
            );
          }) : (
            <div className="cis-topnav-empty">No menu items match your search.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function formatLastLogin(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Slim desktop-only tools bar (search, circulars, settings, theme, account).
 * Navigation itself lives in the left Sidebar; the mobile equivalent of this
 * bar is Header.jsx. */
export default function TopNav({ menu = [], lastLoginAt = null, className = '' }) {
  const { pathname, search } = useLocation();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchMenuItems(menu, query), [menu, query]);

  return (
    <nav className={`cis-topnav cis-topnav-slim d-none d-lg-block ${className}`.trim()} aria-label="Toolbar">
      <div className="cis-topnav-bar cis-topnav-bar-single">
        <div className="cis-topnav-tools">
          <TopNavSearch
            value={query}
            onChange={setQuery}
            results={results}
            pathname={pathname}
            search={search}
          />
          {lastLoginAt && (
            <span className="cis-topnav-lastlogin d-none d-xl-inline-flex" title="Last successful login">
              <i className="fa fa-clock-o" aria-hidden="true" />
              <span>
                <small>Last login</small>
                {formatLastLogin(lastLoginAt)}
              </span>
            </span>
          )}
          <CommandPaletteTrigger />
          <Link to="/circular" className="cis-topnav-iconbtn" title="Circulars & announcements" aria-label="Circulars & announcements">
            <i className="fa fa-bell-o" aria-hidden="true" />
          </Link>
          <Link to="/settings" className="cis-topnav-iconbtn" title="Settings" aria-label="Settings">
            <i className="fa fa-cog" aria-hidden="true" />
          </Link>
          <ThemeControlMenu />
          <span className="cis-topnav-tools-divider" aria-hidden="true" />
          <UserMenu variant="dark" compact />
        </div>
      </div>
    </nav>
  );
}
