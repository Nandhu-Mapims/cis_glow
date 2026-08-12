import { prisma } from '../../../config/prisma.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logAdminSetup } from './setupAudit.js';
import { GLOBAL_ACCESS_TYPE } from '../../../utils/accessType.js';

const PAGE = 'access.php';

function parseDateTime(value) {
  if (!value) return null;
  const str = String(value).trim();
  const match = str.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh, min] = match;
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00`);
}

function formatDateTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1971) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTime(dt) {
  if (!dt) return '';
  // access_tb TIME columns are CAST(...AS CHAR) into bare "HH:MM:SS" strings
  // (see loadAccessRestriction) so they survive legacy zero-date rows --
  // `new Date("HH:MM:SS")` alone is not a recognized format and always
  // parses as Invalid Date, so anchor it to a real date first.
  const str = String(dt).trim();
  const d = /^\d{2}:\d{2}(:\d{2})?$/.test(str) ? new Date(`1970-01-01 ${str}`) : new Date(str);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function loadMemberOptions(selectedId = '') {
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

function mapAccessRow(row) {
  const allowDays = String(row.allow_day || '').split(',').filter(Boolean).map(Number);
  const days = [1, 2, 3, 4, 5, 6, 7].map((day, idx) => ({
    value: day,
    label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][idx],
    checked: allowDays.includes(day),
  }));

  return {
    accessId: row.id,
    memberId: row.user_id,
    localAccess: row.local_access === 1,
    randomKey: Number(row.random_id) || 1,
    randomKeys: [row.random_id_1, row.random_id_2, row.random_id_3, row.random_id_4],
    dateBase: row.date_base === 1,
    dayBase: row.day_base === 1,
    fromDate: formatDateTime(row.from_date),
    toDate: formatDateTime(row.to_date),
    allowFromTime: formatTime(row.allow_from_time),
    allowToTime: formatTime(row.allow_to_time),
    days,
  };
}

async function fetchAccessRow(userId) {
  // Plain prisma.access_tb.findFirst() throws for any row with a legacy
  // zero-date to_date/from_date ("0000-00-00...") -- Prisma's typed
  // Client API can't deserialize it into a Date. Cast the date/time
  // columns to CHAR in raw SQL instead (same fix already used for this
  // exact table in accessCheck.js, the login-time access gate).
  const rows = await prisma.$queryRaw`
    SELECT id, user_id, local_access, random_id, random_id_1, random_id_2, random_id_3, random_id_4,
           date_base,
           CAST(from_date AS CHAR) AS from_date,
           CAST(to_date AS CHAR) AS to_date,
           day_base, allow_day,
           CAST(allow_from_time AS CHAR) AS allow_from_time,
           CAST(allow_to_time AS CHAR) AS allow_to_time
    FROM access_tb
    WHERE del = 1 AND user_id = ${userId}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function loadAccessRestriction(memberId, fields = {}, query = {}, audit = {}) {
  const selectedMember = String(
    fields.member_id || query.member_id || query.uid || '',
  ).trim();
  const copyFromUser = String(fields.copy_from_user || '').trim();

  const members = await loadMemberOptions(selectedMember);
  let access = null;
  let globalUser = false;

  if (selectedMember) {
    const account = await prisma.web_account_setup.findFirst({
      where: { id: Number(selectedMember), del: 1 },
      select: { access_type: true },
    });
    if (account?.access_type?.toLowerCase() === 'global') {
      globalUser = true;
    } else {
      const isCopying = copyFromUser && copyFromUser !== selectedMember;
      const sourceRow = await fetchAccessRow(isCopying ? copyFromUser : selectedMember);
      if (sourceRow) {
        access = mapAccessRow(sourceRow);
        if (isCopying) {
          // Preview only: keep pointing at the TARGET's own existing record
          // (if any) so Save updates/creates for the target, never the
          // source. Nothing is written until Save is submitted.
          const targetRow = await fetchAccessRow(selectedMember);
          access.accessId = targetRow?.id || null;
        }
      }
    }
  }

  if (!audit.skipLog) {
    const description = copyFromUser
      ? `User id->${selectedMember} (previewing restrictions copied from user id->${copyFromUser})`
      : selectedMember || 'form';
    await logAdminSetup(PAGE, 'View', 'Successful', description, memberId, audit);
  }
  return {
    members,
    selectedMember,
    copiedFromUser: copyFromUser && copyFromUser !== selectedMember ? copyFromUser : null,
    globalUser,
    access,
  };
}

