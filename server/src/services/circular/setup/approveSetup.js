import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId, parseOptionalId } from '../../../utils/sqlSafe.js';
import { fetchCircularPending } from '../circularShared.js';
import { auditFields, logCircularSetup } from '../setupAudit.js';

const PAGE = 'circular_approve.php';

export async function loadCircularApproveSetup(memberId, fields = {}, audit = {}) {
  const rows = await fetchCircularPending(100);
  await logCircularSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    rows: rows.map((r) => ({
      id: r.id,
      title: r.title,
      subTitle: r.subTitle,
      fromDate: r.date,
      audienceFor: r.audienceFor,
      signatures: r.signatures,
    })),
    selectedId: parseOptionalId(fields.id),
  };
}

export async function saveCircularApproveSetup(payload, memberId, audit = {}) {
  const id = parseId(payload.id);
  const action = String(payload.action || 'approve');
  if (!id) return { success: false, message: 'Circular is required' };

  const { update } = auditFields(memberId, audit);
  const status = action === 'reject' ? 2 : 1;
  await prisma.$executeRawUnsafe(`
    UPDATE circular_tb SET
      c_status = ${status},
      c_approved = '${escapeSql(memberId)}',
      updated_dt = NOW(),
      updated_by = '${escapeSql(update.updated_by)}',
      updated_ip = '${escapeSql(update.updated_ip)}'
    WHERE id = ${id}
  `);

  await logCircularSetup(PAGE, 'Update', 'Successful', String(id), memberId, audit);
  return {
    success: true,
    message: action === 'reject' ? 'Circular rejected.' : 'Circular approved.',
    ...(await loadCircularApproveSetup(memberId, {}, { ...audit, skipLog: true })),
  };
}
