import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { config } from '../../config/index.js';

// Native rewrite of legacy-bridge/colage_generate_bridge.php + colage_generate_core.inc.php,
// a GD-based photo-grid ("collage") generator for ID cards / group sheets.
// Ports the same layout math (row/column grid, optional merge-box larger cells,
// optional name-label overlay, optional template frame overlay) onto sharp.
//
// NOT byte-identical to the GD output (different rasterizer), but same layout,
// same photo source resolution order (student then staff), same defaults.

const FONT_PATH = path.join(config.legacyCisPath, 'FreeSansBold.ttf');
const FONT_FAMILY = 'FreeSansBold';

function hexToRgb(color) {
  const clean = String(color || '').replace(/[^0-9A-Fa-f]/g, '').padEnd(6, '0').slice(0, 6);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

async function getPerson(aNo) {
  const id = String(aNo || '').trim();
  if (!id) return null;

  const studentRows = await prisma.$queryRawUnsafe(
    `SELECT register_no AS id, student_name AS name, student_initial AS initial
     FROM student_profile_tb WHERE register_no = '${escapeSql(id)}' AND del = 1 LIMIT 1`,
  );
  if (studentRows.length) {
    const row = studentRows[0];
    return { id: row.id, name: `${row.name || ''} ${row.initial || ''}`.trim(), type: 'student_idcard' };
  }

  const staffRows = await prisma.$queryRawUnsafe(
    `SELECT staff_id AS id, staff_name AS name, staff_initial AS initial
     FROM staff_profile_tb WHERE staff_id = '${escapeSql(id)}' AND del = 1 LIMIT 1`,
  );
  if (staffRows.length) {
    const row = staffRows[0];
    return { id: row.id, name: `${row.name || ''} ${row.initial || ''}`.trim(), type: 'staff_idcard' };
  }

  return null;
}

/** Parses "(1,2,3)(4,5,6)" merge-box syntax into { cellNumber -> boxIndex } plus per-box cell lists. */
function parseMergeBox(mergeBox) {
  const boxes = [];
  const cellToBox = new Map();
  if (!mergeBox) return { boxes, cellToBox };

  const groups = mergeBox.split(')').map((s) => s.replace(/^\(/, '').trim()).filter(Boolean);
  groups.forEach((group, index) => {
    const cells = group.split(',').map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n) && n > 0);
    if (!cells.length) return;
    const boxIndex = boxes.length;
    boxes.push({ cells });
    cells.forEach((cell) => cellToBox.set(cell, boxIndex));
  });
  return { boxes, cellToBox };
}

