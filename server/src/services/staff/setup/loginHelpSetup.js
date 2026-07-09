import { prisma } from '../../../config/prisma.js';
import { auditFields, logStaffModule } from '../staffModuleAudit.js';

const PAGE = 'staff_help.php';

export async function loadLoginHelpSetup(memberId, _fields = {}, audit = {}) {
  const row = await prisma.pages_tb.findFirst({ where: { id: 1 } });
  await logStaffModule(PAGE, 'View', 'Successful', '', memberId, audit);
  return { content: row?.page_content || '' };
}

export async function saveLoginHelpSetup(payload, memberId, audit = {}) {
  const content = String(payload.content || '');
  const { update } = auditFields(memberId, audit);
  await prisma.pages_tb.update({
    where: { id: 1 },
    data: { page_content: content, ...update },
  });
  await logStaffModule(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadLoginHelpSetup(memberId, {}, { ...audit, skipLog: true })),
  };
}
