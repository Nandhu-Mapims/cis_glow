import { prisma } from '../../../config/prisma.js';
import { auditFields, logSettingsSetup } from '../setupAudit.js';

const PAGE = 'approval_setup.php';

export async function loadApprovalSetup(memberId, _fields = {}, audit = {}) {
  const rows = await prisma.approval_tb.findMany({
    where: { del: 1 },
    orderBy: { id: 'asc' },
  });

  await logSettingsSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    items: rows.map((row) => ({
      id: row.id,
      pageType: row.page_type,
      enabled: row.approval_enable === 1,
    })),
  };
}

export async function saveApprovalSetup(payload, memberId, audit = {}) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const { update } = auditFields(memberId, audit);

  for (const item of items) {
    if (!item.id) continue;
    await prisma.approval_tb.update({
      where: { id: Number(item.id) },
      data: {
        approval_enable: item.enabled ? 1 : 0,
        ...update,
      },
    });
  }

  await logSettingsSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadApprovalSetup(memberId, {}, { ...audit, skipLog: true })),
  };
}
