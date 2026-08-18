/**
 * Import users + menu access from ../ALL_USER.json into web_account_setup,
 * access_tb, and authentication_tb.
 *
 * Idempotent / re-runnable: matches existing users by member_id and existing
 * authentication_tb rows by (user_id, menu_id) — re-running after editing
 * ALL_USER.json updates the password and overwrites each menu's `access`
 * (true → authentication=1, false → authentication=0) rather than
 * duplicating rows.
 *
 * Usage:
 *   node scripts/import-all-users.js
 *   node scripts/import-all-users.js /path/to/other.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../src/config/prisma.js';
import { encrypt } from '../src/services/password.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function nowSql() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function upsertUser(entry, createdIp, createdBy, createdDt) {
  const memberId = String(entry.member_id).trim().toUpperCase();
  const memberName = String(entry.member_name || memberId).trim();
  const accessType = entry.access_type === 'Global' ? 'Global' : 'Limit';
  const plainPassword = String(entry.password).trim();

  const existingRows = await prisma.$queryRaw`
    SELECT id FROM web_account_setup WHERE del = 1 AND member_id = ${memberId} LIMIT 1
  `;
  const existing = existingRows[0];

  let userId;
  if (existing) {
    userId = existing.id;
    await prisma.$executeRaw`
      UPDATE web_account_setup
      SET password = ${encrypt(plainPassword)},
          reset_password = '',
          member_name = ${memberName},
          access_type = ${accessType},
          updated_dt = ${createdDt},
          updated_ip = ${createdIp},
          updated_by = ${createdBy}
      WHERE id = ${userId}
    `;
    console.log(`Updated ${memberId} (id=${userId}, access_type=${accessType}).`);
  } else {
    const user = await prisma.web_account_setup.create({
      data: {
        member_id: memberId,
        member_name: memberName,
        address_mobile: '0000000000',
        address_email: `${memberId.toLowerCase()}@cis.local`,
        password: encrypt(plainPassword),
        reset_password: '',
        photo: '',
        acc_gender: '',
        access_type: accessType,
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
    console.log(`Created ${memberId} (id=${userId}, access_type=${accessType}).`);
  }

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
  }

  let granted = 0;
  let revoked = 0;
  for (const menu of entry.menus || []) {
    const menuId = Number(menu.menu_id);
    const wantAuth = menu.access ? 1 : 0;

    const existingRow = await prisma.$queryRaw`
      SELECT id, authentication FROM authentication_tb WHERE menu_id = ${menuId} AND user_id = ${userId} AND del = 1 LIMIT 1
    `;
    if (existingRow[0]) {
      if (Number(existingRow[0].authentication) !== wantAuth) {
        await prisma.$executeRaw`
          UPDATE authentication_tb
          SET authentication = ${wantAuth}, updated_by = ${createdBy}, updated_ip = ${createdIp}, updated_dt = ${createdDt}
          WHERE id = ${existingRow[0].id}
        `;
      }
    } else {
      await prisma.$executeRaw`
        INSERT INTO authentication_tb (user_id, department, menu_id, authentication, created_dt, created_ip, created_by, updated_ip, updated_by, del)
        VALUES (${userId}, 0, ${menuId}, ${wantAuth}, ${createdDt}, ${createdIp}, ${createdBy}, ${createdIp}, ${createdBy}, 1)
      `;
    }
    if (wantAuth) granted += 1;
    else revoked += 1;
  }

  console.log(`  menus: ${granted} granted, ${revoked} revoked (of ${entry.menus?.length || 0} listed).`);
}

async function main() {
  const jsonPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, '../../ALL_USER.json');

  const raw = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(raw);

  const createdBy = String(process.env.IMPORT_CREATED_BY || 'ALL_USER.json').trim();
  const createdIp = '127.0.0.1';
  const createdDt = new Date();

  console.log(`Importing ${data.users.length} user(s) from ${jsonPath}`);
  for (const entry of data.users) {
    await upsertUser(entry, createdIp, createdBy, createdDt);
  }
  console.log(`Done at ${nowSql()}`);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
