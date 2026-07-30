import { isMenuLinkActive } from './legacyRoutes';
import { resolveMenuIcon } from './menuUtils';

/** Client-side grouping so the top bar shows a handful of buckets instead of
 * one button per `admin_menu_category_tb` row (25+ today). Purely cosmetic —
 * doesn't touch menu authorization, just how categories are bucketed for
 * display. Category names must match `admin_menu_category_tb.category_name`. */
const GROUP_DEFS = [
  { id: 'dashboard', match: ['Dashboard'] },
  { id: 'students', name: 'Students', icon: 'fa fa-user', match: ['Student', 'Student Portfolia', 'Student Att', 'Certificates'] },
  { id: 'academics', name: 'Academics', icon: 'fa fa-graduation-cap', match: ['Curriculum', 'Exam', 'E-Learning', 'NAAC'] },
  { id: 'staff', name: 'Staff', icon: 'fa fa-id-badge', match: ['Staff', 'Staff Att.', 'Payroll', 'Stipend Payroll'] },
  { id: 'fees', name: 'Fee', icon: 'fa fa-money', match: ['Fee'] },
  { id: 'facilities', name: 'Facilities', icon: 'fa fa-building', match: ['Library', 'Hostel', 'Kiosk', 'TV'] },
  { id: 'communication', name: 'Communication', icon: 'fa fa-bullhorn', match: ['Circular', 'SMS', 'Web', 'Committee'] },
  { id: 'admin', name: 'Admin', icon: 'fa fa-cog', match: ['Admin Office', 'Admin', 'Settings'] },
];

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

/** Buckets raw menu categories into fewer top-level groups per GROUP_DEFS.
 * Any category that doesn't match a bucket keeps its own top-level slot so
 * nothing silently disappears if new categories are added later. */
export function groupMenuCategories(menu) {
  const byName = new Map(menu.map((category) => [normalizeName(category.name), category]));
  const used = new Set();
  const groups = [];

  for (const def of GROUP_DEFS) {
    const categories = def.match
      .map((name) => byName.get(normalizeName(name)))
      .filter(Boolean);
    if (!categories.length) continue;
    categories.forEach((category) => used.add(category.id));
    groups.push({
      id: def.id,
      name: def.name || categories[0].name,
      icon: resolveMenuIcon(def.icon || categories[0].icon),
      categories,
    });
  }

  menu.forEach((category) => {
    if (used.has(category.id)) return;
    groups.push({
      id: `cat-${category.id}`,
      name: category.name,
      icon: resolveMenuIcon(category.icon),
      categories: [category],
    });
  });

  return groups;
}

function nonEmptyMainMenus(category) {
  return (category?.mainMenus || []).filter((mainMenu) => (mainMenu.subMenus || []).length);
}

/** Second-level rail rows for a group's mega panel.
 * - Multi-category group: one row per category; each row's content may have
 *   several sections (that category's mainMenus).
 * - Single-category group: one row per mainMenu (the pre-grouping behavior),
 *   each row is its own single section. */
export function buildGroupRows(group) {
  if (!group) return [];
  if (group.categories.length > 1) {
    return group.categories
      .map((category) => ({
        key: `cat-${category.id}`,
        label: category.name,
        icon: resolveMenuIcon(category.icon),
        sections: nonEmptyMainMenus(category),
      }))
      .filter((row) => row.sections.length);
  }
  const [category] = group.categories;
  return nonEmptyMainMenus(category).map((mainMenu, idx) => ({
    key: `main-${category.id}-${idx}`,
    label: mainMenu.name,
    icon: resolveMenuIcon(mainMenu.icon || category.icon),
    sections: [mainMenu],
  }));
}

export function groupIsDropdown(group) {
  const rows = buildGroupRows(group);
  if (rows.length > 1) return true;
  const totalLinks = rows.reduce(
    (sum, row) => sum + row.sections.reduce((s, section) => s + (section.subMenus?.length || 0), 0),
    0,
  );
  return totalLinks > 1;
}

/** Single (link, icon) pair for a group rendered as a plain nav link
 * (exactly one category, one mainMenu, one subMenu). */
export function getGroupSingleLink(group) {
  const [category] = group.categories;
  const mainMenu = category?.mainMenus?.[0];
  const item = mainMenu?.subMenus?.[0];
  if (!item) return null;
  return { link: item.link, icon: resolveMenuIcon(category?.icon || mainMenu?.icon || item.icon) };
}

export function groupIsActive(group, pathname, search) {
  return group.categories.some((category) =>
    nonEmptyMainMenus(category).some((mainMenu) =>
      (mainMenu.subMenus || []).some((item) => isMenuLinkActive(item.link, pathname, search)),
    ));
}

export function rowIsActive(row, pathname, search) {
  return row.sections.some((section) =>
    (section.subMenus || []).some((item) => isMenuLinkActive(item.link, pathname, search)));
}
