import { prisma } from '../../../config/prisma.js';
import { auditFields, logAdminSetup } from './setupAudit.js';
import { loadMenuCatalog, buildMenuGroups } from './menuMatrixShared.js';

// No legacy equivalent -- this screen doesn't exist in the PHP app (see
// ADMIN_ROLE_MODULE_UPGRADE.md). Logged under a non-.php page name so it's
// clearly distinguishable from real legacy-parity screens in log_tb.
const PAGE = 'role_manager';

async function loadRoleOptions(selectedId = '') {
  const roles = await prisma.role_tb.findMany({
    where: { del: 1 },
    orderBy: { role_name: 'asc' },
    select: { id: true, role_name: true, description: true },
  });

  return roles.map((role) => ({
    value: String(role.id),
    label: role.role_name,
    description: role.description,
    selected: String(role.id) === String(selectedId),
  }));
}

async function loadRoleMenuGroups(roleId) {
  const { menus, categoryOrder } = await loadMenuCatalog();
  const authRows = await prisma.role_menu_tb.findMany({
    where: { del: 1, role_id: Number(roleId), authentication: 1 },
    select: { menu_id: true },
  });
  const checkedMenuIds = new Set(authRows.map((r) => r.menu_id));
  return buildMenuGroups(menus, categoryOrder, checkedMenuIds);
}

export async function loadRoleManager(memberId, fields = {}, query = {}, audit = {}) {
  const selectedRoleId = String(fields.role_id || query.roleId || '').trim();
  const isNew = selectedRoleId === 'new';

  const roles = await loadRoleOptions(isNew ? '' : selectedRoleId);
  let roleName = '';
  let description = '';
  let menuGroups = [];

  if (selectedRoleId && !isNew) {
    const role = await prisma.role_tb.findFirst({
      where: { id: Number(selectedRoleId), del: 1 },
    });
    if (!role) {
      return { error: 'Role not found' };
    }
    roleName = role.role_name;
    description = role.description;
    menuGroups = await loadRoleMenuGroups(selectedRoleId);
  } else if (isNew) {
    menuGroups = await loadRoleMenuGroups('0'); // unchecked matrix, correct shape, no role yet
  }

  if (!audit.skipLog) {
    await logAdminSetup(PAGE, 'View', 'Successful', selectedRoleId || 'form', memberId, audit);
  }

  return {
    roles,
    selectedRoleId,
    isNew,
    roleName,
    description,
    menuGroups,
  };
}

export async function saveRoleManager(fields, memberId, audit = {}) {
  const roleName = String(fields.role_name || '').trim();
  if (!roleName) {
    return { success: false, message: 'Role name is required.' };
  }
  const description = String(fields.description || '').trim();
  const requestedRoleId = String(fields.role_id || '').trim();
  const isNew = !requestedRoleId || requestedRoleId === 'new';

  const menuIds = Array.isArray(fields.a_auth)
    ? fields.a_auth.map(Number).filter(Boolean)
    : fields.a_auth
      ? [Number(fields.a_auth)].filter(Boolean)
      : [];

  const { create, update } = auditFields(memberId, audit);

  try {
    let roleId;
    if (isNew) {
      const created = await prisma.role_tb.create({
        data: { role_name: roleName, description, ...create },
      });
      roleId = created.id;
    } else {
      roleId = Number(requestedRoleId);
      await prisma.role_tb.update({
        where: { id: roleId },
        data: { role_name: roleName, description, ...update },
      });
    }

    // Same soft-toggle pattern as saveMenuAuth: clear existing grants for
    // this role, then re-grant exactly the submitted menu set.
    await prisma.role_menu_tb.updateMany({
      where: { role_id: roleId, authentication: 1, del: 1 },
      data: { authentication: 0, ...update },
    });

    for (const menuId of menuIds) {
      const existing = await prisma.role_menu_tb.findFirst({
        where: { role_id: roleId, menu_id: menuId, del: 1 },
      });
      if (existing) {
        await prisma.role_menu_tb.update({
          where: { id: existing.id },
          data: { authentication: 1, ...update },
        });
      } else {
        await prisma.role_menu_tb.create({
          data: { role_id: roleId, menu_id: menuId, authentication: 1, ...create },
        });
      }
    }

    await logAdminSetup(PAGE, isNew ? 'Add' : 'Update', 'Successful', `Role id->${roleId}`, memberId, audit);
    const reload = await loadRoleManager(memberId, { role_id: String(roleId) }, {}, { ...audit, skipLog: true });
    return { success: true, message: 'Role saved.', ...reload };
  } catch (err) {
    console.error('saveRoleManager error:', err);
    await logAdminSetup(PAGE, isNew ? 'Add' : 'Update', 'Unsuccessful', roleName, memberId, audit);
    return { success: false, message: 'Please try again...' };
  }
}
