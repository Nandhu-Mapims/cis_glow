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
    // Do not hydrate full Prisma model: legacy rows may contain zero dates ('0000-00-00 00:00:00') in updated_dt
    const editRows = await prisma.$queryRawUnsafe(`
      SELECT id, template_id, sms_template, sample_message
      FROM sms_template_tb
      WHERE id = ${editId} AND del = 1
      LIMIT 1
    `);
    const row = editRows[0];
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
  const { update } = auditFields(memberId, audit);

  if (payload.action === 'delete' || payload.delete === 'Confirm') {
    const id = Number(payload.confirm || payload.id);
    if (!id) return { success: false, message: 'Select a template to delete.' };
    await prisma.$executeRawUnsafe(`
      UPDATE sms_template_tb SET
        del = 0,
        updated_dt = NOW(),
        updated_ip = '${escapeSql(update.updated_ip)}',
        updated_by = '${escapeSql(String(update.updated_by))}'
      WHERE id = ${id} AND del = 1
    `);
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

  await prisma.$executeRawUnsafe(`
    UPDATE sms_template_tb SET
      template_id = '${escapeSql(templateId)}',
      sms_template = '${escapeSql(content)}',
      sample_message = '${escapeSql(sample)}',
      updated_dt = NOW(),
      updated_ip = '${escapeSql(update.updated_ip)}',
      updated_by = '${escapeSql(String(update.updated_by))}'
    WHERE id = ${id} AND del = 1
  `);

  await logModulePage(PAGE, 'Update', 'Successful', String(id), memberId, audit);
  return {
    success: true,
    message: 'Template updated...',
    ...(await loadSmsTemplateEdit(memberId, { search: payload.search, page: payload.page }, { ...audit, skipLog: true })),
  };
}
