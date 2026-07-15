import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { buildMenuHref, isMenuLinkActive, resolveMenuLabel } from '../utils/legacyRoutes';

function getItemLabel(sub, main) {
  const name = (sub.name || '').trim();
  const defaultLabel = name || main.name;
  return resolveMenuLabel(sub.link, defaultLabel);
}

function categoryIsActive(category, pathname, search) {
  return category.mainMenus.some((main) =>
    main.subMenus.some((sub) => isMenuLinkActive(sub.link, pathname, search)),
  );
}

function normalizeQuery(value) {
  return String(value || '').trim().toLowerCase();
}

function filterMenu(menu, query) {
  const q = normalizeQuery(query);
  if (!q) return menu;

  return menu
    .map((category) => {
      const categoryMatch = normalizeQuery(category.name).includes(q);
      const mainMenus = category.mainMenus
        .map((main) => {
          const mainMatch = normalizeQuery(main.name).includes(q);
          const subMenus = main.subMenus.filter((sub) => {
            if (categoryMatch || mainMatch) return true;
            const label = getItemLabel(sub, main);
            return normalizeQuery(label).includes(q) || normalizeQuery(sub.link).includes(q);
          });
          if (!subMenus.length && !(categoryMatch || mainMatch)) return null;
          return {
            ...main,
            subMenus: subMenus.length ? subMenus : main.subMenus,
          };
        })
        .filter(Boolean);

      if (!mainMenus.length) return null;
      return { ...category, mainMenus };
    })
    .filter(Boolean);
}

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

function SidebarCategory({ category, pathname, search, defaultOpen, forceOpen = false, onNavigate }) {
  const [open, setOpen] = useState(defaultOpen || forceOpen);
  const items = category.mainMenus.flatMap((main) =>
    main.subMenus.map((sub) => ({
      id: sub.id,
      label: getItemLabel(sub, main),
      link: sub.link,
      icon: sub.icon || main.icon,
      active: isMenuLinkActive(sub.link, pathname, search),
    })),
  );

  useEffect(() => {
    if (defaultOpen || forceOpen) setOpen(true);
  }, [defaultOpen, forceOpen]);

  if (items.length === 0) return null;

  if (items.length === 1 && category.type === 'link' && !forceOpen) {
    const item = items[0];
    return (
      <li className={`sub-menu${item.active ? ' active' : ''}`}>
        <MenuLink link={item.link} className="" onNavigate={onNavigate}>
          <span className="cis-sidebar-item-icon" aria-hidden="true">
            <i className={category.icon || item.icon} />
          </span>
          <span className="cis-sidebar-item-label">{category.name}</span>
        </MenuLink>
      </li>
    );
  }

  return (
    <li className={`sub-menu${open ? ' open' : ''}${categoryIsActive(category, pathname, search) ? ' active' : ''}`}>
      <button
        type="button"
        className="cis-sidebar-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="cis-sidebar-item-icon" aria-hidden="true">
          <i className={category.icon} />
        </span>
        <span className="cis-sidebar-item-label">{category.name}</span>
        <i className={`fa fa-angle-right cis-sidebar-chevron${open ? ' open' : ''}`} aria-hidden="true" />
      </button>
      <ul className="sub">
        {items.map((item) => (
          <li key={item.id} className={item.active ? 'active' : ''}>
            <MenuLink link={item.link} className="" onNavigate={onNavigate}>
              {item.icon ? (
                <span className="cis-sidebar-sub-icon" aria-hidden="true">
                  <i className={item.icon} />
                </span>
              ) : (
                <span className="cis-sidebar-sub-dot" aria-hidden="true" />
              )}
              <span className="cis-sidebar-item-label">{item.label}</span>
            </MenuLink>
          </li>
        ))}
      </ul>
    </li>
  );
}

