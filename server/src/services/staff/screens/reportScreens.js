import { prisma } from '../../../config/prisma.js';
import { legacyPublicFileUrl } from '../../../utils/fileUrls.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { logStaffModule } from '../staffModuleAudit.js';
import {
  escapeHtml,
  formatDisplayDate,
  formatStaffName,
  loadAcademicDesignation,
  loadDeptDesignationLookups,
  loadInstitutionBranding,
  loadTeachingDepartments,
  resolveStaffFilter,
  staffPhotoUrl,
  staffPhotoDisplayUrl,
  DEFAULT_STAFF_PHOTO_URL,
  getStaffCategoryOptions,
} from '../staffShared.js';

const ACTIVE = `(releaving_date > DATE(NOW()) OR CAST(releaving_date AS CHAR) LIKE '0000-00-00%')`;

const STAFF_SALARY_NOTE_SELECT = `id, staff_id, staff_name, staff_initial, staff_title, job_category,
  door_no, street, post, taluk, district, state, pincode, mobile_1, salary_1,
  CAST(joined_date AS CHAR) AS joined_date`;

function normalizeReportDate(val) {
  const raw = String(val || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return raw;
}

function formatSalaryNoteStaffName(row) {
  const title = row.staff_title ? `${row.staff_title}. ` : '';
  return `${title}${row.staff_initial || ''} ${row.staff_name || ''}`.trim();
}

function formatIndianMoney(val) {
  const n = Number(String(val || '').replace(/,/g, ''));
  if (Number.isNaN(n) || !String(val || '').trim()) return '';
  return n.toLocaleString('en-IN');
}

function buildStaffAddress(row) {
  const esc = escapeHtml;
  const door = String(row.door_no || '').trim();
  const street = String(row.street || '').trim();
  const post = String(row.post || '').trim();
  const taluk = String(row.taluk || '').trim();
  const district = String(row.district || '').trim();
  const pincode = String(row.pincode || '').trim();
  const state = String(row.state || '').trim();
  const mobile = String(row.mobile_1 || '').trim();
  const parts = [];
  if (door) parts.push(esc(door));
  if (street) parts.push(esc(street));
  let line = parts.join(' ');
  if (post) line += (line ? ', ' : '') + esc(post);
  if (taluk) line += (line ? ', ' : '') + esc(taluk);
  if (district) line += (line ? ',<br> ' : '') + esc(district);
  if (pincode) line += (district ? ' - ' : '') + esc(pincode);
  if (state) line += (line ? ', ' : '') + esc(state);
  if (mobile) line += (line ? '.<br>Mobile: ' : 'Mobile: ') + esc(mobile);
  return line;
}

function buildInterviewDateLabel(fromDate, toDate) {
  const fromLabel = formatDisplayDate(fromDate);
  const toLabel = formatDisplayDate(toDate);
  if (!fromLabel) return '';
  if (!toLabel || fromLabel === toLabel) return fromLabel;
  return `${fromLabel} - ${toLabel}`;
}

async function loadCategoryNameMap() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, category_name FROM edu_setup_tb
     WHERE del = 1 AND category = 'Category' ORDER BY category_order ASC`,
  );
  return Object.fromEntries(rows.map((r) => [String(r.id), r.category_name]));
}

async function loadAcademicDesignationMap(staffIds) {
  if (!staffIds.length) return {};
  const idList = staffIds.map((id) => `'${escapeSql(String(id))}'`).join(',');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.staff_id, B.name AS desg_name, D.s_name AS dept_sname
     FROM staff_designation_tb AS A
     INNER JOIN staff_desg_master AS B ON A.designation = B.id
     INNER JOIN staff_dept_master AS D ON A.department = D.id
     WHERE A.del = 1 AND A.is_academic = 1 AND B.del = 1 AND D.del = 1
       AND A.staff_id IN (${idList})
     ORDER BY A.staff_id ASC, A.id ASC`,
  );
  const map = {};
  for (const row of rows) {
    const key = String(row.staff_id);
    if (!map[key]) map[key] = { desg_name: row.desg_name, dept_sname: row.dept_sname };
  }
  return map;
}

function buildSalaryNoteReportHtml({ rows, letterDate, interviewLabel }) {
  const bodyRows = rows.map((row, i) => `<tr>
    <td style="text-align:center;vertical-align:middle;">${i + 1}</td>
    <td style="text-align:center;vertical-align:middle;">${escapeHtml(row.staffId)}</td>
    <td style="text-align:center;vertical-align:middle;">${escapeHtml(row.category)}</td>
    <td style="text-align:center;vertical-align:middle;">${escapeHtml(row.name)}</td>
    <td style="text-align:center;vertical-align:middle;">${escapeHtml(row.joinedDate)}</td>
    <td style="text-align:center;vertical-align:middle;line-height:23px;">${escapeHtml(row.designation)}<br><small>${escapeHtml(row.department)}</small></td>
    <td style="text-align:center;vertical-align:middle;"><small>${row.address}</small></td>
    <td style="text-align:center;vertical-align:middle;">${escapeHtml(row.salary)}</td>
    <td style="text-align:center;vertical-align:middle;">Full Time</td>
  </tr>`).join('');

  return `<div class="report-print salary-note-report">
    <p style="float:right;font-family:'Bookman Old Style',serif;font-size:16px;">Date: ${escapeHtml(formatDisplayDate(letterDate) || letterDate)}</p>
    <p style="clear:both;text-align:center;font-family:'Bookman Old Style',serif;font-size:18px;"><strong>PROCEEDING OF THE STAFF SELECTION COMMITTEE<br>(Interview held on ${escapeHtml(interviewLabel)})</strong></p>
    <table class="table table-bordered sal-note-table" style="font-family:'Bookman Old Style',serif;text-align:center;">
      <thead>
        <tr class="table-secondary">
          <th style="text-align:center;">#</th>
          <th style="text-align:center;">Staff ID</th>
          <th style="text-align:center;">Category</th>
          <th style="text-align:center;">Staff Name</th>
          <th style="text-align:center;">Joining Date</th>
          <th style="text-align:center;">Desig./<br>Dept.</th>
          <th style="text-align:center;">Address &amp; Mobile No.</th>
          <th style="text-align:center;">Starting Pay</th>
          <th style="text-align:center;">No of Days</th>
        </tr>
      </thead>
      <tbody>${bodyRows || '<tr><td colspan="9" class="text-center text-muted">No staff found for the selected date range.</td></tr>'}</tbody>
    </table>
    <table width="100%" style="font-family:'Bookman Old Style',serif;text-align:center;margin-top:2rem;">
      <tr>
        <td valign="bottom"><p style="font-size:15px;text-align:center;"><strong>Prof.Dr.S.Magesh Kumar,PHD</strong><br><small>Principal</small></p></td>
        <td valign="bottom"><p style="font-size:15px;text-align:center;"><strong>Dr.T.Ramesh</strong><br><small>Correspondent</small></p></td>
        <td valign="bottom"><p style="font-size:15px;text-align:center;"><strong>Thirumathi V.Lakshmi</strong><br><small>Executive Trustee / Vice President</small></p></td>
      </tr>
    </table>
  </div>`;
}

