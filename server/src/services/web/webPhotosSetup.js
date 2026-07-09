import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { ensureWebPhotosTables } from './webDb.js';
import { auditFields, logWebSetup } from './webAudit.js';
import { saveLegacyBinaryFile } from './webUpload.js';

const PAGE_ADD = 'photos_add.php';
const PAGE_EDIT = 'photos_edit.php';
const IMG_EXT = new Set(['jpeg', 'jpg', 'gif', 'png', 'webp']);

function mapGallery(row) {
  return {
    id: row.id,
    date: row.n_date ? String(row.n_date).slice(0, 10) : '',
    title: row.title || '',
    description: row.description || '',
    attachment: row.attachment || '',
    webView: row.web_view === 1,
    photoCount: row.photo_count ?? 0,
  };
}

export async function loadWebPhotosAdd(_memberId, _fields, _query, audit) {
  await ensureWebPhotosTables();
  await logWebSetup(_memberId, audit, PAGE_ADD, 'load');
  return {
    success: true,
    form: {
      date: new Date().toISOString().slice(0, 10),
      title: '',
      description: '',
      webView: true,
      photos: [],
    },
  };
}

export async function saveWebPhotosAdd(memberId, fields, _query, audit) {
  await ensureWebPhotosTables();
  const title = String(fields.title || '').trim();
  if (!title) return { success: false, message: 'Title is required.' };

  const auditCtx = auditFields(memberId, audit);
  let cover = '';
  const coverFile = fields.files?.find((f) => f.field === 'cover');
  if (coverFile) {
    const uploaded = await saveLegacyBinaryFile({
      folder: 'documents',
      file: coverFile,
      maxBytes: 5 * 1024 * 1024,
      allowedExt: IMG_EXT,
    });
    if (uploaded.error) return { success: false, message: uploaded.error };
    cover = uploaded.filename;
  }

  await prisma.$executeRawUnsafe(`
    INSERT INTO web_photos_gallery
      (n_date, title, description, attachment, web_view, created_dt, created_ip, created_by, del)
    VALUES
      (${fields.date ? `'${escapeSql(fields.date)}'` : 'NULL'},
       '${escapeSql(title)}',
       '${escapeSql(fields.description || '')}',
       '${escapeSql(cover)}',
       ${fields.webView === false ? 0 : 1},
       NOW(), '${escapeSql(auditCtx.ip)}', '${escapeSql(auditCtx.by)}', 1)
  `);
  const idRows = await prisma.$queryRawUnsafe('SELECT LAST_INSERT_ID() AS id');
  const galleryId = Number(idRows[0]?.id);

  const photos = Array.isArray(fields.photos) ? fields.photos : [];
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    let filename = photo.attachment || '';
    const file = fields.files?.find((f) => f.field === `photo_${i}`);
    if (file) {
      const uploaded = await saveLegacyBinaryFile({
        folder: 'documents',
        file,
        maxBytes: 5 * 1024 * 1024,
        allowedExt: IMG_EXT,
      });
      if (uploaded.error) return { success: false, message: uploaded.error };
      filename = uploaded.filename;
    }
    if (!filename) continue;
    await prisma.$executeRawUnsafe(`
      INSERT INTO web_photos
        (photos_from, ref_id, title, p_date, photo_order, attachment, created_dt, created_ip, created_by, del)
      VALUES
        ('gallery', ${galleryId}, '${escapeSql(photo.title || title)}',
         ${fields.date ? `'${escapeSql(fields.date)}'` : 'NULL'},
         ${i + 1}, '${escapeSql(filename)}',
         NOW(), '${escapeSql(auditCtx.ip)}', '${escapeSql(auditCtx.by)}', 1)
    `);
  }

  await logWebSetup(memberId, audit, PAGE_ADD, 'save');
  return { success: true, message: 'Photo gallery added.', galleryId };
}

