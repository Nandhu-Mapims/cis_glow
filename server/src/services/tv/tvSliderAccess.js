import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { loadTvUserOptions, widgetOptionsList } from './tvShared.js';

const PAGE = 'tv_slider_access.php';

function mapRow(row) {
  return {
    rowId: row.id,
    widgetKey: row.widget_name || '',
    order: row.widget_order ?? 0,
    fromTime: row.from_time ? String(row.from_time).slice(0, 5) : '00:00',
    toTime: row.to_time ? String(row.to_time).slice(0, 5) : '23:59',
    active: Number(row.status) === 1,
  };
}

export async function loadTvSliderAccess(memberId, fields = {}, audit = {}) {
  const userId = fields.userId ? parseId(fields.userId) : null;
  const users = await loadTvUserOptions(memberId);
  let rows = [];

  if (userId) {
    const existing = await prisma.$queryRawUnsafe(`
      SELECT id, widget_name, widget_order, from_time, to_time, status
      FROM tv_access_tb
      WHERE del!=0 AND user_id=${userId}
      ORDER BY widget_order ASC
    `);
    rows = existing.length
      ? existing.map(mapRow)
      : [{ rowId: null, widgetKey: '', order: 1, fromTime: '00:00', toTime: '23:59', active: true }];
  }

  await logModulePage(PAGE, 'View', 'Successful', '', memberId, audit);
  return { users, userId, rows, widgetOptions: widgetOptionsList() };
}

export async function saveTvSliderAccess(payload, memberId, audit = {}) {
  const userId = parseId(payload.userId);
  const { create, update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    const rowId = parseId(payload.rowId);
    await prisma.tv_access_tb.update({
      where: { id: rowId },
      data: { del: 0, ...update },
    });
    await logModulePage(PAGE, 'Delete', 'Successful', String(rowId), memberId, audit);
    return {
      success: true,
      message: 'Row deleted.',
      ...(await loadTvSliderAccess(memberId, { userId }, { ...audit, skipLog: true })),
    };
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  for (const row of rows) {
    const widgetKey = String(row.widgetKey || '').trim();
    if (!widgetKey) continue;
    const fromTime = row.fromTime || '00:00';
    const toTime = row.toTime || '23:59';
    const data = {
      user_id: userId,
      widget_name: widgetKey,
      widget_order: Number(row.order) || 0,
      from_time: new Date(`1970-01-01T${fromTime}:00`),
      to_time: new Date(`1970-01-01T${toTime}:00`),
      status: row.active === false ? 0 : 1,
      options: '',
    };

    if (row.rowId) {
      await prisma.tv_access_tb.update({
        where: { id: Number(row.rowId) },
        data: { ...data, del: 1, ...update },
      });
    } else {
      await prisma.tv_access_tb.create({ data: { ...data, ...create } });
    }
  }

  await logModulePage(PAGE, 'Update', 'Successful', String(userId), memberId, audit);
  return {
    success: true,
    message: 'Individual access updated.',
    ...(await loadTvSliderAccess(memberId, { userId }, { ...audit, skipLog: true })),
  };
}
