/**
 * Create a "Limit" (non-Global) account with full menu access.
 *
 * Note: authentication_tb only stores a binary "has access to this menu link"
 * flag (authentication_add.php) — there is no separate read/write permission
 * per screen in this schema, so "read-only" cannot be enforced at the menu
 * level. This grants access to every enabled sub-menu (all modules,
 * including Admin), which is the closest equivalent legacy supports.
 *
 * Usage:
 *   ADMIN_USER_ID=Adminmd ADMIN_USER_PASSWORD='adminmd@123' node scripts/create-admin-menu-user.js
 */

import { prisma } from '../src/config/prisma.js';
import { encrypt } from '../src/services/password.js';

async function main() {
  const memberId = String(process.env.ADMIN_USER_ID || 'Adminmd').trim().toUpperCase();
  const memberName = String(process.env.ADMIN_USER_NAME || 'Admin MD').trim();
  const email = String(process.env.ADMIN_USER_EMAIL || 'adminmd@cis.local').trim();
  const mobile = String(process.env.ADMIN_USER_MOBILE || '0000000000').trim();
  const plainPassword = String(process.env.ADMIN_USER_PASSWORD || 'adminmd@123').trim();
  const createdBy = String(process.env.ADMIN_USER_CREATED_BY || 'system').trim();
  const createdIp = '127.0.0.1';
  const createdDt = new Date();

  const existingRows = await prisma.$queryRaw`
    SELECT id, access_type FROM web_account_setup
    WHERE del = 1 AND member_id = ${memberId} LIMIT 1
  `;
  const existing = existingRows[0];

  let userId;
  if (existing) {
    await prisma.$executeRaw`
      UPDATE web_account_setup
      SET password = ${encrypt(plainPassword)},
          reset_password = '',
          access_type = 'Limit',
          updated_dt = ${createdDt},
          updated_ip = ${createdIp},
          updated_by = ${createdBy}
      WHERE id = ${existing.id}
    `;
    userId = existing.id;
    console.log(`Existing user ${memberId} (id=${userId}) updated to Limit access with new password.`);
  } else {
    const user = await prisma.web_account_setup.create({
      data: {
        member_id: memberId,
        member_name: memberName,
        address_mobile: mobile,
        address_email: email,
        password: encrypt(plainPassword),
        reset_password: '',
        photo: '',
        acc_gender: '',
        access_type: 'Limit',
        created_dt: createdDt,
        created_ip: createdIp,
        created_by: createdBy,
        updated_dt: createdDt,
        updated_ip: createdIp,
        updated_by: createdBy,
        del: 1,
      },
    });
    userId = user.id;
    console.log(`Created user ${memberId} (id=${userId}) with Limit access.`);
  }

  // access_tb — allow all days/times (mirrors account_add.php defaults).
  const existingAccess = await prisma.$queryRaw`
    SELECT id FROM access_tb WHERE user_id = ${String(userId)} AND del = 1 LIMIT 1
  `;
  if (!existingAccess[0]) {
    await prisma.$executeRaw`
      INSERT INTO access_tb (
        user_id, local_access, random_id, random_id_1, random_id_2, random_id_3, random_id_4,
        date_base, from_date, to_date, day_base, allow_day, allow_from_time, allow_to_time,
        created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del
      ) VALUES (
        ${String(userId)}, 0, '0', '', '', '', '',
        0, ${createdDt}, '0000-00-00 00:00:00', 1, '1,2,3,4,5,6,7', '00:00:00', '23:59:00',
        ${createdDt}, ${createdIp}, ${createdBy}, ${createdDt}, ${createdIp}, ${createdBy}, 1
      )
    `;
    console.log('access_tb row created (24x7 access, all days).');
  }

  // Grant menu access to every enabled sub-menu link (all modules, including Admin —
  // see note above on why "read only" can't be scoped separately).
  await prisma.$executeRaw`
    UPDATE authentication_tb
    SET authentication = 0, updated_by = ${createdBy}, updated_ip = ${createdIp}, updated_dt = ${createdDt}
    WHERE user_id = ${userId} AND authentication = 1 AND del = 1
  `;

  const menus = await prisma.$queryRaw`
    SELECT id FROM basic_admin_menu_tb
    WHERE del = 1 AND menu_enable = 1 AND sub_menu_link != ''
  `;

  let granted = 0;
  for (const menu of menus) {
    const existingRow = await prisma.$queryRaw`
      SELECT id FROM authentication_tb WHERE menu_id = ${menu.id} AND user_id = ${userId} AND del = 1 LIMIT 1
    `;
    if (existingRow[0]) {
      await prisma.$executeRaw`
        UPDATE authentication_tb
        SET authentication = 1, updated_by = ${createdBy}, updated_ip = ${createdIp}, updated_dt = ${createdDt}
        WHERE id = ${existingRow[0].id}
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO authentication_tb (user_id, department, menu_id, authentication, created_dt, created_ip, created_by, updated_ip, updated_by, del)
        VALUES (${userId}, 0, ${menu.id}, 1, ${createdDt}, ${createdIp}, ${createdBy}, ${createdIp}, ${createdBy}, 1)
      `;
    }
    granted += 1;
  }

  console.log(`Granted access to ${granted} menu links.`);
  console.log(JSON.stringify({
    memberId,
    memberName,
    password: plainPassword,
    accessType: 'Limit',
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
