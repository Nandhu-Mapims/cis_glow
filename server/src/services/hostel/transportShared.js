import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';

export async function loadTransportStops() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, stopping_name, stopping_km, stopping_order
    FROM transport_stopping_tb
    WHERE del = 1
    ORDER BY stopping_order ASC, stopping_name ASC
  `);
  return rows.map((row) => ({
    id: Number(row.id),
    name: row.stopping_name || '',
    km: row.stopping_km ?? '',
    order: row.stopping_order ?? '',
  }));
}

export async function loadTransportRouteByStop() {
  const transports = await prisma.$queryRawUnsafe(`
    SELECT transport_route, stoping_details
    FROM transport_tb WHERE del = 1
  `);
  const map = {};
  for (const row of transports) {
    const route = row.transport_route || '';
    const stops = String(row.stoping_details || '').split(',').map((s) => s.trim()).filter(Boolean);
    for (const stopId of stops) {
      map[stopId] = route;
    }
  }
  return map;
}

export function transportImageUrl(filename) {
  if (!filename) return '';
  return `/legacy/files/transport/${encodeURIComponent(String(filename).replace(/ /g, '%20'))}`;
}
