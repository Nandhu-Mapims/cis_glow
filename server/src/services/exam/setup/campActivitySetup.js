import fs from 'fs';
import path from 'path';
import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { config } from '../../../config/index.js';
import { auditFields, logExamSetup } from './setupAudit.js';

const TYPE_TABLE = 'web_camp_event_type';
const EVENTS_TABLE = 'web_camp_events';
const PHOTOS_TABLE = 'web_camp_photos';
const PAGE_ADD = 'camp_activity_add.php';
const PAGE_EDIT = 'camp_activity_edit.php';
const LIST_LIMIT = 10;

const UPLOAD_CONFIG = {
  attachment: ['jpg', 'jpeg', 'png', 'gif', 'doc', 'docx', 'pdf', 'txt'],
  images: ['jpg', 'jpeg', 'png', 'gif'],
};

function loadUploadConfig() {
  try {
    const configPath = path.join(config.legacyCisPath, 'assets/json/uploadconfig.json');
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return {
      attachment: raw.attachment || UPLOAD_CONFIG.attachment,
      images: raw.images || UPLOAD_CONFIG.images,
    };
  } catch {
    return UPLOAD_CONFIG;
  }
}

async function tableExists(tableName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS cnt FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    tableName,
  );
  return Number(rows?.[0]?.cnt || 0) > 0;
}

async function ensureCampSchema() {
  if (!(await tableExists(TYPE_TABLE))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${TYPE_TABLE} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL DEFAULT '',
        del TINYINT NOT NULL DEFAULT 1,
        created_dt DATETIME NULL,
        created_ip VARCHAR(50) NULL,
        created_by VARCHAR(100) NULL,
        updated_dt DATETIME NULL,
        updated_ip VARCHAR(50) NULL,
        updated_by VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }
  if (!(await tableExists(EVENTS_TABLE))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${EVENTS_TABLE} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_type VARCHAR(255) NOT NULL DEFAULT '',
        title VARCHAR(255) NOT NULL DEFAULT '',
        from_date DATETIME NULL,
        to_date DATETIME NULL,
        description LONGTEXT NULL,
        attachment VARCHAR(255) NOT NULL DEFAULT '',
        venue VARCHAR(255) NOT NULL DEFAULT '',
        total_patients VARCHAR(50) NOT NULL DEFAULT '',
        web_view TINYINT NOT NULL DEFAULT 1,
        event_status TINYINT NOT NULL DEFAULT 1,
        tags VARCHAR(255) NOT NULL DEFAULT '',
        del TINYINT NOT NULL DEFAULT 1,
        created_dt DATETIME NULL,
        created_ip VARCHAR(50) NULL,
        created_by VARCHAR(100) NULL,
        updated_dt DATETIME NULL,
        updated_ip VARCHAR(50) NULL,
        updated_by VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }
  if (!(await tableExists(PHOTOS_TABLE))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${PHOTOS_TABLE} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        photos_from VARCHAR(50) NOT NULL DEFAULT '',
        ref_id INT NOT NULL DEFAULT 0,
        title VARCHAR(255) NOT NULL DEFAULT '',
        p_date DATE NULL,
        photo_order INT NOT NULL DEFAULT 0,
        attachment VARCHAR(255) NOT NULL DEFAULT '',
        c_attachment VARCHAR(255) NOT NULL DEFAULT '',
        del TINYINT NOT NULL DEFAULT 1,
        created_dt DATETIME NULL,
        created_ip VARCHAR(50) NULL,
        created_by VARCHAR(100) NULL,
        updated_dt DATETIME NULL,
        updated_ip VARCHAR(50) NULL,
        updated_by VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }
}

