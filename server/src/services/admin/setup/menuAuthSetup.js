import { prisma } from '../../../config/prisma.js';
import { auditFields, logAdminSetup } from './setupAudit.js';
import { GLOBAL_ACCESS_TYPE } from '../../../utils/accessType.js';
import { loadMenuCatalog, buildMenuGroups } from './menuMatrixShared.js';

const PAGE = 'authentication_add.php';

async function loadUsersWithFlag(selectedId = '') {
  const configured = await prisma.authentication_tb.findMany({
    where: { del: 1 },
    select: { user_id: true },
    distinct: ['user_id'],
  });
  const configuredSet = new Set(configured.map((r) => String(r.user_id)));

  const rows = await prisma.web_account_setup.findMany({
    where: { del: 1, access_type: { not: GLOBAL_ACCESS_TYPE } },
    orderBy: { member_id: 'asc' },
    select: { id: true, member_id: true, member_name: true },
  });

  return rows.map((row) => ({
    value: String(row.id),
    label: `${row.member_id} - ${row.member_name}${configuredSet.has(String(row.id)) ? ' *' : ''}`,
    selected: String(row.id) === String(selectedId),
  }));
}

async function loadMenuMatrix(userId, sourceUserId = '') {
  const { menus, categoryOrder } = await loadMenuCatalog();

  // Copy mode: pre-check the matrix with the source user's permissions instead
  // of the target's own, so the admin reviews/adjusts before Save persists it
  // against the target (userId). Nothing is written until Save is submitted.
  const authSourceUserId = sourceUserId && sourceUserId !== String(userId) ? sourceUserId : userId;
  const authRows = await prisma.authentication_tb.findMany({
    where: { del: 1, user_id: Number(authSourceUserId), authentication: 1 },
    select: { menu_id: true },
  });
  const checkedMenuIds = new Set(authRows.map((r) => r.menu_id));

  return buildMenuGroups(menus, categoryOrder, checkedMenuIds);
}

export async function loadMenuAuth(memberId, fields = {}, query = {}, audit = {}) {
  const selectedUser = String(
    fields.member_id || query.uid || query.member_id || '',
  ).trim();
  const copyFromUser = String(fields.copy_from_user || '').trim();

  const users = await loadUsersWithFlag(selectedUser);
  const menuGroups = selectedUser ? await loadMenuMatrix(selectedUser, copyFromUser) : [];

  if (!audit.skipLog) {
    const description = copyFromUser
      ? `User id->${selectedUser} (previewing permissions copied from user id->${copyFromUser})`
      : selectedUser || 'form';
    await logAdminSetup(PAGE, 'View', 'Successful', description, memberId, audit);
  }
  return {
    users,
    selectedUser,
    copiedFromUser: copyFromUser || null,
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
