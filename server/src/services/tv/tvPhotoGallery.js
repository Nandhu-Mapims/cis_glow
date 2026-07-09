import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/index.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';

const PAGE = 'tv_photo_gallery.php';
const IMG_EXT = new Set(['jpeg', 'jpg', 'gif', 'png', 'webp']);

async function saveGalleryImage(file) {
  const ext = String(file.name).split('.').pop()?.toLowerCase() || '';
  if (!IMG_EXT.has(ext)) return { error: 'Image file required (jpg, png, gif, webp)' };
  const filename = `${Date.now()}${Math.floor(1000 + Math.random() * 9000)}.${ext}`;
  const dir = path.join(config.legacyImgPath, 'gallery');
  await fs.mkdir(dir, { recursive: true });
  const raw = file.data.includes(',') ? file.data.split(',')[1] : file.data;
  await fs.writeFile(path.join(dir, filename), Buffer.from(raw, 'base64'));
  return { filename, url: `/legacy/img/gallery/${filename}` };
}

function mapGallery(row) {
  return {
    id: row.id,
    title: row.title || '',
    fromDate: row.from_date ? String(row.from_date).slice(0, 16).replace('T', ' ') : '',
    toDate: row.to_date ? String(row.to_date).slice(0, 16).replace('T', ' ') : '',
    photoCount: Number(row.photo_count ?? 0),
  };
}

export async function loadTvPhotoGallery(memberId, fields = {}, audit = {}) {
  const galleryId = fields.galleryId ? parseId(fields.galleryId) : null;
  const galleries = await prisma.$queryRawUnsafe(`
    SELECT G.id, G.title, G.from_date, G.to_date,
           (SELECT COUNT(*) FROM web_photo P WHERE P.del=1 AND P.ref_id=CAST(G.id AS CHAR) AND P.g_type='photo') AS photo_count
    FROM web_photo_gallery G
    WHERE G.del=1
    ORDER BY G.from_date DESC, G.id DESC
    LIMIT 100
  `);

  let detail = null;
  if (galleryId) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, title, from_date, to_date FROM web_photo_gallery WHERE del=1 AND id=${galleryId} LIMIT 1
    `);
    const photos = await prisma.$queryRawUnsafe(`
      SELECT id, title, photo_order, attachment
      FROM web_photo WHERE del=1 AND ref_id='${galleryId}' AND g_type='photo'
      ORDER BY photo_order ASC, id ASC
    `);
    if (rows[0]) {
      detail = {
        ...mapGallery(rows[0]),
        photos: photos.map((p) => ({
          id: p.id,
          order: p.photo_order,
          attachment: p.attachment || '',
          url: p.attachment ? `/legacy/img/gallery/${p.attachment}` : null,
        })),
      };
    }
  }

  await logModulePage(PAGE, 'View', 'Successful', '', memberId, audit);
  return { galleries: galleries.map(mapGallery), galleryId, detail };
}

export async function saveTvPhotoGallery(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  const title = String(payload.title || '').trim();
  if (!title) return { success: false, message: 'Title is required.' };

  const fromDate = payload.fromDate ? `'${escapeSql(payload.fromDate)}'` : 'NULL';
  const toDate = payload.toDate ? `'${escapeSql(payload.toDate)}'` : 'NULL';
  let galleryId = payload.galleryId ? parseId(payload.galleryId) : null;

  if (galleryId) {
    await prisma.$executeRawUnsafe(`
      UPDATE web_photo_gallery SET
        title='${escapeSql(title)}', from_date=${fromDate}, to_date=${toDate},
        updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
      WHERE id=${galleryId} AND del=1
    `);
  } else {
    await prisma.$executeRawUnsafe(`
      INSERT INTO web_photo_gallery (title, from_date, to_date, created_dt, created_ip, created_by, del)
      VALUES ('${escapeSql(title)}', ${fromDate}, ${toDate}, NOW(),
        '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)
    `);
    const idRows = await prisma.$queryRawUnsafe('SELECT LAST_INSERT_ID() AS id');
    galleryId = Number(idRows[0]?.id);
  }

  const photos = Array.isArray(payload.photos) ? payload.photos : [];
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const photoId = photo.id ? parseId(photo.id) : null;
    let attachment = photo.attachment || '';
    const file = payload.files?.find((f) => f.field === `photo_${i}`);
    if (file) {
      const uploaded = await saveGalleryImage(file);
      if (uploaded.error) return { success: false, message: uploaded.error };
      attachment = uploaded.filename;
    }
    if (photoId) {
      const attachSql = attachment ? `, attachment='${escapeSql(attachment)}'` : '';
      await prisma.$executeRawUnsafe(`
        UPDATE web_photo SET del=1, title='${escapeSql(title)}',
          photo_order=${Number(photo.order) || i + 1} ${attachSql},
          updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
        WHERE id=${photoId}
      `);
    } else if (attachment) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO web_photo (ref_id, title, g_type, photo_order, attachment, from_time, to_time,
          created_dt, created_ip, created_by, del)
        VALUES ('${galleryId}', '${escapeSql(title)}', 'photo', ${Number(photo.order) || i + 1},
          '${escapeSql(attachment)}', '', '', NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)
      `);
    }
  }

  if (payload.action === 'delete' && galleryId) {
    await prisma.$executeRawUnsafe(`UPDATE web_photo_gallery SET del=0, updated_dt=NOW() WHERE id=${galleryId}`);
    await prisma.$executeRawUnsafe(`UPDATE web_photo SET del=0, updated_dt=NOW() WHERE ref_id='${galleryId}' AND g_type='photo'`);
    await logModulePage(PAGE, 'Delete', 'Successful', String(galleryId), memberId, audit);
    return { success: true, message: 'Gallery deleted.', galleryId: null };
  }

  await logModulePage(PAGE, 'Update', 'Successful', String(galleryId), memberId, audit);
  return {
    success: true,
    message: 'Photo gallery saved.',
    ...(await loadTvPhotoGallery(memberId, { galleryId }, { ...audit, skipLog: true })),
  };
}
