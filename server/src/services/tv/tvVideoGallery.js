import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';

const PAGE = 'tv_video_gallery.php';

async function listVideos() {
  return prisma.$queryRawUnsafe(`
    SELECT id, attachment, from_time, to_time
    FROM tv_video_tb WHERE del=1 ORDER BY id DESC
  `);
}

export async function loadTvVideoGallery(memberId, _fields = {}, audit = {}) {
  const rows = await listVideos();
  await logModulePage(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    videos: rows.map((r) => ({
      id: r.id,
      attachment: r.attachment,
      fromTime: r.from_time || '',
      toTime: r.to_time || '',
    })),
    form: { attachment: '', fromTime: '', toTime: '' },
  };
}

export async function saveTvVideoGallery(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  if (payload.action === 'delete') {
    await prisma.$executeRawUnsafe(`
      UPDATE tv_video_tb SET del=0, updated_by='${escapeSql(memberId)}',
        updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
      WHERE id=${Number(payload.id)}
    `);
    await logModulePage(PAGE, 'Delete', 'Successful', String(payload.id), memberId, audit);
    return { success: true, message: 'Video removed...', ...(await loadTvVideoGallery(memberId, {}, { ...audit, skipLog: true })) };
  }

  const attachment = String(payload.attachment || '').trim();
  if (!attachment) return { success: false, message: 'Video URL/path is required' };

  if (payload.id) {
    await prisma.$executeRawUnsafe(`
      UPDATE tv_video_tb SET
        attachment='${escapeSql(attachment)}',
        from_time='${escapeSql(String(payload.fromTime || ''))}',
        to_time='${escapeSql(String(payload.toTime || ''))}',
        del=1,
        updated_by='${escapeSql(memberId)}',
        updated_ip='${escapeSql(update.updated_ip)}',
        updated_dt=NOW()
      WHERE id=${Number(payload.id)}
    `);
  } else {
    await prisma.$executeRawUnsafe(`
      INSERT INTO tv_video_tb (attachment, from_time, to_time, created_dt, created_ip, created_by, del)
      VALUES ('${escapeSql(attachment)}', '${escapeSql(String(payload.fromTime || ''))}',
        '${escapeSql(String(payload.toTime || ''))}', NOW(),
        '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1)
    `);
  }

  await logModulePage(PAGE, 'Update', 'Successful', attachment, memberId, audit);
  return { success: true, message: 'Video saved...', ...(await loadTvVideoGallery(memberId, {}, { ...audit, skipLog: true })) };
}

export async function listTvVideosRaw() {
  return listVideos();
}
