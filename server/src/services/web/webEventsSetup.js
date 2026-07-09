import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { ensureWebEventsTables, ensureWebPhotosTables, listWebEventTypes } from './webDb.js';
import { auditFields, logWebSetup } from './webAudit.js';
import { saveLegacyBinaryFile } from './webUpload.js';

const PAGE_ADD = 'festival_event_add.php';
const PAGE_EDIT = 'festival_event_edit.php';
const PAGE_TYPE = 'event_category.php';
const DOC_EXT = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);
const IMG_EXT = new Set(['jpeg', 'jpg', 'gif', 'png', 'webp']);

function toInputDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromInputDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function mapEvent(row) {
  const typeIds = String(row.event_type || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    id: Number(row.id),
    eventTypes: typeIds.map(Number).filter((n) => n > 0),
    title: row.title || '',
    fromDate: toInputDateTime(row.from_date),
    toDate: toInputDateTime(row.to_date),
    description: row.description || '',
    attachment: row.attachment || '',
    venue: row.venue || '',
    webView: Number(row.web_view) !== 0,
    eventStatus: Number(row.event_status) || 1,
    photos: [],
  };
}

const emptyEventForm = () => ({
  eventTypes: [],
  title: '',
  fromDate: '',
  toDate: '',
  description: '',
  attachment: '',
  venue: '',
  webView: true,
  eventStatus: 1,
  photos: [],
});

async function loadEventTypeOptions() {
  const rows = await listWebEventTypes();
  return rows.map((r) => ({ id: Number(r.id), title: r.title || '' }));
}

async function saveEventAttachment(fields) {
  let attachment = fields.attachment || '';
  const attachFile = fields.files?.find((f) => f.field === 'attachment');
  if (attachFile) {
    const uploaded = await saveLegacyBinaryFile({
      folder: 'events',
      file: attachFile,
      maxBytes: 10 * 1024 * 1024,
      allowedExt: DOC_EXT,
    });
    if (uploaded.error) return { error: uploaded.error };
    attachment = uploaded.filename;
  }
  return { attachment };
}

async function saveEventGallery(eventId, eventTitle, eventDate, memberId, fields, audit) {
  await ensureWebPhotosTables();
  const auditCtx = auditFields(memberId, audit);
  const galleryFiles = (fields.files || []).filter((f) => String(f.field || '').startsWith('gallery_'));
  if (!galleryFiles.length) return;

  const existing = await prisma.$queryRawUnsafe(`
    SELECT COALESCE(MAX(photo_order), 0) AS max_order
    FROM web_photos WHERE del = 1 AND photos_from = 'Events' AND ref_id = ${eventId}
  `);
  let order = Number(existing[0]?.max_order || 0);

  for (const file of galleryFiles) {
    const uploaded = await saveLegacyBinaryFile({
      folder: 'photos',
      file,
      maxBytes: 5 * 1024 * 1024,
      allowedExt: IMG_EXT,
    });
    if (uploaded.error) return { error: uploaded.error };
    order += 1;
    await prisma.$executeRawUnsafe(`
      INSERT INTO web_photos
        (photos_from, ref_id, title, p_date, photo_order, attachment, c_attachment,
         created_dt, created_ip, created_by, del)
      VALUES
        ('Events', ${eventId}, '${escapeSql(eventTitle)}',
         ${eventDate ? `'${escapeSql(eventDate)}'` : 'NULL'},
         ${order}, '${escapeSql(uploaded.filename)}', '${escapeSql(uploaded.filename)}',
         NOW(), '${escapeSql(auditCtx.ip)}', '${escapeSql(auditCtx.by)}', 1)
    `);
  }
}

