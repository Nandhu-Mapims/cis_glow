import { prisma } from '../../../config/prisma.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logFeeSetup } from './setupAudit.js';

const PAGE = 'fee_label_config.php';

function mapRow(row) {
  return {
    id: row.id,
    feeOrder: row.fee_order,
    feeName: row.fee_name,
    feeSname: row.fee_sname,
    isScholar: row.is_scholar === 1,
    isValid: row.is_valid === 1,
  };
}

async function fetchRows() {
  const rows = await prisma.fee_label_master.findMany({
    where: { del: 1 },
    orderBy: { fee_order: 'asc' },
  });
  return rows.map(mapRow);
}

export async function loadFeeLabelSetup(memberId, _fields, audit = {}) {
  const rows = await fetchRows();
  await logFeeSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return { rows };
}

export async function saveFeeLabelSetup(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      await prisma.fee_label_master.update({
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
  const { now, ip, memberId: user, create, update } = auditFields(memberId, audit);

  await prisma.fee_label_master.updateMany({
    where: { del: 1 },
    data: { del: 0, ...update },
  });

  for (const row of rows) {
    const feeName = String(row.feeName || '').trim();
    const feeSname = String(row.feeSname || '').trim();
    const feeOrder = Number(row.feeOrder) || 0;
    const isScholar = row.isScholar ? 1 : 0;
    const isValid = row.isValid ? 1 : 0;

    if (!row.id) {
      if (!feeName) continue;
      await prisma.fee_label_master.create({
        data: {
          fee_name: feeName,
          fee_sname: feeSname,
          fee_order: feeOrder,
          is_scholar: isScholar,
          is_valid: isValid,
          ...create,
        },
      });
    } else {
      await prisma.fee_label_master.update({
        where: { id: Number(row.id) },
        data: {
          del: 1,
          fee_name: feeName,
          fee_sname: feeSname,
          fee_order: feeOrder,
          is_scholar: isScholar,
          is_valid: isValid,
          ...update,
        },
      });
    }
  }

  await logFeeSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return { success: true, message: 'Your details are Updated...', rows: await fetchRows() };
}
