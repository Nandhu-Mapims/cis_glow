import { prisma } from '../../config/prisma.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';

const PAGE = 'elearn_setup.php';

export async function loadElearnSetup(memberId, _fields = {}, audit = {}) {
  const rows = await prisma.activity_time_tb.findMany({ where: { del: 1 }, orderBy: [{ atype: 'asc' }, { ayear: 'asc' }] });
  await logModulePage(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    slots: rows.map((r) => ({
      id: r.id,
      atype: r.atype,
      ayear: r.ayear,
      fromTime: r.from_time,
      toTime: r.to_time,
    })),
  };
}

export async function saveElearnSetup(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);
  const slots = Array.isArray(payload.slots) ? payload.slots : [];
  for (const slot of slots) {
    if (!slot.id) continue;
    await prisma.activity_time_tb.update({
      where: { id: Number(slot.id) },
      data: {
        from_time: new Date(`1970-01-01T${slot.fromTime || '08:00'}:00`),
        to_time: new Date(`1970-01-01T${slot.toTime || '18:00'}:00`),
        ...update,
      },
    });
  }
  await logModulePage(PAGE, 'Update', 'Successful', '', memberId, audit);
  return { success: true, message: 'Activity times updated...', ...(await loadElearnSetup(memberId, {}, { ...audit, skipLog: true })) };
}
