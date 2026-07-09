import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';

const PAGE = 'slider_widget.php';

function mapSlide(row) {
  return {
    id: row.id,
    intervalSec: row.interval_sec ?? 5,
    objectType: row.object_type || 'image',
    imageName: row.image_name || '',
    orderNo: row.order_no ?? 0,
    widgetEnable: row.widget_enable === 1,
    imageEnable: row.image_enable === 1,
    contentEnable: row.content_enable === 1,
    bgColor: row.bg_color || '#ffffff',
    foreColor: row.fore_color || '#000000',
    contentLink: row.content_link || '',
    contentTitle: row.content_title || '',
    contentMessage: row.content_message || '',
  };
}

export async function loadKioskSlider(memberId, _fields, audit = {}) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, interval_sec, object_type, image_name, order_no, widget_enable, image_enable,
           content_enable, bg_color, fore_color, content_link, content_title, content_message
    FROM slider_animation_tb WHERE del != 0 ORDER BY order_no ASC LIMIT 7
  `);
  await logModulePage(PAGE, 'View', 'Successful', '', memberId, audit);
  return { success: true, slides: rows.map(mapSlide) };
}

export async function saveKioskSlider(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);
  const slides = Array.isArray(payload.slides) ? payload.slides : [];
  for (const slide of slides) {
    const id = Number(slide.id);
    if (!id) continue;
    await prisma.$executeRawUnsafe(`
      UPDATE slider_animation_tb SET
        interval_sec=${Number(slide.intervalSec) || 5},
        object_type='${escapeSql(slide.objectType || 'image')}',
        image_name='${escapeSql(slide.imageName || '')}',
        order_no=${Number(slide.orderNo) || 0},
        widget_enable=${slide.widgetEnable ? 1 : 0},
        image_enable=${slide.imageEnable ? 1 : 0},
        content_enable=${slide.contentEnable ? 1 : 0},
        bg_color='${escapeSql(slide.bgColor || '#ffffff')}',
        fore_color='${escapeSql(slide.foreColor || '#000000')}',
        content_link='${escapeSql(slide.contentLink || '')}',
        content_title='${escapeSql(slide.contentTitle || '')}',
        content_message='${escapeSql(slide.contentMessage || '')}',
        updated_dt=NOW(), updated_ip='${escapeSql(update.updated_ip)}',
        updated_by='${escapeSql(memberId)}'
      WHERE id=${id}
    `);
  }
  await logModulePage(PAGE, 'Update', 'Successful', '', memberId, audit);
  return { success: true, message: 'Slider updated.', ...(await loadKioskSlider(memberId, {}, { ...audit, skipLog: true })) };
}

const STYLE_PAGE = 'slider_widget_edit.php';

export async function loadKioskSliderStyle(memberId, _fields, audit = {}) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, content_script, content_js, content_style
    FROM slider_widget_style WHERE id=1 LIMIT 1
  `);
  const row = rows[0] || {};
  await logModulePage(STYLE_PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    success: true,
    form: {
      contentScript: row.content_script || '',
      contentJs: row.content_js || '',
      contentStyle: row.content_style || '',
    },
  };
}

export async function saveKioskSliderStyle(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);
  await prisma.$executeRawUnsafe(`
    UPDATE slider_widget_style SET
      content_script='${escapeSql(payload.contentScript || '')}',
      content_js='${escapeSql(payload.contentJs || '')}',
      content_style='${escapeSql(payload.contentStyle || '')}',
      updated_dt=NOW(), updated_ip='${escapeSql(update.updated_ip)}',
      updated_by='${escapeSql(memberId)}'
    WHERE id=1
  `);
  await logModulePage(STYLE_PAGE, 'Update', 'Successful', '', memberId, audit);
  return { success: true, message: 'Widget style saved.', ...(await loadKioskSliderStyle(memberId, {}, { ...audit, skipLog: true })) };
}
