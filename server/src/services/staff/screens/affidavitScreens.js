import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { logStaffModule } from '../staffModuleAudit.js';
import {
  escapeHtml,
  formatStaffName,
  loadAcademicDesignation,
  loadDeptDesignationLookups,
  resolveStaffFilter,
  staffPhotoDisplayUrl,
} from '../staffShared.js';

const AFFIDAVIT_STYLES = `<style>
  .affidavit-print {
    font-family: "Times New Roman", Times, serif;
    color: #000;
    max-width: 780px;
    margin: 0 auto;
  }
  .affidavit-print #total_con.affidavit-page {
    width: 100%;
    max-width: 780px;
    margin: 0 auto 1.25rem;
    padding: 0;
    box-sizing: border-box;
  }
  .affidavit-print .affidavit-page-hidden { display: none !important; }
  .affidavit-print .header_line,
  .affidavit-print .header_line_1,
  .affidavit-print .header_table,
  .affidavit-print #mark_content,
  .affidavit-print .content_table {
    height: auto !important;
    min-height: 0 !important;
    padding-left: 0 !important;
    width: 100%;
  }
  .affidavit-print .header_line {
    width: 100%;
    padding-bottom: 8px;
    margin-bottom: 12px;
    border-bottom: 1px solid #ccc;
    text-align: center;
  }
  .affidavit-print .affidavit-appendix {
    text-align: right;
    margin: 0 0 4px;
    font-size: 14px;
  }
  .affidavit-print .affidavit-title {
    text-align: center;
    font-size: 20px;
    font-weight: bold;
    margin: 0 0 8px;
  }
  .affidavit-print .affidavit-page-marker {
    text-align: center;
    font-weight: bold;
    margin: 0 0 12px;
  }
  .affidavit-print .text_content,
  .affidavit-print .text_content1,
  .affidavit-print .text_con_page {
    font-family: "Book Antiqua", "Times New Roman", serif;
    font-size: 15px;
    line-height: 1.45;
    margin: 0 0 8px;
    padding: 0;
  }
  .affidavit-print .text_con_page {
    padding-left: 0;
    padding-right: 0;
  }
  .affidavit-print p { margin: 0 0 8px; }
  .affidavit-print .affidavit-page-body {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }
  .affidavit-print .affidavit-page-text { flex: 1; min-width: 0; }
  .affidavit-print .affidavit-photo {
    flex: 0 0 110px;
    text-align: center;
  }
  .affidavit-print .affidavit-photo img {
    width: 110px;
    height: 135px;
    object-fit: cover;
    border: 1px solid #ccc;
  }
  .affidavit-print .affidavit-field-table {
    width: 100%;
    border-collapse: collapse;
    margin: 4px 0 8px;
  }
  .affidavit-print .affidavit-field-table td {
    border: 0;
    padding: 2px 0;
    vertical-align: top;
    font-size: 15px;
    line-height: 1.45;
  }
  .affidavit-print .affidavit-field-label {
    width: 150px;
    padding-left: 50px !important;
    white-space: nowrap;
  }
  .affidavit-print .affidavit-contact-label {
    width: 220px;
    padding-left: 50px !important;
    white-space: nowrap;
  }
  .affidavit-print .affidavit-info-table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
  }
  .affidavit-print .affidavit-info-table td {
    border: 0;
    padding: 4px 0;
    vertical-align: top;
    font-size: 15px;
    line-height: 1.45;
  }
  .affidavit-print .affidavit-info-label { width: 38%; }
  .affidavit-print .affidavit-info-colon { width: 12px; }
  .affidavit-print .tab_text_content,
  .affidavit-print .tab_text_content_dci {
    font-size: 13px;
    padding: 4px;
    line-height: 1.35;
    text-align: center;
  }
  .affidavit-print .ol {
    margin: 8px 0 8px 40px;
    padding: 0;
    font-size: 15px;
    line-height: 1.45;
  }
  .affidavit-print .affidavit-signature-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 2rem;
  }
  .affidavit-print .affidavit-signature-table td {
    border: 0;
    width: 33.33%;
    text-align: center;
    vertical-align: top;
    padding: 8px 4px;
  }
  .affidavit-print .table_border td,
  .affidavit-print .table_border th {
    border: 1px solid #333;
    padding: 4px;
    font-size: 12px;
    vertical-align: middle;
  }
  @media screen {
    .affidavit-print #total_con.affidavit-page {
      padding-bottom: 1rem;
      border-bottom: 1px dashed #ddd;
    }
  }
  @media print {
    .affidavit-print #total_con.affidavit-page {
      width: 780px;
      padding: 35px;
      page-break-after: always;
      border-bottom: 0;
      margin-bottom: 0;
    }
  }
</style>`;

const AFFIDAVIT_PROFILE_SELECT = `id, staff_id, staff_name, staff_initial, staff_title, staff_photo, staff_gender,
  CAST(staff_dob AS CHAR) AS staff_dob, CAST(joined_date AS CHAR) AS joined_date, father_name,
  door_no, street, post, taluk, district, state, pincode,
  c_door_no, c_street, c_post, c_taluk, c_district, c_state, c_pincode,
  mobile_1, mobile_2, landline_no, email_id,
  aadhar_no, passport_no, driving_lic, voter_id, eb_proof, rental_agree,
  pan_no, pan_card,
  appoi_order_no, CAST(appoi_order_date AS CHAR) AS appoi_order_date,
  pre_app_no, pre_reliv_no, pre_exp_no,
  pvt_clinic_name, pvt_clinic_city, pvt_clinic_remarks`;

