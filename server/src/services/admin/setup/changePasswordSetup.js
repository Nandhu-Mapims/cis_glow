import { prisma } from '../../../config/prisma.js';
import { encrypt, decrypt } from '../../password.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logAdminSetup } from './setupAudit.js';

const PAGE = 'change_password.php';

const accountSelect = {
  id: true,
  member_id: true,
  member_name: true,
  address_mobile: true,
  address_email: true,
  password: true,
};

async function duplicateContactCheck({ memberId, email, mobile }) {
  const clauses = [];
  if (email) clauses.push(`address_email='${escapeSql(email)}'`);
  if (mobile) clauses.push(`address_mobile='${escapeSql(mobile)}'`);
  if (!clauses.length) return false;
  const sql = `SELECT id FROM web_account_setup WHERE del=1 AND member_id!='${escapeSql(memberId)}' AND (${clauses.join(' OR ')}) LIMIT 1`;
  const rows = await prisma.$queryRawUnsafe(sql);
  return rows.length > 0;
}

function mapUser(row) {
  let currentPassword = '';
  try {
    currentPassword = decrypt(row.password || '').trim();
  } catch {
    currentPassword = '';
  }
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: row.member_name,
    addressMobile: row.address_mobile || '',
    addressEmail: row.address_email || '',
    currentPassword,
  };
}

export async function loadChangePasswordSetup(memberId, _fields = {}, _query = {}, audit = {}) {
  const row = await prisma.web_account_setup.findFirst({
    where: { del: 1, member_id: memberId },
    select: accountSelect,
  });
  if (!row) {
    return { error: 'Account not found' };
  }
  await logAdminSetup(PAGE, 'View', 'Successful', memberId, memberId, audit);
  return { user: mapUser(row) };
}

export async function saveChangePasswordSetup(fields, memberId, _files = [], audit = {}) {
  const row = await prisma.web_account_setup.findFirst({
    where: { del: 1, member_id: memberId },
    select: accountSelect,
  });
  if (!row) {
    return { success: false, message: 'Account not found' };
  }

  if (fields.action === 'password' || fields.Submit3 === 'Save') {
    const password = String(fields.password || '').trim();
    const confirmPassword = String(fields.confirm_password || '').trim();
    if (password !== confirmPassword) {
      await logAdminSetup(PAGE, 'Update', 'Unsuccessful', memberId, memberId, audit);
      return { success: false, message: 'Password not match...' };
    }
    const { update } = auditFields(memberId, audit);
    try {
      await prisma.web_account_setup.update({
        where: { id: row.id },
        data: { password: encrypt(password), ...update },
      });
      await logAdminSetup(PAGE, 'Update', 'Successful', memberId, memberId, audit);
      return {
        success: true,
        message: 'Your details are updated...',
        ...(await loadChangePasswordSetup(memberId, {}, {}, { ...audit, skipLog: true })),
      };
    } catch {
      await logAdminSetup(PAGE, 'Update', 'Unsuccessful', memberId, memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  if (fields.action === 'profile' || fields.Submit0 === 'Save') {
    const memberName = String(fields.member_name || fields.memberName || '').trim();
    const addressMobile = String(fields.address_mobile || fields.addressMobile || '').trim();
    const addressEmail = String(fields.address_email || fields.addressEmail || '').trim();

    if (await duplicateContactCheck({ memberId, email: addressEmail, mobile: addressMobile })) {
      await logAdminSetup(PAGE, 'Update', 'Unsuccessful', memberId, memberId, audit);
      return { success: false, message: 'Email ID already exists...' };
    }

    const { update } = auditFields(memberId, audit);
    try {
      await prisma.web_account_setup.update({
        where: { id: row.id },
        data: {
          member_name: memberName,
          address_mobile: addressMobile,
          address_email: addressEmail,
          ...update,
        },
      });
      await logAdminSetup(PAGE, 'Update', 'Successful', memberId, memberId, audit);
      return {
        success: true,
        message: 'Your details are updated...',
        ...(await loadChangePasswordSetup(memberId, {}, {}, { ...audit, skipLog: true })),
      };
    } catch {
      await logAdminSetup(PAGE, 'Update', 'Unsuccessful', memberId, memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  return { success: false, message: 'Unknown save action' };
}
