import { prisma } from '../../../config/prisma.js';
import { auditFields, logSettingsSetup } from '../setupAudit.js';

const PAGE = 'sms_cron_setup.php';
const SMS_CRON_WHERE = { del: 1, id: { not: 1 } };

export async function loadSmsCronSetup(memberId, fields = {}, audit = {}) {
  const cronRows = await prisma.basic_cron_tb.findMany({
    where: SMS_CRON_WHERE,
    orderBy: { id: 'asc' },
  });

  const cronRef = String(fields.cronRef ?? '').trim();
  const selectedCron = cronRef
    ? cronRows.find((r) => String(r.id) === cronRef) || null
    : null;

  let contacts = [];
  if (selectedCron) {
    contacts = await prisma.basic_cron_email.findMany({
      where: { del: 1, cron_id: selectedCron.id },
      orderBy: { id: 'asc' },
    });
  }

  await logSettingsSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    cronOptions: cronRows.map((row) => ({
      value: String(row.id),
      label: row.c_title,
    })),
    cronRef: selectedCron ? String(selectedCron.id) : '',
    cronTitle: selectedCron?.c_title || '',
    cronStatus: selectedCron?.c_status === 1,
    cronDay: selectedCron?.cron_day ?? '',
    contacts: contacts.map((row) => ({
      id: row.id,
      name: row.email_name,
      mobile: row.mobile_no,
    })),
  };
}

export async function saveSmsCronSetup(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    await prisma.basic_cron_email.updateMany({
      where: { id: Number(payload.id) },
      data: { del: 0, ...update },
    });
    await logSettingsSetup(PAGE, 'Delete', 'Successful', String(payload.id), memberId, audit);
    return {
      success: true,
      message: 'Your details are deleted...',
      ...(await loadSmsCronSetup(memberId, { cronRef: payload.cronRef }, { ...audit, skipLog: true })),
    };
  }

  const cronId = Number(payload.cronRef);
  if (!cronId) return { success: false, message: 'Please select a cron entry' };

  const smsCron = await prisma.basic_cron_tb.findFirst({
    where: { ...SMS_CRON_WHERE, id: cronId },
  });
  if (!smsCron) return { success: false, message: 'Invalid SMS cron entry' };

  await prisma.basic_cron_tb.update({
    where: { id: cronId },
    data: {
      c_title: String(payload.cronTitle || '').trim(),
      c_status: payload.cronStatus ? 1 : 0,
      cron_day: Number(payload.cronDay) || 0,
      ...update,
    },
  });

  await prisma.basic_cron_email.updateMany({
    where: { cron_id: cronId },
    data: { del: 0, ...update },
  });

  const rows = Array.isArray(payload.contacts) ? payload.contacts : [];
  for (const row of rows) {
    const name = String(row.name || '').trim();
    const mobile = String(row.mobile || '').trim();
    if (!name && !mobile) continue;
    if (!row.id) {
      await prisma.basic_cron_email.create({
        data: { cron_id: cronId, email_name: name, email_id: '', mobile_no: mobile, ...create },
      });
    } else {
      await prisma.basic_cron_email.update({
        where: { id: Number(row.id) },
        data: { email_name: name, mobile_no: mobile, del: 1, ...update },
      });
    }
  }

  await logSettingsSetup(PAGE, 'Update', 'Successful', String(payload.cronTitle || ''), memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadSmsCronSetup(memberId, { cronRef: String(cronId) }, { ...audit, skipLog: true })),
  };
}
