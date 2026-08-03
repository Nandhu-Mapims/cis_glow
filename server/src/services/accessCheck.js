import crypto from 'crypto';
import { prisma } from '../config/prisma.js';
import { insertLog } from './logService.js';

function parseTimeToMinutes(timeValue) {
  if (!timeValue) return 0;
  const str = timeValue instanceof Date
    ? timeValue.toISOString().substring(11, 16)
    : String(timeValue).substring(0, 5);
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

function isWithinDayTime(accessRow, now) {
  const currentDay = now.getDay() === 0 ? 7 : now.getDay();
  const allowDays = String(accessRow.allow_day || '').split(',').map((d) => d.trim());
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const fromMinutes = parseTimeToMinutes(accessRow.allow_from_time);
  const toMinutes = parseTimeToMinutes(accessRow.allow_to_time);

  return allowDays.includes(String(currentDay))
    && currentMinutes >= fromMinutes
    && currentMinutes <= toMinutes;
}

function isWithinDateRange(accessRow, now) {
  const fromRaw = String(accessRow.from_date || '');
  const toRaw = String(accessRow.to_date || '');
  if (fromRaw.startsWith('0000-00-00') || toRaw.startsWith('0000-00-00')) {
    return false;
  }
  const current = now.getTime();
  const from = new Date(fromRaw).getTime();
  const to = new Date(toRaw).getTime();
  return !Number.isNaN(from) && !Number.isNaN(to) && from <= current && to >= current;
}

// MD5 here is intentional, not an oversight: these `login_random_id_*`/`login_user_id_*`
// cookies are shared with the legacy PHP app (same browser, same domain, same cookie
// names — see index.php's matching md5() calls), which is the primary "remembered
// device" check on both sides. Switching to a stronger hash here would desync from
// legacy and break device recognition for every user until the legacy app is updated
// too. Low practical risk regardless: this only gates a convenience skip on top of the
// real credential check in auth.js, not authentication itself, and MD5 is used here
// as a fixed-input digest (not against attacker-chosen input) so collision attacks
// don't apply.
function checkDeviceAccess(accessRow, cookies, userId) {
  const loginRandomId = cookies[`login_random_id_${userId}`];
  const loginUserId = cookies[`login_user_id_${userId}`];
  const userIdCheck = crypto.createHash('md5').update(String(userId)).digest('hex');

  if (!loginRandomId || !loginUserId || loginUserId !== userIdCheck) {
    return { allowed: false, emptySlot: findEmptyDeviceSlot(accessRow) };
  }

  const randomCount = Number(accessRow.random_id) || 0;
  const slots = [
    accessRow.random_id_1,
    accessRow.random_id_2,
    accessRow.random_id_3,
    accessRow.random_id_4,
  ];

  for (let i = 0; i < Math.min(randomCount, 4); i += 1) {
    const slotValue = slots[i];
    if (slotValue && loginRandomId === crypto.createHash('md5').update(String(slotValue)).digest('hex')) {
      return { allowed: true };
    }
  }

  return { allowed: false, emptySlot: findEmptyDeviceSlot(accessRow) };
}

function findEmptyDeviceSlot(accessRow) {
  const randomCount = Number(accessRow.random_id) || 0;
  const slots = [
    accessRow.random_id_1,
    accessRow.random_id_2,
    accessRow.random_id_3,
    accessRow.random_id_4,
  ];

  for (let i = 0; i < Math.min(randomCount, 4); i += 1) {
    if (!slots[i]) return i + 1;
  }
  return 0;
}

function generateDeviceKey() {
  const chars = 'abxdefghijklmnopqrstuvwxyz0987654321';
  let result = '';
  for (let i = 0; i < 8; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function accessCheck({
  userId,
  username,
  authType,
  userDt,
  userIp,
  userOs,
  cookies = {},
  sessionId = '',
}) {
  if (authType === 'admin' || authType === 'Global') {
    await insertLog(['index', 'login', 'Successful', '', userDt, userIp, userOs, username], sessionId);
    return { success: true };
  }

  const rows = await prisma.$queryRaw`
    SELECT id, user_id, local_access, random_id, random_id_1, random_id_2, random_id_3, random_id_4,
           date_base,
           CAST(from_date AS CHAR) AS from_date,
           CAST(to_date AS CHAR) AS to_date,
           day_base, allow_day,
           CAST(allow_from_time AS CHAR) AS allow_from_time,
           CAST(allow_to_time AS CHAR) AS allow_to_time
    FROM access_tb
    WHERE user_id = ${String(userId)} AND del = 1
    LIMIT 1
  `;
  const accessRow = rows[0];

  if (!accessRow) {
    await insertLog(['index', 'login', 'Unsuccessful', 'Not an autherised', userDt, userIp, userOs, username], sessionId);
    return {
      success: false,
      message: 'You are not an autherised user...',
    };
  }

  const now = new Date(userDt);
  let allowFlag = false;

  if (accessRow.day_base === 0 && accessRow.date_base === 0) {
    allowFlag = true;
  } else if (accessRow.day_base === 1) {
    allowFlag = isWithinDayTime(accessRow, now);
  } else if (accessRow.date_base === 1) {
    allowFlag = isWithinDateRange(accessRow, now);
  }

  if (!allowFlag) {
    await insertLog(['index', 'login', 'Unsuccessful', 'Not an autherised at this time', userDt, userIp, userOs, username], sessionId);
    return {
      success: false,
      message: 'You are not an autherised user...',
    };
  }

  if (accessRow.local_access === 0) {
    await insertLog(['index', 'login', 'Successful', '', userDt, userIp, userOs, username], sessionId);
    return { success: true };
  }

  const deviceResult = checkDeviceAccess(accessRow, cookies, userId);

  if (deviceResult.allowed) {
    await insertLog(['index', 'login', 'Successful', '', userDt, userIp, userOs, username], sessionId);
    return { success: true };
  }

  if (deviceResult.emptySlot > 0) {
    const randomKey = generateDeviceKey();
    const slotField = `random_id_${deviceResult.emptySlot}`;
    await prisma.$executeRawUnsafe(
      `UPDATE access_tb SET ${slotField} = ?, updated_by = ?, updated_ip = ?, updated_dt = ? WHERE id = ?`,
      randomKey,
      username,
      userIp,
      new Date(userDt),
      accessRow.id,
    );

    await insertLog(['index', 'login', 'Successful', 'set cookies and login', userDt, userIp, userOs, username], sessionId);

    return {
      success: true,
      deviceCookies: {
        [`login_random_id_${userId}`]: crypto.createHash('md5').update(randomKey).digest('hex'),
        [`login_user_id_${userId}`]: crypto.createHash('md5').update(String(userId)).digest('hex'),
      },
    };
  }

  await insertLog(['index', 'login', 'Unsuccessful', 'Unknown device', userDt, userIp, userOs, username], sessionId);
  return {
    success: false,
    message: 'You are not an autherised user...',
  };
}
