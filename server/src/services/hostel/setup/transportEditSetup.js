import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId, parseOptionalId } from '../../../utils/sqlSafe.js';
import { saveLegacyBinaryFile } from '../../web/webUpload.js';
import { loadTransportStops, transportImageUrl } from '../transportShared.js';
import { auditFields, logHostelSetup } from '../setupAudit.js';

const PAGE = 'transport_edit.php';
const PAGE_SIZE = 20;

async function saveTransportPhoto(files) {
  const list = Array.isArray(files) ? files : [];
  const file = list.find((f) => f.field === 'photo' || f.field === 't_photo') || list[0];
  if (!file) return null;
  const uploaded = await saveLegacyBinaryFile({
    folder: 'transport',
    file,
    maxBytes: 2 * 1024 * 1024,
    allowedExt: new Set(['png', 'jpg', 'jpeg', 'gif']),
  });
  if (uploaded.error) return { error: uploaded.error };
  return uploaded.filename.replace(/ /g, '%20');
}

export async function loadTransportEditSetup(memberId, fields = {}, audit = {}) {
  const editId = parseOptionalId(fields.id);
  const stops = await loadTransportStops();

  if (editId) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, transport_number, transport_type, reg_number, transport_capacity,
        transport_image, transport_contact, transport_route, stoping_details, trip_count
      FROM transport_tb WHERE del = 1 AND id = ${editId} LIMIT 1
    `);
    const row = rows[0];
    if (!row) return { error: 'Transport not found' };

    const selectedStops = String(row.stoping_details || '').split(',').map((s) => s.trim()).filter(Boolean);
    await logHostelSetup(PAGE, 'View', 'Successful', String(editId), memberId, audit);
    return {
      mode: 'edit',
      transport: {
        id: Number(row.id),
        vehicleId: row.transport_number || '',
        vehicleType: row.transport_type || 'Bus',
        regNumber: row.reg_number || '',
        capacity: row.transport_capacity || '',
        contact: row.transport_contact || '',
        route: row.transport_route || '',
        tripCount: Number(row.trip_count) || 1,
        image: row.transport_image || '',
        imageUrl: transportImageUrl(row.transport_image),
        stopIds: selectedStops,
      },
      stops,
      listContext: { search: String(fields.search || ''), page: Number(fields.page) || 1 },
    };
  }

  const search = escapeSql(String(fields.search || '').trim());
  const page = Math.max(1, Number(fields.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  let where = 'del = 1';
  if (search) {
    where += ` AND (transport_number LIKE '%${search}%' OR reg_number LIKE '%${search}%')`;
  }

  const [countRows, listRows] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT COUNT(*) AS cnt FROM transport_tb WHERE ${where}`),
    prisma.$queryRawUnsafe(`
      SELECT id, transport_number, reg_number, transport_type, transport_capacity, transport_route, trip_count
      FROM transport_tb WHERE ${where}
      ORDER BY transport_number ASC
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `),
  ]);

  const total = Number(countRows[0]?.cnt || 0);
  await logHostelSetup(PAGE, 'View', 'Successful', search, memberId, audit);
  return {
    mode: 'list',
    search: fields.search || '',
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows: listRows.map((row) => ({
      id: Number(row.id),
      vehicleId: row.transport_number || '',
      regNumber: row.reg_number || '',
      vehicleType: row.transport_type || '',
      capacity: row.transport_capacity || '',
      route: row.transport_route || '',
      tripCount: Number(row.trip_count) || 1,
    })),
  };
}

export async function saveTransportEditSetup(payload, memberId, files = [], audit = {}) {
  const { update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    await prisma.$executeRawUnsafe(`
      UPDATE transport_tb SET del = 0,
        updated_dt = NOW(), updated_ip = '${escapeSql(update.updated_ip)}',
        updated_by = '${escapeSql(memberId)}'
      WHERE id = ${id}
    `);
    await logHostelSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
    return {
      success: true,
      message: 'Your details are deleted...',
      ...(await loadTransportEditSetup(memberId, { search: payload.search, page: payload.page }, { ...audit, skipLog: true })),
    };
  }

  const id = parseId(payload.id);
  const photoResult = await saveTransportPhoto(files);
  if (photoResult?.error) return { success: false, message: photoResult.error };

  const image = photoResult !== null ? photoResult : String(payload.existingImage || '');
  const stopIds = Array.isArray(payload.stopIds) ? payload.stopIds.map(String).filter(Boolean) : [];

  await prisma.$executeRawUnsafe(`
    UPDATE transport_tb SET
      transport_number = '${escapeSql(String(payload.vehicleId || ''))}',
      transport_type = '${escapeSql(String(payload.vehicleType || 'Bus'))}',
      reg_number = '${escapeSql(String(payload.regNumber || ''))}',
      transport_capacity = '${escapeSql(String(payload.capacity || ''))}',
      transport_image = '${escapeSql(image)}',
      transport_contact = '${escapeSql(String(payload.contact || ''))}',
      transport_route = '${escapeSql(String(payload.route || ''))}',
      stoping_details = '${escapeSql(stopIds.join(','))}',
      trip_count = ${Number(payload.tripCount) || 1},
      updated_dt = NOW(),
      updated_ip = '${escapeSql(update.updated_ip)}',
      updated_by = '${escapeSql(memberId)}'
    WHERE id = ${id}
  `);

  await logHostelSetup(PAGE, 'Update', 'Successful', String(id), memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadTransportEditSetup(memberId, {
      id,
      search: payload.search,
      page: payload.page,
    }, { ...audit, skipLog: true })),
  };
}
