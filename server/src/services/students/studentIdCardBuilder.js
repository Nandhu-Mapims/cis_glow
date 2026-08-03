import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config/index.js';
import { escapeHtml } from './studentShared.js';

const CERT = '/legacy/files/certificate';

const FRONT_BG_UG = `${CERT}/ug_idcard_front.jpg`;
const FRONT_BG_PG = `${CERT}/pg_idcard_front.jpg`;
const BACK_BG_UG = `${CERT}/idcard_back.jpg`;
const BACK_BG_PG = `${CERT}/idcard_back_pg.jpg`;
const FRONT_LINE = `${CERT}/idcard_front_line.png`;
const BACK_LINE = `${CERT}/idcard_back_line.png`;
const PRINCIPAL_SIGN = `${CERT}/apdch_principal_sign_new.png`;
const ACCRED_LOGO = `${CERT}/accre_logo.png`;

/** Pre-generated barcode PNG from the legacy app (files/certificate/images/APS<regno>.png). */
export async function studentBarcodeUrl(registerNo) {
  const reg = String(registerNo || '').trim();
  if (!reg) return null;
  const file = path.join(config.legacyFilesPath, 'certificate', 'images', `APS${reg}.png`);
  try {
    await fs.access(file);
    return `${CERT}/images/APS${encodeURIComponent(reg)}.png`;
  } catch {
    return null;
  }
}

