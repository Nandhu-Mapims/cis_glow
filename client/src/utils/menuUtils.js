import { buildMenuHref, isMenuLinkActive, resolveMenuLabel } from './legacyRoutes';

/** Shared menu flatten/search helpers — used by TopNav and CommandPalette so
 * both search the same real menu the same way. */

/** `admin_menu_category_tb.menu_icon` / `basic_admin_menu_tb.menu_icon` mix
 * old simple-line-icons class names (icon-home, icon-users, …) and a handful
 * of Unicons classes (uil uil-…) from the legacy PHP app. Neither of those
 * fonts is loaded here — only Font Awesome is — so those classes render
 * blank. Translate the ones actually in use; anything already `fa …` passes
 * through untouched. */
const LEGACY_ICON_MAP = {
  'icon-home': 'fa fa-home',
  'icon-users': 'fa fa-users',
  'icon-credit-card': 'fa fa-credit-card',
  'icon-layers': 'fa fa-clone',
  'icon-notebook': 'fa fa-book',
  'icon-note': 'fa fa-sticky-note-o',
  'icon-bar-chart': 'fa fa-bar-chart',
  'icon-graduation': 'fa fa-graduation-cap',
  'icon-globe': 'fa fa-globe',
  'icon-hourglass': 'fa fa-hourglass-half',
  'icon-grid': 'fa fa-th-large',
  'icon-social-tumblr': 'fa fa-tumblr',
  'icon-envelope': 'fa fa-envelope-o',
  'icon-equalizer': 'fa fa-sliders',
  'icon-settings': 'fa fa-cog',
  'uil uil-dashboard': 'fa fa-tachometer',
};

const DEFAULT_MENU_ICON = 'fa fa-circle-o';

/** Always returns a renderable icon class — translates legacy simple-line-icons
 * names to Font Awesome, and falls back to a generic marker when a menu row
 * has no icon at all in the DB, so every menu entry shows something. */
export function resolveMenuIcon(icon, fallback = DEFAULT_MENU_ICON) {
  const trimmed = String(icon || '').trim();
  if (!trimmed) return fallback;
  return LEGACY_ICON_MAP[trimmed] || trimmed;
}

export function getMenuItemLabel(sub, main) {
  const name = (sub.name || '').trim();
  return resolveMenuLabel(sub.link, name || main.name);
}

export function flattenCategoryItems(category) {
  const seen = new Set();
  const items = [];

  for (const main of category.mainMenus || []) {
    for (const sub of main.subMenus || []) {
      const link = String(sub.link || '').trim();
      const label = getMenuItemLabel(sub, main);
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
        icon: resolveMenuIcon(sub.icon || main.icon || category.icon),
        group: main.name,
        category: category.name,
        categoryIcon: resolveMenuIcon(category.icon),
      });
    }
  }

  return items;
}

export function categoryIsActive(category, pathname, search) {
  return flattenCategoryItems(category).some((item) => isMenuLinkActive(item.link, pathname, search));
}

export function normalizeMenuQuery(value) {
  return String(value || '').trim().toLowerCase();
}

export function searchMenuItems(menu, query, limit = 40) {
  const q = normalizeMenuQuery(query);
  if (!q) return [];
  const results = [];
  for (const category of menu) {
    for (const item of flattenCategoryItems(category)) {
      if (
        normalizeMenuQuery(item.label).includes(q)
        || normalizeMenuQuery(item.group).includes(q)
        || normalizeMenuQuery(item.category).includes(q)
        || normalizeMenuQuery(item.link).includes(q)
      ) {
        results.push(item);
      }
    }
  }
  return results.slice(0, limit);
}