function wrapAffidavitHtml(body) {
  return `${AFFIDAVIT_STYLES}<div class="affidavit-print">${body}</div>`;
}

function zeroDate(val) {
  return !val || String(val).startsWith('0000');
}

function fmtDmySlash(val) {
  if (zeroDate(val)) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function fmtDmyDash(val) {
  if (zeroDate(val)) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function fmtAadhar(no) {
  const s = String(no || '').replace(/\s/g, '');
  if (s.length < 12) return escapeHtml(s);
  return escapeHtml(`${s.slice(0, 4)} ${s.slice(4, 8)} ${s.slice(8)}`);
}

function buildAddress(parts) {
  const { door, street, post, taluk, district, state, pincode } = parts;
  let ref = '';
  if (door) ref = `${door} `;
  if (street) ref += street;
  if (post) ref += `, ${post}`;
  if (taluk) ref += `, ${taluk}`;
  if (district) ref += `,</br> ${district}`;
  if (state) ref += `, ${state}`;
  if (pincode) ref += ` - ${pincode}`;
  return ref;
}

function calcYmd(fromDate, toDate) {
  const from = zeroDate(fromDate) ? null : new Date(fromDate);
  const to = zeroDate(toDate) ? new Date() : new Date(toDate);
  if (!from || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { years: 0, months: 0, days: 0, totalSeconds: 0 };
  }
  const diff = Math.abs(to.getTime() - from.getTime());
  const years = Math.floor(diff / (365 * 24 * 60 * 60 * 1000));
  const months = Math.floor((diff - years * 365 * 24 * 60 * 60 * 1000) / (30 * 24 * 60 * 60 * 1000));
  const days = Math.floor((diff - years * 365 * 24 * 60 * 60 * 1000 - months * 30 * 24 * 60 * 60 * 1000) / (24 * 60 * 60 * 1000));
  return { years, months, days, totalSeconds: Math.floor(diff / 1000) };
}

function ymdLabel({ years, months, days }) {
  return `${years} year(s) ${months} month(s) ${days} day(s)`;
}

function indMoney(val) {
  const n = Number(String(val || '0').replace(/,/g, ''));
  if (Number.isNaN(n)) return escapeHtml(String(val || ''));
  return escapeHtml(n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }));
}

function mapLabel(map, id) {
  return map[String(id)] || '';
}

function pageClass(pageNo, target) {
  const visible = !pageNo || Number(pageNo) === Number(target);
  return visible ? 'affidavit-page' : 'affidavit-page affidavit-page-hidden';
}

function parentLabel(gender) {
  return String(gender || '').trim().toLowerCase() === 'female' ? 'D/o' : 'S/o';
}

function privateClinicText(profile) {
  const name = String(profile.pvt_clinic_name || '').trim();
  if (!name) return 'I am not having private practice anywhere.';
  return `I am practicing at ${name} in the city of ${profile.pvt_clinic_city || ''} and my days and hours of practice are ${profile.pvt_clinic_remarks || ''}.`;
}

function signatureRow(contd) {
  return `<table class="content_table" border="0" cellpadding="0" cellspacing="0" width="780px">
    <tr><td valign="bottom" width="100%" style="height:120px;">
      <div style="float:left;width:50%;"><p class="text_content">(Signature of Faculty)</p></div>
      <div style="float:right;width:50%;"><p class="text_content" style="text-align:right;">(Signature of Dean/Principal)</br></br>Contd/....${contd}</p></div>
    </td></tr></table>`;
}

function financialYearRanges() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const startYear = month >= 4 ? year : year - 1;
  return [0, 1, 2].map((i) => {
    const from = startYear - i - 1;
    const to = startYear - i;
    return {
      label: `${from} - ${to}`,
      from: `${from}-04-01`,
      to: `${to}-03-01`,
    };
  });
}

async function loadEduSetupSnameMap() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT id, category_sname FROM edu_setup_tb WHERE del != 0 ORDER BY category_order ASC',
  );
  return Object.fromEntries(rows.map((r) => [String(r.id), r.category_sname]));
}

async function loadDesgNameMap() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT id, name FROM staff_desg_master WHERE del != 0 ORDER BY d_order ASC',
  );
  return Object.fromEntries(rows.map((r) => [String(r.id), r.name]));
}

async function loadAffidavitProfiles(ids) {
  if (!ids.length) return [];
  const clause = ids.map((id) => Number(id)).filter(Boolean).join(',');
  if (!clause) return [];
  return prisma.$queryRawUnsafe(
    `SELECT ${AFFIDAVIT_PROFILE_SELECT} FROM staff_profile_tb WHERE del = 1 AND id IN (${clause}) ORDER BY staff_id ASC`,
  );
}

