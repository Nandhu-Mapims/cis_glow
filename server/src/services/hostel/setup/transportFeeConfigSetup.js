import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { loadTransportRouteByStop, loadTransportStops } from '../transportShared.js';
import { auditFields, logHostelSetup } from '../setupAudit.js';

const PAGE = 'transport_fee_config.php';
const PAGE_SIZE = 60;

export async function loadTransportFeeConfigSetup(memberId, fields = {}, audit = {}) {
  const page = Math.max(1, Number(fields.page) || 1);
  const [stops, routeByStop] = await Promise.all([
    loadTransportStops(),
    loadTransportRouteByStop(),
  ]);

  const stopMap = Object.fromEntries(stops.map((s) => [String(s.id), s.name]));
  const usedStopIds = [...new Set(
    Object.keys(routeByStop).filter((id) => stopMap[id]),
  )].sort((a, b) => Number(a) - Number(b));

  const total = usedStopIds.length;
  const offset = (page - 1) * PAGE_SIZE;
  const pageStopIds = usedStopIds.slice(offset, offset + PAGE_SIZE);

  const feeRows = pageStopIds.length ? await prisma.$queryRawUnsafe(`
    SELECT id, stop_id, route, fee_amount
    FROM transport_fee_tb
    WHERE del = 1 AND stop_id IN (${pageStopIds.map((id) => `'${escapeSql(id)}'`).join(',')})
  `) : [];

  const feeByStop = Object.fromEntries(feeRows.map((row) => [String(row.stop_id), row]));

  const rows = pageStopIds.map((stopId) => {
    const fee = feeByStop[stopId];
    const route = fee?.route || routeByStop[stopId] || '';
    return {
      id: fee ? Number(fee.id) : null,
      stopId,
      stopName: stopMap[stopId] || '',
      route,
      amount: fee?.fee_amount || '',
    };
  });

  await logHostelSetup(PAGE, 'View', 'Successful', String(page), memberId, audit);
  return {
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows,
  };
}

export async function saveTransportFeeConfigSetup(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  for (const row of rows) {
    const stopId = escapeSql(String(row.stopId || ''));
    const route = escapeSql(String(row.route || ''));
    const amount = escapeSql(String(row.amount || ''));
    if (!stopId) continue;

    if (row.id) {
      await prisma.$executeRawUnsafe(`
        UPDATE transport_fee_tb SET
          stop_id = '${stopId}',
          route = '${route}',
          fee_amount = '${amount}',
          del = 1,
          updated_dt = NOW(),
          updated_ip = '${escapeSql(update.updated_ip)}',
          updated_by = '${escapeSql(memberId)}'
        WHERE id = ${Number(row.id)}
      `);
    } else if (amount) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO transport_fee_tb (
          stop_id, route, fee_amount,
          created_dt, created_ip, created_by,
          updated_dt, updated_ip, updated_by, del
        ) VALUES (
          '${stopId}', '${route}', '${amount}',
          NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
          NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1
        )
      `);
    }
  }

  await logHostelSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadTransportFeeConfigSetup(memberId, { page: payload.page }, { ...audit, skipLog: true })),
  };
}