async function persistEvent(memberId, fields, audit, eventId = null) {
  const auditCtx = auditFields(memberId, audit);
  const title = String(fields.title || '').trim();
  if (!title) return { error: 'Event name is required.' };

  const attachResult = await saveEventAttachment(fields);
  if (attachResult.error) return attachResult;

  const typeList = Array.isArray(fields.eventTypes)
    ? fields.eventTypes.map(String).filter(Boolean).join(',')
    : String(fields.eventTypes || '');
  const fromDate = fromInputDateTime(fields.fromDate);
  const toDate = fromInputDateTime(fields.toDate);
  const fromSql = fromDate ? `'${escapeSql(fromDate.toISOString().slice(0, 19).replace('T', ' '))}'` : 'NULL';
  const toSql = toDate ? `'${escapeSql(toDate.toISOString().slice(0, 19).replace('T', ' '))}'` : 'NULL';
  const pDate = fromDate ? fromDate.toISOString().slice(0, 10) : null;

  const cols = {
    event_type: escapeSql(typeList),
    title: escapeSql(title),
    description: escapeSql(fields.description || ''),
    attachment: escapeSql(attachResult.attachment || fields.attachment || ''),
    venue: escapeSql(fields.venue || ''),
    web_view: fields.webView === false ? 0 : 1,
    event_status: Number(fields.eventStatus) || 1,
  };

  let savedId = eventId;
  if (eventId) {
    await prisma.$executeRawUnsafe(`
      UPDATE web_events SET
        event_type='${cols.event_type}',
        title='${cols.title}',
        from_date=${fromSql},
        to_date=${toSql},
        description='${cols.description}',
        attachment='${cols.attachment}',
        venue='${cols.venue}',
        web_view=${cols.web_view},
        event_status=${cols.event_status},
        updated_dt=NOW(),
        updated_ip='${escapeSql(auditCtx.ip)}',
        updated_by='${escapeSql(auditCtx.by)}'
      WHERE id=${eventId} AND del=1
    `);
  } else {
    await prisma.$executeRawUnsafe(`
      INSERT INTO web_events
        (event_type, title, from_date, to_date, description, attachment, venue,
         web_view, event_status, created_dt, created_ip, created_by, del)
      VALUES
        ('${cols.event_type}', '${cols.title}', ${fromSql}, ${toSql},
         '${cols.description}', '${cols.attachment}', '${cols.venue}',
         ${cols.web_view}, ${cols.event_status},
         NOW(), '${escapeSql(auditCtx.ip)}', '${escapeSql(auditCtx.by)}', 1)
    `);
    const idRows = await prisma.$queryRawUnsafe('SELECT LAST_INSERT_ID() AS id');
    savedId = Number(idRows[0]?.id);
  }

  const galleryResult = await saveEventGallery(savedId, title, pDate, memberId, fields, audit);
  if (galleryResult?.error) return galleryResult;

  return { eventId: savedId };
}

export async function loadWebEventAdd(_memberId, _fields, _query, audit) {
  await ensureWebEventsTables();
  await logWebSetup(_memberId, audit, PAGE_ADD, 'load');
  return {
    success: true,
    eventTypes: await loadEventTypeOptions(),
    form: emptyEventForm(),
  };
}

export async function saveWebEventAdd(memberId, fields, _query, audit) {
  await ensureWebEventsTables();
  const result = await persistEvent(memberId, fields, audit);
  if (result.error) return { success: false, message: result.error };
  await logWebSetup(memberId, audit, PAGE_ADD, 'save');
  return { success: true, message: 'Event added.', eventId: result.eventId };
}

