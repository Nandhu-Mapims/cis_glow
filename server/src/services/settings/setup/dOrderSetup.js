import { prisma } from '../../../config/prisma.js';
import { staffDesgOrderSelect } from '../../../utils/legacySelects.js';
import { auditFields, logSettingsSetup } from '../setupAudit.js';

const PAGE = 'staff_dept_order.php';

export async function loadDOrderSetup(memberId, _fields = {}, audit = {}) {
  const distinctNames = await prisma.staff_desg_master.findMany({
    where: { del: 1 },
    select: { name: true },
    distinct: ['name'],
    orderBy: { d_order: 'asc' },
  });

  const orderRows = await prisma.staff_desg_order.findMany({
    where: { del: 1 },
    select: staffDesgOrderSelect,
  });
  const orderByName = new Map(orderRows.map((r) => [r.name, r]));

  const rows = distinctNames.map((d) => {
    const existing = orderByName.get(d.name);
    return {
      id: existing?.id || null,
      name: d.name,
      order: existing?.d_order ?? 0,
    };
  }).sort((a, b) => a.order - b.order);

  await logSettingsSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return { rows: rows.length ? rows : [{ name: '', order: 1 }] };
}

export async function saveDOrderSetup(payload, memberId, audit = {}) {
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const { create, update } = auditFields(memberId, audit);

  await prisma.staff_desg_order.updateMany({
    where: { del: 1 },
    data: { del: 0, ...update },
  });

  for (const row of rows) {
    const name = String(row.name || '').trim();
    const order = Number(row.order) || 0;
    if (!name) continue;
    if (!row.id) {
      await prisma.staff_desg_order.create({
        data: { name, d_order: order, ...create },
      });
    } else {
      await prisma.staff_desg_order.update({
        where: { id: Number(row.id) },
        data: { name, d_order: order, del: 1, ...update },
      });
    }
  }

  await logSettingsSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadDOrderSetup(memberId, {}, { ...audit, skipLog: true })),
  };
}
