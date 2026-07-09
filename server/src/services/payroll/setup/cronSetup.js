import { prisma } from '../../../config/prisma.js';
import { auditFields, logPayrollSetup } from './setupAudit.js';

const PAGE = 'payroll_cron_setup.php';
const PAYROLL_CRON_WHERE = { del: 1, id: 1 };

export async function loadCronSetup(fields = {}, memberId, audit = {}) {
  const cronRows = await prisma.basic_cron_tb.findMany({
    where: PAYROLL_CRON_WHERE,
    orderBy: { id: 'asc' },
  });

  const deptRef = String(fields.dept_name_ref ?? fields.dept_name ?? '').trim();
  const selectedCron = deptRef
    ? cronRows.find((r) => String(r.id) === deptRef) || null
    : null;

  let emails = [];
  if (selectedCron) {
    emails = await prisma.basic_cron_email.findMany({
      where: { del: 1, cron_id: selectedCron.id },
      orderBy: { id: 'asc' },
    });
  }

  await logPayrollSetup(PAGE, 'View', 'Successful', '', memberId, audit);

  return {
    cronOptions: cronRows.map((row) => ({
      value: String(row.id),
      label: row.c_title,
      status: row.c_status,
      cronDay: row.cron_day,
    })),
    selectedCronId: selectedCron ? String(selectedCron.id) : '',
    selected: selectedCron
      ? {
        title: selectedCron.c_title,
        status: selectedCron.c_status,
        cronDay: selectedCron.cron_day,
      }
      : null,
    emails: emails.map((row) => ({
      id: row.id,
      name: row.email_name,
      email: row.email_id,
    })),
  };
}

export async function saveCronSetup(fields, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);

  if (fields.delete === 'Confirm' && fields.confirm) {
    await prisma.basic_cron_email.updateMany({
      where: { id: Number(fields.confirm) },
      data: { del: 0, ...update },
    });
    await logPayrollSetup(PAGE, 'Delete', 'Successful', String(fields.confirm), memberId, audit);
    return {
      success: true,
      message: 'Your details are deleted...',
      ...(await loadCronSetup({}, memberId, { ...audit, skipLog: true })),
    };
  }

  if (fields.Submit !== 'Update') {
    return loadCronSetup(fields, memberId, audit);
  }

  const cronId = Number(fields.dept_name_ref);
  if (!cronId) return { success: false, message: 'Please select a cron entry' };

  const payrollCron = await prisma.basic_cron_tb.findFirst({
    where: { ...PAYROLL_CRON_WHERE, id: cronId },
  });
  if (!payrollCron) return { success: false, message: 'Invalid payroll cron entry' };

  await prisma.basic_cron_tb.update({
    where: { id: cronId },
    data: {
      c_title: String(fields.dept_name || '').trim(),
      c_status: Number(fields.c_status) || 0,
      cron_day: Number(fields.c_day) || 0,
      ...update,
    },
  });

  await prisma.basic_cron_email.updateMany({
    where: { cron_id: cronId },
    data: { del: 0, ...update },
  });

  const ids = Array.isArray(fields.id) ? fields.id : [];
  const names = Array.isArray(fields.desg_name) ? fields.desg_name : [];
  const emails = Array.isArray(fields.desg_email) ? fields.desg_email : [];
  const { create } = auditFields(memberId, audit);

  for (let i = 0; i < names.length; i++) {
    const name = String(names[i] || '').trim();
    const email = String(emails[i] || '').trim();
    if (!name && !email) continue;
    const rowId = ids[i];
    if (!rowId) {
      await prisma.basic_cron_email.create({
        data: {
          cron_id: cronId,
          email_name: name,
          email_id: email,
          ...create,
        },
      });
    } else {
      await prisma.basic_cron_email.update({
        where: { id: Number(rowId) },
        data: {
          email_name: name,
          email_id: email,
          del: 1,
          ...update,
        },
      });
    }
  }

  await logPayrollSetup(PAGE, 'Update', 'Successful', String(fields.dept_name || ''), memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadCronSetup({ dept_name_ref: String(cronId) }, memberId, { ...audit, skipLog: true })),
  };
}