function wrapReportHtml(title, body) {
  return `<div class="report-print"><h4 class="text-center">${escapeHtml(title)}</h4>${body}</div>`;
}

function tableHtml(headers, rows) {
  const th = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const trs = rows.map((row, i) => {
    const cells = row.map((c) => `<td>${c}</td>`).join('');
    return `<tr><td>${i + 1}</td>${cells}</tr>`;
  }).join('');
  return `<table class="table table-bordered table-sm"><thead><tr><th>S.No</th>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

function attachPrintEmbedHtml(folder, filename) {
  const name = String(filename || '').trim();
  if (!name) return '';
  const url = legacyPublicFileUrl(`${folder}/${name}`);
  if (!url) return '';
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'gif', 'png'].includes(ext)) {
    return `<img src="${escapeHtml(url)}" alt="" style="max-width:760px;width:100%;height:auto;" />`;
  }
  return `<iframe src="${escapeHtml(url)}" width="760" height="1100" style="border:0;max-width:100%;" title="${escapeHtml(name)}"></iframe>`;
}

async function loadStaffForReport(fields, memberId, page, audit) {
  const staff = await resolveStaffFilter(fields);
  if (!audit?.skipLog) await logStaffModule(page, 'Generate', 'Successful', String(staff.length), memberId, audit);
  return staff;
}

const APPOINT_ORDER_SELECT = `id, staff_id, staff_name, staff_initial, staff_title, staff_gender, class_type,
  door_no, street, post, taluk, district, state, pincode,
  c_door_no, c_street, c_post, c_taluk, c_district, c_state, c_pincode,
  communication_address,
  CAST(joined_date AS CHAR) AS joined_date,
  CAST(created_dt AS CHAR) AS created_dt,
  CAST(quarters_date AS CHAR) AS quarters_date`;

const APPOINT_ORDER_STYLES = `<style>
.appoint-order-print { font-family: "Book Antiqua", "Palatino Linotype", serif; color: #000; }
.appoint-order-print #total_con {
  width: 780px; max-width: 100%; margin: 0 auto 2rem; padding: 25px 25px 0 35px;
  page-break-after: always; box-sizing: border-box;
}
.appoint-order-print .header_card {
  font-size: 22px; padding: 25px; text-align: center; text-decoration: underline; font-weight: bold;
}
.appoint-order-print .header_annexure {
  font-size: 20px; padding: 25px; text-align: right; font-weight: bold;
}
.appoint-order-print .app_content {
  font-size: 18px; padding: 8px 0; line-height: 30px;
}
.appoint-order-print .app_content2 {
  font-size: 18px; padding: 8px 0 8px 25px; line-height: 30px;
}
.appoint-order-print .app_head {
  font-size: 18px; padding: 8px 0; line-height: 15px; text-align: left; text-decoration: underline;
}
.appoint-order-print .app_texthead { font-size: 18px; text-align: left; }
.appoint-order-print .app_foot { font-size: 13px; }
.appoint-order-print .ol {
  margin: 5px 0 0 45px; padding: 0;
}
.appoint-order-print .ol li {
  font-size: 18px; list-style-type: lower-alpha; padding-bottom: 22px; padding-left: 10px;
  line-height: 20px; text-align: justify;
}
.appoint-order-print .ul { margin: 0; padding-left: 20px; }
.appoint-order-print .mark_td_bottom_border { border-bottom: 1px solid #666; }
.appoint-order-print .mark_td_left_bottom_border { border-bottom: 1px solid #666; border-left: 1px solid #666; }
.appoint-order-print .tab_text_content { margin: 0; padding: 6px; }
@media print {
  .appoint-order-print #total_con { page-break-after: always; }
}
</style>`;

function formatAppointStaffName(row) {
  const title = row.staff_title ? `${row.staff_title} ` : '';
  return `${title}${row.staff_name || ''} ${row.staff_initial || ''}`.trim();
}

function appointDegreeLevel(classType) {
  const value = String(classType || '').trim();
  if (value === 'U.G,P.G') return 'M.D.S.,';
  if (value === 'U.G') return 'B.D.S.,';
  return '';
}

function appointGenderPronouns(gender) {
  const g = String(gender || '').trim();
  if (g === 'Female') return { object: 'her', subject: 'she' };
  if (g === 'Male') return { object: 'him', subject: 'he' };
  return { object: 'his/her', subject: 'he/she' };
}

function buildAppointAddress(row, prefix = '') {
  const esc = escapeHtml;
  const p = prefix ? `${prefix}_` : '';
  const door = String(row[`${p}door_no`] ?? row.door_no ?? '').trim();
  const street = String(row[`${p}street`] ?? row.street ?? '').trim();
  const post = String(row[`${p}post`] ?? row.post ?? '').trim();
  const taluk = String(row[`${p}taluk`] ?? row.taluk ?? '').trim();
  const district = String(row[`${p}district`] ?? row.district ?? '').trim();
  const state = String(row[`${p}state`] ?? row.state ?? '').trim();
  const pincode = String(row[`${p}pincode`] ?? row.pincode ?? '').trim();
  let line = '';
  if (door) line = `${esc(door)} `;
  if (street) line += esc(street);
  if (post) line += `${line ? ',<br> ' : ''}${esc(post)}`;
  if (taluk) line += `${line ? ', ' : ''}${esc(taluk)}`;
  if (district) line += `${line ? ',<br> ' : ''}${esc(district)}`;
  if (state) line += `${line ? ', ' : ''}${esc(state)}`;
  if (pincode) line += `${district ? ' - ' : ''}${esc(pincode)}`;
  return line;
}

async function loadAppointmentOrderProfiles(ids) {
  if (!ids.length) return [];
  const idList = ids.map((id) => Number(id)).filter(Boolean).join(',');
  return prisma.$queryRawUnsafe(
    `SELECT ${APPOINT_ORDER_SELECT}
     FROM staff_profile_tb
     WHERE del = 1 AND id IN (${idList})
     ORDER BY staff_id ASC`,
  );
}

async function loadFirstDesignationMap(staffIds) {
  if (!staffIds.length) return {};
  const idList = staffIds.map((id) => `'${escapeSql(String(id))}'`).join(',');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT C.staff_id, D.name AS dept_name, G.name AS desg_name
     FROM staff_designation_tb AS C
     LEFT JOIN staff_dept_master AS D ON D.id = C.department
     LEFT JOIN staff_desg_master AS G ON G.id = C.designation
     WHERE C.del = 1 AND C.staff_id IN (${idList})
     ORDER BY C.staff_id ASC, C.id ASC`,
  );
  const map = {};
  for (const row of rows) {
    const key = String(row.staff_id);
    if (!map[key]) map[key] = row;
  }
  return map;
}

async function loadAppointmentBannerHtml() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT banner_image FROM basic_banner_tb WHERE del = 1 AND id = 1 LIMIT 1',
  );
  const image = rows[0]?.banner_image;
  if (!image) return '';
  const url = legacyPublicFileUrl(`global_images/${image}`);
  return `<img src="${escapeHtml(url)}" width="400" height="80" alt="" />`;
}

