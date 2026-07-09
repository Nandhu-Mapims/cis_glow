import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';

const PAGE = 'sms_template_edit.php';

export async function loadSmsTemplateEdit(memberId, fields = {}, audit = {}) {
  const search = String(fields.search || '').trim();
  const page = Math.max(1, Number(fields.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const whereParts = ['del = 1'];
  if (search) {
    const q = escapeSql(search);
    whereParts.push(`(sample_message LIKE '%${q}%' OR sms_template LIKE '%${q}%' OR template_id LIKE '%${q}%')`);
  }

  const whereSql = whereParts.join(' AND ');
  const countRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS cnt FROM sms_template_tb WHERE ${whereSql}`,
  );
  const total = Number(countRows[0]?.cnt || 0);

  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, template_id, sms_template, sample_message
    FROM sms_template_tb
    WHERE ${whereSql}
    ORDER BY created_dt DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  let editing = null;
  const editId = Number(fields.editId || fields.edit_row_id || 0);
  if (editId > 0) {
    const row = await prisma.sms_template_tb.findFirst({ where: { id: editId, del: 1 } });
    if (row) {
      editing = {
        id: row.id,
        templateId: row.template_id,
        content: row.sms_template,
        sample: row.sample_message,
      };
    }
  }

  if (!audit.skipLog) {
    await logModulePage(PAGE, 'View', 'Successful', search || 'list', memberId, audit);
  }

  return {
    search,
    page,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    templates: rows.map((row) => ({
      id: row.id,
      templateId: row.template_id,
      content: row.sms_template,
      sample: row.sample_message,
    })),
    editing,
  };
}

export async function saveSmsTemplateEdit(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);

  if (payload.action === 'delete' || payload.delete === 'Confirm') {
    const id = Number(payload.confirm || payload.id);
    if (!id) return { success: false, message: 'Select a template to delete.' };
    await prisma.sms_template_tb.update({
      where: { id },
      data: { del: 0, ...update },
    });
    await logModulePage(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
    return {
      success: true,
      message: 'Template deleted...',
      ...(await loadSmsTemplateEdit(memberId, { search: payload.search, page: payload.page }, { ...audit, skipLog: true })),
    };
  }

  const id = Number(payload.edit_row_id || payload.id);
  const templateId = String(payload.template_id || payload.templateId || '').trim();
  const content = String(payload.template_content || payload.content || '').trim();
  const sample = String(payload.template_sample || payload.sample || '').trim();

  if (!id || !templateId || !content) {
    return { success: false, message: 'Template ID and content are required.' };
  }

  await prisma.sms_template_tb.update({
    where: { id },
    data: {
      template_id: templateId,
      sms_template: content,
      sample_message: sample,
      ...update,
    },
  });

  await logModulePage(PAGE, 'Update', 'Successful', String(id), memberId, audit);
  return {
    success: true,
    message: 'Template updated...',
    ...(await loadSmsTemplateEdit(memberId, { search: payload.search, page: payload.page }, { ...audit, skipLog: true })),
  };
}