function titleCase(name) {
  return String(name || '').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function nameHtml(name, courseName) {
  const displayName = titleCase(name);
  const length = displayName.length;
  let fontSize = 30;
  if (length < 14) fontSize = 43;
  else if (length < 20) fontSize = 40;
  else if (length < 24) fontSize = 35;
  const title = courseName === 'P.G'
    ? '<span style="font-size: 30px; text-transform: none;">Dr. </span>'
    : '';
  return `${title}<span style="font-size:${fontSize}px">${escapeHtml(displayName)}</span>`;
}

function formatAdmittedYear(academicYear) {
  const value = String(academicYear || '');
  if (!value) return '';
  return `${value.slice(0, 5)}${value.slice(-2)}`;
}

function formatDob(dob) {
  const text = String(dob || '');
  if (!text || text.startsWith('0000-00-00')) return '';
  const [year, month, day] = text.slice(0, 10).split('-');
  if (!year || !month || !day) return '';
  return `${day}-${month}-${year}`;
}

/** Address block matching legacy student_id_card.php's concatenation rules exactly. */
function buildAddressHtml({ doorNo, street, post, taluk, district, pincode }) {
  const clean = (v) => String(v || '').trim();
  const doorNoV = clean(doorNo);
  const streetV = clean(street);
  const postV = clean(post);
  const talukV = clean(taluk);
  const districtV = clean(district);
  const pincodeV = clean(pincode);

  let out = '';
  if (doorNoV && doorNoV !== '-') {
    out += doorNoV.endsWith(',') ? `${escapeHtml(doorNoV)} ` : `${escapeHtml(doorNoV)}, `;
  }
  if (streetV && streetV !== '-') {
    out += streetV.endsWith(',') ? `${escapeHtml(streetV)} ` : `${escapeHtml(streetV)}, `;
  }
  if (postV !== talukV) {
    if (postV && postV !== '-') {
      out += postV.endsWith(',') ? `${escapeHtml(postV)} ` : `<br>${escapeHtml(postV)}, `;
    }
    if (talukV && talukV !== '-') {
      out += talukV.endsWith(',') ? `${escapeHtml(talukV)} ` : `${escapeHtml(talukV)}, `;
    }
  } else if (postV && postV !== '-') {
    out += postV.endsWith(',') ? `${escapeHtml(postV)} ` : `<br>${escapeHtml(postV)}, `;
  }
  if (districtV && districtV !== '-') {
    out += districtV.endsWith(',')
      ? `<br>${escapeHtml(districtV.slice(0, -1))} Dist., `
      : `<br>${escapeHtml(districtV)} Dist., `;
  }
  out = out.trim();
  if (out.endsWith(',')) out = out.slice(0, -1);9
  if (pincodeV && pincodeV !== '-' && out !== '') {
    out += `<br>${escapeHtml(pincodeV)}`;
  }
  return out;
}

export function buildStudentIdCardFrontHtml(s) {
  const degreeName = s.degreeName
    ? (s.courseName === 'P.G'
      ? `${escapeHtml(s.degreeName)}${s.departmentName ? `<span style="font-size:21px;">${escapeHtml(s.departmentName)}</span>` : ''}`
      : escapeHtml(s.degreeName))
    : '';
  const frontBg = s.courseName === 'U.G' ? FRONT_BG_UG : FRONT_BG_PG;
  const barcodeImg = s.barcodeUrl ? `<img src="${s.barcodeUrl}" class="barcode" alt="" />` : '';
  const photoImg = `<img src="${s.photoUrl}" width="420" alt="" />`;

  return `<div id="idcard">
<div id="id_container"><img src="${frontBg}" height="1063" width="685" alt="" /><div id="name">
  <h2 class="id_student_name">${nameHtml(s.name, s.courseName)}</h2>
  <h4 class="emp_id">${escapeHtml(s.registerNo)}${degreeName ? ` | ${degreeName}` : ''}</h4>
  ${s.uregisterNo ? `<h4 class="emp_dept">U.Reg.No. ${escapeHtml(s.uregisterNo)}</h4>` : ''}
  <h4 class="valid">Admitted Year ${escapeHtml(formatAdmittedYear(s.academicYear))}</h4>
</div>
<div id="sign2"><table width="100%" height="100%" border="0" cellspacing="0" cellpadding="0"><tbody><tr><td valign="bottom"><img src="${PRINCIPAL_SIGN}" width="150" alt="" /></td></tr></tbody></table></div>
<div id="barcode">
<table width="140%" height="100%" border="0" cellspacing="0" cellpadding="0">
<tbody><tr>
<th scope="col">${barcodeImg}</th>
<th class="trust_name">A unit of Adhiparsakthi <br>Charitable, Medical,<br> Educational &amp; Cultural<br>Trust</th>
</tr></tbody></table>
</div>
<div id="line_layer"><img src="${FRONT_LINE}" alt="" /></div>
<div id="photo_div">${photoImg}</div>
<div id="if_bottom_con">
<table width="110%" height="100%" border="0" cellspacing="0" cellpadding="0">
<tbody><tr>
<th id="accred_image"><img src="${ACCRED_LOGO}" width="300" height="90" alt="" /></th>
<th class="trust_name">Melmaruvathur - 603 319, Chengalpattu Dist.<br>T:+91-44-2752 8082/83 | www.apdch.edu.in<br>E: info@apdch.edu.in</th>
</tr></tbody></table>
</div>
</div></div>`;
}

export function buildStudentIdCardBackHtml(s) {
  const backBg = s.courseName === 'U.G' ? BACK_BG_UG : BACK_BG_PG;
  const dobHtml = formatDob(s.dob)
    ? `<h5 class="address_content"><strong>DOB:</strong> ${formatDob(s.dob)}</h5>`
    : '';
  const bgHtml = s.bloodGroup
    ? `<h5 class="address_content"><strong>Blood Group:</strong> ${escapeHtml(s.bloodGroup)}</h5>`
    : '';
  const mobile = String(s.mobile || '').trim();
  const fatherMobile = String(s.fatherMobile || '').trim();
  let mobileHtml = mobile && mobile !== '-'
    ? `<h5 class="address_content"><strong>Mobile:</strong> ${escapeHtml(mobile)}</h5>`
    : '';
  if (fatherMobile && fatherMobile !== '-' && fatherMobile !== mobile) {
    mobileHtml += `<h5 class="address_content"><strong>Father's Mobile:</strong> ${escapeHtml(fatherMobile)}</h5>`;
  }
  const addr = buildAddressHtml(s);
  const addressHtml = addr
    ? `<h5 class="address_content"><strong>Address:</strong><br />${addr}.</h5>`
    : '';
  const backPhotoImg = `<img src="${s.photoUrl}" width="355" alt="" />`;

  return `<div id="idcard">
<div id="id_container"><img src="${backBg}" height="1063" width="685" style="position:absolute;" alt="" /><div id="back_content">
<table width="100%" height="100%" border="0" cellpadding="0" cellspacing="0">
<tbody><tr>
<td valign="top">${dobHtml}${bgHtml}${mobileHtml}${addressHtml}</td>
</tr></tbody></table>
</div>
<div id="if_bottom_content">
<p class="if_found">if found, please return this card to</p>
<p class="addr_title">ADmin Office, <br>Adhiparasakthi Dental College &amp; Hospital</p>
<p class="addr_text">Melmaruvathur, Tamilnadu - 603 319</p>
</div>
<div id="bphoto_div">${backPhotoImg}</div>
<div id="bline_layer"><img src="${BACK_LINE}" alt="" /></div>
</div></div>`;
}

/** Cards array must contain enriched student records with `photoUrl` already resolved (skip students with no photo, matching legacy). */
export function buildStudentIdCardReport(students, { frontEnable = true, backEnable = true } = {}) {
  const parts = [];
  let rowFoundCount = 1;
  let studentCount = 0;
  for (const s of students) {
    if (!s.photoUrl) continue;
    if (frontEnable) parts.push(buildStudentIdCardFrontHtml(s));
    if (backEnable) parts.push(buildStudentIdCardBackHtml(s));
    studentCount += 1;

    if (frontEnable && backEnable) {
      if (rowFoundCount % 4 === 0) parts.push('<div style="page-break-before:always">&nbsp;</div>');
    } else if (rowFoundCount % 9 === 0) {
      parts.push('<div style="page-break-before:always">&nbsp;</div>');
    }
    rowFoundCount += 1;
  }

  if (!studentCount) {
    return { count: 0, reportHtml: '<p class="text-muted mb-0">No students with an ID card photo found for the selected criteria.</p>' };
  }

  const body = `<link rel="stylesheet" href="/legacy/css/student_id_card.css" />
<div class="cis-student-idcard-sheet">${parts.join('')}</div>`;
  return { count: studentCount, reportHtml: body };
}