export async function loadWebEventEdit(_memberId, fields, query, audit) {
  await ensureWebEventsTables();
  await ensureWebPhotosTables();
  const eventId = fields.eventId || query.eventId ? parseId(fields.eventId || query.eventId) : null;
  const search = String(fields.search || query.search || '').trim();

  let searchSql = '';
  if (search) {
    const q = escapeSql(search);
    searchSql = ` AND (title LIKE '%${q}%' OR venue LIKE '%${q}%')`;
  }

  const events = await prisma.$queryRawUnsafe(`
    SELECT id, title, from_date, to_date, venue, web_view, event_status
    FROM web_events WHERE del = 1 ${searchSql}
    ORDER BY created_dt DESC
    LIMIT 100
  `);

  let form = emptyEventForm();
  let photos = [];
  if (eventId) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT * FROM web_events WHERE del = 1 AND id = ${eventId} LIMIT 1
    `);
    if (rows[0]) {
      form = mapEvent(rows[0]);
      photos = await prisma.$queryRawUnsafe(`
        SELECT id, attachment, photo_order
        FROM web_photos
        WHERE del = 1 AND photos_from = 'Events' AND ref_id = ${eventId}
        ORDER BY photo_order ASC, id ASC
      `);
      form.photos = photos.map((p) => ({
        id: Number(p.id),
        attachment: p.attachment || '',
        order: Number(p.photo_order) || 0,
        url: p.attachment ? `/legacy/files/photos/${p.attachment}` : '',
      }));
    }
  }

  await logWebSetup(_memberId, audit, PAGE_EDIT, 'load');
  return {
    success: true,
    search,
    eventTypes: await loadEventTypeOptions(),
    events: events.map((r) => ({
      id: Number(r.id),
      title: r.title || '',
      fromDate: toInputDateTime(r.from_date),
      toDate: toInputDateTime(r.to_date),
      venue: r.venue || '',
    })),
    eventId,
    form,
  };
}

export async function saveWebEventEdit(memberId, fields, _query, audit) {
  await ensureWebEventsTables();
  if (fields.action === 'delete') {
    const eventId = parseId(fields.eventId);
    if (!eventId) return { success: false, message: 'Select an event.' };
    const auditCtx = auditFields(memberId, audit);
    await prisma.$executeRawUnsafe(`
      UPDATE web_events SET del = 0, updated_dt = NOW(),
        updated_ip = '${escapeSql(auditCtx.ip)}', updated_by = '${escapeSql(auditCtx.by)}'
      WHERE id = ${eventId}
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE web_photos SET del = 0, updated_dt = NOW(),
        updated_ip = '${escapeSql(auditCtx.ip)}', updated_by = '${escapeSql(auditCtx.by)}'
      WHERE ref_id = ${eventId} AND photos_from = 'Events'
    `);
    await logWebSetup(memberId, audit, PAGE_EDIT, 'delete');
    return {
      success: true,
      message: 'Event deleted.',
      ...(await loadWebEventEdit(memberId, {}, {}, { ...audit, skipLog: true })),
    };
  }

  const eventId = parseId(fields.eventId);
  if (!eventId) return { success: false, message: 'Select an event.' };
  const result = await persistEvent(memberId, fields, audit, eventId);
  if (result.error) return { success: false, message: result.error };
  await logWebSetup(memberId, audit, PAGE_EDIT, 'save');
  return {
    success: true,
    message: 'Event updated.',
    ...(await loadWebEventEdit(memberId, { eventId }, {}, { ...audit, skipLog: true })),
  };
}

export async function loadWebEventType(_memberId, _fields, _query, audit) {
  await ensureWebEventsTables();
  const rows = await listWebEventTypes();
  await logWebSetup(_memberId, audit, PAGE_TYPE, 'load');
  return {
    success: true,
    rows: rows.map((r) => ({ id: Number(r.id), title: r.title || '' })),
  };
}

export async function saveWebEventType(memberId, fields, _query, audit) {
  await ensureWebEventsTables();
  const auditCtx = auditFields(memberId, audit);

  if (fields.action === 'delete') {
    const id = parseId(fields.id);
    if (!id) return { success: false, message: 'Invalid row.' };
    await prisma.$executeRawUnsafe(`
      UPDATE web_event_type SET del = 0, updated_dt = NOW(),
        updated_ip = '${escapeSql(auditCtx.ip)}', updated_by = '${escapeSql(auditCtx.by)}'
      WHERE id = ${id}
    `);
    await logWebSetup(memberId, audit, PAGE_TYPE, 'delete');
    return {
      success: true,
      message: 'Event type deleted.',
      ...(await loadWebEventType(memberId, {}, {}, { ...audit, skipLog: true })),
    };
  }

  const rows = Array.isArray(fields.rows) ? fields.rows : [];
  for (const row of rows) {
    const title = String(row.title || '').trim();
    if (!title) continue;
    if (row.id) {
      await prisma.$executeRawUnsafe(`
        UPDATE web_event_type SET title = '${escapeSql(title)}', updated_dt = NOW(),
          updated_ip = '${escapeSql(auditCtx.ip)}', updated_by = '${escapeSql(auditCtx.by)}'
        WHERE id = ${Number(row.id)} AND del = 1
      `);
    } else {
      await prisma.$executeRawUnsafe(`
        INSERT INTO web_event_type (title, created_dt, created_ip, created_by, del)
        VALUES ('${escapeSql(title)}', NOW(), '${escapeSql(auditCtx.ip)}', '${escapeSql(auditCtx.by)}', 1)
      `);
    }
  }

  await logWebSetup(memberId, audit, PAGE_TYPE, 'save');
  return {
    success: true,
    message: 'Event types saved.',
    ...(await loadWebEventType(memberId, {}, {}, { ...audit, skipLog: true })),
  };
}