function buildAppointmentOrderPages(profile, designation, bannerHtml, institutionName) {
  const staffName = formatAppointStaffName(profile);
  const degree = appointDegreeLevel(profile.class_type);
  const pronouns = appointGenderPronouns(profile.staff_gender);
  const desg = designation?.desg_name || '';
  const dept = designation?.dept_name || '';
  const staffId = profile.staff_id;
  const profileId = profile.id;
  const createdDate = formatDisplayDate(profile.created_dt);
  const joinedDate = formatDisplayDate(profile.joined_date);
  const quartersDate = formatDisplayDate(profile.quarters_date);
  const staffAddress = buildAppointAddress(profile);
  const quartersAddress = buildAppointAddress(profile, 'c');
  const inst = institutionName || 'Adhiparasakthi Dental College and Hospital';

  const appointmentOrder = `<div id="total_con">
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td valign="bottom"><p class="app_content">Ref:APDCH/APP_ORD/${escapeHtml(staffId)}/${profileId}</p></td>
        <td valign="bottom" style="text-align:right"><p class="app_content"><strong>Date:</strong> ${escapeHtml(createdDate)}</p></td>
      </tr>
    </table>
    <div class="header_card">APPOINTMENT ORDER</div>
    <p class="app_content" style="text-align:justify;text-indent:50px;">
      On the recommendation of the staff selection committee, the undersigned is pleased to appoint
      <strong>${escapeHtml(staffName)}, ${escapeHtml(degree)}</strong> as <strong>${escapeHtml(desg)}</strong>
      in the <strong>Department of ${escapeHtml(dept)}</strong> in our Institution.
      The remuneration payable to ${pronouns.object} will be as per UGC norms.
    </p>
    <p class="app_head">The appointment is subject to the following:</p>
    <ol class="ol">
      <li>Your appointment is on a temporary basis for a probationary period of one year. The management shall review the terms of employment at the end of probation as it deems fit.</li>
      <li>If any time the management comes to know that the antecedents of the employee is not conducive and or doubtful, you are liable for such action as the management deems fit.</li>
      <li>You will be governed by the Act, Statutes, Regulations and Rules of ACMEC Trust, and the circulars issued from time to time by the college.</li>
      <li>You have to give three - month's notice to the management, in case you wants to resign and be relieved from your post. However the management retains the right to accept such resignation, depending on the situation that may prevail.</li>
      <li>You are advised to join the Institution immediately.</li>
    </ol>
    <br>
    <p class="app_content" style="text-align:right;padding-right:50px;"><strong>Principal</strong></p>
    <p class="app_foot">Copy to:</p>
    <ul class="ul"><li>Personal File</li><li>Account Section</li></ul>
    <p class="app_foot">Encl: Annexure I</p>
  </div>`;

  const annexure = `<div id="total_con">
    <div style="float:left;">${bannerHtml}</div>
    <div class="header_annexure">Annexure I</div>
    <div style="clear:both;border-top:dotted #666 2px;">&nbsp;</div>
    <p class="app_content">To<br><strong>${escapeHtml(staffName)}, ${escapeHtml(degree)}</strong><br>${escapeHtml(desg)}<br>Dept. of ${escapeHtml(dept)}</p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td width="40" valign="middle" class="mark_td_bottom_border"><p class="tab_text_content">Degree</p></td>
        <td width="200" valign="middle" class="mark_td_left_bottom_border"><p class="tab_text_content">College of Study</p></td>
      </tr>
      <tr>
        <td valign="top"><p class="app_content" style="text-indent:50px;">Salary</p></td>
        <td valign="top"><p class="app_content" style="text-indent:50px;">Salary</p></td>
      </tr>
    </table>
  </div>`;

  const joiningReport = `<div id="total_con">
    <div style="float:left;">${bannerHtml}</div>
    <div class="header_annexure">Joining Report Form</div>
    <div style="clear:both;border-top:dotted #666 2px;">&nbsp;</div>
    <p class="app_texthead">From</p>
    <p class="app_content2"><strong>${escapeHtml(staffName)}, ${escapeHtml(degree)}</strong><br>${staffAddress}</p>
    <p class="app_texthead">To</p>
    <p class="app_content2"><strong>The Principal,</strong><br>${escapeHtml(inst)}<br>Melmaruvathur - 603319.</p>
    <p class="app_texthead">Respected Sir/Madam</p>
    <p class="app_content2">Sub: Joining Report - Reg.<br>Ref: Your Appointment No. APDCH/APP_ORD/${escapeHtml(staffId)}/${profileId}, Dt: ${escapeHtml(joinedDate)}</p>
    <p class="app_content" style="text-align:justify;text-indent:50px;">
      With reference to the above, I am reporting myself for duty as <strong>${escapeHtml(desg)} Department of ${escapeHtml(dept)}</strong>
      from i.e., ____________________ (Forenoon/Afternoon).
    </p>
    <p class="app_texthead">Thanking You</p>
    <p class="app_texthead">Yours Faithfully</p>
    <br><br>
    <div style="display:flex;justify-content:space-between;">
      <p class="app_content">${escapeHtml(staffName)}</p>
      <p class="app_content">Head of the Department</p>
      <p class="app_content">Principal</p>
    </div>
  </div>`;

  let html = appointmentOrder + annexure + joiningReport;

  if (String(profile.communication_address || '').trim() === '1') {
    html += `<div id="total_con">
      <div style="float:left;">${bannerHtml}</div>
      <div class="header_annexure">Quarters Allotment Order</div>
      <div style="clear:both;border-top:dotted #666 2px;">&nbsp;</div>
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td valign="bottom"><p class="app_content">Ref:APDCH/QUARTERS_ORD/${escapeHtml(staffId)}</p></td>
          <td valign="bottom" style="text-align:right"><p class="app_content"><strong>Date:</strong> ${escapeHtml(quartersDate)}</p></td>
        </tr>
      </table>
      <p class="app_texthead">To</p>
      <p class="app_content2"><strong>${escapeHtml(staffName)}, ${escapeHtml(degree)}</strong><br>${staffAddress}</p>
      <p class="app_texthead">Respected Sir/Madam</p>
      <p class="app_content2">Ref: Your Appointment No. APDCH/APP_ORD/${escapeHtml(staffId)}/${profileId}, Dt: ${escapeHtml(createdDate)}</p>
      <p class="app_content" style="text-align:justify;text-indent:50px;">
        In continuation of our appointment order of even date, the management is pleased to provide you an accommodation in our Staff Quarters ${quartersAddress}, is allotted to <strong>${escapeHtml(staffName)}, ${escapeHtml(degree)}</strong>, ${escapeHtml(desg)} Department of ${escapeHtml(dept)}.
      </p>
      <p class="app_content" style="text-align:justify;text-indent:50px;">
        The rules and regulations for staying in the quarters must be strictly adhered to during the period of stay.
      </p>
      <br><br>
      <p class="app_content" style="text-align:right;padding-right:50px;"><strong>Principal</strong></p>
    </div>`;
  }

  return html;
}

