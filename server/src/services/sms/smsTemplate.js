import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
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
    const id = Number(payload.id);
    if (!id) return { success: false, message: 'Select a template to delete.' };
    await prisma.$executeRawUnsafe(`
      UPDATE sms_template_tb SET
        del = 0,
        updated_dt = NOW(),
        updated_ip = '${escapeSql(update.updated_ip)}',
        updated_by = '${escapeSql(String(update.updated_by))}'
      WHERE id = ${id}
    `);
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
    const id = Number(payload.id);
    await prisma.$executeRawUnsafe(`
      UPDATE sms_template_tb SET
        template_id = '${escapeSql(templateId)}',
        sms_template = '${escapeSql(content)}',
        sample_message = '${escapeSql(sample)}',
        del = 1,
        updated_dt = NOW(),
        updated_ip = '${escapeSql(update.updated_ip)}',
        updated_by = '${escapeSql(String(update.updated_by))}'
      WHERE id = ${id}
    `);
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