export async function saveAccessRestriction(fields, memberId, audit = {}) {
  const selectedMember = String(fields.member_id || '').trim();
  if (!selectedMember) {
    return { success: false, message: 'Select a member first.' };
  }

  const account = await prisma.web_account_setup.findFirst({
    where: { id: Number(selectedMember), del: 1 },
    select: { access_type: true },
  });
  if (account?.access_type?.toLowerCase() === 'global') {
    return { success: false, message: 'Global users cannot be restricted here.' };
  }

  const dateBase = fields.date_base === '1' || fields.date_base === 1;
  const dayBase = fields.day_base === '1' || fields.day_base === 1;
  const localAccess = fields.local_access === '1' || fields.local_access === 1 ? 1 : 0;
  const randomKey = String(fields.random_key || '1');

  let fromDate = new Date('1970-01-01T00:00:00');
  let toDate = new Date('1970-01-01T00:00:00');
  let dayDetails = '';
  let allowFrom = '00:00:00';
  let allowTo = '00:00:00';
  let useDateBase = 0;
  let useDayBase = 0;

  if (dateBase) {
    useDateBase = 1;
    const from = parseDateTime(fields.from_date);
    const to = parseDateTime(fields.to_date);
    if (from) fromDate = from;
    if (to) toDate = to;
  } else if (dayBase) {
    useDayBase = 1;
    const dayField = fields.day || {};
    const dayValues = Array.isArray(dayField)
      ? dayField
      : Object.values(dayField).filter(Boolean);
    dayDetails = dayValues.join(',');
    allowFrom = fields.a_from_time ? `${fields.a_from_time}:00` : '00:00:00';
    allowTo = fields.a_to_time ? `${fields.a_to_time}:00` : '00:00:00';
  }

  const randomUpdates = {};
  for (let i = 1; i <= 4; i += 1) {
    const key = `random_key_${i}`;
    randomUpdates[`random_id_${i}`] = String(fields[key] ?? '');
  }

  const { create, update } = auditFields(memberId, audit);
  const accessId = fields.access_id ? Number(fields.access_id) : null;

  try {
    if (!accessId) {
      await prisma.access_tb.create({
        data: {
          user_id: selectedMember,
          local_access: localAccess,
          random_id: randomKey,
          ...randomUpdates,
          date_base: useDateBase,
          from_date: fromDate,
          to_date: toDate,
          day_base: useDayBase,
          allow_day: dayDetails,
          allow_from_time: new Date(`1970-01-01T${allowFrom}`),
          allow_to_time: new Date(`1970-01-01T${allowTo}`),
          ...create,
        },
      });
    } else {
      await prisma.access_tb.update({
        where: { id: accessId },
        data: {
          user_id: selectedMember,
          local_access: localAccess,
          random_id: randomKey,
          ...randomUpdates,
          date_base: useDateBase,
          from_date: fromDate,
          to_date: toDate,
          day_base: useDayBase,
          allow_day: dayDetails,
          allow_from_time: new Date(`1970-01-01T${allowFrom}`),
          allow_to_time: new Date(`1970-01-01T${allowTo}`),
          ...update,
        },
      });
    }

    await logAdminSetup(PAGE, 'Update', 'Successful', `User id->${selectedMember}`, memberId, audit);
    const reload = await loadAccessRestriction(memberId, { member_id: selectedMember }, {}, { ...audit, skipLog: true });
    return { success: true, message: 'Your details are updated...', ...reload };
  } catch {
    await logAdminSetup(PAGE, 'Update', 'Unsuccessful', `User id->${selectedMember}`, memberId, audit);
    return { success: false, message: 'Please try again...' };
  }
}