async function loadAffidavitData(profileId, fields = {}) {
  const sid = escapeSql(String(profileId));
  const pubYear = Number(fields.pub_year) || 0;
  const affidavitOnly = Number(fields.affidavit) === 1 || fields.affidavit === true;
  const [eduMap, desgMap, designation, education, experience, desHistory, payroll, publications] = await Promise.all([
    loadEduSetupSnameMap(),
    loadDesgNameMap(),
    loadAcademicDesignation(profileId),
    prisma.$queryRawUnsafe(
      `SELECT degree_name, institution, university, yop, major_name, regi_no,
              CAST(regi_date AS CHAR) AS regi_date, reg_council
       FROM staff_education_tb WHERE del = 1 AND staff_id = '${sid}' ORDER BY id ASC`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT institution_type, institution, location,
              CAST(from_date AS CHAR) AS from_date, CAST(to_date AS CHAR) AS to_date
       FROM staff_experience_tb WHERE del = 1 AND staff_id = '${sid}' ORDER BY id ASC`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT designation, CAST(from_date AS CHAR) AS from_date, CAST(to_date AS CHAR) AS to_date
       FROM staff_designation_tb WHERE del = 1 AND staff_id = ${Number(profileId)} ORDER BY id ASC`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT payroll_month, net_pay, tds_amount
       FROM staff_payroll_tb WHERE del = 1 AND staff_id = '${sid}' ORDER BY id DESC LIMIT 6`,
    ),
    (async () => {
      let sql = `SELECT p_title_name, p_journal_name, p_month, p_year, p_volume, p_page, p_points
        FROM staff_publication_tb WHERE del = 1 AND staff_id = '${sid}' AND CAST(p_points AS DECIMAL(10,2)) > 0`;
      if (pubYear) sql += ` AND p_year > ${pubYear}`;
      if (affidavitOnly) sql += ' AND p_main = 1';
      sql += ' ORDER BY p_year DESC';
      return prisma.$queryRawUnsafe(sql);
    })(),
  ]);

  const fyRanges = financialYearRanges();
  const tdsTotals = await Promise.all(
    fyRanges.map((fy) => prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM(CAST(tds_amount AS DECIMAL(12,2))), 0) AS total
       FROM staff_payroll_tb WHERE del = 1 AND staff_id = '${sid}'
         AND payroll_month BETWEEN '${fy.from}' AND '${fy.to}'`,
    ).then((rows) => rows[0]?.total ?? 0)),
  );

  const lastExp = experience.length ? experience[experience.length - 1] : null;
  return {
    eduMap,
    desgMap,
    designation,
    education,
    experience,
    desHistory,
    payroll,
    publications,
    fyRanges,
    tdsTotals,
    lastExp,
  };
}

function buildEducationRows(education, eduMap) {
  return education.map((e) => {
    const regDate = zeroDate(e.regi_date) ? '' : fmtDmyDash(e.regi_date);
    const reg = `${escapeHtml(e.regi_no || '')}${regDate ? `<br><small>Dt: ${escapeHtml(regDate)}</small>` : ''}`;
    return `<tr>
      <td class="tab_text_content_dci" align="center">${escapeHtml(mapLabel(eduMap, e.degree_name))}</td>
      <td class="tab_text_content_dci" align="center" style="font-size:12px;">${escapeHtml(e.institution || '')}</td>
      <td class="tab_text_content_dci" align="center">${escapeHtml(mapLabel(eduMap, e.university))}</td>
      <td class="tab_text_content_dci" align="center">${escapeHtml(String(e.yop || ''))}</td>
      <td class="tab_text_content_dci" align="center">${escapeHtml(mapLabel(eduMap, e.major_name))}</td>
      <td class="tab_text_content_dci" align="center">${escapeHtml(mapLabel(eduMap, e.reg_council))}</td>
      <td class="tab_text_content_dci" align="center">${reg}</td>
    </tr>`;
  }).join('');
}

function buildExperienceRows(experience) {
  let totalSeconds = 0;
  const rows = experience.map((row) => {
    if (zeroDate(row.from_date)) return '';
    const ymd = calcYmd(row.from_date, row.to_date);
    totalSeconds += ymd.totalSeconds;
    return `<tr>
      <td class="tab_text_content_dci">${escapeHtml(row.location || '')}</td>
      <td class="tab_text_content_dci" align="center" style="font-size:12px;">${escapeHtml(row.institution || '')}</td>
      <td class="tab_text_content_dci" align="center" nowrap>${escapeHtml(fmtDmyDash(row.from_date))}</td>
      <td class="tab_text_content_dci" align="center" nowrap>${escapeHtml(zeroDate(row.to_date) ? '' : fmtDmyDash(row.to_date))}</td>
      <td class="tab_text_content_dci" align="center" nowrap>${ymdLabel(ymd)}</td>
    </tr>`;
  }).join('');
  return { rows, totalSeconds };
}

function buildDesignationHistoryRows(desHistory, desgMap) {
  let totalSeconds = 0;
  const rows = desHistory.map((row) => {
    const ymd = calcYmd(row.from_date, row.to_date);
    totalSeconds += ymd.totalSeconds;
    const toLabel = zeroDate(row.to_date) || Number(row.to_date) <= 2 ? 'Till Date' : fmtDmyDash(row.to_date);
    return `<tr>
      <td class="tab_text_content_dci">${escapeHtml(mapLabel(desgMap, row.designation))}</td>
      <td class="tab_text_content_dci" align="center" style="font-size:12px;">Adhiparasakthi Dental College &amp; Hospital</td>
      <td class="tab_text_content_dci" align="center" nowrap>${escapeHtml(fmtDmyDash(row.from_date))}</td>
      <td class="tab_text_content_dci" align="center" nowrap>${escapeHtml(toLabel)}</td>
      <td class="tab_text_content_dci" align="center" nowrap>${ymdLabel(ymd)}</td>
    </tr>`;
  }).join('');
  return { rows, totalSeconds };
}

