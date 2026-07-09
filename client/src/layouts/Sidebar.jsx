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

function SidebarCategory({ category, pathname, search, defaultOpen, onNavigate }) {
  const [open, setOpen] = useState(defaultOpen);
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
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  if (items.length === 0) return null;

  if (items.length === 1 && category.type === 'link') {
    const item = items[0];
    return (
      <li className={`sub-menu${item.active ? ' active' : ''}`}>
        <MenuLink link={item.link} className="" onNavigate={onNavigate}>
          <i className={category.icon || item.icon} />
          <span>{category.name}</span>
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
        <i className={category.icon} />
        <span>{category.name}</span>
        <span className={`arrow${open ? ' open' : ''}`} />
      </button>
      <ul className="sub">
        {items.map((item) => (
          <li key={item.id} className={item.active ? 'active' : ''}>
            <MenuLink link={item.link} className="" onNavigate={onNavigate}>
              {item.icon ? <i className={item.icon} /> : null}
              <span>{item.label}</span>
            </MenuLink>
          </li>
        ))}
      </ul>
    </li>
  );
}

function SidebarMenu({ menu, pathname, search, onNavigate }) {
  const activeCategoryIds = useMemo(
    () => new Set(menu.filter((category) => categoryIsActive(category, pathname, search)).map((c) => c.id)),
    [menu, pathname, search],
  );

  return (
    <ul className="sidebar-menu">
      {menu.map((category) => (
        <SidebarCategory
          key={category.id}
          category={category}
          pathname={pathname}
          search={search}
          defaultOpen={activeCategoryIds.has(category.id)}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  );
}

export default function Sidebar({ settings, menu = [], mobileOpen = false, onMobileClose }) {
  const { pathname, search } = useLocation();
  const innerRef = useRef(null);
  const logoUrl = settings?.institutionLogoUrl || '/legacy/img/global_images/logo.png';
  const shortName = settings?.institutionShortName || 'CIS';

  const handleNavigate = () => {
    if (onMobileClose) onMobileClose();
  };

  useEffect(() => {
    const root = innerRef.current;
    if (!root) return;
    const active = root.querySelector(
      '.sidebar-menu li.sub-menu.active > a, .sidebar-menu li.sub-menu.active > .cis-sidebar-toggle, .sidebar-menu li ul.sub li.active a',
    );
    if (active) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [pathname]);

  return (
    <>
      <aside className="cis-sidebar d-none d-lg-flex">
        <div className="cis-sidebar-inner" ref={innerRef}>
          <div className="cis-sidebar-brand">
            <Link to="/dashboard" className="cis-sidebar-brand-link" onClick={handleNavigate}>
              <span className="cis-sidebar-logo-mark">
                <img
                  src={logoUrl}
                  alt=""
                  onError={(e) => { e.currentTarget.src = '/legacy/img/global_images/logo.png'; }}
                />
              </span>
              <span className="cis-sidebar-brand-text">
                <strong>{shortName}</strong>
                <small>Campus System</small>
              </span>
            </Link>
          </div>
          <div className="cis-sidebar-label">Menu</div>
          <SidebarMenu menu={menu} pathname={pathname} search={search} onNavigate={handleNavigate} />
        </div>
      </aside>

      <div
        className={`cis-sidebar-backdrop d-lg-none${mobileOpen ? ' show' : ''}`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside className={`cis-sidebar cis-sidebar-mobile d-lg-none${mobileOpen ? ' open' : ''}`}>
        <div className="cis-sidebar-inner">
          <div className="cis-sidebar-brand">
            <Link to="/dashboard" className="cis-sidebar-brand-link" onClick={handleNavigate}>
              <span className="cis-sidebar-logo-mark">
                <img
                  src={logoUrl}
                  alt=""
                  onError={(e) => { e.currentTarget.src = '/legacy/img/global_images/logo.png'; }}
                />
              </span>
              <span className="cis-sidebar-brand-text">
                <strong>{shortName}</strong>
                <small>Campus System</small>
              </span>
            </Link>
          </div>
          <div className="cis-sidebar-label">Menu</div>
          <SidebarMenu menu={menu} pathname={pathname} search={search} onNavigate={handleNavigate} />
        </div>
      </aside>
    </>
  );
}