function mergeDimensions(mergeBox, columnCount, photoWidth, photoHeight, photoMargin) {
  const { boxes } = parseMergeBox(mergeBox);
  if (!boxes.length || columnCount < 1) return { width: 0, height: 0 };
  const cells = boxes[0].cells;
  const rows = cells.map((cell) => Math.ceil(cell / columnCount) - 1);
  const cols = cells.map((cell) => (cell - 1) % columnCount);
  const mergeRows = Math.max(...rows) - Math.min(...rows) + 1;
  const mergeCols = Math.max(...cols) - Math.min(...cols) + 1;
  return {
    width: mergeCols * photoWidth + mergeCols * photoMargin * 2,
    height: mergeRows * photoHeight + mergeRows * photoMargin * 2,
  };
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadTemplateBuffer(templateId, width, height) {
  if (!templateId || width <= 0 || height <= 0) return null;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT image_filename FROM colage_image_tb WHERE id = '${escapeSql(String(templateId))}' AND del = 1 LIMIT 1`,
  );
  const filename = rows[0]?.image_filename;
  if (!filename) return null;
  const templatePath = path.join(config.legacyFilesPath, 'cage', 'cimg', filename);
  if (!(await fileExists(templatePath))) return null;
  return sharp(templatePath).resize(width, height, { fit: 'fill' }).png().toBuffer();
}

function nameOverlaySvg(text, width, fontSize, color) {
  const escaped = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return Buffer.from(
    `<svg width="${width}" height="${fontSize + 8}" xmlns="http://www.w3.org/2000/svg">
      <style>text { font-family: '${FONT_FAMILY}', sans-serif; font-weight: bold; }</style>
      <text x="50%" y="${fontSize}" font-size="${fontSize}" fill="#${color}" text-anchor="middle">${escaped}</text>
    </svg>`,
  );
}

async function photoCell({
  personPath, width, height, bgColor, templateBuffer,
}) {
  const bg = hexToRgb(bgColor);
  let cell = sharp({
    create: {
      width, height, channels: 4, background: { ...bg, alpha: 1 },
    },
  });
  const overlays = [];
  if (await fileExists(personPath)) {
    const photo = await sharp(personPath).resize(width, height, { fit: 'fill' }).png().toBuffer();
    overlays.push({ input: photo, left: 0, top: 0 });
  }
  if (templateBuffer) {
    overlays.push({ input: templateBuffer, left: 0, top: 0 });
  }
  if (overlays.length) cell = cell.composite(overlays);
  return cell.png().toBuffer();
}

export async function generateCollageImage(memberId, fields = {}) {
  const searchByANo = String(fields.search_by_a_no || '').trim();
  if (!searchByANo) {
    return { error: 'Enter register / staff numbers (comma separated).' };
  }

  const photoWidth = Number(fields.photo_width) || 250;
  const photoHeight = Number(fields.photo_height) || 240;
  const photoBgcolor = fields.photo_bgcolor || 'FFFFFF';
  const photoMargin = Number(fields.photo_margin) || 5;
  const templateId = fields.template_id || '';
  const rowCount = Math.max(1, Number(fields.row_count) || 6);
  const columnCount = Math.max(1, Number(fields.column_count) || 6);

  const mergeANo = fields.merge_a_no || '';
  const mergeBox = fields.merge_box || '';
  let mWidth = Number(fields.m_width) || 0;
  let mHeight = Number(fields.m_height) || 0;
  const mBgcolor = fields.m_bgcolor || 'FFFFFF';
  const mTemplateId = fields.m_template_id || '';

  if (mergeBox && (mWidth <= 0 || mHeight <= 0)) {
    const auto = mergeDimensions(mergeBox, columnCount, photoWidth, photoHeight, photoMargin);
    if (mWidth <= 0) mWidth = auto.width;
    if (mHeight <= 0) mHeight = auto.height;
  }

  const nameEnable = fields.name_enable && fields.name_enable !== '0';
  const nameSize = Number(fields.name_size) || 14;
  const nameHeight = Number(fields.name_height) || 25;
  const nameColor = fields.name_color || '333333';

  const mNameEnable = fields.m_name_enable && fields.m_name_enable !== '0';
  const mNameSize = Number(fields.m_name_size) || 25;
  const mNameHeight = Number(fields.m_name_height) || 30;
  const mNameColor = fields.m_name_color || '333333';

  const { cellToBox, boxes } = parseMergeBox(mergeBox);
  const mergeAnoList = mergeANo.split(',');
  boxes.forEach((box, index) => { box.ano = (mergeAnoList[index] || '').trim(); box.filled = false; });

  const templateBuffer = await loadTemplateBuffer(templateId, photoWidth, photoHeight);
  const mTemplateBuffer = await loadTemplateBuffer(mTemplateId, mWidth, mHeight);

  const totalWidth = columnCount * photoWidth + columnCount * photoMargin * 2;
  const totalHeight = rowCount * photoHeight + rowCount * photoMargin * 2 + rowCount * nameHeight;

  const composites = [];
  let outX = photoMargin;
  let outY = photoMargin;
  let rCount = 0;
  let sCount = 0;
  const totalCells = columnCount * rowCount;
  const aNoList = searchByANo.split(',');

  for (let c = 0; c < totalCells; c += 1) {
    let rowIncrement = 0;
    let filled = false;
    const boxIndex = cellToBox.get(rCount + 1);

    if (boxIndex !== undefined) {
      filled = true;
      const box = boxes[boxIndex];
      if (!box.filled && mWidth > 0 && mHeight > 0) {
        box.filled = true;
        rowIncrement = 1;
        // eslint-disable-next-line no-await-in-loop
        const person = await getPerson(box.ano);
        if (person) {
          const personPath = path.join(config.legacyFilesPath, person.type, `${person.id}.png`);
          // eslint-disable-next-line no-await-in-loop
          if (await fileExists(personPath)) {
            // eslint-disable-next-line no-await-in-loop
            const cellBuffer = await photoCell({
              personPath, width: mWidth, height: mHeight, bgColor: mBgcolor, templateBuffer: mTemplateBuffer,
            });
            composites.push({ input: cellBuffer, left: outX, top: outY });
            if (mNameEnable && person.name) {
              composites.push({
                input: nameOverlaySvg(person.name, mWidth, mNameSize, mNameColor),
                left: outX,
                top: outY + mHeight,
              });
            }
          }
        }
      }
    }

    if (!filled) {
      const aNo = (aNoList[sCount] || '').trim();
      // eslint-disable-next-line no-await-in-loop
      const person = await getPerson(aNo);
      if (person) {
        const personPath = path.join(config.legacyFilesPath, person.type, `${person.id}.png`);
        // eslint-disable-next-line no-await-in-loop
        if (await fileExists(personPath)) {
          rowIncrement = 1;
          // eslint-disable-next-line no-await-in-loop
          const cellBuffer = await photoCell({
            personPath, width: photoWidth, height: photoHeight, bgColor: photoBgcolor, templateBuffer,
          });
          composites.push({ input: cellBuffer, left: outX, top: outY });
          if (nameEnable && person.name) {
            composites.push({
              input: nameOverlaySvg(person.name, photoWidth, nameSize, nameColor),
              left: outX,
              top: outY + photoHeight,
            });
          }
        }
      }
      sCount += 1;
    } else {
      rowIncrement = 1;
    }

    if (rowIncrement === 1) {
      outX += photoWidth + photoMargin * 2;
      rCount += 1;
      if (rCount % columnCount === 0) {
        outX = photoMargin;
        outY += photoHeight + nameHeight + photoMargin * 2;
      }
    }
  }

  const outputDir = path.join(config.legacyFilesPath, 'cage', 'output');
  await fs.mkdir(outputDir, { recursive: true });
  const filename = `col${Date.now()}.jpg`;
  const finalOutput = path.join(outputDir, filename);

  let canvas = sharp({
    create: {
      width: totalWidth, height: totalHeight, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  });
  if (composites.length) canvas = canvas.composite(composites);
  await canvas.jpeg({ quality: 99 }).toFile(finalOutput);

  return {
    filename,
    outputUrl: `/legacy/files/cage/output/${encodeURIComponent(filename)}`,
  };
}