function totalFromSeconds(totalSeconds) {
  const years = Math.floor(totalSeconds / (365 * 24 * 60 * 60));
  const months = Math.floor((totalSeconds - years * 365 * 24 * 60 * 60) / (30 * 24 * 60 * 60));
  const days = Math.floor((totalSeconds - years * 365 * 24 * 60 * 60 - months * 30 * 24 * 60 * 60) / (24 * 60 * 60));
  return ymdLabel({ years, months, days });
}

async function buildDciAffidavitHtml(profile, fields = {}) {
  const data = await loadAffidavitData(profile.id, fields);
  const staffName = escapeHtml(formatStaffName(profile));
  const parent = parentLabel(profile.staff_gender);
  const father = escapeHtml(profile.father_name || '');
  const dob = escapeHtml(fmtDmySlash(profile.staff_dob));
  const permAddr = escapeHtml(buildAddress({
    door: profile.door_no, street: profile.street, post: profile.post, taluk: profile.taluk,
    district: profile.district, state: profile.state, pincode: profile.pincode,
  }));
  const commAddr = escapeHtml(buildAddress({
    door: profile.c_door_no, street: profile.c_street, post: profile.c_post, taluk: profile.c_taluk,
    district: profile.c_district, state: profile.c_state, pincode: profile.c_pincode,
  }));
  const photo = await staffPhotoDisplayUrl(profile.staff_id, 'idcard', profile.staff_photo);
  const photoHtml = `<img src="${escapeHtml(photo)}" width="110" height="135" alt="" onerror="this.src='/legacy/img/profile-avatar.jpg'" />`;
  const pan = escapeHtml(profile.pan_no || profile.pan_card || '');
  const aadhar = fmtAadhar(profile.aadhar_no);
  const desName = escapeHtml(data.designation?.desg_name || '');
  const deptName = escapeHtml(data.designation?.dept_name || '');
  const pageNo = fields.page_no;
  const p1 = pageClass(pageNo, 1);
  const p2 = pageClass(pageNo, 2);
  const p3 = pageClass(pageNo, 3);
  const p4 = pageClass(pageNo, 4);
  const p5 = pageClass(pageNo, 5);

  const eduRows = buildEducationRows(data.education, data.eduMap);
  const expBlock = buildExperienceRows(data.experience);
  const desBlock = buildDesignationHistoryRows(data.desHistory, data.desgMap);
  const totalExp = totalFromSeconds(expBlock.totalSeconds + desBlock.totalSeconds);

  const lastInst = data.lastExp ? escapeHtml(data.lastExp.institution || 'Not Applicable') : 'Not Applicable';
  const lastRole = data.lastExp ? escapeHtml(data.lastExp.location || 'Not Applicable') : 'Not Applicable';
  const lastTo = data.lastExp && !zeroDate(data.lastExp.to_date) ? escapeHtml(fmtDmyDash(data.lastExp.to_date)) : 'Not Applicable';

  const payrollRows = data.payroll.map((p, i) => {
    const month = zeroDate(p.payroll_month) ? '' : new Date(p.payroll_month).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    return `<tr>
      <td class="tab_text_content_dci">${i + 1}</td>
      <td class="tab_text_content_dci" align="center">${escapeHtml(month)}</td>
      <td class="tab_text_content_dci" align="center">${indMoney(p.net_pay)}</td>
      <td class="tab_text_content_dci" align="center">${indMoney(p.tds_amount)}</td>
    </tr>`;
  }).join('');

  const tdsRows = data.fyRanges.map((fy, i) => `<tr>
    <td class="tab_text_content_dci" align="center">${i + 1}</td>
    <td class="tab_text_content_dci" align="center">${escapeHtml(fy.label)}</td>
    <td class="tab_text_content_dci" align="center">${indMoney(data.tdsTotals[i])}</td>
  </tr>`).join('');

  const pubRows = data.publications.map((p, i) => `<tr>
    <td class="tab_text_content_dci">${i + 1}</td>
    <td class="pub_text_content" align="center">${escapeHtml(p.p_title_name || '')}</td>
    <td class="pub_text_content" align="center">${escapeHtml(p.p_journal_name || '')}.<br>${escapeHtml(String(p.p_year || ''))}-${escapeHtml(String(p.p_month || ''))}; ${escapeHtml(p.p_volume || '')}: ${escapeHtml(p.p_page || '')}</td>
    <td class="tab_text_content_dci" align="center">${escapeHtml(String(p.p_points || ''))}</td>
  </tr>`).join('');

  const privateClinic = escapeHtml(privateClinicText(profile));

  return `
<div id="total_con" class="${p1}">
  <table class="header_line" border="0" cellpadding="0" cellspacing="0" width="100%"><tr>
    <td>
      <p class="affidavit-appendix">(Appendix -1)</p>
      <p class="affidavit-title"><strong>AFFIDAVIT</strong></p>
    </td>
  </tr></table>
  <div id="mark_content">
    <div class="affidavit-page-body">
      <div class="affidavit-page-text">
        <p class="text_content" style="text-align:justify;">1. I, <strong>${staffName}</strong> ${parent} <strong>${father}</strong></p>
        <p class="text_content">2. Date of Birth (DD/MM/YYYY) : <strong>${dob}</strong></p>
        <p class="text_content">3. Residential Address of Faculty</p>
        <table class="affidavit-field-table">
          <tr><td class="affidavit-field-label">a. Present :</td><td><strong>${commAddr}</strong></td></tr>
          <tr><td class="affidavit-field-label">b. Permanent :</td><td><strong>${permAddr}</strong></td></tr>
        </table>
        <p class="text_content">4. Contact Details:</p>
        <table class="affidavit-field-table">
          <tr><td class="affidavit-contact-label">Mobile No. :</td><td><strong>${escapeHtml(profile.mobile_1 || '')}</strong></td></tr>
          <tr><td class="affidavit-contact-label">Resi. Tel. No. with STD Code :</td><td><strong>${escapeHtml(profile.landline_no || '')}</strong></td></tr>
          <tr><td class="affidavit-contact-label">Email :</td><td><strong>${escapeHtml(profile.email_id || '')}</strong></td></tr>
        </table>
      </div>
      <div class="affidavit-photo">${photoHtml}</div>
    </div>
    ${signatureRow(2)}
  </div>
</div>

<div id="total_con" class="${p2}">
  <div id="mark_content"><p class="affidavit-page-marker">--2--</p>
    <p class="text_content">5. Any one documents from 5a and 5b is mandatory:</p>
    <table width="98%" cellpadding="3" cellspacing="0" class="table_border" border="1">
      <tr>
        <td><strong>5a</strong></td><td><strong>Proof of Photo ID</strong></td><td><strong>Document No.</strong></td>
        <td><strong>5b</strong></td><td><strong>Proof of Residence</strong></td><td><strong>Document No.</strong></td>
      </tr>
      <tr><td>1</td><td>Passport</td><td><strong>${escapeHtml(profile.passport_no || '')}</strong></td><td>1</td><td>Passport</td><td></td></tr>
      <tr><td>2</td><td>Voter ID Card</td><td><strong>${escapeHtml(profile.voter_id || '')}</strong></td><td>2</td><td>Aadhaar Card</td><td><strong>${aadhar}</strong></td></tr>
      <tr><td>3</td><td>Driving License</td><td>${escapeHtml(profile.driving_lic || '')}</td><td>3</td><td>Voter ID Card</td><td>${escapeHtml(profile.voter_id || '')}</td></tr>
      <tr><td>4</td><td>Aadhaar Card</td><td><strong>${aadhar}</strong></td><td>4</td><td>Bill - Electricity / Landline Phone</td><td>${escapeHtml(profile.eb_proof || '')}</td></tr>
      <tr><td>5</td><td></td><td></td><td>5</td><td>Regd. Rent Agreement</td><td>${escapeHtml(profile.rental_agree || '')}</td></tr>
    </table>
    <div style="padding-left:40px;"><small>Note:- Original Documents are mandatory for verification. All Documents/Certified Translation, must be in English.</small></div>
    <p class="text_content">6. Pan Card No. <strong>${pan}</strong><small style="padding-left:25px;">Certified copy to be enclosed</small></p>
    <p class="text_content">7. Aadhaar Card No. <strong>${aadhar}</strong><small style="padding-left:25px;">Certified copy to be enclosed</small></p>
  </div>
</div>

<div id="total_con" class="${p3}">
  <div id="mark_content"><p class="affidavit-page-marker">--3--</p>
    <p class="text_content">8. QUALIFICATIONS:</p>
    <table width="98%" cellpadding="3" cellspacing="0" class="table_border" border="1">
      <tr>
        <td class="tab_text_content_dci">Degree</td><td class="tab_text_content_dci">College of Study</td><td class="tab_text_content_dci">University</td>
        <td class="tab_text_content_dci">Year &amp; Month of Passing</td><td class="tab_text_content_dci">Speciality</td>
        <td class="tab_text_content_dci">Name of the State Dental Council</td><td class="tab_text_content_dci">Reg. No. of UG &amp; PG with date</td>
      </tr>
      ${eduRows}
    </table>
    <div style="padding-left:40px;"><small>*Enclosed certified copy of the State Council Registration renewed till date.</small></div>
    <p class="text_content">9. Present Designation : <strong>${desName}</strong></p>
    <p class="text_content">10. Name and Postal Address of College/Institution : <strong>ADHIPARASAKTHI DENTAL COLLEGE AND HOSPITAL, MELMARUVATHUR - 603319.</strong></p>
    <p class="text_content">11. Present Institute Appointment Order No.: <strong>${escapeHtml(profile.appoi_order_no || '')}, Date: ${escapeHtml(fmtDmyDash(profile.appoi_order_date))}</strong></p>
    <p class="text_content">12. Before joining present institution I was working at <strong>${lastInst}</strong> as <strong>${lastRole}</strong> and relieved on <strong>${lastTo}</strong> after resigning.
      <ol><li>Appointment Order No.: <strong>${escapeHtml(profile.pre_app_no || '')}</strong></li>
      <li>Relieving Order No.: <strong>${escapeHtml(profile.pre_reliv_no || '')}</strong></li></ol></p>
    <p class="text_content">13. TEACHING EXPERIENCE:</p>
    <table width="98%" cellpadding="3" cellspacing="0" class="table_border" border="1">
      <tr><td>Position</td><td>Name of Institution</td><td>From</td><td>To</td><td>Total Experience Y-M-D</td></tr>
      ${expBlock.rows}${desBlock.rows}
      <tr><td colspan="4"><strong>Total Experience</strong></td><td><strong>${totalExp}</strong></td></tr>
    </table>
    ${signatureRow(3)}
  </div>
</div>

<div id="total_con" class="${p4}">
  <div id="mark_content"><p class="affidavit-page-marker">--4--</p>
    <p class="text_content">14. TOTAL SALARY DRAWN FROM THE COLLEGE IN THE LAST SIX(6) MONTHS:(List enclosed)</p>
    <table width="98%" cellpadding="3" cellspacing="0" class="table_border" border="1">
      <tr><td>S.No</td><td>Month</td><td>Amount Received</td><td>Tax Deducted</td></tr>
      ${payrollRows}
    </table>
    <p class="text_content">15. TDS FOR THE LAST THREE FINANCIAL YEARS:</p>
    <table width="98%" cellpadding="3" cellspacing="0" class="table_border" border="1">
      <tr><td>S.No</td><td>Financial Year</td><td>Total Tax Deducted Yearly</td></tr>
      ${tdsRows}
    </table>
    <p class="text_content">16. DETAILS OF PUBLICATIONS:</p>
    <table width="98%" cellpadding="3" cellspacing="0" class="table_border" border="1">
      <tr><td>S.No</td><td>Title of the Articles</td><td>Journal Details</td><td>Points</td></tr>
      ${pubRows}
    </table>
    ${signatureRow(4)}
  </div>
</div>

<div id="total_con" class="${p5}">
  <div id="mark_content"><p class="affidavit-page-marker">--5--</p>
    <p class="text_content1" style="text-align:center;"><strong>DECLARATION</strong></p>
    <p class="text_content" style="text-align:justify;">1. I, <strong>${staffName}</strong> ${parent} <strong>${father}</strong> do hereby give an undertaking that I am working as a full time salaried employee (as per UGC Norms) designated as <strong>${desName}</strong> in the Department of <strong>${deptName}</strong> at <strong>Adhiparasakthi Dental College and Hospital</strong> on all working days, working Hours from 08:30 am to 03:30 pm.</p>
    <p class="text_content">2. I am working as a Full Time/Part Time* faculty.</p>
    <p class="text_content" style="text-align:justify;">3. I have not presented myself to any other Institution as a faculty in the current academic year for the purpose of DCI Inspection.</p>
    <p class="text_content" style="text-align:justify;">4. ${privateClinic}</p>
    <p class="text_content" style="text-align:justify;">5. I, hereby, declare that the above information and documents provided by me are absolutely true, correct and authentic to the best of my knowledge.</p>
    <p class="text_content" style="text-align:justify;">This is to certify that the information given by the above deponent is correct and nothing has been concealed and deponent is working in the <strong>${deptName}</strong> as <strong>${desName}</strong> as a full-time teacher in our college and is not engaged in full-time private practice anywhere.</p>
    <p class="text_content1" style="text-align:center;"><strong>Attestation by Notary Public/Oath Commissioner</strong></p>
    <p class="text_content1" style="text-align:justify;">I, <strong>${staffName}</strong> ${parent} <strong>${father}</strong> Identified by __________________ has solemnly affirmed before me that the contents of the affidavit are true and correct to his/her knowledge.</p>
    <p class="text_content1" style="text-align:justify;">We have verified all the relevant documents and confirmed that information given is true to our knowledge and the above staff member was present during the inspection.</p>
    <table class="content_table" border="0" cellpadding="0" cellspacing="0" width="780px"><tr><td style="height:120px;">
      <div style="float:left;width:50%;"><p>(Signature of Inspector – 1)</p></div>
      <div style="float:right;width:50%;"><p style="text-align:right;">(Signature of Inspector – 2)</p></div>
    </td></tr></table>
  </div>
</div>`;
}