function buildAppointmentOrderReport(profiles, designationMap, bannerHtml, institutionName) {
  const pages = profiles.map((profile) => buildAppointmentOrderPages(
    profile,
    designationMap[String(profile.id)],
    bannerHtml,
    institutionName,
  ));
  return `${APPOINT_ORDER_STYLES}<div class="report-print appoint-order-print">${pages.join('')}</div>`;
}

export async function loadAppointOrderScreen(memberId, fields = {}, audit = {}) {
  const lookups = await loadDeptDesignationLookups();
  if (!fields.Submit && !fields.search_by) {
    await logStaffModule('staff_appoint_order.php', 'View', 'Successful', '', memberId, audit);
    return { ...lookups, reportHtml: null };
  }
  const staff = await loadStaffForReport(fields, memberId, 'staff_appoint_order.php', audit);
  if (!staff.length) {
    return {
      ...lookups,
      count: 0,
      reportHtml: '<p class="text-muted">No staff found.</p>',
    };
  }

  const [profiles, designationMap, bannerHtml, brand] = await Promise.all([
    loadAppointmentOrderProfiles(staff.map((s) => s.id)),
    loadFirstDesignationMap(staff.map((s) => s.id)),
    loadAppointmentBannerHtml(),
    loadInstitutionBranding(),
  ]);

  const institutionName = [brand.institutionName, brand.address].filter(Boolean).join(' ').trim()
    || 'Adhiparasakthi Dental College and Hospital';

  return {
    ...lookups,
    count: profiles.length,
    reportHtml: buildAppointmentOrderReport(profiles, designationMap, bannerHtml, institutionName),
  };
}

