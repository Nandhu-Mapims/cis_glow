import fs from 'fs/promises';
import path from 'path';
import QRCode from 'qrcode';
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/index.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { alumniPhotoUrl, escapeHtml } from './studentShared.js';

const FRONT_BG = '/legacy/files/certificate/AASSET_idcard_front_bg.jpg';
const BACK_BG = '/legacy/files/certificate/AASSET_id_card_back_bg.jpg';

function isEnabledFlag(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (value === false || value === 0 || value === '0') return false;
  return Boolean(value);
}

function toTitleCaseName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function formatYearDisplay(yop) {
  const value = String(yop || '');
  if (!value) return '';
  return `${value.slice(0, 5)}${value.slice(-4)}`;
}

function formatDobDisplay(dob) {
  const text = String(dob || '');
  if (!text || text.startsWith('0000-00-00')) return '';
  const [year, month, day] = text.slice(0, 10).split('-');
  if (!year || !month || !day) return '';
  return `${day}-${month}-${year}`;
}

function formatMobileDisplay(mobile) {
  const value = String(mobile || '').trim();
  return value === '-' ? '' : value;
}

function buildNameHtml(name, courseName) {
  const displayName = toTitleCaseName(name);
  const length = displayName.length;
  let fontSize = 30;
  if (length < 14) fontSize = 43;
  else if (length < 20) fontSize = 40;
  else if (length < 24) fontSize = 35;

  const nameTitle = courseName === 'P.G'
    ? '<span style="font-size: 30px; text-transform: none;">Dr. </span>'
    : '';

  return `${nameTitle}<span style="font-size:${fontSize}px">${escapeHtml(displayName)}</span>`;
}

async function loadCourseDetails(courseId) {
  if (!courseId) return null;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, course_name, degree_name, department_name
     FROM basic_setup_course_tb WHERE del=1 AND id='${escapeSql(String(courseId))}' LIMIT 1`,
  );
  return rows[0] || null;
}

async function buildQrImage(registerNo, name, yop) {
  const qrData = `Membership.No.: ${registerNo} \n Name: ${name} \n Year: ${formatYearDisplay(yop)} `;
  const qrDir = path.join(config.legacyCisPath, 'files', 'qr', 'alumni_qr_img');
  await fs.mkdir(qrDir, { recursive: true });
  const filePath = path.join(qrDir, `${registerNo}.png`);
  try {
    await QRCode.toFile(filePath, qrData, { width: 320, margin: 1 });
    return `/legacy/files/qr/alumni_qr_img/${encodeURIComponent(registerNo)}.png`;
  } catch {
    return QRCode.toDataURL(qrData, { width: 320, margin: 1 });
  }
}

function buildFrontCard({
  photoUrl,
  registerNo,
  name,
  yop,
  degreeName,
  courseName,
  dob,
  mobile,
}) {
  const photoHtml = `<img src="${escapeHtml(photoUrl)}" width="100%" height="100%" style="position: absolute;bottom: -10%;" alt="" />`;
  return `
<div id="idcard">
  <div id="id_container">
    <img src="${FRONT_BG}" height="685" width="1063" alt="" />
    <div id="photo_div">${photoHtml}</div>
    <div id="name">
      <h2 class="id_student_name">NAME: ${buildNameHtml(name, courseName)}</h2>
      <h4 class="emp_id">Membership No: ${escapeHtml(registerNo)}</h4>
      <h4 class="emp_id">Year: ${escapeHtml(formatYearDisplay(yop))}</h4>
      <h4 class="emp_id">Degree: ${escapeHtml(degreeName || '')}</h4>
      <h4 class="emp_id">Date of Birth: ${escapeHtml(formatDobDisplay(dob))}</h4>
      <h4 class="emp_id">Mobile: ${escapeHtml(formatMobileDisplay(mobile))}</h4>
    </div>
  </div>
</div>`;
}

function buildBackCard(qrImageUrl) {
  const qrHtml = `<img src="${escapeHtml(qrImageUrl)}" width="320" height="310" alt="" />`;
  return `
<div id="idcard">
  <div id="id_container">
    <img src="${BACK_BG}" height="685" width="1063" style="position:absolute;" alt="" />
    <div style="float: right;padding-right: 30px;padding-top: 57px;position: absolute;top: 133px;left: 555px;">${qrHtml}</div>
  </div>
</div>`;
}

export async function buildAlumniIdCardHtml(row, options = {}) {
  const frontEnable = isEnabledFlag(options.frontEnable, true);
  const backEnable = isEnabledFlag(options.backEnable, true);
  const photoUrl = await alumniPhotoUrl(row.alumni_regno, row.alumni_file);
  if (!photoUrl) return '';

  const course = await loadCourseDetails(row.alumni_dept);
  const courseName = course?.course_name || '';
  let degreeName = course?.degree_name || row.alumni_course || '';
  const deptName = String(course?.department_name || '').trim();
  if (deptName && deptName !== '-') {
    degreeName = `${degreeName} - ${deptName}`;
  }

  const registerNo = String(row.alumni_regno || '').trim();
  const name = String(row.alumni_name || '').trim();
  const yop = row.alumni_yop || '';
  const dob = row.alumni_dob || '';
  const mobile = row.alumni_mobile || '';

  const parts = [];
  if (frontEnable) {
    parts.push(buildFrontCard({
      photoUrl,
      registerNo,
      name,
      yop,
      degreeName,
      courseName,
      dob,
      mobile,
    }));
  }
  if (backEnable) {
    const qrImageUrl = await buildQrImage(registerNo, name, yop);
    parts.push(buildBackCard(qrImageUrl));
  }
  return parts.join('\n');
}

export async function buildAlumniIdCardReport(rows, options = {}) {
  const cards = [];
  let rowFoundCount = 1;
  const frontEnable = isEnabledFlag(options.frontEnable, true);
  const backEnable = isEnabledFlag(options.backEnable, true);

  for (const row of rows) {
    const cardHtml = await buildAlumniIdCardHtml(row, { frontEnable, backEnable });
    if (!cardHtml) continue;

    if (frontEnable && backEnable) {
      if (rowFoundCount % 4 === 0) {
        cards.push('<div style="page-break-before:always">&nbsp;</div>');
      }
    } else if (rowFoundCount % 9 === 0) {
      cards.push('<div style="page-break-before:always">&nbsp;</div>');
    }

    cards.push(cardHtml);
    rowFoundCount += 1;
  }

  if (!cards.length) {
    return {
      count: 0,
      reportHtml: '<p class="text-muted mb-0">No alumni with ID card photos found for the selected criteria.</p>',
    };
  }

  const body = `
<link rel="stylesheet" href="/legacy/css/alumni_id_card.css" />
<div class="cis-alumni-idcard-sheet">${cards.join('')}</div>`;

  return { count: cards.length, reportHtml: body };
}

export function parseAlumniIdCardOptions(fields = {}) {
  return {
    frontEnable: isEnabledFlag(fields.front_enable, true),
    backEnable: isEnabledFlag(fields.back_enable, true),
  };
}
