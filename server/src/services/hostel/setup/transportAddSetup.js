import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { saveLegacyBinaryFile } from '../../web/webUpload.js';
import { loadTransportStops } from '../transportShared.js';
import { auditFields, logHostelSetup } from '../setupAudit.js';

const PAGE = 'transport_add.php';

export async function loadTransportAddSetup(memberId, _fields = {}, audit = {}) {
  const stops = await loadTransportStops();
  await logHostelSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return { stops };
}

async function saveTransportPhoto(files) {
  const list = Array.isArray(files) ? files : [];
  const file = list.find((f) => f.field === 'photo' || f.field === 't_photo') || list[0];
  if (!file) return '';
  const uploaded = await saveLegacyBinaryFile({
    folder: 'transport',
    file,
    maxBytes: 2 * 1024 * 1024,
    allowedExt: new Set(['png', 'jpg', 'jpeg', 'gif']),
  });
  if (uploaded.error) return { error: uploaded.error };
  return uploaded.filename.replace(/ /g, '%20');
}

export async function saveTransportAddSetup(payload, memberId, files = [], audit = {}) {
  const vehicleId = String(payload.vehicleId || '').trim();
  if (!vehicleId) return { success: false, message: 'Vehicle Id is required' };

  const dup = await prisma.$queryRawUnsafe(`
    SELECT id FROM transport_tb WHERE del = 1 AND transport_number = '${escapeSql(vehicleId)}' LIMIT 1
  `);
  if (dup.length) return { success: false, message: 'Vehicle ID Already Exists...' };

  const stopIds = Array.isArray(payload.stopIds) ? payload.stopIds.map(String).filter(Boolean) : [];
  if (!stopIds.length) return { success: false, message: 'Select at least one stop.' };

  const photoResult = await saveTransportPhoto(files);
  if (photoResult?.error) return { success: false, message: photoResult.error };
  const { create } = auditFields(memberId, audit);

  await prisma.$executeRawUnsafe(`
    INSERT INTO transport_tb (
      transport_number, transport_type, reg_number, transport_capacity,
      transport_image, transport_contact, contact_number, transport_route, stoping_details, trip_count,
      created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del
    ) VALUES (
      '${escapeSql(vehicleId)}',
      '${escapeSql(String(payload.vehicleType || 'Bus'))}',
      '${escapeSql(String(payload.regNumber || ''))}',
      '${escapeSql(String(payload.capacity || ''))}',
      '${escapeSql(typeof photoResult === 'string' ? photoResult : '')}',
      '${escapeSql(String(payload.contact || ''))}',
      '${escapeSql(String(payload.contactNumber || payload.contact || ''))}',
      '${escapeSql(String(payload.route || ''))}',
      '${escapeSql(stopIds.join(','))}',
      ${Number(payload.tripCount) || 1},
      NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
      NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1
    )
  `);

  await logHostelSetup(PAGE, 'Add', 'Successful', vehicleId, memberId, audit);
  return {
    success: true,
    message: 'Your details are added...',
    ...(await loadTransportAddSetup(memberId, {}, { ...audit, skipLog: true })),
  };
}
