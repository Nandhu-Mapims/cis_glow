import { prisma } from '../../../config/prisma.js';
import { auditFields, logAdminSetup } from './setupAudit.js';

const PAGE = 'authentication_add.php';

async function loadUsersWithFlag(selectedId = '') {
  const configured = await prisma.authentication_tb.findMany({
    where: { del: 1 },
    select: { user_id: true },
    distinct: ['user_id'],
  });
  const configuredSet = new Set(configured.map((r) => String(r.user_id)));

  const rows = await prisma.web_account_setup.findMany({
    where: { del: 1, access_type: { not: 'Global' } },
    orderBy: { member_id: 'asc' },
    select: { id: true, member_id: true, member_name: true },
  });

  return rows.map((row) => ({
    value: String(row.id),
    label: `${row.member_id} - ${row.member_name}${configuredSet.has(String(row.id)) ? ' *' : ''}`,
    selected: String(row.id) === String(selectedId),
  }));
}

async function loadMenuMatrix(userId) {
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

  const authRows = await prisma.authentication_tb.findMany({
    where: { del: 1, user_id: Number(userId) },
    select: { menu_id: true, authentication: true },
  });
  const authMap = new Map(authRows.map((r) => [r.menu_id, r.authentication === 1]));

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

  const groups = mainMenus.map((mainName) => {
    const items = menus
      .filter((m) => m.main_menu_name === mainName && m.sub_menu_link)
      .map((m) => ({
        menuId: m.id,
        label: m.sub_menu_name || 'Direct',
        checked: authMap.get(m.id) === true,
      }));
    return { mainMenu: mainName, items };
  });

  return groups;
}

export async function loadMenuAuth(memberId, fields = {}, query = {}, audit = {}) {
  const selectedUser = String(
    fields.member_id || query.uid || query.member_id || '',
  ).trim();

  const users = await loadUsersWithFlag(selectedUser);
  const menuGroups = selectedUser ? await loadMenuMatrix(selectedUser) : [];

  if (!audit.skipLog) {
    await logAdminSetup(PAGE, 'View', 'Successful', selectedUser || 'form', memberId, audit);
  }
  return {
    users,
    selectedUser,
    menuGroups,
  };
}

export async function saveMenuAuth(fields, memberId, audit = {}) {
  const userId = String(fields.user_id_ref || fields.member_id || '').trim();
  if (!userId) {
    return { success: false, message: 'Select a user first.' };
  }

  const menuIds = Array.isArray(fields.a_auth)
    ? fields.a_auth.map(Number).filter(Boolean)
    : fields.a_auth
      ? [Number(fields.a_auth)].filter(Boolean)
      : [];

  const { create, update } = auditFields(memberId, audit);

  try {
    await prisma.authentication_tb.updateMany({
      where: { user_id: Number(userId), authentication: 1, del: 1 },
      data: { authentication: 0, ...update },
    });

    for (const menuId of menuIds) {
      const existing = await prisma.authentication_tb.findFirst({
        where: { menu_id: menuId, user_id: Number(userId), del: 1 },
      });
      if (existing) {
        await prisma.authentication_tb.update({
          where: { id: existing.id },
          data: { authentication: 1, ...update },
        });
      } else {
        await prisma.authentication_tb.create({
          data: {
            user_id: Number(userId),
            menu_id: menuId,
            department: 0,
            authentication: 1,
            ...create,
          },
        });
      }
    }

    await logAdminSetup(PAGE, 'Update', 'Successful', `User id->${userId}`, memberId, audit);
    const reload = await loadMenuAuth(memberId, { member_id: userId }, {}, { ...audit, skipLog: true });
    return { success: true, message: 'Your details are updated...', ...reload };
  } catch {
    await logAdminSetup(PAGE, 'Add', 'Unsuccessful', `User id->${userId}`, memberId, audit);
    return { success: false, message: 'Please try again...' };
  }
}
