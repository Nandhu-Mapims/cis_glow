import { prisma } from '../../../config/prisma.js';

/**
 * Compiles a user's assigned roles (user_role_tb -> role_menu_tb) into real
 * authentication_tb rows -- the same table menuAuthForModule() and the
 * legacy PHP app already read. This keeps roles a pure *authoring*
 * convenience: nothing downstream (menu auth middleware, legacy app,
 * post-login menu redirect) needs to know roles exist.
 *
 * Additive only, by design: a menu_id already present in authentication_tb
 * for this user (whether from a prior role grant or a manual override on
 * the Menu Authentication screen) is left untouched. Assigning a role can
 * only grant new menu access, never silently revoke something an admin set
 * by hand. Removing a role likewise does not retract previously granted
 * items -- use Menu Authentication to remove specific access. This avoids
 * needing a "granted by role X" marker column on the shared authentication_tb
 * table, which stays byte-for-byte the same shape the legacy app expects.
 */
export async function materializeUserPermissions(userId, memberId, audit = {}) {
  const uid = Number(userId);

  const roleLinks = await prisma.user_role_tb.findMany({
    where: { del: 1, user_id: uid },
    select: { role_id: true },
  });
  const roleIds = [...new Set(roleLinks.map((r) => r.role_id))];
  if (roleIds.length === 0) {
    return { rolesApplied: 0, menusGranted: 0 };
  }

  const [roleMenuRows, existingAuth] = await Promise.all([
    prisma.role_menu_tb.findMany({
      where: { del: 1, role_id: { in: roleIds }, authentication: 1 },
      select: { menu_id: true },
    }),
    prisma.authentication_tb.findMany({
      where: { del: 1, user_id: uid },
      select: { menu_id: true },
    }),
  ]);

  const alreadyGranted = new Set(existingAuth.map((r) => r.menu_id));
  const toGrant = [...new Set(roleMenuRows.map((r) => r.menu_id))]
    .filter((menuId) => !alreadyGranted.has(menuId));

  if (toGrant.length === 0) {
    return { rolesApplied: roleIds.length, menusGranted: 0 };
  }

  const now = new Date();
  const ip = String(audit.ip || '').slice(0, 15);

  await prisma.authentication_tb.createMany({
    data: toGrant.map((menuId) => ({
      user_id: uid,
      menu_id: menuId,
      department: 0,
      authentication: 1,
      created_dt: now,
      created_ip: ip,
      created_by: memberId,
      updated_dt: now,
      updated_ip: ip,
      updated_by: memberId,
      del: 1,
    })),
  });

  return { rolesApplied: roleIds.length, menusGranted: toGrant.length };
}
