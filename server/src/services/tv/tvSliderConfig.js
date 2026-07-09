import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/index.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { TV_SLIDE_EFFECTS } from './tvSliderEffects.js';

const PAGE = 'tv_slider_config.php';
const SLIDER_CSS_PATH = () => path.join(config.legacyCisPath, 'tv/css/slider.css');
const SLIDER_IMG_DIR = () => path.join(config.legacyCisPath, 'tv/img/slider');

function stripHash(value) {
  return String(value || '').replace(/^#/, '').trim();
}

function parseFontSizes(fontSize) {
  const parts = String(fontSize || '').split(',');
  return {
    titleSize: parts[0] || '30',
    stitleSize: parts[1] || '20',
    textSize: parts[2] || '16',
    stextSize: parts[3] || '14',
  };
}

function formatFontSizes(row) {
  return [
    row.titleSize || '30',
    row.stitleSize || '20',
    row.textSize || '16',
    row.stextSize || '14',
  ].join(',');
}

function mapWidgetRow(row) {
  const sizes = parseFontSizes(row.font_size);
  const bgImage = row.bg_image || '';
  return {
    id: Number(row.id),
    name: row.widget_name || '',
    bgImage,
    bgImageUrl: bgImage ? `/legacy/tv/img/slider/${bgImage}` : '',
    bgColor: stripHash(row.bg_color),
    titleColor: stripHash(row.title_color),
    stitleColor: stripHash(row.stitle_color),
    textColor: stripHash(row.text_color),
    stextColor: stripHash(row.stext_color),
    ...sizes,
    slideEffect: row.slide_effect || 'parallaxtobottom',
    slideDelay: row.slide_delay || '9',
  };
}

function cssColor(value, fallback) {
  const color = stripHash(value) || fallback;
  return `#${color}`;
}

function buildSliderCss(widgets) {
  return widgets.map((w) => {
    const bgColor = stripHash(w.bgColor) || 'ff3100';
    const titleColor = stripHash(w.titleColor) || 'F4F4F4';
    const stitleColor = stripHash(w.stitleColor) || 'EEEEEE';
    const textColor = stripHash(w.textColor) || 'FFFFFF';
    const stextColor = stripHash(w.stextColor) || 'FFFFFF';
    const titleSize = Number(w.titleSize) || 30;
    const stitleSize = Number(w.stitleSize) || 20;
    const textSize = Number(w.textSize) || 16;
    const stextSize = Number(w.stextSize) || 14;
    const bgStyle = w.bgImage
      ? 'background:transparent;'
      : `background:#${bgColor};`;

    return `
.tv_con_${w.id} { ${bgStyle} height:900px; }
.tv_con_${w.id} .tv_title1 { color:${cssColor(titleColor, 'F4F4F4')}; font-size:${titleSize}px; line-height:${titleSize + 2}px; }
.tv_con_${w.id} .tv_title2 { color:${cssColor(stitleColor, 'EEEEEE')}; font-size:${stitleSize}px; line-height:${stitleSize + 2}px; }
.tv_con_${w.id} .tv_text1 { color:${cssColor(textColor, 'FFFFFF')}; font-size:${textSize}px; line-height:${textSize + 2}px; }
.tv_con_${w.id} .tv_text2 { color:${cssColor(stextColor, 'FFFFFF')}; font-size:${stextSize}px; line-height:${stextSize + 2}px; }
`;
  }).join('');
}

async function loadWidgetRows() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, widget_name, bg_image, bg_color, title_color, stitle_color, text_color, stext_color,
           font_size, slide_effect, slide_delay
    FROM tv_setup_tb
    WHERE del = 1
    ORDER BY widget_name ASC
  `);
  return rows.map(mapWidgetRow);
}

async function saveUploadedBgImage(file) {
  if (!file?.data) return '';
  const ext = String(file.name || '').split('.').pop()?.toLowerCase() || 'jpg';
  const filename = `${Date.now()}${Math.floor(1000 + Math.random() * 9000)}.${ext}`;
  await fs.mkdir(SLIDER_IMG_DIR(), { recursive: true });
  const raw = String(file.data).includes(',') ? String(file.data).split(',')[1] : String(file.data);
  await fs.writeFile(path.join(SLIDER_IMG_DIR(), filename), Buffer.from(raw, 'base64'));
  return filename;
}

export async function loadTvSliderConfig(memberId, _fields = {}, audit = {}) {
  const widgets = await loadWidgetRows();
  await logModulePage(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    widgets,
    slideEffects: TV_SLIDE_EFFECTS,
  };
}

export async function saveTvSliderConfig(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);
  const rows = Array.isArray(payload.widgets) ? payload.widgets : [];
  const files = Array.isArray(payload.files) ? payload.files : [];
  const fileByField = new Map(files.map((f) => [f.field, f]));

  if (!rows.length) {
    return { success: false, message: 'No widgets to update' };
  }

  const savedRows = [];
  for (const row of rows) {
    const id = Number(row.id);
    if (!id) continue;

    let bgImage = String(row.bgImage || '').trim();
    if (row.removeBgImage) {
      bgImage = '';
    } else {
      const upload = fileByField.get(`bgImage_${id}`);
      if (upload) {
        bgImage = await saveUploadedBgImage(upload);
      }
    }

    const data = {
      bg_image: bgImage,
      bg_color: stripHash(row.bgColor),
      title_color: stripHash(row.titleColor),
      stitle_color: stripHash(row.stitleColor),
      text_color: stripHash(row.textColor),
      stext_color: stripHash(row.stextColor),
      font_size: formatFontSizes(row),
      slide_effect: String(row.slideEffect || ''),
      slide_delay: String(row.slideDelay || ''),
      ...update,
    };

    await prisma.tv_setup_tb.update({ where: { id }, data });
    savedRows.push({ ...row, bgImage });
  }

  await fs.mkdir(path.dirname(SLIDER_CSS_PATH()), { recursive: true });
  await fs.writeFile(SLIDER_CSS_PATH(), buildSliderCss(savedRows), 'utf8');

  await logModulePage(PAGE, 'Update', 'Successful', String(savedRows.length), memberId, audit);
  return {
    success: true,
    message: 'Style updated.',
    ...(await loadTvSliderConfig(memberId, {}, { ...audit, skipLog: true })),
  };
}