export async function loadWebPhotosEdit(_memberId, fields, query, audit) {
  await ensureWebPhotosTables();
  const galleryId = fields.galleryId || query.galleryId ? parseId(fields.galleryId || query.galleryId) : null;

  const galleries = await prisma.$queryRawUnsafe(`
    SELECT G.id, G.n_date, G.title, G.description, G.attachment, G.web_view,
           (SELECT COUNT(*) FROM web_photos P WHERE P.del=1 AND P.ref_id=G.id) AS photo_count
    FROM web_photos_gallery G
    WHERE G.del=1
    ORDER BY G.n_date DESC, G.id DESC
    LIMIT 100
  `);

  let detail = null;
  if (galleryId) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, n_date, title, description, attachment, web_view
      FROM web_photos_gallery WHERE del=1 AND id=${galleryId} LIMIT 1
    `);
    const photos = await prisma.$queryRawUnsafe(`
      SELECT id, title, p_date, photo_order, attachment
      FROM web_photos WHERE del=1 AND ref_id=${galleryId}
      ORDER BY photo_order ASC, id ASC
    `);
    if (rows[0]) {
      detail = {
        ...mapGallery(rows[0]),
        photos: photos.map((p) => ({
          id: p.id,
          title: p.title || '',
          date: p.p_date ? String(p.p_date).slice(0, 10) : '',
          order: p.photo_order,
          attachment: p.attachment || '',
          url: p.attachment ? `/legacy/files/documents/${p.attachment}` : null,
        })),
      };
    }
  }

  await logWebSetup(_memberId, audit, PAGE_EDIT, 'load');
  return {
    success: true,
    galleries: galleries.map(mapGallery),
    galleryId,
    detail,
  };
}

export async function saveWebPhotosEdit(memberId, fields, _query, audit) {
  await ensureWebPhotosTables();
  const galleryId = parseId(fields.galleryId);
  if (!galleryId) return { success: false, message: 'Select a gallery.' };

  const auditCtx = auditFields(memberId, audit);
  const coverFile = fields.files?.find((f) => f.field === 'cover');
  let coverSql = '';
  if (coverFile) {
    const uploaded = await saveLegacyBinaryFile({
      folder: 'documents',
      file: coverFile,
      maxBytes: 5 * 1024 * 1024,
      allowedExt: IMG_EXT,
    });
    if (uploaded.error) return { success: false, message: uploaded.error };
    coverSql = `, attachment='${escapeSql(uploaded.filename)}'`;
  }

  await prisma.$executeRawUnsafe(`
    UPDATE web_photos_gallery SET
      n_date=${fields.date ? `'${escapeSql(fields.date)}'` : 'NULL'},
      title='${escapeSql(fields.title || '')}',
      description='${escapeSql(fields.description || '')}',
      web_view=${fields.webView === false ? 0 : 1},
      updated_dt=NOW(),
      updated_ip='${escapeSql(auditCtx.ip)}',
      updated_by='${escapeSql(auditCtx.by)}'
      ${coverSql}
    WHERE id=${galleryId} AND del=1
  `);

  const photos = Array.isArray(fields.photos) ? fields.photos : [];
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const photoId = parseId(photo.id);
    let filename = photo.attachment || '';
    const file = fields.files?.find((f) => f.field === `photo_${i}`);
    if (file) {
      const uploaded = await saveLegacyBinaryFile({
        folder: 'documents',
        file,
        maxBytes: 5 * 1024 * 1024,
        allowedExt: IMG_EXT,
      });
      if (uploaded.error) return { success: false, message: uploaded.error };
      filename = uploaded.filename;
    }

    if (photoId) {
      const attachSql = filename ? `, attachment='${escapeSql(filename)}'` : '';
      await prisma.$executeRawUnsafe(`
        UPDATE web_photos SET
          title='${escapeSql(photo.title || '')}',
          photo_order=${Number(photo.order) || i + 1}
          ${attachSql},
          updated_dt=NOW(),
          updated_ip='${escapeSql(auditCtx.ip)}',
          updated_by='${escapeSql(auditCtx.by)}'
        WHERE id=${photoId} AND del=1
      `);
    } else if (filename) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO web_photos
          (photos_from, ref_id, title, p_date, photo_order, attachment, created_dt, created_ip, created_by, del)
        VALUES
          ('gallery', ${galleryId}, '${escapeSql(photo.title || fields.title || '')}',
           ${fields.date ? `'${escapeSql(fields.date)}'` : 'NULL'},
           ${Number(photo.order) || i + 1}, '${escapeSql(filename)}',
           NOW(), '${escapeSql(auditCtx.ip)}', '${escapeSql(auditCtx.by)}', 1)
      `);
    }
  }

  await logWebSetup(memberId, audit, PAGE_EDIT, 'save');
  return { success: true, message: 'Photo gallery updated.' };
}
