import { prisma } from '../../../config/prisma.js';

/** Enabled menu items + their category ordering, shared by any per-user or per-role checkbox matrix screen. */
export async function loadMenuCatalog() {
  const categories = await prisma.admin_menu_category_tb.findMany({
    where: { del: 1 },
    orderBy: { category_order: 'asc' },
    select: { id: true },
  });
  const categoryOrder = categories.map((c) => c.id);

  const menus = await prisma.basic_admin_menu_tb.findMany({
    where: { del: 1, menu_enable: 1, category_id: { not: 0 } },
    select: {
      id: true,
      category_id: true,
      main_menu_name: true,
      main_menu_order: true,
      sub_menu_name: true,
      sub_menu_link: true,
      sub_menu_order: true,
    },
    orderBy: [{ main_menu_order: 'asc' }, { sub_menu_order: 'asc' }],
  });

  return { menus, categoryOrder };
}

/** Groups menus by main-menu name (category-ordered) and marks each item checked/unchecked from checkedMenuIds. */
export function buildMenuGroups(menus, categoryOrder, checkedMenuIds) {
  const checked = checkedMenuIds instanceof Set ? checkedMenuIds : new Set(checkedMenuIds);

  const mainMenus = [];
  const seenMain = new Set();
  for (const menu of menus) {
    if (!menu.sub_menu_link) continue;
    if (!seenMain.has(menu.main_menu_name)) {
      seenMain.add(menu.main_menu_name);
      mainMenus.push(menu.main_menu_name);
    }
  }

  mainMenus.sort((a, b) => {
    const aCat = menus.find((m) => m.main_menu_name === a)?.category_id || 0;
    const bCat = menus.find((m) => m.main_menu_name === b)?.category_id || 0;
    const aIdx = categoryOrder.indexOf(aCat);
    const bIdx = categoryOrder.indexOf(bCat);
    if (aIdx !== bIdx) return aIdx - bIdx;
    const aOrder = menus.find((m) => m.main_menu_name === a)?.main_menu_order || 0;
    const bOrder = menus.find((m) => m.main_menu_name === b)?.main_menu_order || 0;
    return aOrder - bOrder;
  });

  return mainMenus.map((mainName) => {
    const items = menus
      .filter((m) => m.main_menu_name === mainName && m.sub_menu_link)
      .map((m) => ({
        menuId: m.id,
        label: m.sub_menu_name || 'Direct',
        checked: checked.has(m.id),
      }));
    return { mainMenu: mainName, items };
  });
}