export async function loadSalaryNoteScreen(memberId, fields = {}, audit = {}) {
  const categories = await getStaffCategoryOptions();
  if (!fields.Submit) {
    await logStaffModule('staff_salary_note.php', 'View', 'Successful', '', memberId, audit);
    return { categories, reportHtml: null };
  }

  const from = normalizeReportDate(fields.from_date) || new Date().toISOString().slice(0, 10);
  const to = normalizeReportDate(fields.to_date) || from;
  const letterDate = fields.letter_date || from;

  let sql = `SELECT ${STAFF_SALARY_NOTE_SELECT}
    FROM staff_profile_tb
    WHERE del = 1 AND DATE(created_dt) >= '${escapeSql(from)}' AND DATE(created_dt) <= '${escapeSql(to)}'`;
  if (fields.category && fields.category !== '0') {
    sql += ` AND job_category = '${escapeSql(String(fields.category))}'`;
  }
  sql += ' ORDER BY created_dt ASC';

  const [staffRows, categoryMap] = await Promise.all([
    prisma.$queryRawUnsafe(sql),
    loadCategoryNameMap(),
  ]);
  const designationMap = await loadAcademicDesignationMap(staffRows.map((s) => s.id));

  const rows = staffRows.map((s) => {
    const des = designationMap[String(s.id)] || {};
    return {
      staffId: s.staff_id,
      category: categoryMap[String(s.job_category)] || '',
      name: formatSalaryNoteStaffName(s),
      joinedDate: formatDisplayDate(s.joined_date),
      designation: des.desg_name || '',
      department: des.dept_sname || '',
      address: buildStaffAddress(s),
      salary: formatIndianMoney(s.salary_1),
    };
  });

  await logStaffModule('staff_salary_note.php', 'Generate', 'Successful', String(rows.length), memberId, audit);
  return {
    categories,
    letterDate,
    reportHtml: buildSalaryNoteReportHtml({
      rows,
      letterDate,
      interviewLabel: buildInterviewDateLabel(from, to),
    }),
  };
}

export async function loadIdCardScreen(memberId, fields = {}, audit = {}) {
  const lookups = await loadDeptDesignationLookups();
  if (!fields.Submit && !fields.search_by) {
    await logStaffModule('staff_id_card.php', 'View', 'Successful', '', memberId, audit);
    return { ...lookups, frontEnable: true, backEnable: true, reportHtml: null };
  }
  const staff = await loadStaffForReport(fields, memberId, 'staff_id_card.php', audit);
  const cards = [];
  for (const s of staff) {
    const des = await loadAcademicDesignation(s.id);
    const photo = await staffPhotoUrl(s.staff_id, 'idcard');
    const img = photo ? `<img src="${photo}" alt="" style="max-height:80px"/>` : '';
    cards.push(`<div class="d-inline-block border p-2 m-2" style="width:220px">
      ${fields.front_enable !== false ? `<div><strong>${escapeHtml(formatStaffName(s))}</strong><br/>${img}<br/>${escapeHtml(s.staff_id)}</div>` : ''}
      ${fields.back_enable !== false ? `<div class="mt-2 small">Dept: ${escapeHtml(des?.dept_name || '')}<br/>Desg: ${escapeHtml(des?.desg_name || '')}</div>` : ''}
    </div>`);
  }
  return { ...lookups, count: staff.length, reportHtml: wrapReportHtml('Staff ID Cards', cards.join('') || '<p>No staff found.</p>') };
}

export async function loadPhotoEmptyScreen(memberId, fields = {}, audit = {}) {
  const categories = await getStaffCategoryOptions();
  if (!fields.Submit && !fields.search_category) {
    await logStaffModule('staff_photo_empty.php', 'View', 'Successful', '', memberId, audit);
    return { categories, reportHtml: null };
  }
  const catIds = Array.isArray(fields.search_category) ? fields.search_category : (fields.search_category ? [fields.search_category] : []);
  let sql = `SELECT id, staff_id, staff_name, staff_initial, staff_title, job_category, designation
    FROM staff_profile_tb WHERE del = 1 AND ${ACTIVE}`;
  if (catIds.length) {
    const clause = catIds.map((c) => `job_category='${escapeSql(String(c))}'`).join(' OR ');
    sql += ` AND (${clause})`;
  }
  const staff = await prisma.$queryRawUnsafe(sql);
  const rows = [];
  for (const s of staff) {
    const photo = await staffPhotoUrl(s.staff_id, 'idcard');
    if (photo) continue;
    const des = await loadAcademicDesignation(s.id);
    rows.push([escapeHtml(s.staff_id), escapeHtml(formatStaffName(s)), escapeHtml(String(s.job_category)), escapeHtml(des?.desg_name || '')]);
  }
  await logStaffModule('staff_photo_empty.php', 'Generate', 'Successful', String(rows.length), memberId, audit);
  return {
    categories,
    reportHtml: wrapReportHtml('Staff Without ID Card Photo', tableHtml(['Staff ID', 'Name', 'Category', 'Designation'], rows)),
  };
}

export async function loadPhotosScreen(memberId, _fields = {}, audit = {}) {
  const departments = await prisma.$queryRawUnsafe(
    `SELECT id, name FROM staff_dept_master WHERE del = 1 AND TRIM(name) <> '' ORDER BY d_order ASC, id ASC`,
  );
  const sections = [];
  let totalCount = 0;
  let missingCount = 0;
  for (const dept of departments) {
    const staff = await prisma.$queryRawUnsafe(
      `SELECT A.id, A.staff_id, A.staff_name, A.staff_initial, A.staff_title, A.staff_profile, A.staff_photo, G.name AS desg_name
       FROM staff_profile_tb AS A
       INNER JOIN staff_designation_tb AS C ON C.staff_id = A.id AND C.del = 1 AND C.is_academic = 1
       INNER JOIN staff_desg_master AS G ON G.id = C.designation
       WHERE A.del = 1 AND ${ACTIVE.replace('releaving_date', 'A.releaving_date')}
         AND C.department = ${dept.id}
         AND C.from_date <= CURDATE()
         AND (C.to_date >= CURDATE() OR CAST(C.to_date AS CHAR) = '0000-00-00')
       ORDER BY A.staff_name ASC LIMIT 100`,
    );
    if (!staff.length) continue;
    const cards = [];
    for (const s of staff) {
      totalCount += 1;
      const photo = await staffPhotoUrl(s.staff_id, 'profile', s.staff_photo);
      if (!photo) missingCount += 1;
      const photoSrc = photo || DEFAULT_STAFF_PHOTO_URL;
      cards.push(`<div class="d-inline-block text-center m-2" style="width:120px">
        <img src="${photoSrc}" alt="${escapeHtml(formatStaffName(s))}" style="width:100px;height:120px;object-fit:cover;border:1px solid #dee2e6" onerror="this.onerror=null;this.src='${DEFAULT_STAFF_PHOTO_URL}'"/>
        <div class="small">${escapeHtml(formatStaffName(s))}</div>
        <div class="small text-muted">${escapeHtml(s.desg_name || '')}</div>
      </div>`);
    }
    sections.push(`<h5>${escapeHtml(dept.name)}</h5><div>${cards.join('')}</div>`);
  }
  await logStaffModule('staff_photos.php', 'View', 'Successful', '', memberId, audit);
  const summary = missingCount
    ? `<p class="text-muted small mb-3">${missingCount} of ${totalCount} staff do not have an ID card photo on file. Upload photos from Staff → Photo Upload (name files as <code>staffid.png</code>).</p>`
    : '';
  return { reportHtml: wrapReportHtml('Staff Photos', `${summary}${sections.join('')}` || '<p>No staff found.</p>') };
}