async function buildTnmgrAffidavitHtml(profile, fields = {}) {
  const data = await loadAffidavitData(profile.id, fields);
  const staffName = escapeHtml(formatStaffName(profile));
  const parent = parentLabel(profile.staff_gender);
  const father = escapeHtml(profile.father_name || '');
  const dob = escapeHtml(fmtDmySlash(profile.staff_dob));
  const joinedDate = escapeHtml(fmtDmyDash(profile.joined_date));
  const commAddr = escapeHtml(buildAddress({
    door: profile.c_door_no, street: profile.c_street, post: profile.c_post, taluk: profile.c_taluk,
    district: profile.c_district, state: profile.c_state, pincode: profile.c_pincode,
  }));
  const pan = escapeHtml(profile.pan_no || profile.pan_card || '');
  const aadhar = fmtAadhar(profile.aadhar_no);
  const desName = escapeHtml(data.designation?.desg_name || '');
  const deptName = escapeHtml(data.designation?.dept_name || '');
  const majorLabel = data.education.length
    ? escapeHtml(mapLabel(data.eduMap, data.education[data.education.length - 1].major_name))
    : deptName;
  const pageNo = fields.page_no;
  const p1 = pageClass(pageNo, 1);
  const p2 = pageClass(pageNo, 2);
  const p3 = pageClass(pageNo, 3);
  const p4 = pageClass(pageNo, 4);
  const p5 = pageClass(pageNo, 5);

  const eduRows = data.education.map((e) => {
    const regDate = zeroDate(e.regi_date) ? '' : fmtDmyDash(e.regi_date);
    const reg = `${escapeHtml(e.regi_no || '')}${regDate ? `<br><small>Date: ${escapeHtml(regDate)}</small>` : ''}`;
    return `<tr>
      <td class="tab_text_content" align="center">${escapeHtml(mapLabel(data.eduMap, e.degree_name))}</td>
      <td class="tab_text_content" align="center">${escapeHtml(e.institution || '')}</td>
      <td class="tab_text_content" align="center">${escapeHtml(mapLabel(data.eduMap, e.university))}</td>
      <td class="tab_text_content" align="center">${escapeHtml(String(e.yop || ''))}</td>
      <td class="tab_text_content" align="center">${escapeHtml(mapLabel(data.eduMap, e.major_name))}</td>
      <td class="tab_text_content" align="center">${reg}</td>
      <td class="tab_text_content" align="center">${escapeHtml(mapLabel(data.eduMap, e.reg_council))}</td>
    </tr>`;
  }).join('');

  const expBlock = buildExperienceRows(data.experience);
  const desBlock = buildDesignationHistoryRows(data.desHistory, data.desgMap);
  const totalExp = totalFromSeconds(expBlock.totalSeconds + desBlock.totalSeconds);

  const tdsRows = data.fyRanges.map((fy, i) => `<tr>
    <td class="tab_text_content" align="center">${i + 1}</td>
    <td class="tab_text_content" align="center">${escapeHtml(fy.label)}</td>
    <td class="tab_text_content" align="center">${indMoney(data.tdsTotals[i])}</td>
  </tr>`).join('');

  const infoRow = (label, value, rawHtml = false) => `<tr>
    <td class="affidavit-info-label">${label}</td>
    <td class="affidavit-info-colon">:</td>
    <td>${rawHtml ? value : `<strong>${value}</strong>`}</td>
  </tr>`;

  return `
<div id="total_con" class="${p1}">
  <div id="mark_content">
    <table class="header_line" border="0" cellpadding="0" cellspacing="0" width="100%"><tr>
      <td><p class="affidavit-title"><strong>AFFIDAVIT</strong></p></td>
    </tr></table>
    <p class="text_con_page" style="text-align:justify;">I, <strong>${staffName}</strong> ${parent} <strong>${father}</strong> presently working full-time as <strong>${desName}</strong> in <strong>Adhiparasakthi Dental College &amp; Hospital, Melmaruvathur – 603 319</strong>, solemnly affirm and declare that I am not working in any other institution in any capacity and not in full-time private practice. I also solemnly affirm and declare as under:-</p>
    <p class="text_con_page">Date of Birth : <strong>${dob}</strong></p>
  </div>
</div>

<div id="total_con" class="${p2}">
  <div id="mark_content">
    <p class="affidavit-page-marker">--2--</p>
    <p class="text_content"><strong>QUALIFICATIONS:</strong></p>
    <table width="100%" cellpadding="3" cellspacing="0" class="table_border" border="1">
      <tr>
        <td class="tab_text_content">Degree</td><td class="tab_text_content">College of Study</td><td class="tab_text_content">University</td>
        <td class="tab_text_content">Year &amp; Month of Passing</td><td class="tab_text_content">Speciality</td>
        <td class="tab_text_content">Registration No. of UG &amp; PG with date</td><td class="tab_text_content">Name of the State Dental Council</td>
      </tr>
      ${eduRows}
    </table>
  </div>
</div>

<div id="total_con" class="${p3}">
  <div id="mark_content">
    <p class="affidavit-page-marker">--3--</p>
    <p class="text_content"><strong>TEACHING EXPERIENCE:</strong></p>
    <p class="text_content1" style="text-align:justify;">Details of the previous appointments/teaching experience after MDS Qualification only if employed on full-time basis as teaching experience on part-time/visiting basis or on daily wages basis are not acceptable and will not be taken into consideration for determining length of teaching experience:</p>
    <table width="100%" cellpadding="3" cellspacing="0" class="table_border" border="1">
      <tr>
        <td class="tab_text_content">Position</td><td class="tab_text_content">Name of Institution</td>
        <td class="tab_text_content">From</td><td class="tab_text_content">To</td><td class="tab_text_content">Total Experience Y-M-D</td>
      </tr>
      ${expBlock.rows}${desBlock.rows}
      <tr><td colspan="4"><strong>Total Experience</strong></td><td><strong>${totalExp}</strong></td></tr>
    </table>
    <p class="text_content"><strong>Deponent Signature:</strong><br />Date:</p>
  </div>
</div>

<div id="total_con" class="${p4}">
  <div id="mark_content">
    <p class="affidavit-page-marker">--4--</p>
    <p class="text_content"><strong>TDS Deduction yearly for last three years:</strong></p>
    <table width="100%" cellpadding="3" cellspacing="0" class="table_border" border="1">
      <tr><td class="tab_text_content">S.No</td><td class="tab_text_content">Financial Year</td><td class="tab_text_content">Total Tax Deducted Yearly</td></tr>
      ${tdsRows}
    </table>
    <p class="text_content"><strong>PUBLICATION POINTS</strong></p>
    <table width="100%" cellpadding="3" cellspacing="0" class="table_border" border="1" style="max-width:400px;">
      <tr><td class="tab_text_content">Professor &amp; HOD</td><td class="tab_text_content" style="text-align:right;padding-right:24px;">/ 40</td></tr>
      <tr><td class="tab_text_content">Professor</td><td class="tab_text_content" style="text-align:right;padding-right:24px;">/ 40</td></tr>
      <tr><td class="tab_text_content">Reader</td><td class="tab_text_content" style="text-align:right;padding-right:24px;">/ 20</td></tr>
    </table>
    <p class="text_content1">(A certified copy each of my Form 16 (TDS certificate) for financial years* - is attached)<br />* In the case of Professor last three financial years and in the case of Reader last one financial year.</p>
    <p class="text_content1">For proof of the residential Address please attach any one of the following documents:-</p>
    <ol class="ol">
      <li>Ration Card</li><li>Telephone Bill in the name of Deponent</li><li>Election Card</li>
      <li>Water Bill in the name of the Deponent</li><li>Proof of Children Education</li><li>Electricity Bill in the name of Deponent</li>
    </ol>
    <table class="affidavit-info-table">
      ${infoRow('Phone &amp; Fax Number of Dental College', '044 - 2752 9628, 2752 8082, 2752 8083<br />Telefax : 044 – 2752 8081')}
      ${infoRow('Address of Office', 'Adhiparasakthi Dental College &amp; Hospital, Melmaruvathur – 603 319.')}
      ${infoRow('Address of Residence', commAddr)}
      ${infoRow('Phone No.', escapeHtml(profile.mobile_1 || ''))}
      ${infoRow('E-Mail address', escapeHtml(profile.email_id || ''))}
      ${infoRow('Date of joining the present Institution', joinedDate)}
      ${infoRow('PAN NO', pan)}
      ${infoRow('AADHAAR CARD', aadhar)}
      ${infoRow('State Council Registration renewed till current year', 'Copy attached')}
      ${infoRow('Certified Copy of Bank Statement / Pass Book by the bank (6 months)', 'Copy attached')}
      ${infoRow('I.T. Circle', '-')}
      ${infoRow('Full time / Part time', `I have been appointed as full-time <strong>${desName}</strong> at the said college.<br /><strong>Appointment Order No. ${escapeHtml(profile.appoi_order_no || '')}<br />Date : ${escapeHtml(fmtDmyDash(profile.appoi_order_date))} (Copy attached)</strong>`, true)}
      ${infoRow('Salary offered on the U.G.C. Pay-Scales', 'I have been offered UGC Pay-Scales for the above said post by the above college authority')}
      ${infoRow('Letter of Acceptance', 'I have accepted the above offer (a copy of the Letter of acceptance is enclosed).')}
    </table>
    <p class="text_content1">I also solemnly declare that the information furnished herein is true to the best of my knowledge and nothing has been concealed and no statement made therein is false.</p>
    <p class="text_content"><strong>Deponent Signature:</strong><br />Date:</p>
  </div>
</div>

<div id="total_con" class="${p5}">
  <div id="mark_content">
    <p class="affidavit-page-marker">--5--</p>
    <p class="text_content1" style="text-align:justify;">This is to certify that the information given by the above deponent is correct and nothing has been concealed there from and deponent is working in the Department of ${majorLabel} as ${desName} as a full-time teacher in our college and is not engaged in full – time private practice anywhere.</p>
    <table class="affidavit-signature-table">
      <tr>
        <td><strong>Principal Signature</strong></td>
        <td><strong>Deponent Signature</strong></td>
        <td><strong>Trustee Signature</strong></td>
      </tr>
    </table>
    <p style="border-top:dotted #666 2px;margin:24px 0 12px;">&nbsp;</p>
    <p class="text_content1" style="text-align:center;"><strong>Attestation by Notary Public/Oath Commissioner</strong></p>
    <p class="text_content1" style="text-align:center;"><strong>CERTIFIED THAT THE DEPONENT</strong></p>
    <p class="text_content1" style="text-align:justify;">I, <strong>${staffName}</strong> ${parent} <strong>${father}</strong> Identified by __________________ has solemnly affirmed before me at ____________________ on at Sl.No. _____ that the contents of the affidavit which have been read and explained to him/her are true and correct to his/her knowledge.</p>
    <p class="text_content1" style="text-align:center;"><strong>Signature Notary Public / Oath Commissioner</strong></p>
    <p class="text_content1" style="text-align:justify;">We have verified all the relevant documents and confirmed that information given is true to our knowledge and the above staff member was present during the inspection.</p>
  </div>
</div>`;
}

