import { prisma } from '../../../config/prisma.js';
import { auditFields, logAdminSetup } from './setupAudit.js';

const PAGE = 'otp_account_reset.php';
const RESET_PASSWORD = 'RsETzLMn';

export async function loadOtpAccountReset(memberId, _fields = {}, _query = {}, audit = {}) {
  const rows = await prisma.web_account_setup.findMany({
    where: { del: 1, member_id: { not: 'igrapix' } },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      member_id: true,
      member_name: true,
      reset_password: true,
    },
  });

  if (!audit.skipLog) {
    await logAdminSetup(PAGE, 'View', 'Successful', 'form', memberId, audit);
  }

  return {
    accounts: rows.map((row) => ({
      id: row.id,
      memberId: row.member_id,
      memberName: row.member_name,
      pendingReset: Boolean(row.reset_password),
    })),
  };
}

export async function saveOtpAccountReset(fields, memberId, audit = {}) {
  const ids = Array.isArray(fields.a_auth)
    ? fields.a_auth.map(Number).filter(Boolean)
    : fields.a_auth
      ? [Number(fields.a_auth)].filter(Boolean)
      : [];

  if (ids.length === 0) {
    return { success: false, message: 'Select at least one account.' };
  }

  const { update } = auditFields(memberId, audit);

  try {
    await prisma.web_account_setup.updateMany({
      where: { id: { in: ids }, del: 1 },
      data: { reset_password: RESET_PASSWORD, ...update },
    });

    await logAdminSetup(PAGE, 'Update', 'Successful', `${ids.length} accounts`, memberId, audit);
    const reload = await loadOtpAccountReset(memberId, {}, {}, { ...audit, skipLog: true });
    return { success: true, message: 'Passwords are reset...', ...reload };
  } catch {
    await logAdminSetup(PAGE, 'Add', 'Unsuccessful', '', memberId, audit);
    return { success: false, message: 'Please try again...' };
  }
}
