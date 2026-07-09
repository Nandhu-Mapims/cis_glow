import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logHostelSetup } from '../setupAudit.js';

const PAGE = 'transport_stopping_setup.php';

function emptyRow(order = 1) {
  return { order, name: '', km: '' };
}

function mapRow(row) {
  return {
    id: Number(row.id),
    order: row.stopping_order ?? '',
    name: row.stopping_name || '',
    km: row.stopping_km ?? '',
  };
}

export async function loadTransportStoppingSetup(memberId, _fields = {}, audit = {}) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, stopping_name, stopping_km, stopping_order
    FROM transport_stopping_tb WHERE del = 1 ORDER BY stopping_order ASC, id ASC
  `);
  await logHostelSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    rows: rows.length ? rows.map(mapRow) : [emptyRow(1)],
  };
}

export async function saveTransportStoppingSetup(payload, memberId, audit = {}) {
  const { ip } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE transport_stopping_tb SET del = 0,
          updated_dt = NOW(), updated_ip = '${escapeSql(ip)}',
          updated_by = '${escapeSql(memberId)}'
        WHERE id = ${id}
      `);
      await logHostelSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return {
        success: true,
        message: 'Your details are deleted...',
        ...(await loadTransportStoppingSetup(memberId, {}, { ...audit, skipLog: true })),
      };
    } catch {
      await logHostelSetup(PAGE, 'Delete', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  for (const row of rows) {
    const name = String(row.name || '').trim();
    if (!name) continue;
    const km = Number(row.km) || 0;
    const order = Number(row.order) || 0;
    const id = row.id ? parseId(row.id) : null;

    if (!id) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO transport_stopping_tb (
          stopping_name, stopping_km, stopping_order,
          stopping_mroute, stopping_route,
          created_dt, created_ip, created_by,
          updated_dt, updated_ip, updated_by, del
        ) VALUES (
          '${escapeSql(name)}', ${km}, ${order}, '', '',
          NOW(), '${escapeSql(ip)}', '${escapeSql(memberId)}',
          NOW(), '${escapeSql(ip)}', '${escapeSql(memberId)}', 1
        )
      `);
    } else {
      await prisma.$executeRawUnsafe(`
        UPDATE transport_stopping_tb SET
          stopping_name = '${escapeSql(name)}',
          stopping_km = ${km},
          stopping_order = ${order},
          updated_dt = NOW(),
          updated_ip = '${escapeSql(ip)}',
          updated_by = '${escapeSql(memberId)}'
        WHERE id = ${id}
      `);
    }
  }

  await logHostelSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadTransportStoppingSetup(memberId, {}, { ...audit, skipLog: true })),
  };
}
