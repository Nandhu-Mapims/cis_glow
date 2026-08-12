import { prisma } from '../../../config/prisma.js';
import { decrypt, encrypt } from '../../password.js';
import { isGlobalAccessType } from '../../../utils/accessType.js';
import { auditFields, logAdminSetup } from './setupAudit.js';

const PAGE = 'otp_account_reset.php';
const RESET_PASSWORD = 'cisdental@123';

export async function loadOtpAccountReset(memberId, _fields = {}, _query = {}, audit = {}) {
  const canSeePasswords = isGlobalAccessType(audit.accessType);

  const rows = await prisma.web_account_setup.findMany({
    where: { del: 1, member_id: { not: 'igrapix' } },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      member_id: true,
      member_name: true,
      reset_password: true,
      ...(canSeePasswords ? { password: true } : {}),
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
      ...(canSeePasswords ? { currentPassword: decrypt(row.password) } : {}),
    })),
    canSeePasswords,
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
      data: { password: encrypt(RESET_PASSWORD), reset_password: RESET_PASSWORD, ...update },
    });

    await logAdminSetup(PAGE, 'Update', 'Successful', `${ids.length} accounts`, memberId, audit);
    const reload = await loadOtpAccountReset(memberId, {}, {}, { ...audit, skipLog: true });
    return { success: true, message: 'Passwords are reset...', ...reload };
  } catch {
    await logAdminSetup(PAGE, 'Add', 'Unsuccessful', '', memberId, audit);
    return { success: false, message: 'Please try again...' };
  }
}
