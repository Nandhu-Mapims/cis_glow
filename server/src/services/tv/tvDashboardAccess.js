import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { loadTvUserOptions } from './tvShared.js';

const PAGE = 'tv_dashboard_access.php';

export async function loadTvDashboardAccess(memberId, fields = {}, audit = {}) {
  const userId = fields.userId ? parseId(fields.userId) : null;
  const users = await loadTvUserOptions(memberId);

  let widgets = [];
  if (userId) {
    const assigned = await prisma.$queryRawUnsafe(`
      SELECT B.id AS row_id, A.id AS widget_id, A.widget_name AS name,
             B.widget_order AS widget_order, B.status
      FROM tv_setup_tb AS A
      INNER JOIN tv_access_tb AS B ON CAST(A.id AS CHAR) = B.widget_name
      WHERE A.del=1 AND B.del=1 AND B.user_id=${userId}
      ORDER BY B.widget_order ASC
    `);
    const assignedIds = new Set(assigned.map((r) => Number(r.widget_id)));
    const unassigned = await prisma.$queryRawUnsafe(`
      SELECT id AS widget_id, widget_name AS name
      FROM tv_setup_tb
      WHERE del=1 ${assignedIds.size ? `AND id NOT IN (${[...assignedIds].join(',')})` : ''}
      ORDER BY widget_name ASC
    `);
    widgets = [
      ...assigned.map((r) => ({
        rowId: Number(r.row_id),
        widgetId: Number(r.widget_id),
        name: r.name,
        order: r.widget_order == null ? '' : String(r.widget_order),
        enabled: Number(r.status) === 1,
      })),
      ...unassigned.map((r) => ({
        rowId: null,
        widgetId: Number(r.widget_id),
        name: r.name,
        order: '',
        enabled: false,
      })),
    ];
  }

  await logModulePage(PAGE, 'View', 'Successful', '', memberId, audit);
  return { users, userId, widgets };
}

export async function saveTvDashboardAccess(payload, memberId, audit = {}) {
  const userId = parseId(payload.userId);
  const rows = Array.isArray(payload.widgets) ? payload.widgets : [];
  const { create, update } = auditFields(memberId, audit);

  await prisma.$executeRawUnsafe(`
    UPDATE tv_access_tb SET del=0, updated_by='${escapeSql(memberId)}',
      updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
    WHERE user_id=${userId} AND del=1
  `);

  for (const row of rows) {
    if (!row.enabled) continue;
    const widgetId = String(row.widgetId);
    const order = Number(row.order) || 0;
    const status = row.enabled ? 1 : 0;

    if (row.rowId) {
      await prisma.$executeRawUnsafe(`
        UPDATE tv_access_tb SET
          user_id=${userId},
          widget_name='${escapeSql(widgetId)}',
          widget_order=${order},
          status=${status},
          del=1,
          updated_by='${escapeSql(memberId)}',
          updated_ip='${escapeSql(update.updated_ip)}',
          updated_dt=NOW()
        WHERE id=${Number(row.rowId)}
      `);
    } else {
      await prisma.tv_access_tb.create({
        data: {
          user_id: userId,
          widget_name: widgetId,
          widget_order: order,
          status,
          options: '',
          from_time: new Date('1970-01-01T08:00:00'),
          to_time: new Date('1970-01-01T18:00:00'),
          ...create,
        },
      });
    }
  }

  await logModulePage(PAGE, 'Update', 'Successful', String(userId), memberId, audit);
  return {
    success: true,
    message: 'Dashboard access updated.',
    ...(await loadTvDashboardAccess(memberId, { userId }, { ...audit, skipLog: true })),
  };
}
