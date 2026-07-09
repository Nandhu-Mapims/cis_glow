import { prisma } from '../../config/prisma.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';

const PAGE = 'sms_template.php';

export async function loadSmsTemplate(memberId, _fields = {}, audit = {}) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, template_id, sms_template, sample_message
    FROM sms_template_tb
    WHERE del = 1
    ORDER BY id DESC
  `);
  await logModulePage(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    templates: rows.map((row) => ({
      id: row.id,
      templateId: row.template_id,
      content: row.sms_template,
      sample: row.sample_message,
    })),
    form: { templateId: '', content: '', sample: '' },
  };
}

export async function saveSmsTemplate(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    await prisma.sms_template_tb.update({
      where: { id: Number(payload.id) },
      data: { del: 0, ...update },
    });
    await logModulePage(PAGE, 'Delete', 'Successful', String(payload.id), memberId, audit);
    return {
      success: true,
      message: 'Template deleted...',
      ...(await loadSmsTemplate(memberId, {}, { ...audit, skipLog: true })),
    };
  }

  const templateId = String(payload.templateId || '').trim();
  const content = String(payload.content || '').trim();
  const sample = String(payload.sample || '').trim();
  if (!templateId || !content) {
    return { success: false, message: 'Template ID and content are required' };
  }

  if (payload.id) {
    await prisma.sms_template_tb.update({
      where: { id: Number(payload.id) },
      data: { template_id: templateId, sms_template: content, sample_message: sample, del: 1, ...update },
    });
  } else {
    await prisma.sms_template_tb.create({
      data: { template_id: templateId, sms_template: content, sample_message: sample, ...create },
    });
  }

  await logModulePage(PAGE, payload.id ? 'Update' : 'Add', 'Successful', templateId, memberId, audit);
  return {
    success: true,
    message: payload.id ? 'Template updated...' : 'Template added...',
    ...(await loadSmsTemplate(memberId, {}, { ...audit, skipLog: true })),
  };
}
