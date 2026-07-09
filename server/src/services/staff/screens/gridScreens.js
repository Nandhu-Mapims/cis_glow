import { prisma } from '../../../config/prisma.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { saveLegacyBinaryFile } from '../../web/webUpload.js';
import { auditFields, logStaffModule } from '../staffModuleAudit.js';
import {
  escapeHtml,
  formatStaffName,
  listActiveStaff,
  listStaffPicker,
  loadTransportOptions,
  searchStaff,
} from '../staffShared.js';
import {
  getStaffAttachmentCatalog,
  saveStaffAttachments,
  uploadStaffAttachmentFile,
} from '../staffAttachments.js';

const ACTIVE = `(releaving_date > DATE(NOW()) OR CAST(releaving_date AS CHAR) = '0000-00-00')`;

export async function loadTransportScreen(memberId, fields = {}, audit = {}) {
  const page = Math.max(1, Number(fields.page) || 1);
  const limit = 50;
  const offset = (page - 1) * limit;
  const transports = await loadTransportOptions();
  const totalRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS c FROM staff_profile_tb WHERE del = 1 AND ${ACTIVE}`,
  );
  const total = Number(totalRows[0]?.c || 0);
  const staff = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id, staff_name, staff_initial, staff_title
     FROM staff_profile_tb WHERE del = 1 AND ${ACTIVE}
     ORDER BY staff_id ASC LIMIT ${limit} OFFSET ${offset}`,
  );
  const rows = [];
  for (const s of staff) {
    const transRows = await prisma.$queryRawUnsafe(
      `SELECT id, trans_yn, trans_number FROM staff_transport WHERE del = 1 AND staff_id = ${Number(s.id)} LIMIT 1`,
    );
    const trans = transRows[0];
    rows.push({
      staffRowId: Number(s.id),
      staffId: s.staff_id,
      staffName: formatStaffName(s),
      recordId: trans?.id || null,
      enabled: trans?.trans_yn === 1,
      transportNumber: trans?.trans_number || '',
    });
  }
  await logStaffModule('staff_transport.php', 'View', 'Successful', `page=${page}`, memberId, audit);
  return { rows, transports, page, total, limit };
}

export async function saveTransportScreen(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  const items = Array.isArray(payload.items) ? payload.items : [];
  for (const item of items) {
    const staffRowId = Number(item.staffRowId);
    if (!staffRowId) continue;
    const enabled = item.enabled ? 1 : 0;
    const transportNumber = Number(item.transportNumber) || 0;
    if (item.recordId) {
      await prisma.staff_transport.update({
        where: { id: Number(item.recordId) },
        data: { trans_yn: enabled, trans_number: transportNumber, ...update },
      });
    } else if (enabled || transportNumber) {
      await prisma.staff_transport.create({
        data: { staff_id: staffRowId, trans_yn: enabled, trans_number: transportNumber, ...create },
      });
    }
  }
  await logStaffModule('staff_transport.php', 'Update', 'Successful', String(items.length), memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadTransportScreen(memberId, { page: payload.page }, { ...audit, skipLog: true })),
  };
}

export async function loadPhotoUploadScreen(memberId, _fields = {}, audit = {}) {
  await logStaffModule('staff_photo_upload.php', 'View', 'Successful', '', memberId, audit);
  return { overwriteExists: false, uploads: [] };
}

export async function savePhotoUploadScreen(payload, memberId, audit = {}) {
  const files = Array.isArray(payload.files) ? payload.files : [];
  const overwrite = !!payload.overwriteExists;
  const results = [];
  for (const file of files) {
    const name = String(file.name || '').trim();
    if (!name.toLowerCase().endsWith('.png')) {
      results.push({ name, error: 'Only .png files named staffid.png are allowed' });
      continue;
    }
    const result = await saveLegacyBinaryFile({
      folder: 'staff_idcard',
      file: { name, data: file.data },
      allowedExt: new Set(['png']),
      preserveName: true,
      maxBytes: 2 * 1024 * 1024,
    });
    if (result.error) {
      results.push({ name, error: result.error });
      continue;
    }
    results.push({ name, publicUrl: result.publicUrl, success: true });
  }
  await logStaffModule('staff_photo_upload.php', 'Update', 'Successful', String(results.length), memberId, audit);
  return { success: true, message: 'Upload complete', results, overwriteExists: overwrite };
}

export async function loadCertificatesScreen(memberId, fields = {}, audit = {}) {
  const staffId = fields.staffId ? parseId(fields.staffId) : null;
  let catalog = null;
  if (staffId) {
    catalog = await getStaffAttachmentCatalog(staffId);
  }
  await logStaffModule('staff_attachments.php', 'View', 'Successful', String(staffId || ''), memberId, audit);
  return {
    catalog,
    searchResults: fields.q
      ? await searchStaff({ by: fields.by || 'name', q: fields.q })
      : await listStaffPicker(50),
  };
}

export async function saveCertificatesScreen(payload, memberId, audit = {}) {
  const staffId = parseId(payload.staffId);
  if (!staffId) return { success: false, message: 'Staff is required' };
  const result = await saveStaffAttachments(staffId, payload.items || [], {
    ip: audit.ip,
    username: memberId,
  });
  if (result.error) return { success: false, message: result.error };
  return {
    success: true,
    message: 'Attachments saved',
    ...(await loadCertificatesScreen(memberId, { staffId }, { ...audit, skipLog: true })),
    catalog: result.catalog,
  };
}

export async function uploadCertificatesFile(payload) {
  const { filename, dataBase64 } = payload || {};
  return uploadStaffAttachmentFile(filename, dataBase64);
}

export async function certificatesMore(query = {}) {
  const q = String(query.q || '').trim();
  if (!q) return listStaffPicker(50);
  return searchStaff({
    by: query.by || 'name',
    q,
    staffId: query.staffId,
  });
}
