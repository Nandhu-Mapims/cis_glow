import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logAdminSetup } from './setupAudit.js';

const PAGE_BY_MODE = {
  hod: 'staff_authentication_add.php',
  page: 'staff_page_authentication_add.php',
};

async function loadStaffOptions(mode, selectedId = '') {
  const where = mode === 'hod'
    ? { del: 1, atten_auth: 1 }
    : { del: 1, atten_auth: { not: 1 } };

  const rows = await prisma.staff_profile_tb.findMany({
    where,
    orderBy: { staff_id: 'asc' },
    select: {
      id: true,
      staff_id: true,
      staff_name: true,
      staff_initial: true,
      staff_title: true,
    },
  });

  return rows.map((row) => {
    const label = `${row.staff_id} | ${row.staff_title}. ${row.staff_name} ${row.staff_initial || ''}`.trim();
    return {
      value: String(row.id),
      label,
      selected: String(row.id) === String(selectedId),
    };
  });
}

async function loadMenuMatrix(staffId, mode) {
  const regFilter = mode === 'hod' ? 0 : { not: 0 };

  const categories = await prisma.admin_staff_menu_category_tb.findMany({
    where: { del: 1 },
    orderBy: { category_order: 'asc' },
    select: { id: true },
  });
  const categoryOrder = categories.map((c) => c.id);

  const menus = await prisma.basic_st_admin_menu_tb.findMany({
    where: {
      del: 1,
      menu_enable: 1,
      category_id: { not: 0 },
      reg_icon: regFilter,
      sub_menu_link: { not: '' },
    },
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

  const authRows = await prisma.admin_staff_authentication_tb.findMany({
    where: { del: 1, staff_id: Number(staffId) },
    select: { id: true, menu_id: true, authentication: true },
  });
  const authMap = new Map(authRows.map((r) => [r.menu_id, { id: r.id, checked: r.authentication === 1 }]));

  const mainMenus = [];
  const seenMain = new Set();
  for (const menu of menus) {
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

  return mainMenus.map((mainName) => ({
    mainMenu: mainName,
    items: menus
      .filter((m) => m.main_menu_name === mainName)
      .map((m) => {
        const auth = authMap.get(m.id);
        return {
          menuId: m.id,
          rowId: auth?.id || null,
          label: m.sub_menu_name || 'Direct',
          checked: auth?.checked === true,
        };
      }),
  }));
}

function pageForMode(mode) {
  return PAGE_BY_MODE[mode] || PAGE_BY_MODE.hod;
}

export async function loadStaffAuthSetup(mode, memberId, fields = {}, query = {}, audit = {}) {
  const selectedStaff = String(fields.staff_id || query.uid || '').trim();
  const staffOptions = await loadStaffOptions(mode, selectedStaff);
  const menuGroups = selectedStaff ? await loadMenuMatrix(selectedStaff, mode) : [];

  if (!audit.skipLog) {
    await logAdminSetup(pageForMode(mode), 'View', 'Successful', selectedStaff || 'form', memberId, audit);
  }

  return {
    mode,
    staffOptions,
    selectedStaff,
    menuGroups,
  };
}

export async function saveStaffAuthSetup(mode, fields, memberId, audit = {}) {
  const staffId = String(fields.staff_id || '').trim();
  if (!staffId) {
    return { success: false, message: 'Select a staff member first.' };
  }

  const menuIds = Array.isArray(fields.menu_id)
    ? fields.menu_id.map(Number)
    : fields.menu_id
      ? [Number(fields.menu_id)]
      : [];

  const rowIds = Array.isArray(fields.user_row_id)
    ? fields.user_row_id.map((v) => (v ? Number(v) : null))
    : fields.user_row_id
      ? [fields.user_row_id ? Number(fields.user_row_id) : null]
      : [];

  const authValues = Array.isArray(fields.a_auth)
    ? fields.a_auth.map((v) => (v === '1' || v === 1 || v === true ? 1 : 0))
    : fields.a_auth
      ? [fields.a_auth === '1' || fields.a_auth === 1 || fields.a_auth === true ? 1 : 0]
      : [];

  const { create, update } = auditFields(memberId, audit);

  try {
    for (let i = 0; i < menuIds.length; i += 1) {
      const menuId = menuIds[i];
      if (!menuId) continue;
      const authentication = authValues[i] ?? 0;
      const rowId = rowIds[i];

      if (rowId && Number.isInteger(rowId) && rowId > 0) {
        await prisma.admin_staff_authentication_tb.update({
          where: { id: rowId },
          data: {
            staff_id: Number(staffId),
            menu_id: menuId,
            authentication,
            ...update,
          },
        });
      } else {
        await prisma.admin_staff_authentication_tb.create({
          data: {
            staff_id: Number(staffId),
            menu_id: menuId,
            department: 0,
            authentication,
            ...create,
          },
        });
      }
    }

    await logAdminSetup(pageForMode(mode), 'Update', 'Successful', `User id->${staffId}`, memberId, audit);
    const reload = await loadStaffAuthSetup(mode, memberId, { staff_id: staffId }, {}, { ...audit, skipLog: true });
    return { success: true, message: 'Your details are updated...', ...reload };
  } catch {
    await logAdminSetup(pageForMode(mode), 'Add', 'Unsuccessful', `User id->${staffId}`, memberId, audit);
    return { success: false, message: 'Please try again...' };
  }
}

export async function loadStaffAuthHod(memberId, fields, query, audit) {
  return loadStaffAuthSetup('hod', memberId, fields, query, audit);
}

export async function saveStaffAuthHod(fields, memberId, audit) {
  return saveStaffAuthSetup('hod', fields, memberId, audit);
}

export async function loadStaffAuthPage(memberId, fields, query, audit) {
  return loadStaffAuthSetup('page', memberId, fields, query, audit);
}

export async function saveStaffAuthPage(fields, memberId, audit) {
  return saveStaffAuthSetup('page', fields, memberId, audit);
}