function randomFileName(ext) {
  const now = new Date();
  const stamp = [
    String(now.getDate()).padStart(2, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getFullYear()).slice(-2),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  return `${stamp}${Math.floor(1000 + Math.random() * 9000)}.${ext}`;
}

function parseLegacyDateTime(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const match = text.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
  if (match) {
    const [, dd, mm, yyyy, hh, mi] = match;
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:00`;
  }
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function formatLegacyDateTime(value) {
  const text = String(value || '');
  if (!text || text.startsWith('0000-00-00')) return '';
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${mi}`;
}

function saveUploadedFile(file, allowedExts, targetDir) {
  if (!file?.content) return { success: false, message: 'Missing file content' };
  const ext = path.extname(file.filename || '').slice(1).toLowerCase();
  if (!allowedExts.includes(ext)) {
    return { success: false, message: `Please Upload ${allowedExts.join(', ')}...` };
  }
  const buffer = Buffer.from(file.content, 'base64');
  if (buffer.length > 10 * 1024 * 1024) {
    return { success: false, message: 'Please Upload less than 10 MB file...' };
  }
  fs.mkdirSync(targetDir, { recursive: true });
  const stored = randomFileName(ext);
  fs.writeFileSync(path.join(targetDir, stored), buffer);
  return { success: true, stored };
}

async function loadEventTypes() {
  await ensureCampSchema();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, title FROM ${TYPE_TABLE} WHERE del=1 ORDER BY title ASC`,
  );
  return rows.map((row) => ({ id: Number(row.id), title: String(row.title || '') }));
}

function fileUrl(subfolder, filename) {
  if (!filename) return '';
  return `/api/files/camp/${subfolder}/${filename}`;
}

async function loadGalleryPhotos(eventId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, title, photo_order, attachment, c_attachment
     FROM ${PHOTOS_TABLE}
     WHERE del=1 AND ref_id='${Number(eventId)}' AND photos_from='Events'
     ORDER BY photo_order ASC`,
  );
  return rows.map((row) => ({
    id: Number(row.id),
    title: String(row.title || ''),
    photoOrder: Number(row.photo_order) || 0,
    attachment: String(row.attachment || ''),
    cAttachment: String(row.c_attachment || row.attachment || ''),
    thumbUrl: fileUrl('photos', row.c_attachment || row.attachment),
  }));
}

async function insertGalleryPhotos(eventId, eventTitle, eventDate, files, memberId, audit, startOrder = 0) {
  const uploadCfg = loadUploadConfig();
  const photoDir = path.join(config.legacyFilesPath, 'camp', 'photos');
  const { create } = auditFields(memberId, audit);
  const ip = create.created_ip || '';
  const by = create.created_by || memberId;
  let order = startOrder;

  for (const file of files) {
    const saved = saveUploadedFile(file, uploadCfg.images, photoDir);
    if (!saved.success) continue;
    order += 1;
    const compressed = `c_${saved.stored}`;
    fs.copyFileSync(path.join(photoDir, saved.stored), path.join(photoDir, compressed));
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${PHOTOS_TABLE}
       (photos_from, ref_id, title, p_date, photo_order, attachment, c_attachment,
        created_dt, created_ip, created_by, del)
       VALUES ('Events', '${Number(eventId)}', '${escapeSql(eventTitle)}',
         '${escapeSql(eventDate)}', '${order}', '${escapeSql(saved.stored)}',
         '${escapeSql(compressed)}', NOW(), '${escapeSql(ip)}', '${escapeSql(by)}', 1)`,
    );
  }
  return order;
}

export async function loadCampActivityType(memberId, _fields = {}, audit = {}) {
  const exists = await tableExists(TYPE_TABLE);
  if (!exists) {
    await ensureCampSchema();
  }
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, title FROM ${TYPE_TABLE} WHERE del=1 ORDER BY title ASC`,
  );
  await logExamSetup(PAGE_ADD, 'View', 'Successful', '', memberId, audit);
  return {
    rows: rows.map((row, index) => ({
      index: index + 1,
      id: Number(row.id),
      title: String(row.title || ''),
    })),
  };
}

export async function saveCampActivityType(payload, memberId, audit = {}) {
  await ensureCampSchema();
  const { update, create } = auditFields(memberId, audit);
  const ip = create.created_ip || update.updated_ip || '';
  const by = create.created_by || update.updated_by || memberId;

  if (payload.action === 'delete' && payload.deleteId) {
    await prisma.$executeRawUnsafe(
      `UPDATE ${TYPE_TABLE} SET del=0, updated_dt=NOW(), updated_ip='${escapeSql(ip)}', updated_by='${escapeSql(by)}'
       WHERE id='${Number(payload.deleteId)}'`,
    );
    await logExamSetup(PAGE_ADD, 'Delete', 'Successful', String(payload.deleteId), memberId, audit);
    return {
      success: true,
      message: 'Your details are deleted...',
      ...(await loadCampActivityType(memberId, {}, { ...audit, skipLog: true })),
    };
  }

  const newTitles = Array.isArray(payload.newTitles) ? payload.newTitles : [];
  for (const title of newTitles) {
    const value = String(title || '').trim();
    if (!value) continue;
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${TYPE_TABLE}(title, created_dt, created_ip, created_by, del)
       VALUES ('${escapeSql(value)}', NOW(), '${escapeSql(ip)}', '${escapeSql(by)}', 1)`,
    );
  }

  const updates = Array.isArray(payload.updates) ? payload.updates : [];
  for (const row of updates) {
    const id = Number(row.id);
    const title = String(row.title || '').trim();
    if (!id || !title) continue;
    await prisma.$executeRawUnsafe(
      `UPDATE ${TYPE_TABLE} SET title='${escapeSql(title)}', updated_dt=NOW(),
         updated_ip='${escapeSql(ip)}', updated_by='${escapeSql(by)}'
       WHERE id='${id}'`,
    );
  }

  await logExamSetup(PAGE_ADD, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadCampActivityType(memberId, {}, { ...audit, skipLog: true })),
  };
}

export async function loadCampActivityAdd(memberId, _fields = {}, audit = {}) {
  await ensureCampSchema();
  const uploadCfg = loadUploadConfig();
  await logExamSetup(PAGE_ADD, 'View', 'Successful', '', memberId, audit);
  return {
    eventTypes: await loadEventTypes(),
    attachmentHelp: uploadCfg.attachment.join(', '),
    imagesHelp: uploadCfg.images.join(', '),
    webView: '1',
  };
}

export async function saveCampActivityAdd(payload, memberId, files = [], audit = {}) {
  await ensureCampSchema();
  const uploadCfg = loadUploadConfig();
  const { create } = auditFields(memberId, audit);
  const ip = create.created_ip || '';
  const by = create.created_by || memberId;

  const eventTypes = Array.isArray(payload.event_types)
    ? payload.event_types
    : (payload.eventTypes || []);
  const eventTitle = String(payload.event_title || payload.eventTitle || '').trim();
  const fromDate = parseLegacyDateTime(payload.from_date || payload.fromDate);
  const toDate = parseLegacyDateTime(payload.to_date || payload.toDate);
  const description = String(payload.description || '');
  const venue = String(payload.venue || '').trim();
  const totalPatients = String(payload.total_patients || payload.totalPatients || '').trim();
  const webView = String(payload.web_view ?? payload.webView ?? '1');

  if (!eventTitle || !fromDate || !toDate || !venue || !totalPatients) {
    return { success: false, message: 'Required fields missing' };
  }

  let attachment = '';
  const attachFile = files.find((f) => f.field === 'attachment' || f.field?.includes('attachment'));
  if (attachFile) {
    const eventDir = path.join(config.legacyFilesPath, 'camp', 'events');
    const saved = saveUploadedFile(attachFile, uploadCfg.attachment, eventDir);
    if (!saved.success) return { success: false, message: saved.message };
    attachment = saved.stored;
  }

  const eventTypeList = eventTypes.map(String).filter(Boolean).join(',');

  await prisma.$executeRawUnsafe(
    `INSERT INTO ${EVENTS_TABLE}
     (event_type, title, from_date, to_date, description, attachment, venue, total_patients,
      web_view, created_dt, created_ip, created_by, del)
     VALUES ('${escapeSql(eventTypeList)}', '${escapeSql(eventTitle)}',
       '${escapeSql(fromDate)}', '${escapeSql(toDate)}', '${escapeSql(description)}',
       '${escapeSql(attachment)}', '${escapeSql(venue)}', '${escapeSql(totalPatients)}',
       '${escapeSql(webView)}', NOW(), '${escapeSql(ip)}', '${escapeSql(by)}', 1)`,
  );

  const idRows = await prisma.$queryRawUnsafe('SELECT LAST_INSERT_ID() AS id');
  const eventId = Number(idRows?.[0]?.id);
  const eventDate = fromDate.slice(0, 10);
  const galleryFiles = files.filter((f) => f.field === 'gallery[]' || f.field?.includes('gallery'));
  if (eventId && galleryFiles.length) {
    await insertGalleryPhotos(eventId, eventTitle, eventDate, galleryFiles, memberId, audit);
  }

  await logExamSetup(PAGE_ADD, 'Add', 'Successful', eventTitle, memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadCampActivityAdd(memberId, {}, { ...audit, skipLog: true })),
  };
}

export async function loadCampActivityEdit(memberId, fields = {}, audit = {}) {
  await ensureCampSchema();
  const uploadCfg = loadUploadConfig();
  const editId = Number(fields.editId || fields.edit_row_id || 0);
  const search = String(fields.search || '').trim();
  const page = Math.max(1, Number(fields.page) || 1);
  const offset = (page - 1) * LIST_LIMIT;

  if (editId) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM ${EVENTS_TABLE} WHERE del=1 AND id='${editId}' LIMIT 1`,
    );
    const row = rows?.[0];
    if (!row) {
      return { error: 'Event not found', eventTypes: await loadEventTypes() };
    }
    const selectedTypes = String(row.event_type || '').split(',').filter(Boolean);
    await logExamSetup(PAGE_EDIT, 'View', 'Successful', String(editId), memberId, audit);
    return {
      mode: 'edit',
      editId,
      eventTypes: await loadEventTypes(),
      selectedTypes,
      eventTitle: String(row.title || ''),
      fromDate: formatLegacyDateTime(row.from_date),
      toDate: formatLegacyDateTime(row.to_date),
      description: String(row.description || ''),
      venue: String(row.venue || ''),
      totalPatients: String(row.total_patients || ''),
      attachment: String(row.attachment || ''),
      attachmentUrl: fileUrl('events', row.attachment),
      webView: String(row.web_view ?? '1'),
      eventStatus: String(row.event_status ?? '1'),
      gallery: await loadGalleryPhotos(editId),
      attachmentHelp: uploadCfg.attachment.join(', '),
      imagesHelp: uploadCfg.images.join(', '),
      search,
      page,
    };
  }

  let searchSql = '';
  if (search) {
    const parsedDate = parseLegacyDateTime(`${search} 00:00`);
    const datePart = parsedDate ? parsedDate.slice(0, 10) : '';
    const parts = [`title LIKE '%${escapeSql(search)}%'`];
    if (datePart) {
      parts.push(`DATE(from_date)='${escapeSql(datePart)}'`, `DATE(to_date)='${escapeSql(datePart)}'`);
    }
    searchSql = ` AND (${parts.join(' OR ')})`;
  }

  const countRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS cnt FROM ${EVENTS_TABLE} WHERE del=1${searchSql}`,
  );
  const total = Number(countRows?.[0]?.cnt || 0);
  const listRows = await prisma.$queryRawUnsafe(
    `SELECT id, title, from_date, to_date FROM ${EVENTS_TABLE}
     WHERE del=1${searchSql} ORDER BY created_dt DESC LIMIT ${offset}, ${LIST_LIMIT}`,
  );

  await logExamSetup(PAGE_EDIT, 'View', 'Successful', search, memberId, audit);
  return {
    mode: 'list',
    rows: listRows.map((row) => ({
      id: Number(row.id),
      title: String(row.title || ''),
      fromDate: formatLegacyDateTime(row.from_date),
      toDate: formatLegacyDateTime(row.to_date),
    })),
    search,
    page,
    total,
    totalPages: Math.max(1, Math.ceil(total / LIST_LIMIT)),
    eventTypes: await loadEventTypes(),
  };
}

export async function saveCampActivityEdit(payload, memberId, files = [], audit = {}) {
  await ensureCampSchema();
  const uploadCfg = loadUploadConfig();
  const { create, update } = auditFields(memberId, audit);
  const ip = create.created_ip || update.updated_ip || '';
  const by = create.created_by || update.updated_by || memberId;

  if (payload.delete === 'Confirm' || payload.action === 'delete') {
    const confirmId = Number(payload.confirm || payload.deleteId);
    if (!confirmId) return { success: false, message: 'Nothing to delete' };
    await prisma.$executeRawUnsafe(
      `UPDATE ${EVENTS_TABLE} SET del=0, updated_dt=NOW(), updated_ip='${escapeSql(ip)}', updated_by='${escapeSql(by)}'
       WHERE id='${confirmId}'`,
    );
    await prisma.$executeRawUnsafe(
      `UPDATE ${PHOTOS_TABLE} SET del=0, updated_dt=NOW(), updated_ip='${escapeSql(ip)}', updated_by='${escapeSql(by)}'
       WHERE ref_id='${confirmId}' AND photos_from='Events'`,
    );
    await logExamSetup(PAGE_EDIT, 'Delete', 'Successful', String(confirmId), memberId, audit);
    return {
      success: true,
      message: 'Your details are deleted...',
      ...(await loadCampActivityEdit(memberId, { search: payload.search, page: payload.page }, { ...audit, skipLog: true })),
    };
  }

  const editId = Number(payload.edit_row_id || payload.editId);
  if (!editId) return { success: false, message: 'Event id required' };

  const submitAction = String(payload.Submit || payload.action || 'Save');

  if (submitAction === 'Update Gallery') {
    const photoIds = Array.isArray(payload.p_u_id) ? payload.p_u_id : [payload.p_u_id].filter(Boolean);
    const titles = Array.isArray(payload.p_title) ? payload.p_title : [payload.p_title];
    const orders = Array.isArray(payload.p_order) ? payload.p_order : [payload.p_order];
    for (let i = 0; i < photoIds.length; i += 1) {
      await prisma.$executeRawUnsafe(
        `UPDATE ${PHOTOS_TABLE} SET title='${escapeSql(String(titles[i] || ''))}',
           photo_order='${escapeSql(String(orders[i] || ''))}',
           updated_dt=NOW(), updated_ip='${escapeSql(ip)}', updated_by='${escapeSql(by)}'
         WHERE id='${Number(photoIds[i])}'`,
      );
    }
    await logExamSetup(PAGE_EDIT, 'Update', 'Successful', String(editId), memberId, audit);
    return {
      success: true,
      message: 'Your details are updated...',
      ...(await loadCampActivityEdit(memberId, { editId, search: payload.search, page: payload.page }, { ...audit, skipLog: true })),
    };
  }

  if (submitAction === 'Delete Gallery') {
    const deleteIds = Array.isArray(payload.photo_id) ? payload.photo_id : [payload.photo_id];
    for (const photoId of deleteIds) {
      if (!photoId) continue;
      await prisma.$executeRawUnsafe(
        `UPDATE ${PHOTOS_TABLE} SET del=0, updated_dt=NOW(), updated_ip='${escapeSql(ip)}', updated_by='${escapeSql(by)}'
         WHERE id='${Number(photoId)}'`,
      );
    }
    await logExamSetup(PAGE_EDIT, 'Delete', 'Successful', String(editId), memberId, audit);
    return {
      success: true,
      message: 'Your details are updated...',
      ...(await loadCampActivityEdit(memberId, { editId, search: payload.search, page: payload.page }, { ...audit, skipLog: true })),
    };
  }

  const eventTypes = Array.isArray(payload.event_types)
    ? payload.event_types
    : (payload.eventTypes || []);
  const eventTitle = String(payload.event_title || payload.eventTitle || '').trim();
  const fromDate = parseLegacyDateTime(payload.from_date || payload.fromDate);
  const toDate = parseLegacyDateTime(payload.to_date || payload.toDate);
  const description = String(payload.description || '');
  const venue = String(payload.venue || '').trim();
  const totalPatients = String(payload.total_patients || payload.totalPatients || '').trim();
  const webView = String(payload.web_view ?? payload.webView ?? '1');
  const eventStatus = String(payload.event_status ?? payload.eventStatus ?? '1');
  let attachment = String(payload.hd_attachment || payload.attachmentExisting || '');

  const attachFile = files.find((f) => f.field === 'attachment' || f.field?.includes('attachment'));
  if (attachFile?.content) {
    const eventDir = path.join(config.legacyFilesPath, 'camp', 'events');
    const saved = saveUploadedFile(attachFile, uploadCfg.attachment, eventDir);
    if (!saved.success) return { success: false, message: saved.message };
    attachment = saved.stored;
  }

  await prisma.$executeRawUnsafe(
    `UPDATE ${EVENTS_TABLE} SET
       event_type='${escapeSql(eventTypes.map(String).filter(Boolean).join(','))}',
       title='${escapeSql(eventTitle)}',
       from_date='${escapeSql(fromDate)}',
       to_date='${escapeSql(toDate)}',
       description='${escapeSql(description)}',
       attachment='${escapeSql(attachment)}',
       venue='${escapeSql(venue)}',
       total_patients='${escapeSql(totalPatients)}',
       web_view='${escapeSql(webView)}',
       event_status='${escapeSql(eventStatus)}',
       updated_dt=NOW(), updated_ip='${escapeSql(ip)}', updated_by='${escapeSql(by)}'
     WHERE id='${editId}'`,
  );

  const eventDate = (fromDate || '').slice(0, 10);
  await prisma.$executeRawUnsafe(
    `UPDATE ${PHOTOS_TABLE} SET p_date='${escapeSql(eventDate)}',
       updated_dt=NOW(), updated_ip='${escapeSql(ip)}', updated_by='${escapeSql(by)}'
     WHERE ref_id='${editId}' AND photos_from='Events' AND del=1`,
  );

  const existingPhotos = await loadGalleryPhotos(editId);
  const startOrder = existingPhotos.length;
  const galleryFiles = files.filter((f) => f.field === 'gallery[]' || f.field?.includes('gallery'));
  if (galleryFiles.length) {
    await insertGalleryPhotos(editId, eventTitle, eventDate, galleryFiles, memberId, audit, startOrder);
  }

  await logExamSetup(PAGE_EDIT, 'Update', 'Successful', String(editId), memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadCampActivityEdit(memberId, { editId, search: payload.search, page: payload.page }, { ...audit, skipLog: true })),
  };
}