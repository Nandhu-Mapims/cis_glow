import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import CommandPaletteTrigger from '../components/CommandPaletteTrigger';
import ThemeControlMenu from '../components/ThemeControlMenu';
import UserMenu from '../components/UserMenu';
import { buildMenuHref, isMenuLinkActive } from '../utils/legacyRoutes';
import {
  categoryIsActive,
  flattenCategoryItems,
  getMenuItemLabel,
  normalizeMenuQuery,
  resolveMenuIcon,
  searchMenuItems,
} from '../utils/menuUtils';
import {
  buildGroupRows,
  getGroupSingleLink,
  groupIsActive,
  groupIsDropdown,
  groupMenuCategories,
  rowIsActive,
} from '../utils/menuGroups';

const normalizeQuery = normalizeMenuQuery;

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

/** Sliding highlight pill shared by the top-level bar and the mega-menu rail.
 * Moves imperatively via transform so the highlight glides between rows
 * instead of the background snapping/re-painting on each item. */
function SlideIndicator({ indicatorRef }) {
  return <span className="cis-topnav-indicator" ref={indicatorRef} aria-hidden="true" />;
}

/** Column count for a mega-panel content grid: 5 or fewer links stays a
 * single column, 6-15 goes two, and anything past 15 maxes out at three. */
function columnsForCount(count) {
  if (count <= 5) return 1;
  if (count <= 15) return 2;
  return 3;
}

/** Packs sections into `cols` balanced columns instead of letting the browser
 * flow them top-to-bottom in source order (CSS column-count). Source-order
 * flow left short columns stranded next to a tall one whenever big/small
 * sections landed side by side; this sorts sections largest-first and always
 * drops the next one into the currently shortest column (classic greedy
 * bin-packing), so column bottoms land close to even and gaps get filled by
 * whatever section actually fits the remaining space. */
function packSectionsIntoColumns(sections, cols) {
  if (cols <= 1) return [sections];
  const weights = sections.map((section) => (section.subMenus || []).length + 1);
  const order = sections.map((_, idx) => idx).sort((a, b) => weights[b] - weights[a]);
  const columns = Array.from({ length: cols }, () => []);
  const totals = new Array(cols).fill(0);
  order.forEach((idx) => {
    let target = 0;
    for (let c = 1; c < cols; c += 1) {
      if (totals[c] < totals[target]) target = c;
    }
    columns[target].push(sections[idx]);
    totals[target] += weights[idx];
  });
  return columns;
}

function useSlideIndicator() {
  const indicatorRef = useRef(null);
  const targetElRef = useRef(null);

  const place = useCallback(() => {
    const node = indicatorRef.current;
    const el = targetElRef.current;
    if (!node) return;
    if (!el) {
      node.style.opacity = '0';
      return;
    }
    node.style.opacity = '1';
    node.style.width = `${el.offsetWidth}px`;
    node.style.height = `${el.offsetHeight}px`;
    node.style.transform = `translate(${el.offsetLeft}px, ${el.offsetTop}px)`;
  }, []);

  const moveTo = useCallback((el) => {
    targetElRef.current = el;
    place();
  }, [place]);

  useEffect(() => {
    // The icon font (Font Awesome, loaded from a CDN) can finish loading
    // after this first layout pass and swap glyph widths, silently shifting
    // every item's offsetLeft — the pill was already measured and never
    // re-measures, so it's left stuck a few px off. Only visible on a cold
    // load (warm/cached loads already have the font). Re-measure once the
    // real font is in.
    if (!document.fonts?.ready) return undefined;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) place();
    });
    return () => {
      cancelled = true;
    };
  }, [place]);

  return [indicatorRef, moveTo];
}

function NavItem({ group, pathname, search, onNavigate, itemRef, onHover }) {
  const item = getGroupSingleLink(group);
  if (!item) return null;
  const itemActive = isMenuLinkActive(item.link, pathname, search);
  return (
    <li
      ref={itemRef}
      className={`cis-topnav-item${itemActive ? ' is-active' : ''}`}
      onMouseEnter={onHover}
    >
      <MenuLink link={item.link} className="cis-topnav-link" onNavigate={onNavigate}>
        <i className={item.icon} aria-hidden="true" />
        <span>{group.name}</span>
      </MenuLink>
    </li>
  );
}

function NavDropdownToggle({ group, pathname, search, open, itemRef, onHover, onToggle }) {
  const active = groupIsActive(group, pathname, search);
  return (
    <li
      ref={itemRef}
      className={`cis-topnav-item${open ? ' is-open' : ''}${active ? ' is-active' : ''}`}
      onMouseEnter={onHover}
    >
      <button
        type="button"
        className="cis-topnav-link cis-topnav-toggle"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggle();
        }}
      >
        <i className={group.icon} aria-hidden="true" />
        <span>{group.name}</span>
        <i className={`fa fa-angle-down cis-topnav-caret${open ? ' is-open' : ''}`} aria-hidden="true" />
      </button>
    </li>
  );
}

