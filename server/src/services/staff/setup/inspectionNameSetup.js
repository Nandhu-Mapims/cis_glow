import { prisma } from '../../../config/prisma.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logStaffModule } from '../staffModuleAudit.js';

const PAGE = 'inspection_name.php';

export async function loadInspectionNameSetup(memberId, _fields = {}, audit = {}) {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT id, inspection_for, inspection_order FROM inspection_name WHERE del = 1 ORDER BY inspection_order ASC',
  );
  await logStaffModule(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    rows: rows.length
      ? rows.map((r) => ({ id: r.id, name: r.inspection_for, order: r.inspection_order }))
      : [{ name: '', order: 1 }],
  };
}

export async function saveInspectionNameSetup(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    await prisma.inspection_name.update({ where: { id }, data: { del: 0, ...update } });
    await logStaffModule(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
    return {
      success: true,
      message: 'Your details are deleted...',
      ...(await loadInspectionNameSetup(memberId, {}, { ...audit, skipLog: true })),
    };
  }

  await prisma.inspection_name.updateMany({ where: { del: 1 }, data: { del: 0, ...update } });
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  for (const row of rows) {
    const name = String(row.name || '').trim();
    const order = Number(row.order) || 0;
    if (!row.id && name) {
      await prisma.inspection_name.create({
        data: { inspection_for: name, inspection_order: order, ...create },
      });
    } else if (row.id) {
      await prisma.inspection_name.update({
        where: { id: Number(row.id) },
        data: { inspection_for: name, inspection_order: order, del: 1, ...update },
      });
    }
  }

  await logStaffModule(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadInspectionNameSetup(memberId, {}, { ...audit, skipLog: true })),
  };
}
