import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ThemeControlMenu from '../components/ThemeControlMenu';
import UserMenu from '../components/UserMenu';
import { buildMenuHref, isMenuLinkActive, resolveMenuLabel } from '../utils/legacyRoutes';

function getItemLabel(sub, main) {
  const name = (sub.name || '').trim();
  return resolveMenuLabel(sub.link, name || main.name);
}

function flattenCategoryItems(category) {
  const seen = new Set();
  const items = [];

  for (const main of category.mainMenus || []) {
    for (const sub of main.subMenus || []) {
      const link = String(sub.link || '').trim();
      const label = getItemLabel(sub, main);
      const modern = buildMenuHref(link);
      const key = modern
        ? `route:${modern.split('?')[0]}`
        : (sub.id != null ? `id:${sub.id}` : `link:${link}|${label}`);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: sub.id ?? key,
        label,
        link,
        icon: sub.icon || main.icon,
        group: main.name,
        category: category.name,
        categoryIcon: category.icon,
      });
    }
  }

  return items;
}

function categoryIsActive(category, pathname, search) {
  return flattenCategoryItems(category).some((item) => isMenuLinkActive(item.link, pathname, search));
}

function normalizeQuery(value) {
  return String(value || '').trim().toLowerCase();
}

function searchMenuItems(menu, query) {
  const q = normalizeQuery(query);
  if (!q) return [];
  const results = [];
  for (const category of menu) {
    for (const item of flattenCategoryItems(category)) {
      if (
        normalizeQuery(item.label).includes(q)
        || normalizeQuery(item.group).includes(q)
        || normalizeQuery(item.category).includes(q)
        || normalizeQuery(item.link).includes(q)
      ) {
        results.push(item);
      }
    }
  }
  return results.slice(0, 40);
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

function NavDropdown({
  category,
  pathname,
  search,
  onNavigate,
  open = false,
  onOpenChange,
}) {
  const rootRef = useRef(null);
  const items = useMemo(() => flattenCategoryItems(category), [category]);
  const active = categoryIsActive(category, pathname, search);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event) => {
      if (!rootRef.current?.contains(event.target)) onOpenChange?.(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') onOpenChange?.(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  if (!items.length) return null;

  if (items.length === 1) {
    const item = items[0];
    const itemActive = isMenuLinkActive(item.link, pathname, search);
    return (
      <li className={`cis-topnav-item${itemActive ? ' is-active' : ''}`}>
        <MenuLink link={item.link} className="cis-topnav-link" onNavigate={onNavigate}>
          {category.icon || item.icon ? <i className={category.icon || item.icon} aria-hidden="true" /> : null}
          <span>{category.name}</span>
        </MenuLink>
      </li>
    );
  }

  return (
    <li
      ref={rootRef}
      className={`cis-topnav-item${open ? ' is-open' : ''}${active ? ' is-active' : ''}`}
    >
      <button
        type="button"
        className="cis-topnav-link cis-topnav-toggle"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOpenChange?.(!open);
        }}
      >
        {category.icon ? <i className={category.icon} aria-hidden="true" /> : null}
        <span>{category.name}</span>
        <i className={`fa fa-angle-down cis-topnav-caret${open ? ' is-open' : ''}`} aria-hidden="true" />
      </button>
      <div className="cis-topnav-panel" role="menu" aria-hidden={!open}>
        <ul className="cis-topnav-panel-list">
          {items.map((item) => {
            const itemActive = isMenuLinkActive(item.link, pathname, search);
            return (
              <li key={item.id}>
                <MenuLink
                  link={item.link}
                  className={`cis-topnav-panel-link${itemActive ? ' is-active' : ''}`}
                  onNavigate={() => {
                    onOpenChange?.(false);
                    onNavigate?.();
                  }}
                >
                  {item.icon ? <i className={item.icon} aria-hidden="true" /> : null}
                  <span>{item.label}</span>
                </MenuLink>
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
}

function TopNavSearch({
  value,
  onChange,
  results,
  pathname,
  search,
  onNavigate,
  inputRef,
  inputId = 'cis-topnav-search-input',
}) {
  const searching = Boolean(normalizeQuery(value));
  return (
    <div className="cis-topnav-search">
      <label className="visually-hidden" htmlFor={inputId}>
        Search menu
      </label>
      <i className="fa fa-search cis-topnav-search-icon" aria-hidden="true" />
      <input
        ref={inputRef}
        id={inputId}
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

function MobileAccordion({ category, pathname, search, onNavigate }) {
  const [open, setOpen] = useState(categoryIsActive(category, pathname, search));
  const items = useMemo(() => flattenCategoryItems(category), [category]);
  const active = categoryIsActive(category, pathname, search);

  if (!items.length) return null;

  if (items.length === 1) {
    const item = items[0];
    return (
      <li className={`cis-topnav-item${isMenuLinkActive(item.link, pathname, search) ? ' is-active' : ''}`}>
        <MenuLink link={item.link} className="cis-topnav-link" onNavigate={onNavigate}>
          <i className={category.icon || item.icon} aria-hidden="true" />
          <span>{category.name}</span>
        </MenuLink>
      </li>
    );
  }

  return (
    <li className={`cis-topnav-item${open ? ' is-open' : ''}${active ? ' is-active' : ''}`}>
      <button
        type="button"
        className="cis-topnav-link cis-topnav-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <i className={category.icon} aria-hidden="true" />
        <span>{category.name}</span>
        <i className={`fa fa-angle-down cis-topnav-caret${open ? ' is-open' : ''}`} aria-hidden="true" />
      </button>
      <div className="cis-topnav-panel is-inline" role="menu" aria-hidden={!open}>
        <ul className="cis-topnav-panel-list">
          {items.map((item) => (
            <li key={item.id}>
              <MenuLink
                link={item.link}
                className={`cis-topnav-panel-link${isMenuLinkActive(item.link, pathname, search) ? ' is-active' : ''}`}
                onNavigate={onNavigate}
              >
                {item.icon ? <i className={item.icon} aria-hidden="true" /> : null}
                <span>{item.label}</span>
              </MenuLink>
            </li>
          ))}
        </ul>
      </div>
    </li>
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

export default function TopNav({
  settings,
  menu = [],
  lastLoginAt = null,
  mobileOpen = false,
  onMobileClose,
  className = '',
}) {
  const { pathname, search } = useLocation();
  const [query, setQuery] = useState('');
  const [openCategoryId, setOpenCategoryId] = useState(null);
  const searchRef = useRef(null);
  const logoUrl = settings?.institutionLogoUrl || '/legacy/img/global_images/logo.png';
  const shortName = settings?.institutionShortName || 'CIS';
  const results = useMemo(() => searchMenuItems(menu, query), [menu, query]);

  useEffect(() => {
    setOpenCategoryId(null);
  }, [pathname, search]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const timer = setTimeout(() => searchRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [mobileOpen]);

  const handleNavigate = () => {
    setQuery('');
    setOpenCategoryId(null);
    onMobileClose?.();
  };

  return (
    <>
      <nav className={`cis-topnav d-none d-lg-block ${className}`.trim()} aria-label="Main">
        <div className="cis-topnav-bar cis-topnav-bar-brand">
          <Link to="/dashboard" className="cis-topnav-brand">
            <span className="cis-topnav-logo">
              <img
                src={logoUrl}
                alt=""
                onError={(e) => { e.currentTarget.src = '/legacy/img/global_images/logo.png'; }}
              />
            </span>
            <span className="cis-topnav-brand-text">
              <strong>{shortName}</strong>
              <small>Campus Information</small>
            </span>
          </Link>

          <div className="cis-topnav-tools">
            <TopNavSearch
              value={query}
              onChange={(value) => {
                setQuery(value);
                setOpenCategoryId(null);
              }}
              results={results}
              pathname={pathname}
              search={search}
              onNavigate={handleNavigate}
              inputId="cis-topnav-search-desktop"
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
            <ThemeControlMenu />
            <span className="cis-topnav-tools-divider" aria-hidden="true" />
            <UserMenu variant="dark" />
          </div>
        </div>

        <div className="cis-topnav-bar cis-topnav-bar-menu">
          <ul className="cis-topnav-menu">
            {menu.map((category) => (
              <NavDropdown
                key={category.id}
                category={category}
                pathname={pathname}
                search={search}
                onNavigate={handleNavigate}
                open={openCategoryId === category.id}
                onOpenChange={(nextOpen) => setOpenCategoryId(nextOpen ? category.id : null)}
              />
            ))}
          </ul>
        </div>
      </nav>

      <div
        className={`cis-topnav-backdrop d-lg-none${mobileOpen ? ' show' : ''}`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside className={`cis-topnav-drawer d-lg-none${mobileOpen ? ' open' : ''}`} aria-label="Navigation">
        <div className="cis-topnav-drawer-head">
          <Link to="/dashboard" className="cis-topnav-brand" onClick={handleNavigate}>
            <span className="cis-topnav-logo">
              <img
                src={logoUrl}
                alt=""
                onError={(e) => { e.currentTarget.src = '/legacy/img/global_images/logo.png'; }}
              />
            </span>
            <span className="cis-topnav-brand-text">
              <strong>{shortName}</strong>
              <small>Campus Information</small>
            </span>
          </Link>
          <button type="button" className="cis-topnav-drawer-close" onClick={onMobileClose} aria-label="Close menu">
            <i className="fa fa-times" aria-hidden="true" />
          </button>
        </div>
        <div className="cis-topnav-drawer-body">
          <TopNavSearch
            value={query}
            onChange={setQuery}
            results={results}
            pathname={pathname}
            search={search}
            onNavigate={handleNavigate}
            inputRef={searchRef}
            inputId="cis-topnav-search-mobile"
          />
          {!normalizeQuery(query) ? (
            <ul className="cis-topnav-menu cis-topnav-menu-mobile">
              {menu.map((category) => (
                <MobileAccordion
                  key={category.id}
                  category={category}
                  pathname={pathname}
                  search={search}
                  onNavigate={handleNavigate}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </aside>
    </>
  );
}
