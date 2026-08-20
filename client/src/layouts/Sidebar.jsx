import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import CommandPaletteTrigger from '../components/CommandPaletteTrigger';
import ThemeControlMenu from '../components/ThemeControlMenu';
import UserMenu from '../components/UserMenu';
import { buildMenuHref, isMenuLinkActive } from '../utils/legacyRoutes';
import {
  categoryIsActive,
  flattenCategoryItems,
  normalizeMenuQuery,
  resolveMenuIcon,
  searchMenuItems,
} from '../utils/menuUtils';

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

export function SidebarSearch({ value, onChange, results, pathname, search, onNavigate, inputRef }) {
  const searching = Boolean(normalizeMenuQuery(value));
  return (
    <div className="cis-sidebar-search">
      <label className="visually-hidden" htmlFor="cis-sidebar-search-input">
        Search menu
      </label>
      <i className="fa fa-search cis-sidebar-search-icon" aria-hidden="true" />
      <input
        ref={inputRef}
        id="cis-sidebar-search-input"
        type="search"
        className="cis-sidebar-search-input"
        placeholder="Search menu…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      {value ? (
        <button
          type="button"
          className="cis-sidebar-search-clear"
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          <i className="fa fa-times" aria-hidden="true" />
        </button>
      ) : null}
      {searching ? (
        <div className="cis-sidebar-search-results" role="listbox">
          {results.length ? results.map((item) => {
            const active = isMenuLinkActive(item.link, pathname, search);
            return (
              <MenuLink
                key={item.id}
                link={item.link}
                className={`cis-topnav-panel-link${active ? ' is-active' : ''}`}
                onNavigate={() => {
                  onChange('');
                  onNavigate?.();
                }}
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

/** One category's row in the vertical menu. Expanded desktop/mobile renders
 * an inline accordion; collapsed desktop (icon rail) renders a fixed-position
 * flyout instead, since the rail has no room for labels. */
function SidebarCategory({ category, collapsed, pathname, search, onNavigate }) {
  const items = useMemo(() => flattenCategoryItems(category), [category]);
  const active = categoryIsActive(category, pathname, search);
  const [open, setOpen] = useState(active);
  const [flyout, setFlyout] = useState(null);
  const btnRef = useRef(null);
  const closeTimer = useRef(null);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  if (!items.length) return null;

  if (items.length === 1) {
    const item = items[0];
    const itemActive = isMenuLinkActive(item.link, pathname, search);
    return (
      <li className={`cis-sidebar-item${itemActive ? ' is-active' : ''}`}>
        <MenuLink link={item.link} className="cis-sidebar-link" onNavigate={onNavigate}>
          <i className={item.icon} aria-hidden="true" />
          <span className="cis-sidebar-link-label">{category.name}</span>
        </MenuLink>
      </li>
    );
  }

  const icon = resolveMenuIcon(category.icon);

  if (collapsed) {
    const openFlyout = () => {
      clearTimeout(closeTimer.current);
      const rect = btnRef.current?.getBoundingClientRect();
      if (rect) setFlyout({ top: rect.top, left: rect.right + 8 });
    };
    const scheduleClose = () => {
      clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(() => setFlyout(null), 150);
    };
    return (
      <li
        className={`cis-sidebar-item${active ? ' is-active' : ''}`}
        onMouseEnter={openFlyout}
        onMouseLeave={scheduleClose}
      >
        <button
          type="button"
          ref={btnRef}
          className="cis-sidebar-link cis-sidebar-link-collapsed"
          onClick={openFlyout}
          aria-haspopup="menu"
          aria-expanded={Boolean(flyout)}
          title={category.name}
        >
          <i className={icon} aria-hidden="true" />
        </button>
        {flyout ? (
          <div
            className="cis-sidebar-flyout"
            style={{ top: flyout.top, left: flyout.left }}
            onMouseEnter={() => clearTimeout(closeTimer.current)}
            onMouseLeave={scheduleClose}
            role="menu"
          >
            <div className="cis-sidebar-flyout-label">{category.name}</div>
            <ul className="cis-topnav-panel-list">
              {items.map((item) => (
                <li key={item.id}>
                  <MenuLink
                    link={item.link}
                    className={`cis-topnav-panel-link${isMenuLinkActive(item.link, pathname, search) ? ' is-active' : ''}`}
                    onNavigate={() => {
                      setFlyout(null);
                      onNavigate?.();
                    }}
                  >
                    <i className={item.icon} aria-hidden="true" />
                    <span>{item.label}</span>
                  </MenuLink>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <li className={`cis-sidebar-item${open ? ' is-open' : ''}${active ? ' is-active' : ''}`}>
      <button
        type="button"
        className="cis-sidebar-link cis-sidebar-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <i className={icon} aria-hidden="true" />
        <span className="cis-sidebar-link-label">{category.name}</span>
        <i className={`fa fa-angle-down cis-sidebar-caret${open ? ' is-open' : ''}`} aria-hidden="true" />
      </button>
      <div className="cis-sidebar-panel" role="menu" aria-hidden={!open}>
        <ul className="cis-topnav-panel-list">
          {items.map((item) => (
            <li key={item.id}>
              <MenuLink
                link={item.link}
                className={`cis-topnav-panel-link${isMenuLinkActive(item.link, pathname, search) ? ' is-active' : ''}`}
                onNavigate={onNavigate}
              >
                <i className={item.icon} aria-hidden="true" />
                <span>{item.label}</span>
              </MenuLink>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

function SidebarBrand({ shortName, logoUrl, onNavigate }) {
  return (
    <Link to="/dashboard" className="cis-sidebar-brand" onClick={onNavigate}>
      <span className="cis-sidebar-logo">
        <img src={logoUrl} alt="" />
      </span>
      <span className="cis-sidebar-brand-text">
        <strong>{shortName}</strong>
        <small>Campus Information</small>
      </span>
    </Link>
  );
}

export default function Sidebar({
  settings,
  menu = [],
  lastLoginAt = null,
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onMobileClose,
}) {
  const { pathname, search } = useLocation();
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  const logoUrl = '/img/institution-logo.png';
  const shortName = settings?.institutionShortName || 'CIS';
  const results = useMemo(() => searchMenuItems(menu, query), [menu, query]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const timer = setTimeout(() => searchRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [mobileOpen]);

  const handleNavigate = () => {
    setQuery('');
    onMobileClose?.();
  };

  return (
    <>
      <aside
        className={`cis-sidebar d-none d-lg-flex${collapsed ? ' is-collapsed' : ''}`}
        aria-label="Main navigation"
      >
        <SidebarBrand shortName={shortName} logoUrl={logoUrl} />

        <nav className="cis-sidebar-scroll">
          <ul className="cis-sidebar-menu">
            {menu.map((category) => (
              <SidebarCategory
                key={category.id}
                category={category}
                collapsed={collapsed}
                pathname={pathname}
                search={search}
                onNavigate={() => {}}
              />
            ))}
          </ul>
        </nav>

        <div className="cis-sidebar-footer">
          <button
            type="button"
            className="cis-sidebar-collapse-btn"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            title={collapsed ? 'Expand menu' : 'Collapse menu'}
          >
            <i className={`fa ${collapsed ? 'fa-angle-double-right' : 'fa-angle-double-left'}`} aria-hidden="true" />
            {!collapsed ? <span>Collapse</span> : null}
          </button>
        </div>
      </aside>

      <div
        className={`cis-topnav-backdrop d-lg-none${mobileOpen ? ' show' : ''}`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside className={`cis-sidebar cis-sidebar-drawer d-lg-none${mobileOpen ? ' open' : ''}`} aria-label="Navigation">
        <div className="cis-sidebar-drawer-head">
          <SidebarBrand shortName={shortName} logoUrl={logoUrl} onNavigate={handleNavigate} />
          <button type="button" className="cis-topnav-drawer-close" onClick={onMobileClose} aria-label="Close menu">
            <i className="fa fa-times" aria-hidden="true" />
          </button>
        </div>
        <div className="cis-sidebar-scroll cis-sidebar-drawer-body">
          <SidebarSearch
            value={query}
            onChange={setQuery}
            results={results}
            pathname={pathname}
            search={search}
            onNavigate={handleNavigate}
            inputRef={searchRef}
          />
          {lastLoginAt ? (
            <div className="cis-sidebar-lastlogin">
              <i className="fa fa-clock-o" aria-hidden="true" />
              <span>Last login: {new Date(lastLoginAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ) : null}
          {!normalizeMenuQuery(query) ? (
            <ul className="cis-sidebar-menu">
              {menu.map((category) => (
                <SidebarCategory
                  key={category.id}
                  category={category}
                  collapsed={false}
                  pathname={pathname}
                  search={search}
                  onNavigate={handleNavigate}
                />
              ))}
            </ul>
          ) : null}
          <div className="cis-sidebar-drawer-tools">
            <CommandPaletteTrigger />
            <Link to="/circular" className="cis-topnav-iconbtn" title="Circulars & announcements" aria-label="Circulars & announcements" onClick={handleNavigate}>
              <i className="fa fa-bell-o" aria-hidden="true" />
            </Link>
            <Link to="/settings" className="cis-topnav-iconbtn" title="Settings" aria-label="Settings" onClick={handleNavigate}>
              <i className="fa fa-cog" aria-hidden="true" />
            </Link>
            <ThemeControlMenu />
            <UserMenu variant="dark" compact />
          </div>
        </div>
      </aside>
    </>
  );
}
