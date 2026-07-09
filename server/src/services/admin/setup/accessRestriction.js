import { prisma } from '../../../config/prisma.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logAdminSetup } from './setupAudit.js';

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
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function loadMemberOptions(selectedId = '') {
  const rows = await prisma.web_account_setup.findMany({
    where: { del: 1, access_type: { not: 'Global' } },
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

export async function loadAccessRestriction(memberId, fields = {}, query = {}, audit = {}) {
  const selectedMember = String(
    fields.member_id || query.member_id || query.uid || '',
  ).trim();

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
      const row = await prisma.access_tb.findFirst({
        where: { del: 1, user_id: selectedMember },
      });
      if (row) access = mapAccessRow(row);
    }
  }

  if (!audit.skipLog) {
    await logAdminSetup(PAGE, 'View', 'Successful', selectedMember || 'form', memberId, audit);
  }
  return {
    members,
    selectedMember,
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
