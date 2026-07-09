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
    const row = await prisma.sms_group_tb.findFirst({ where: { id: editId, del: 1 } });
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
    await prisma.sms_group_tb.update({
      where: { id },
      data: { del: 0, ...update },
    });
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

  await prisma.sms_group_tb.update({
    where: { id },
    data: {
      group_title: groupTitle,
      group_mobile: groupMobile,
      ...update,
    },
  });

  await logModulePage(PAGE, 'Update', 'Successful', String(id), memberId, audit);
  return {
    success: true,
    message: 'Group updated...',
    ...(await loadSmsGroupEdit(memberId, { search: payload.search, page: payload.page }, { ...audit, skipLog: true })),
  };
}