async function loadDciStaffRows(departmentIds) {
  if (!departmentIds?.length) return [];
  const clause = departmentIds.map((d) => `C.department=${Number(d)}`).join(' OR ');
  return prisma.$queryRawUnsafe(
    `SELECT A.id, A.staff_id, A.staff_name, A.staff_initial, A.staff_title,
            CAST(A.staff_dob AS CHAR) AS staff_dob, A.joined_date,
            D.name AS dept_name, MAX(G.name) AS desg_name
     FROM staff_profile_tb AS A
     INNER JOIN staff_designation_tb AS C ON C.staff_id = A.id
     INNER JOIN staff_dept_master AS D ON D.id = C.department
     INNER JOIN staff_desg_master AS G ON G.id = C.designation
     WHERE A.del = 1 AND C.del = 1 AND D.del = 1 AND G.del = 1
       AND ${ACTIVE.replace('releaving_date', 'A.releaving_date')}
       AND (A.job_category = '255' OR A.job_category = '271' OR A.job_category = '357')
       AND C.is_academic = 1 AND (${clause})
     GROUP BY A.id, A.staff_id, A.staff_name, A.staff_initial, A.staff_title, A.staff_dob, A.joined_date, D.name
     ORDER BY D.name, A.staff_name`,
  );
}

async function loadEduSetupMap() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT id, category_name FROM edu_setup_tb WHERE del = 1',
  );
  return Object.fromEntries(rows.map((r) => [String(r.id), r.category_name]));
}

async function loadDesgMap() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT id, name FROM staff_desg_master WHERE del = 1',
  );
  return Object.fromEntries(rows.map((r) => [String(r.id), r.name]));
}

const SAFE_FROM_DATE = `IF(CAST(from_date AS CHAR) LIKE '0000%', NULL, from_date)`;
const SAFE_TO_DATE = `IF(CAST(to_date AS CHAR) LIKE '0000%', NULL, to_date)`;

function experienceDays(fromDate, toDate) {
  if (!fromDate || String(fromDate).startsWith('0000')) return 0;
  const from = new Date(fromDate);
  const to = toDate && !String(toDate).startsWith('0000') ? new Date(toDate) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.max(0, Math.floor((to - from) / (1000 * 60 * 60 * 24)));
}

function formatTotalExperience(days) {
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const d = days % 30;
  return `${years} Years ${months} Months ${d} Days`;
}

function formatExpComponents(days) {
  if (!days || days <= 0) return '';
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const d = days % 30;
  const parts = [];
  if (years) parts.push(`${years} year${years > 1 ? 's' : ''}`);
  if (months) parts.push(`${months} month${months > 1 ? 's' : ''}`);
  if (d) parts.push(`${d} day${d > 1 ? 's' : ''}`);
  return parts.join(' ');
}

function getJune15CurrentYear() {
  const year = new Date().getFullYear();
  return new Date(year, 5, 15);
}

async function loadTnmgrStaffForDept(deptId) {
  return prisma.$queryRawUnsafe(
    `SELECT A.id, A.staff_id, A.staff_name, A.staff_initial, A.staff_title,
            CAST(A.staff_dob AS CHAR) AS staff_dob, A.joined_date, A.aadhar_no
     FROM staff_profile_tb AS A
     INNER JOIN staff_designation_tb AS C ON C.staff_id = A.id
     INNER JOIN staff_desg_master AS G ON G.id = C.designation
     WHERE A.del = 1 AND C.del = 1 AND G.del = 1
       AND ${ACTIVE.replace('releaving_date', 'A.releaving_date')}
       AND (A.job_category = '255' OR A.job_category = '271' OR A.job_category = '357')
       AND C.is_academic = 1 AND C.department = ${Number(deptId)}
     GROUP BY A.id, A.staff_id, A.staff_name, A.staff_initial, A.staff_title, A.staff_dob, A.joined_date, A.aadhar_no, G.d_order
     ORDER BY G.d_order ASC, A.joined_date ASC`,
  );
}

