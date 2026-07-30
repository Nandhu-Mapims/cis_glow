import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';

const PAGE = 'group_edit.php';

export async function loadSmsGroupEdit(memberId, fields = {}, audit = {}) {
  const search = String(fields.search || '').trim();
  const page = Math.max(1, Number(fields.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const whereParts = ['del = 1'];
  if (search) {
    const q = escapeSql(search);
    whereParts.push(`(group_title LIKE '%${q}%' OR group_mobile LIKE '%${q}%')`);
  }

  const whereSql = whereParts.join(' AND ');
  const countRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS cnt FROM sms_group_tb WHERE ${whereSql}`,
  );
  const total = Number(countRows[0]?.cnt || 0);

  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, group_title, group_mobile
    FROM sms_group_tb
    WHERE ${whereSql}
    ORDER BY id DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  let editing = null;
  const editId = Number(fields.editId || fields.edit_row_id || 0);
  if (editId > 0) {
    // Do not hydrate the full Prisma model here: some legacy rows have a
    // `0000-00-00` updated_dt, which Prisma correctly rejects as an invalid
    // JavaScript Date. The edit view only needs these three safe columns.
    const editRows = await prisma.$queryRawUnsafe(`
      SELECT id, group_title, group_mobile
      FROM sms_group_tb
      WHERE id = ${editId} AND del = 1
      LIMIT 1
    `);
    const row = editRows[0];
    if (row) {
      editing = {
        id: row.id,
        groupTitle: row.group_title,
        groupMobile: row.group_mobile,
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
    groups: rows.map((row) => ({
      id: row.id,
      groupTitle: row.group_title,
      groupMobile: row.group_mobile,
    })),
    editing,
  };
}

export async function saveSmsGroupEdit(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);

  if (payload.action === 'delete' || payload.delete === 'Confirm') {
    const id = Number(payload.confirm || payload.id);
    if (!id) return { success: false, message: 'Select a group to delete.' };
    await prisma.$executeRawUnsafe(`
      UPDATE sms_group_tb SET
        del = 0,
        updated_dt = NOW(),
        updated_ip = '${escapeSql(update.updated_ip)}',
        updated_by = '${escapeSql(String(update.updated_by))}'
      WHERE id = ${id} AND del = 1
    `);
    await logModulePage(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
    return {
      success: true,
      message: 'Group deleted...',
      ...(await loadSmsGroupEdit(memberId, { search: payload.search, page: payload.page }, { ...audit, skipLog: true })),
    };
  }

  const id = Number(payload.edit_row_id || payload.id);
  const groupTitle = String(payload.group_title || payload.groupTitle || '').trim();
  const groupMobile = String(payload.group_mobile || payload.groupMobile || '').trim();
  if (!id || !groupTitle || !groupMobile) {
    return { success: false, message: 'Title and mobile numbers are required.' };
  }

  await prisma.$executeRawUnsafe(`
    UPDATE sms_group_tb SET
      group_title = '${escapeSql(groupTitle)}',
      group_mobile = '${escapeSql(groupMobile)}',
      updated_dt = NOW(),
      updated_ip = '${escapeSql(update.updated_ip)}',
      updated_by = '${escapeSql(String(update.updated_by))}'
    WHERE id = ${id} AND del = 1
  `);

  await logModulePage(PAGE, 'Update', 'Successful', String(id), memberId, audit);
  return {
    success: true,
    message: 'Group updated...',
    ...(await loadSmsGroupEdit(memberId, { search: payload.search, page: payload.page }, { ...audit, skipLog: true })),
  };
}
