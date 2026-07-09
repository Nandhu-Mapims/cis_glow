import { prisma } from '../../../config/prisma.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logFeeSetup } from './setupAudit.js';

const PAGE = 'fee_type_config.php';

function mapRow(row) {
  return {
    id: row.id,
    feeOrder: row.fee_order,
    feeId: row.fee_id,
    feeType: row.fee_type,
  };
}

async function fetchRows() {
  const rows = await prisma.fee_type_master.findMany({
    where: { del: 1 },
    orderBy: { fee_order: 'asc' },
  });
  return rows.map(mapRow);
}

export async function loadFeeTypeSetup(memberId, _fields, audit = {}) {
  const rows = await fetchRows();
  await logFeeSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return { rows };
}

export async function saveFeeTypeSetup(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      await prisma.fee_type_master.update({
        where: { id },
        data: { del: 0, ...update },
      });
      await logFeeSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return { success: true, message: 'Your details are deleted...', rows: await fetchRows() };
    } catch {
      await logFeeSetup(PAGE, 'Delete', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const { create, update } = auditFields(memberId, audit);

  await prisma.fee_type_master.updateMany({
    where: { del: 1 },
    data: { del: 0, ...update },
  });

  for (const row of rows) {
    const feeId = String(row.feeId || '').trim();
    const feeType = String(row.feeType || '').trim();
    const feeOrder = Number(row.feeOrder) || 0;

    if (!row.id) {
      if (!feeId) continue;
      await prisma.fee_type_master.create({
        data: {
          fee_id: feeId,
          fee_type: feeType,
          fee_order: feeOrder,
          ...create,
        },
      });
    } else {
      await prisma.fee_type_master.update({
        where: { id: Number(row.id) },
        data: {
          del: 1,
          fee_id: feeId,
          fee_type: feeType,
          fee_order: feeOrder,
          ...update,
        },
      });
    }
  }

  await logFeeSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return { success: true, message: 'Your details are Updated...', rows: await fetchRows() };
}