async function loadAffidavitScreen(memberId, fields, audit, { legacyPage, title, buildHtml }) {
  const lookups = await loadDeptDesignationLookups();
  if (!fields.Submit && !fields.search_by) {
    await logStaffModule(legacyPage, 'View', 'Successful', '', memberId, audit);
    return { ...lookups, reportHtml: null };
  }

  const staff = await resolveStaffFilter(fields);
  if (!audit?.skipLog) {
    await logStaffModule(legacyPage, 'Generate', 'Successful', String(staff.length), memberId, audit);
  }
  const profiles = await loadAffidavitProfiles(staff.map((s) => s.id));
  const blocks = [];
  for (const profile of profiles) {
    blocks.push(await buildHtml(profile, fields));
  }
  return {
    ...lookups,
    reportHtml: wrapAffidavitHtml(blocks.join('') || '<p>No staff found.</p>'),
  };
}

export async function loadAffidavitDciScreen(memberId, fields = {}, audit = {}) {
  return loadAffidavitScreen(memberId, fields, audit, {
    legacyPage: 'staff_affidavit_dci.php',
    title: 'DCI Affidavit',
    buildHtml: buildDciAffidavitHtml,
  });
}

export async function loadAffidavitTnmgrScreen(memberId, fields = {}, audit = {}) {
  return loadAffidavitScreen(memberId, fields, audit, {
    legacyPage: 'staff_affidavit_TNMGRMU.php',
    title: 'TNMGRMU Affidavit',
    buildHtml: buildTnmgrAffidavitHtml,
  });
}
