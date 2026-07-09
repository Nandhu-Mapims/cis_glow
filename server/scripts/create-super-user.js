/**
 * Create a Global (super user) account in web_account_setup.
 *
 * Usage:
 *   node scripts/create-super-user.js
 *   SUPER_USER_ID=CISADMIN SUPER_USER_PASSWORD='YourPass123' node scripts/create-super-user.js
 *
 * Global users:
 * - See full admin menu (no per-menu authentication_tb rows required)
 * - Bypass menuAuthForModule checks on API routes
 * - Bypass access_tb time/device restrictions at login
 */

import crypto from 'crypto';
import { prisma } from '../src/config/prisma.js';
import { encrypt } from '../src/services/password.js';

function randomPassword(length = 14) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#';
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i += 1) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

function nowSql() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function main() {
  const memberId = String(process.env.SUPER_USER_ID || 'CISADMIN').trim().toUpperCase();
  const memberName = String(process.env.SUPER_USER_NAME || 'CIS Super Admin').trim();
  const email = String(process.env.SUPER_USER_EMAIL || 'cisadmin@cis.local').trim();
  const mobile = String(process.env.SUPER_USER_MOBILE || '0000000000').trim();
  const plainPassword = String(process.env.SUPER_USER_PASSWORD || '').trim() || randomPassword();
  const createdBy = String(process.env.SUPER_USER_CREATED_BY || 'system').trim();
  const createdIp = '127.0.0.1';
  const createdDt = new Date();

  if (memberId.length < 3) {
    throw new Error('SUPER_USER_ID must be at least 3 characters');
  }

  const existing = await prisma.web_account_setup.findFirst({
    where: { del: 1, member_id: memberId },
  });

  if (existing) {
    if (existing.access_type === 'Global') {
      console.log(`Global user already exists: ${memberId} (id=${existing.id})`);
      console.log('To reset password, set SUPER_USER_PASSWORD and run with SUPER_USER_FORCE=1');
      if (process.env.SUPER_USER_FORCE !== '1') {
        return;
      }
      await prisma.web_account_setup.update({
        where: { id: existing.id },
        data: {
          password: encrypt(plainPassword),
          reset_password: '',
          updated_dt: createdDt,
          updated_ip: createdIp,
          updated_by: createdBy,
        },
      });
      console.log('Password updated for existing Global user.');
      console.log(JSON.stringify({ memberId, password: plainPassword, accessType: 'Global' }, null, 2));
      return;
    }
    throw new Error(`User ${memberId} exists but access_type is "${existing.access_type}", not Global`);
  }

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
      access_type: 'Global',
      created_dt: createdDt,
      created_ip: createdIp,
      created_by: createdBy,
      updated_dt: createdDt,
      updated_ip: createdIp,
      updated_by: createdBy,
      del: 1,
    },
  });

  // Optional — Global users bypass access_tb at login; mirror account_add.php defaults.
  try {
    await prisma.$executeRaw`
      INSERT INTO access_tb (
        user_id, local_access, random_id, random_id_1, random_id_2, random_id_3, random_id_4,
        date_base, from_date, to_date, day_base, allow_day, allow_from_time, allow_to_time,
        created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del
      ) VALUES (
        ${String(user.id)}, 0, '0', '', '', '', '',
        0, ${createdDt}, '0000-00-00 00:00:00', 1, '1,2,3,4,5,6,7', '00:00:00', '23:59:00',
        ${createdDt}, ${createdIp}, ${createdBy}, ${createdDt}, ${createdIp}, ${createdBy}, 1
      )
    `;
  } catch (accessError) {
    console.warn('Note: access_tb row skipped (Global login does not require it).', accessError.message);
  }

  console.log('Global super user created successfully.');
  console.log(JSON.stringify({
    id: user.id,
    memberId,
    memberName,
    email,
    password: plainPassword,
    accessType: 'Global',
    loginUrl: process.env.CLIENT_URL || 'http://localhost:5173',
    createdAt: nowSql(),
  }, null, 2));
  console.log('\nStore the password securely and change it after first login if needed.');
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