function SidebarMenu({ menu, pathname, search, forceOpen = false, onNavigate }) {
  const activeCategoryIds = useMemo(
    () => new Set(menu.filter((category) => categoryIsActive(category, pathname, search)).map((c) => c.id)),
    [menu, pathname, search],
  );

  if (!menu.length) {
    return (
      <div className="cis-sidebar-empty" role="status">
        No menu items match your search.
      </div>
    );
  }

  return (
    <ul className="sidebar-menu">
      {menu.map((category) => (
        <SidebarCategory
          key={category.id}
          category={category}
          pathname={pathname}
          search={search}
          defaultOpen={forceOpen || activeCategoryIds.has(category.id)}
          forceOpen={forceOpen}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  );
}

function SidebarSearch({ value, onChange, inputRef }) {
  return (
    <div className="cis-sidebar-search">
      <label className="visually-hidden" htmlFor="cis-sidebar-search-input">
        Search menu
      </label>
      <span className="cis-sidebar-search-icon" aria-hidden="true">
        <i className="fa fa-search" />
      </span>
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
    </div>
  );
}

function SidebarPanel({
  settings,
  menu,
  pathname,
  search,
  query,
  onQueryChange,
  onNavigate,
  innerRef,
  searchRef,
}) {
  const logoUrl = settings?.institutionLogoUrl || '/legacy/img/global_images/logo.png';
  const shortName = settings?.institutionShortName || 'CIS';
  const filteredMenu = useMemo(() => filterMenu(menu, query), [menu, query]);
  const searching = Boolean(normalizeQuery(query));

  return (
    <div className="cis-sidebar-inner" ref={innerRef}>
      <div className="cis-sidebar-top">
        <div className="cis-sidebar-brand">
          <Link to="/dashboard" className="cis-sidebar-brand-link" onClick={onNavigate}>
            <span className="cis-sidebar-logo-mark">
              <img
                src={logoUrl}
                alt=""
                onError={(e) => { e.currentTarget.src = '/legacy/img/global_images/logo.png'; }}
              />
            </span>
            <span className="cis-sidebar-brand-text">
              <strong>{shortName}</strong>
              <small>Campus Information</small>
            </span>
          </Link>
        </div>
        <SidebarSearch value={query} onChange={onQueryChange} inputRef={searchRef} />
      </div>

      <div className="cis-sidebar-nav">
        <div className="cis-sidebar-label">
          {searching ? `Results · ${filteredMenu.length}` : 'Navigation'}
        </div>
        <SidebarMenu
          menu={filteredMenu}
          pathname={pathname}
          search={search}
          forceOpen={searching}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}

export default function Sidebar({ settings, menu = [], mobileOpen = false, onMobileClose }) {
  const { pathname, search } = useLocation();
  const innerRef = useRef(null);
  const desktopSearchRef = useRef(null);
  const mobileSearchRef = useRef(null);
  const [query, setQuery] = useState('');

  const handleNavigate = () => {
    setQuery('');
    if (onMobileClose) onMobileClose();
  };

  useEffect(() => {
    const root = innerRef.current;
    if (!root || query) return;
    const active = root.querySelector(
      '.sidebar-menu li.sub-menu.active > a, .sidebar-menu li.sub-menu.active > .cis-sidebar-toggle, .sidebar-menu li ul.sub li.active a',
    );
    if (active) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [pathname, query]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const timer = setTimeout(() => mobileSearchRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [mobileOpen]);

  return (
    <>
      <aside className="cis-sidebar d-none d-lg-flex">
        <SidebarPanel
          settings={settings}
          menu={menu}
          pathname={pathname}
          search={search}
          query={query}
          onQueryChange={setQuery}
          onNavigate={handleNavigate}
          innerRef={innerRef}
          searchRef={desktopSearchRef}
        />
      </aside>

      <div
        className={`cis-sidebar-backdrop d-lg-none${mobileOpen ? ' show' : ''}`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside className={`cis-sidebar cis-sidebar-mobile d-lg-none${mobileOpen ? ' open' : ''}`}>
        <SidebarPanel
          settings={settings}
          menu={menu}
          pathname={pathname}
          search={search}
          query={query}
          onQueryChange={setQuery}
          onNavigate={handleNavigate}
          searchRef={mobileSearchRef}
        />
      </aside>
    </>
  );
}
