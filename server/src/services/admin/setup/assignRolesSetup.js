import { prisma } from '../../../config/prisma.js';
import { auditFields, logAdminSetup } from './setupAudit.js';
import { GLOBAL_ACCESS_TYPE } from '../../../utils/accessType.js';
import { materializeUserPermissions } from './roleMaterializer.js';

// No legacy equivalent -- see ADMIN_ROLE_MODULE_UPGRADE.md.
const PAGE = 'assign_roles';

async function loadUserOptions(selectedId = '') {
  const rows = await prisma.web_account_setup.findMany({
    where: { del: 1, access_type: { not: GLOBAL_ACCESS_TYPE } },
    orderBy: { member_id: 'asc' },
    select: { id: true, member_id: true, member_name: true },
  });
  return rows.map((row) => ({
    value: String(row.id),
    label: `${row.member_id} - ${row.member_name}`,
    selected: String(row.id) === String(selectedId),
  }));
}

async function loadRoleChecklist(userId) {
  const [roles, assigned] = await Promise.all([
    prisma.role_tb.findMany({
      where: { del: 1 },
      orderBy: { role_name: 'asc' },
      select: { id: true, role_name: true, description: true },
    }),
    userId
      ? prisma.user_role_tb.findMany({
          where: { del: 1, user_id: Number(userId) },
          select: { role_id: true },
        })
      : [],
  ]);
  const assignedIds = new Set(assigned.map((r) => r.role_id));

  return roles.map((role) => ({
    roleId: role.id,
    label: role.role_name,
    description: role.description,
    checked: assignedIds.has(role.id),
  }));
}

export async function loadAssignRoles(memberId, fields = {}, query = {}, audit = {}) {
  const selectedUser = String(fields.member_id || query.uid || query.member_id || '').trim();

  const users = await loadUserOptions(selectedUser);
  const roleChecklist = selectedUser ? await loadRoleChecklist(selectedUser) : [];

  if (!audit.skipLog) {
    await logAdminSetup(PAGE, 'View', 'Successful', selectedUser || 'form', memberId, audit);
  }

  return {
    users,
    selectedUser,
    roleChecklist,
  };
}

export async function saveAssignRoles(fields, memberId, audit = {}) {
  const userId = String(fields.member_id || '').trim();
  if (!userId) {
    return { success: false, message: 'Select a user first.' };
  }

  const roleIds = Array.isArray(fields.a_roles)
    ? fields.a_roles.map(Number).filter(Boolean)
    : fields.a_roles
      ? [Number(fields.a_roles)].filter(Boolean)
      : [];

  const { create, update } = auditFields(memberId, audit);

  try {
    // Standard del=1/del=0 soft-delete-then-recreate: retire every current
    // assignment, then re-create exactly the submitted role set.
    await prisma.user_role_tb.updateMany({
      where: { user_id: Number(userId), del: 1 },
      data: { del: 0, ...update },
    });

    for (const roleId of roleIds) {
      await prisma.user_role_tb.create({
        data: { user_id: Number(userId), role_id: roleId, ...create },
      });
    }

    const { rolesApplied, menusGranted } = await materializeUserPermissions(userId, memberId, audit);

    await logAdminSetup(
      PAGE,
      'Update',
      'Successful',
      `User id->${userId}, roles->${roleIds.join(',') || 'none'}`,
      memberId,
      audit,
    );

    const reload = await loadAssignRoles(memberId, { member_id: userId }, {}, { ...audit, skipLog: true });
    const note = menusGranted > 0
      ? `Roles updated. ${menusGranted} new menu item(s) granted from ${rolesApplied} role(s). Existing individual permissions were left untouched.`
      : 'Roles updated. No new menu items to grant (already covered by existing permissions, or no roles selected).';
    return { success: true, message: note, ...reload };
  } catch (err) {
    console.error('saveAssignRoles error:', err);
    await logAdminSetup(PAGE, 'Update', 'Unsuccessful', `User id->${userId}`, memberId, audit);
    return { success: false, message: 'Please try again...' };
  }
}