async function loadFirstAcademicDesignation(profileId, desgMap) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT designation FROM staff_designation_tb
     WHERE del = 1 AND staff_id = ${Number(profileId)} AND is_academic = 1
     ORDER BY id ASC LIMIT 1`,
  );
  return desgMap[String(rows[0]?.designation)] || '';
}

async function computeTnmgrExperience(profileId, joinedDate) {
  let previousDays = 0;
  const extRows = await prisma.$queryRawUnsafe(
    `SELECT ${SAFE_FROM_DATE} AS from_date, ${SAFE_TO_DATE} AS to_date
     FROM staff_experience_tb
     WHERE del = 1 AND staff_id = '${escapeSql(String(profileId))}'
       AND CAST(from_date AS CHAR) NOT LIKE '0000%'
     ORDER BY id ASC`,
  );
  for (const row of extRows) {
    previousDays += experienceDays(row.from_date, row.to_date);
  }

  const june15 = getJune15CurrentYear();
  const presentDays = joinedDate && !String(joinedDate).startsWith('0000')
    ? experienceDays(joinedDate, june15)
    : 0;
  const totalDays = previousDays + presentDays;

  return {
    previousService: previousDays > 0 ? formatTotalExperience(previousDays) : '',
    presentInstitute: formatExpComponents(presentDays),
    totalAsOfJune15: totalDays > 0 ? formatTotalExperience(totalDays) : '',
  };
}

async function buildTnmgrReportTable(departmentIds, desgMap) {
  let body = `<table class="table table-bordered table-sm"><thead><tr>
    <th>S.No.</th><th>Designation</th><th>Faculty Name</th><th>Date of Birth</th>
    <th>Original Affidavit with date</th><th>DCI UID(if available &amp; Aadhar No)</th><th>Form 16</th>
    <th>Total Service College wise in the all previous institutes(attach appendix)</th>
    <th>Joined Date</th><th>Experience in Present Institute</th>
    <th>Total Experience as on 15th june of current year</th>
    <th>Present during Inspection with signature or absent</th>
  </tr></thead><tbody>`;

  let counter = 0;
  let hasRows = false;
  for (const deptId of departmentIds) {
    const deptRows = await prisma.$queryRawUnsafe(
      `SELECT name FROM staff_dept_master WHERE del = 1 AND id = ${Number(deptId)} LIMIT 1`,
    );
    const deptName = deptRows[0]?.name;
    const staff = await loadTnmgrStaffForDept(deptId);
    if (!staff.length) continue;

    hasRows = true;
    body += `<tr><td colspan="12" style="font-weight:bold">${escapeHtml(deptName || '')}</td></tr>`;

    for (const s of staff) {
      const designation = await loadFirstAcademicDesignation(s.id, desgMap);
      const exp = await computeTnmgrExperience(s.id, s.joined_date);
      counter += 1;
      body += `<tr>
        <td>${counter}</td>
        <td>${escapeHtml(designation)}</td>
        <td>${escapeHtml(formatStaffName(s))}</td>
        <td>${escapeHtml(formatDisplayDate(s.staff_dob))}</td>
        <td></td>
        <td>${escapeHtml(s.aadhar_no || '')}</td>
        <td></td>
        <td>${escapeHtml(exp.previousService)}</td>
        <td>${escapeHtml(formatDisplayDate(s.joined_date))}</td>
        <td>${escapeHtml(exp.presentInstitute)}</td>
        <td>${escapeHtml(exp.totalAsOfJune15)}</td>
        <td></td>
      </tr>`;
    }
  }

  body += '</tbody></table>';
  return hasRows ? body : '';
}

async function loadInspectionStaffReportScreen(memberId, fields, audit, title, logPage) {
  const departments = await loadTeachingDepartments();
  if (!fields.Submit && !fields.search_category) {
    await logStaffModule(logPage, 'View', 'Successful', '', memberId, audit);
    return { departments, reportHtml: null };
  }
  const deptIds = (Array.isArray(fields.search_category) ? fields.search_category : [fields.search_category])
    .map(Number)
    .filter(Boolean);
  const desgMap = await loadDesgMap();
  const reportBody = deptIds.length
    ? await buildTnmgrReportTable(deptIds, desgMap)
    : '';
  await logStaffModule(logPage, 'Generate', 'Successful', String(deptIds.length), memberId, audit);
  return {
    departments,
    reportHtml: wrapReportHtml(
      title,
      reportBody || '<p class="text-muted">No staff found for the selected department(s).</p>',
    ),
  };
}

export async function loadDciReportScreen(memberId, fields = {}, audit = {}) {
  return loadInspectionStaffReportScreen(memberId, fields, audit, 'DCI Report', 'staff_dci_report.php');
}

export async function loadTnmgrReportScreen(memberId, fields = {}, audit = {}) {
  return loadInspectionStaffReportScreen(memberId, fields, audit, 'TNMGRMU Report', 'staff_tnmgr_report.php');
}

export async function loadPublicationDciScreen(memberId, fields = {}, audit = {}) {
  const departments = await loadTeachingDepartments();
  if (!fields.Submit && !fields.search_category) {
    await logStaffModule('dci_staff_publication_report.php', 'View', 'Successful', '', memberId, audit);
    return { departments, reportHtml: null };
  }
  const deptIds = Array.isArray(fields.search_category) ? fields.search_category.map(Number) : [Number(fields.search_category)];
  const staff = await loadDciStaffRows(deptIds.filter(Boolean));
  const staffIds = staff.map((s) => Number(s.id)).filter((id) => Number.isInteger(id));
  const allPubs = staffIds.length
    ? await prisma.$queryRawUnsafe(
      `SELECT staff_id, p_title_name, p_journal_name, p_year FROM staff_publication_tb
       WHERE del = 1 AND staff_id IN (${staffIds.join(',')}) ORDER BY staff_id, p_year DESC`,
    )
    : [];
  const pubsByStaffId = new Map();
  for (const p of allPubs) {
    const key = Number(p.staff_id);
    if (!pubsByStaffId.has(key)) pubsByStaffId.set(key, []);
    pubsByStaffId.get(key).push(p);
  }
  const blocks = [];
  for (const s of staff) {
    const pubs = pubsByStaffId.get(Number(s.id)) || [];
    if (!pubs.length) continue;
    const pubRows = pubs.map((p) => [
      escapeHtml(p.p_title_name),
      escapeHtml(p.p_journal_name),
      escapeHtml(String(p.p_year || '')),
    ]);
    blocks.push(`<div class="cis-report-section"><div class="cis-report-section-inner">
      <h5>${escapeHtml(formatStaffName(s))} (${escapeHtml(s.staff_id)})</h5>
      ${tableHtml(['Title', 'Journal', 'Year'], pubRows)}
      </div></div>`);
  }
  await logStaffModule('dci_staff_publication_report.php', 'Generate', 'Successful', String(blocks.length), memberId, audit);
  return { departments, reportHtml: wrapReportHtml('DCI Publication Report', blocks.join('') || '<p>No publications found.</p>') };
}

export async function loadPublicationTnmgrScreen(memberId, fields = {}, audit = {}) {
  const result = await loadPublicationDciScreen(memberId, fields, { ...audit, skipLog: true });
  if (result.reportHtml) result.reportHtml = result.reportHtml.replace('DCI Publication', 'TNMGRMU Publication');
  await logStaffModule('tnmgrmu_staff_publication_report.php', fields.Submit ? 'Generate' : 'View', 'Successful', '', memberId, audit);
  return result;
}

export { loadAffidavitDciScreen, loadAffidavitTnmgrScreen } from './affidavitScreens.js';

export async function loadAttachPrintScreen(memberId, fields = {}, audit = {}) {
  const lookups = await loadDeptDesignationLookups();
  if (!fields.Submit && !fields.search_by) {
    await logStaffModule('staff_attach_print.php', 'View', 'Successful', '', memberId, audit);
    return { ...lookups, reportHtml: null };
  }
  const staff = await loadStaffForReport(fields, memberId, 'staff_attach_print.php', audit);
  const affidavitOnly = Number(fields.affidavit) === 1 || fields.affidavit === true;
  const blocks = [];
  for (const s of staff) {
    const profileId = escapeSql(String(s.id));
    let pubSql = `SELECT p_title_name, p_attachment FROM staff_publication_tb
      WHERE del = 1 AND staff_id = '${profileId}' AND TRIM(p_attachment) <> ''`;
    if (affidavitOnly) pubSql += ' AND p_main = 1';
    pubSql += ' ORDER BY id ASC';
    const pubs = await prisma.$queryRawUnsafe(pubSql);
    const atts = await prisma.$queryRawUnsafe(
      `SELECT attach_file FROM staff_attachment_tb
       WHERE del = 1 AND s_id = ${Number(s.id)} AND TRIM(attach_file) <> ''
       ORDER BY id ASC`,
    );
    const rows = [];
    for (const p of pubs) {
      const embed = attachPrintEmbedHtml('publication_docs', p.p_attachment);
      if (embed) {
        rows.push(`<tr><td valign="middle"><h4>${escapeHtml(p.p_title_name || '')}</h4>${embed}</td></tr>`);
      }
    }
    for (const a of atts) {
      const embed = attachPrintEmbedHtml('staff_documents', a.attach_file);
      if (embed) rows.push(`<tr><td valign="middle">${embed}</td></tr>`);
    }
    if (rows.length) {
      blocks.push(`<div style="page-break-after:always;"><table cellpadding="3" cellspacing="0" class="table table-bordered table-sm" border="1">${rows.join('')}</table></div>`);
    }
  }
  const body = staff.length
    ? `<p class="text-danger">Search results: ${staff.length} found...</p>${blocks.join('') || '<p>No attachment documents found for the selected staff.</p>'}`
    : '<p>No staff found.</p>';
  return { ...lookups, reportHtml: wrapReportHtml('Staff Attachments Print', body) };
}

async function loadOrgPositionAssignments(mode) {
  const map = new Map();
  if (mode === 'department') {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT pd.position, COALESCE(d.name, pd.department) AS label
       FROM web_positions_dept pd
       LEFT JOIN staff_dept_master d ON d.id = pd.department AND d.del = 1
       WHERE pd.del = 1`,
    );
    for (const row of rows) {
      map.set(String(row.position).toLowerCase(), String(row.label || row.position));
    }
    return map;
  }
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ps.position,
            TRIM(CONCAT(COALESCE(p.staff_name, ''), CASE WHEN p.staff_id IS NULL OR p.staff_id = '' THEN '' ELSE CONCAT(' (', p.staff_id, ')') END)) AS label
     FROM web_positions_setup ps
     LEFT JOIN staff_profile_tb p ON p.id = ps.admin AND p.del = 1
     WHERE ps.del = 1`,
  );
  for (const row of rows) {
    if (row.label) map.set(String(row.position).toLowerCase(), String(row.label));
  }
  return map;
}

function orgPositionLabel(positionKey, assignments) {
  const label = assignments.get(String(positionKey || '').toLowerCase());
  return label ? escapeHtml(label) : null;
}

export async function loadOrgStructureScreen(memberId, fields = {}, audit = {}) {
  const mode = fields.mode || 'employee';
  if (!fields.Submit) {
    await logStaffModule('org_structure.php', 'View', 'Successful', '', memberId, audit);
    return { mode, removeBackground: !!fields.remove_background, reportHtml: null };
  }

  const levels = await prisma.$queryRawUnsafe(
    'SELECT id, level_title, level_order FROM web_positions_level WHERE del = 1 ORDER BY level_order ASC',
  );
  if (!levels.length) {
    await logStaffModule('org_structure.php', 'Generate', 'Successful', '0', memberId, audit);
    return {
      mode,
      removeBackground: !!fields.remove_background,
      reportHtml: wrapReportHtml(
        `Org Structure (${mode})`,
        '<p>No org chart levels configured. Set up levels in Staff → Org Chart Config.</p>',
      ),
    };
  }

  const assignments = await loadOrgPositionAssignments(mode);
  const parts = [];
  for (const lvl of levels) {
    const positions = await prisma.$queryRawUnsafe(
      `SELECT level_desc, level_head
       FROM web_positions_dlevel
       WHERE del = 1 AND level_id = ${Number(lvl.id)}
       ORDER BY id ASC`,
    );
    if (!positions.length) continue;
    const lis = positions.map((p) => {
      const holder = orgPositionLabel(p.level_desc, assignments);
      const holderHtml = holder ? ` — ${holder}` : '';
      return `<li>${escapeHtml(p.level_desc)}${holderHtml} → ${escapeHtml(p.level_head || '—')}</li>`;
    }).join('');
    parts.push(`<h5>${escapeHtml(lvl.level_title)}</h5><ul>${lis}</ul>`);
  }

  await logStaffModule('org_structure.php', 'Generate', 'Successful', String(parts.length), memberId, audit);
  return {
    mode,
    removeBackground: !!fields.remove_background,
    reportHtml: wrapReportHtml(
      `Org Structure (${mode})`,
      parts.join('')
        || '<p>Levels exist but no positions are configured. Add positions in Staff → Org Chart Config.</p>',
    ),
  };
}
