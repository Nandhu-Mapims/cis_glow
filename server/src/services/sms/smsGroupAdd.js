import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';

const PAGE = 'group_add.php';

export async function loadSmsGroupAdd(memberId, _fields = {}, audit = {}) {
  await logModulePage(PAGE, 'View', 'Successful', '', memberId, audit);
  return { form: { groupTitle: '', groupMobile: '' } };
}

export async function saveSmsGroupAdd(payload, memberId, audit = {}) {
  const groupTitle = String(payload.group_title || payload.groupTitle || '').trim();
  const groupMobile = String(payload.group_mobile || payload.groupMobile || '').trim();
  if (!groupTitle || !groupMobile) {
    return { success: false, message: 'Title and mobile numbers are required.' };
  }

  const { create } = auditFields(memberId, audit);
  await prisma.sms_group_tb.create({
    data: {
      group_title: groupTitle,
      group_mobile: groupMobile,
      ...create,
    },
  });

  await logModulePage(PAGE, 'Add', 'Successful', groupTitle, memberId, audit);
  return {
    success: true,
    message: 'Group added...',
    ...(await loadSmsGroupAdd(memberId, {}, { ...audit, skipLog: true })),
  };
}
