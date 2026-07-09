import { prisma } from '../../../config/prisma.js';
import { auditFields, logSettingsSetup } from '../setupAudit.js';

const PAGE = 'hospital_sms_approval.php';

export async function loadHospitalSmsSetup(memberId, _fields = {}, audit = {}) {
  const rows = await prisma.sms_config_hospital.findMany({
    where: { del: 1 },
    orderBy: { id: 'asc' },
  });

  await logSettingsSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.c_title,
      enabled: row.c_status === 1,
      mobile: row.c_mobile,
    })),
  };
}

export async function saveHospitalSmsSetup(payload, memberId, audit = {}) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const { update } = auditFields(memberId, audit);

  for (const item of items) {
    if (!item.id) continue;
    await prisma.sms_config_hospital.update({
      where: { id: Number(item.id) },
      data: {
        c_status: item.enabled ? 1 : 0,
        c_mobile: String(item.mobile || '').trim(),
        ...update,
      },
    });
  }

  await logSettingsSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadHospitalSmsSetup(memberId, {}, { ...audit, skipLog: true })),
  };
}
