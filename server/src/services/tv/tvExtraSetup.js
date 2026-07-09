import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/index.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { listTvVideosRaw } from './tvVideoGallery.js';

const PAGE = 'tv_youtube_gallery.php';

export async function loadTvYoutubeGallery(memberId, _fields = {}, audit = {}) {
  const rows = await listTvVideosRaw();
  rows.sort((a, b) => a.id - b.id);
  await logModulePage(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    videos: rows.map((r) => ({ id: r.id, youtubeId: r.attachment || '' })),
  };
}

export async function saveTvYoutubeGallery(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);
  const videos = Array.isArray(payload.videos) ? payload.videos : [];

  for (const video of videos) {
    const id = parseId(video.id);
    await prisma.$executeRawUnsafe(`
      UPDATE tv_video_tb SET attachment='${escapeSql(String(video.youtubeId || '').trim())}',
        updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
      WHERE id=${id}
    `);
  }

  await logModulePage(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'YouTube IDs updated.',
    ...(await loadTvYoutubeGallery(memberId, {}, { ...audit, skipLog: true })),
  };
}

const LIVE_PAGE = 'tv_live_video.php';

export async function loadTvLiveVideo(memberId, _fields = {}, audit = {}) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, event_title, player_widget, direct_live,
           from_timestamp, to_timestamp, e_option, description, w_image
    FROM live_setup_tb WHERE id=1 LIMIT 1
  `);
  const row = rows[0] || {};
  await logModulePage(LIVE_PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    form: {
      eventTitle: row.event_title || '',
      playerWidget: row.player_widget || '',
      directLive: Number(row.direct_live) === 1,
      fromTimestamp: row.from_timestamp ? String(row.from_timestamp).slice(0, 16).replace('T', ' ') : '',
      toTimestamp: row.to_timestamp ? String(row.to_timestamp).slice(0, 16).replace('T', ' ') : '',
      eOption: Number(row.e_option) || 1,
      description: row.description || '',
      wImage: row.w_image || '',
    },
  };
}

export async function saveTvLiveVideo(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);
  const fromTs = payload.fromTimestamp ? `'${escapeSql(String(payload.fromTimestamp).replace('T', ' '))}'` : 'NULL';
  const toTs = payload.toTimestamp ? `'${escapeSql(String(payload.toTimestamp).replace('T', ' '))}'` : 'NULL';

  let wImage = payload.wImage || '';
  const imageFile = payload.files?.find((f) => f.field === 'wImage');
  if (imageFile?.data) {
    const ext = String(imageFile.name).split('.').pop()?.toLowerCase() || 'jpg';
    const filename = `${Date.now()}${Math.floor(1000 + Math.random() * 9000)}.${ext}`;
    const dir = path.join(config.legacyFilesPath, 'announcement');
    await fs.mkdir(dir, { recursive: true });
    const raw = imageFile.data.includes(',') ? imageFile.data.split(',')[1] : imageFile.data;
    await fs.writeFile(path.join(dir, filename), Buffer.from(raw, 'base64'));
    wImage = filename;
  }

  await prisma.$executeRawUnsafe(`
    UPDATE live_setup_tb SET
      event_title='${escapeSql(payload.eventTitle || '')}',
      player_widget='${escapeSql(payload.playerWidget || '')}',
      direct_live=${payload.directLive ? 1 : 0},
      from_timestamp=${fromTs},
      to_timestamp=${toTs},
      e_option=${Number(payload.eOption) || 1},
      description='${escapeSql(payload.description || '')}',
      w_image='${escapeSql(wImage)}',
      updated_by='${escapeSql(memberId)}',
      updated_ip='${escapeSql(update.updated_ip)}',
      updated_dt=NOW()
    WHERE id=1
  `);

  await logModulePage(LIVE_PAGE, 'Update', 'Successful', '1', memberId, audit);
  return {
    success: true,
    message: 'Live video settings saved.',
    ...(await loadTvLiveVideo(memberId, {}, { ...audit, skipLog: true })),
  };
}

const STYLE_PAGE = 'tv_print_style.php';
const STYLE_PATH = () => path.join(config.legacyCisPath, 'tv/css/style.css');

export async function loadTvPrintStyle(memberId, _fields = {}, audit = {}) {
  let content = '';
  try {
    content = await fs.readFile(STYLE_PATH(), 'utf8');
  } catch {
    content = '';
  }
  await logModulePage(STYLE_PAGE, 'View', 'Successful', '', memberId, audit);
  return { content };
}

export async function saveTvPrintStyle(payload, memberId, audit = {}) {
  await fs.mkdir(path.dirname(STYLE_PATH()), { recursive: true });
  await fs.writeFile(STYLE_PATH(), String(payload.content || ''), 'utf8');
  await logModulePage(STYLE_PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'TV CSS updated.',
    ...(await loadTvPrintStyle(memberId, {}, { ...audit, skipLog: true })),
  };
}
