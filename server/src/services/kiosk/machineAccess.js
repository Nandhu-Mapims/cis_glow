import { prisma } from '../../config/prisma.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';

const PAGE = 'machine_access.php';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export async function loadMachineAccess(memberId, fields = {}, audit = {}) {
  const staffCat = String(fields.staffCategory || '');
  const categories = await prisma.$queryRaw`
    SELECT DISTINCT staff_cat AS cat FROM access_machine WHERE del = 1 ORDER BY staff_cat ASC
  `;
  const rows = staffCat
    ? await prisma.access_machine.findMany({ where: { del: 1, staff_cat: staffCat }, orderBy: { acc_group: 'asc' } })
    : [];

  await logModulePage(PAGE, 'View', 'Successful', staffCat, memberId, audit);
  return {
    staffCategories: categories.map((c) => c.cat),
    staffCategory: staffCat,
    groups: rows.map((r) => ({
      id: r.id,
      group: r.acc_group,
      days: r.days,
      fromTime: r.from_time,
      toTime: r.to_time,
    })),
    dayOptions: DAYS,
    form: { group: '', days: [], fromTime: '08:00', toTime: '18:00' },
  };
}

export async function saveMachineAccess(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  const staffCat = String(payload.staffCategory || '').trim();
  if (!staffCat) return { success: false, message: 'Staff category is required' };

  if (payload.action === 'delete') {
    await prisma.access_machine.updateMany({
      where: { staff_cat: staffCat, acc_group: Number(payload.group) },
      data: { del: 0, ...update },
    });
    await logModulePage(PAGE, 'Delete', 'Successful', `${staffCat}-${payload.group}`, memberId, audit);
    return { success: true, message: 'Access group deleted...', ...(await loadMachineAccess(memberId, { staffCategory: staffCat }, { ...audit, skipLog: true })) };
  }

  const days = Array.isArray(payload.days) ? payload.days.join(',') : String(payload.days || '');
  let group = Number(payload.group);
  if (!group) {
    const max = await prisma.access_machine.findFirst({
      where: { del: 1 },
      orderBy: { acc_group: 'desc' },
    });
    group = (max?.acc_group || 0) + 1;
  } else {
    await prisma.access_machine.updateMany({
      where: { staff_cat: staffCat, acc_group: group, del: 1 },
      data: { del: 0, ...update },
    });
  }

  await prisma.access_machine.create({
    data: {
      staff_cat: staffCat,
      acc_group: group,
      days,
      from_time: new Date(`1970-01-01T${payload.fromTime || '08:00'}:00`),
      to_time: new Date(`1970-01-01T${payload.toTime || '18:00'}:00`),
      ...create,
    },
  });

  await logModulePage(PAGE, 'Update', 'Successful', staffCat, memberId, audit);
  return { success: true, message: 'Machine access updated...', ...(await loadMachineAccess(memberId, { staffCategory: staffCat }, { ...audit, skipLog: true })) };
}
