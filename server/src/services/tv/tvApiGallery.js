import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';

const PAGE = 'tv_api_gallery.php';

function mapGallery(row) {
  return {
    id: row.id,
    title: row.title || '',
    fromDate: row.from_date ? String(row.from_date).slice(0, 16).replace('T', ' ') : '',
    toDate: row.to_date ? String(row.to_date).slice(0, 16).replace('T', ' ') : '',
    itemCount: Number(row.item_count ?? 0),
  };
}

export async function loadTvApiGallery(memberId, fields = {}, audit = {}) {
  const galleryId = fields.galleryId ? parseId(fields.galleryId) : null;
  const galleries = await prisma.$queryRawUnsafe(`
    SELECT G.id, G.title, G.from_date, G.to_date,
           (SELECT COUNT(*) FROM web_photo P WHERE P.del=1 AND P.ref_id=CAST(G.id AS CHAR) AND P.g_type='api') AS item_count
    FROM web_api_gallery G
    WHERE G.del=1
    ORDER BY G.from_date DESC, G.id DESC
    LIMIT 100
  `);

  let detail = null;
  if (galleryId) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, title, from_date, to_date FROM web_api_gallery WHERE del=1 AND id=${galleryId} LIMIT 1
    `);
    const items = await prisma.$queryRawUnsafe(`
      SELECT id, attachment, photo_order, from_time, to_time
      FROM web_photo WHERE del=1 AND ref_id='${galleryId}' AND g_type='api'
      ORDER BY photo_order ASC, id ASC
    `);
    if (rows[0]) {
      detail = {
        ...mapGallery(rows[0]),
        items: items.map((p) => ({
          id: p.id,
          apiUrl: p.attachment || '',
          order: p.photo_order,
          fromTime: p.from_time || '',
          toTime: p.to_time || '',
        })),
      };
    }
  }

  await logModulePage(PAGE, 'View', 'Successful', '', memberId, audit);
  return { galleries: galleries.map(mapGallery), galleryId, detail };
}

export async function saveTvApiGallery(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  const title = String(payload.title || '').trim();
  if (!title) return { success: false, message: 'Title is required.' };

  const fromDate = payload.fromDate ? `'${escapeSql(payload.fromDate)}'` : 'NULL';
  const toDate = payload.toDate ? `'${escapeSql(payload.toDate)}'` : 'NULL';
  let galleryId = payload.galleryId ? parseId(payload.galleryId) : null;

  if (payload.action === 'delete' && galleryId) {
    await prisma.$executeRawUnsafe(`UPDATE web_api_gallery SET del=0, updated_dt=NOW() WHERE id=${galleryId}`);
    await prisma.$executeRawUnsafe(`UPDATE web_photo SET del=0, updated_dt=NOW() WHERE ref_id='${galleryId}' AND g_type='api'`);
    await logModulePage(PAGE, 'Delete', 'Successful', String(galleryId), memberId, audit);
    return { success: true, message: 'API gallery deleted.' };
  }

  if (galleryId) {
    await prisma.$executeRawUnsafe(`
      UPDATE web_api_gallery SET title='${escapeSql(title)}', from_date=${fromDate}, to_date=${toDate},
        updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
      WHERE id=${galleryId} AND del=1
    `);
  } else {
    await prisma.$executeRawUnsafe(`
      INSERT INTO web_api_gallery (title, from_date, to_date, created_dt, created_ip, created_by, del)
      VALUES ('${escapeSql(title)}', ${fromDate}, ${toDate}, NOW(),
        '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)
    `);
    const idRows = await prisma.$queryRawUnsafe('SELECT LAST_INSERT_ID() AS id');
    galleryId = Number(idRows[0]?.id);
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  await prisma.$executeRawUnsafe(`
    UPDATE web_photo SET del=0, updated_dt=NOW()
    WHERE ref_id='${galleryId}' AND g_type='api' AND del=1
  `);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const apiUrl = String(item.apiUrl || '').trim();
    if (!apiUrl) continue;
    const itemId = item.id ? parseId(item.id) : null;
    if (itemId) {
      await prisma.$executeRawUnsafe(`
        UPDATE web_photo SET del=1, title='${escapeSql(title)}',
          attachment='${escapeSql(apiUrl)}', photo_order=${Number(item.order) || i + 1},
          from_time='${escapeSql(item.fromTime || '')}', to_time='${escapeSql(item.toTime || '')}',
          updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
        WHERE id=${itemId}
      `);
    } else {
      await prisma.$executeRawUnsafe(`
        INSERT INTO web_photo (ref_id, title, g_type, photo_order, attachment, from_time, to_time,
          created_dt, created_ip, created_by, del)
        VALUES ('${galleryId}', '${escapeSql(title)}', 'api', ${Number(item.order) || i + 1},
          '${escapeSql(apiUrl)}', '${escapeSql(item.fromTime || '')}', '${escapeSql(item.toTime || '')}',
          NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)
      `);
    }
  }

  await logModulePage(PAGE, 'Update', 'Successful', String(galleryId), memberId, audit);
  return {
    success: true,
    message: 'API gallery saved.',
    ...(await loadTvApiGallery(memberId, { galleryId }, { ...audit, skipLog: true })),
  };
}