/** Full-width mega panel: left rail (categories, or that single category's
 * mainMenus) with its own sliding highlight + a grid of links on the right,
 * sectioned by mainMenu label when a rail row covers more than one. */
function MegaPanel({ group, pathname, search, onNavigate, onClose }) {
  const rows = useMemo(() => buildGroupRows(group), [group]);
  const [activeRow, setActiveRow] = useState(0);
  const railRef = useRef(null);
  const rowRefs = useRef({});
  const [railIndicatorRef, moveRailIndicator] = useSlideIndicator();
  const showRail = rows.length > 1;

  useEffect(() => {
    const activeIdx = rows.findIndex((row) => rowIsActive(row, pathname, search));
    setActiveRow(activeIdx >= 0 ? activeIdx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id]);

  useLayoutEffect(() => {
    moveRailIndicator(rowRefs.current[activeRow]);
  }, [activeRow, rows.length, moveRailIndicator]);

  if (!group || !rows.length) return null;

  const sections = rows[activeRow]?.sections || [];
  const flatItems = sections.flatMap((section) =>
    (section.subMenus || []).map((item) => ({ item, section })));
  const cols = columnsForCount(flatItems.length);
  const showSectionLabels = sections.length > 1;
  const columns = useMemo(() => packSectionsIntoColumns(sections, cols), [sections, cols]);

  return (
    <div className="cis-topnav-mega" role="menu">
      {showRail ? (
        <div className="cis-topnav-mega-rail" ref={railRef}>
          <SlideIndicator indicatorRef={railIndicatorRef} />
          {rows.map((row, idx) => (
            <button
              key={row.key}
              type="button"
              ref={(el) => { rowRefs.current[idx] = el; }}
              className={`cis-topnav-mega-rail-item${activeRow === idx ? ' is-active' : ''}`}
              onMouseEnter={() => setActiveRow(idx)}
              onFocus={() => setActiveRow(idx)}
              onClick={() => setActiveRow(idx)}
            >
              <i className={row.icon} aria-hidden="true" />
              <span>{row.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="cis-topnav-mega-content" key={activeRow}>
        <div className="cis-topnav-mega-columns">
          {columns.map((colSections, colIdx) => (
            <div className="cis-topnav-mega-column" key={colIdx}>
              {colSections.map((section) => {
                const items = section.subMenus || [];
                if (!items.length) return null;
                return (
                  <div key={section.id ?? section.name} className="cis-topnav-mega-section">
                    {showSectionLabels ? (
                      <div className="cis-topnav-mega-section-label">{section.name}</div>
                    ) : null}
                    <div className="cis-topnav-mega-grid">
                      {items.map((item) => {
                        const link = String(item.link || '').trim();
                        const label = getMenuItemLabel(item, section);
                        const active = isMenuLinkActive(link, pathname, search);
                        const icon = resolveMenuIcon(item.icon || section.icon);
                        return (
                          <MenuLink
                            key={item.id ?? `${link}-${label}`}
                            link={link}
                            className={`cis-topnav-mega-link${active ? ' is-active' : ''}`}
                            onNavigate={() => {
                              onClose?.();
                              onNavigate?.();
                            }}
                          >
                            <i className={icon} aria-hidden="true" />
                            <span>{label}</span>
                          </MenuLink>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DesktopMenuBar({ menu, pathname, search, onNavigate }) {
  const groups = useMemo(() => groupMenuCategories(menu), [menu]);
  const [openCategoryId, setOpenCategoryId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [panelLeft, setPanelLeft] = useState(0);
  const barRef = useRef(null);
  const menuRef = useRef(null);
  const panelWrapRef = useRef(null);
  const itemRefs = useRef({});
  const [indicatorRef, moveIndicator] = useSlideIndicator();

  const openCategory = useMemo(
    () => groups.find((group) => group.id === openCategoryId) || null,
    [groups, openCategoryId],
  );
  const activeCategoryId = useMemo(
    () => groups.find((group) => groupIsActive(group, pathname, search))?.id ?? null,
    [groups, pathname, search],
  );
  const targetId = hoveredId ?? openCategoryId ?? activeCategoryId;

  const recomputeIndicator = useCallback(() => {
    moveIndicator(targetId != null ? itemRefs.current[targetId] : null);
  }, [targetId, moveIndicator]);

  useLayoutEffect(() => {
    recomputeIndicator();
  }, [recomputeIndicator]);

  useEffect(() => {
    // The bar's own width shifts whenever a sibling in `.cis-topnav-tools`
    // changes size after mount (e.g. the "Last login" badge appears once
    // `/api/dashboard` resolves, later than the menu/settings fetch that
    // renders this bar) — that reflow moves every centered nav item without
    // changing which category is active, so the indicator's targetId-based
    // effect above never re-fires and the pill is left stuck at its old
    // offset. Watch the bar for resizes from any cause and re-place it.
    const node = menuRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      recomputeIndicator();
      setOpenCategoryId((current) => {
        if (!current) return current;
        const li = itemRefs.current[current];
        const bar = barRef.current;
        const panel = panelWrapRef.current;
        if (li && bar && panel) {
          const barWidth = bar.offsetWidth;
          const panelWidth = panel.offsetWidth;
          setPanelLeft(Math.max(0, Math.min(li.offsetLeft, barWidth - panelWidth)));
        }
        return current;
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [recomputeIndicator]);

  useLayoutEffect(() => {
    if (!openCategoryId) return;
    const li = itemRefs.current[openCategoryId];
    const bar = barRef.current;
    const panel = panelWrapRef.current;
    if (!li || !bar || !panel) return;
    const barWidth = bar.offsetWidth;
    const panelWidth = panel.offsetWidth;
    const clamped = Math.max(0, Math.min(li.offsetLeft, barWidth - panelWidth));
    setPanelLeft(Number.isFinite(clamped) ? clamped : 0);
  }, [openCategoryId, groups]);

  useEffect(() => {
    const onResize = () => {
      recomputeIndicator();
      if (!openCategoryId) return;
      const li = itemRefs.current[openCategoryId];
      const bar = barRef.current;
      const panel = panelWrapRef.current;
      if (!li || !bar || !panel) return;
      const barWidth = bar.offsetWidth;
      const panelWidth = panel.offsetWidth;
      setPanelLeft(Math.max(0, Math.min(li.offsetLeft, barWidth - panelWidth)));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [openCategoryId, recomputeIndicator]);

  useEffect(() => {
    if (!openCategoryId) return undefined;
    const onDocClick = (event) => {
      if (!barRef.current?.contains(event.target)) setOpenCategoryId(null);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpenCategoryId(null);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [openCategoryId]);

  useEffect(() => {
    setOpenCategoryId(null);
  }, [pathname, search]);

  const registerRef = (id) => (el) => {
    itemRefs.current[id] = el;
  };

  return (
    <div className="cis-topnav-bar-menu" ref={barRef}>
      <ul
        className="cis-topnav-menu"
        ref={menuRef}
        onMouseLeave={() => setHoveredId(null)}
      >
        <SlideIndicator indicatorRef={indicatorRef} />
        {groups.map((group) => {
          if (!groupIsDropdown(group)) {
            if (!getGroupSingleLink(group)) return null;
            return (
              <NavItem
                key={group.id}
                group={group}
                pathname={pathname}
                search={search}
                onNavigate={onNavigate}
                itemRef={registerRef(group.id)}
                onHover={() => {
                  setHoveredId(group.id);
                  if (openCategoryId) setOpenCategoryId(null);
                }}
              />
            );
          }
          return (
            <NavDropdownToggle
              key={group.id}
              group={group}
              pathname={pathname}
              search={search}
              open={openCategoryId === group.id}
              itemRef={registerRef(group.id)}
              onHover={() => {
                setHoveredId(group.id);
                if (openCategoryId && openCategoryId !== group.id) setOpenCategoryId(group.id);
              }}
              onToggle={() => setOpenCategoryId((current) => (current === group.id ? null : group.id))}
            />
          );
        })}
      </ul>
      <div
        className={`cis-topnav-mega-wrap${openCategory ? ' is-open' : ''}`}
        ref={panelWrapRef}
        style={{ transform: `translateX(${panelLeft}px)` }}
      >
        {openCategory ? (
          <MegaPanel
            group={openCategory}
            pathname={pathname}
            search={search}
            onNavigate={onNavigate}
            onClose={() => setOpenCategoryId(null)}
          />
        ) : null}
      </div>
    </div>
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
  compact = false,
}) {
  const searching = Boolean(normalizeQuery(value));
  return (
    <div className={`cis-topnav-search${compact ? ' cis-topnav-search--compact' : ''}`}>
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
          <i className={item.icon} aria-hidden="true" />
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
        <i className={resolveMenuIcon(category.icon)} aria-hidden="true" />
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
      <nav className={`cis-topnav d-none d-lg-block ${className}`.trim()} aria-label="Main">
        <div className="cis-topnav-bar cis-topnav-bar-single">
          <Link to="/dashboard" className="cis-topnav-brand">
            <span className="cis-topnav-logo">
              <img src={logoUrl} alt="" />
            </span>
            <span className="cis-topnav-brand-text">
              <strong>{shortName}</strong>
              <small>Campus Information</small>
            </span>
          </Link>

          <DesktopMenuBar
            menu={menu}
            pathname={pathname}
            search={search}
            onNavigate={handleNavigate}
          />

          <div className="cis-topnav-tools">
            <TopNavSearch
              value={query}
              onChange={setQuery}
              results={results}
              pathname={pathname}
              search={search}
              onNavigate={handleNavigate}
              inputId="cis-topnav-search-desktop"
              compact
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

      <div
        className={`cis-topnav-backdrop d-lg-none${mobileOpen ? ' show' : ''}`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside className={`cis-topnav-drawer d-lg-none${mobileOpen ? ' open' : ''}`} aria-label="Navigation">
        <div className="cis-topnav-drawer-head">
          <Link to="/dashboard" className="cis-topnav-brand" onClick={handleNavigate}>
            <span className="cis-topnav-logo">
              <img src={logoUrl} alt="" />
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
