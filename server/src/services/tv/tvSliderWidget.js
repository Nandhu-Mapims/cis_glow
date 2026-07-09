import { prisma } from '../../config/prisma.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';

const PAGE = 'tv/tv_slider_widget.php';

export async function loadTvSliderWidget(memberId, _fields = {}, audit = {}) {
  const widgets = await prisma.tv_setup_tb.findMany({
    where: { del: 1 },
    orderBy: { id: 'asc' },
  });
  await logModulePage(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    widgets: widgets.map((w) => ({
      id: w.id,
      name: w.widget_name,
      content: w.widget_content,
      bgImage: w.bg_image,
      bgColor: w.bg_color,
      slideEffect: w.slide_effect,
      slideDelay: w.slide_delay,
    })),
    form: { name: '', content: '', bgImage: '', bgColor: '#ffffff', slideEffect: 'fade', slideDelay: '5000' },
  };
}

export async function saveTvSliderWidget(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  if (payload.action === 'delete') {
    await prisma.tv_setup_tb.update({
      where: { id: Number(payload.id) },
      data: { del: 0, ...update },
    });
    await logModulePage(PAGE, 'Delete', 'Successful', String(payload.id), memberId, audit);
    return { success: true, message: 'Widget deleted...', ...(await loadTvSliderWidget(memberId, {}, { ...audit, skipLog: true })) };
  }

  const data = {
    widget_name: String(payload.name || '').trim(),
    widget_content: String(payload.content || ''),
    bg_image: String(payload.bgImage || ''),
    bg_color: String(payload.bgColor || '#ffffff'),
    slide_effect: String(payload.slideEffect || 'fade'),
    slide_delay: String(payload.slideDelay || '5000'),
    title_color: '#000000',
    stitle_color: '#333333',
    text_color: '#000000',
    stext_color: '#666666',
    font_size: '14',
  };

  if (payload.id) {
    await prisma.tv_setup_tb.update({ where: { id: Number(payload.id) }, data: { ...data, ...update } });
  } else {
    await prisma.tv_setup_tb.create({ data: { ...data, ...create } });
  }

  await logModulePage(PAGE, 'Update', 'Successful', data.widget_name, memberId, audit);
  return { success: true, message: 'Widget saved...', ...(await loadTvSliderWidget(memberId, {}, { ...audit, skipLog: true })) };
}
