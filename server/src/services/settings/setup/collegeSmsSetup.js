import { prisma } from '../../../config/prisma.js';
import { auditFields, logSettingsSetup } from '../setupAudit.js';

const PAGE = 'sms_approval_setup.php';

const SMS_GROUPS = [
  { key: 'Staff', filter: (title) => title.startsWith('Staff') },
  { key: 'Student', filter: (title) => title.startsWith('Student') },
  { key: 'Hostel', filter: (title) => title.startsWith('Hostel') },
  { key: 'Others', filter: (title) => !title.startsWith('Staff') && !title.startsWith('Student') && !title.startsWith('Hostel') },
];

export async function loadCollegeSmsSetup(memberId, _fields = {}, audit = {}) {
  const rows = await prisma.sms_config_tb.findMany({
    where: { del: 1 },
    orderBy: { id: 'asc' },
  });

  const groups = SMS_GROUPS.map((group) => ({
    label: group.key,
    items: rows
      .filter((row) => group.filter(row.c_title))
      .map((row) => ({
        id: row.id,
        title: row.c_title,
        enabled: row.c_status === 1,
      })),
  })).filter((g) => g.items.length > 0);

  await logSettingsSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return { groups };
}

export async function saveCollegeSmsSetup(payload, memberId, audit = {}) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const { update } = auditFields(memberId, audit);

  for (const item of items) {
    if (!item.id) continue;
    await prisma.sms_config_tb.update({
      where: { id: Number(item.id) },
      data: { c_status: item.enabled ? 1 : 0, ...update },
    });
  }

  await logSettingsSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadCollegeSmsSetup(memberId, {}, { ...audit, skipLog: true })),
  };
}
