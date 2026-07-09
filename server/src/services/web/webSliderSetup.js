import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields, logWebSetup } from './webAudit.js';

const PAGE = 'home_slider_widget_edit.php';

function mapRow(row) {
  return {
    id: row.id,
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

export async function loadWebSliderSetup(_memberId, _fields, _query, audit) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, object_type, image_name, order_no, widget_enable, image_enable,
           content_enable, bg_color, fore_color, content_link, content_title, content_message
    FROM slider_animation_tb
    WHERE del != 0
    ORDER BY order_no ASC
    LIMIT 7
  `);
  await logWebSetup(_memberId, audit, PAGE, 'load');
  return { success: true, slides: rows.map(mapRow) };
}

export async function saveWebSliderSetup(memberId, fields, _query, audit) {
  const slides = Array.isArray(fields.slides) ? fields.slides : [];
  const auditCtx = auditFields(memberId, audit);

  for (const slide of slides) {
    const id = Number(slide.id);
    if (!id) continue;
    const widget = slide.widgetEnable ? 1 : 0;
    const imageEn = slide.imageEnable ? 1 : 0;
    const contentEn = slide.contentEnable ? 1 : 0;
    await prisma.$executeRawUnsafe(`
      UPDATE slider_animation_tb SET
        object_type='${escapeSql(slide.objectType || 'image')}',
        image_name='${escapeSql(slide.imageName || '')}',
        order_no=${Number(slide.orderNo) || 0},
        widget_enable=${widget},
        image_enable=${imageEn},
        content_enable=${contentEn},
        bg_color='${escapeSql(slide.bgColor || '#ffffff')}',
        fore_color='${escapeSql(slide.foreColor || '#000000')}',
        content_link='${escapeSql(slide.contentLink || '')}',
        content_title='${escapeSql(slide.contentTitle || '')}',
        content_message='${escapeSql(slide.contentMessage || '')}',
        updated_dt=NOW(),
        updated_ip='${escapeSql(auditCtx.ip)}',
        updated_by='${escapeSql(auditCtx.by)}'
      WHERE id=${id}
    `);
  }

  await logWebSetup(memberId, audit, PAGE, 'save');
  return { success: true, message: 'Slider settings updated.' };
}
