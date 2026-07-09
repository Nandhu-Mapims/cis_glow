import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/index.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { insertLog } from '../logService.js';
import { legacyPublicFileUrl } from '../../utils/fileUrls.js';

const PAGE = 'staff_profile_export_more.php';

const STATIC_FIELD_GROUPS = {
  'Staff Details': [
    'Staff ID', 'Staff Full Name', 'Staff Title', 'Staff Name', 'Staff Initial',
  ],
  'Job Details': [
    'Joined Date', 'Category', 'Department', 'Designation', 'Levels', 'Payroll Type',
  ],
  'Personal 1': [
    'Gender', 'DOB', 'Blood Group', 'Religion', 'Community', 'Caste', 'Marital Status', 'Age',
  ],
  'Personal 2': [
    'Father Name', 'Mobile1', 'Mobile2', 'Email', 'Discontinued', 'Reason',
  ],
  'Proof of Residence & Photo ID': [
    'Aadhar No', 'Passport No', 'Driving License', 'Voter-ID No',
    'Electricity Service No.', 'PAN No.', 'Quarters/Rental Agreement',
  ],
  Experience: ['Previous Experience', 'APDCH Experience', 'Total Experience'],
  'Permanent Address': [
    'Full Address', 'Door No.', 'Street', 'Post', 'Taluk', 'District', 'State', 'Pincode',
  ],
  'Communication Address': [
    'Full_Address', 'Door_No.', 'Street.', 'Post.', 'Taluk.', 'District.', 'State.', 'Pincode.',
  ],
  'Educational Qualification': [
    'UG', 'UG YOP', 'UG College', 'UG Reg', 'PG', 'PG YOP', 'PG College', 'PG Reg',
    'P.Hd', 'P.Hd Year', 'UG University', 'PG University', 'P.Hd University', 'Educational Qualification',
  ],
  'Bank Details': [
    'A/c No.', 'A/c Name', 'Bank Name', 'Branch', 'IFSC Code', 'PAN No.', 'PF Acc.No.', 'ESI No.',
  ],
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatDisplayDate(val) {
  if (!val || String(val).startsWith('0000-00-00')) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function calcAge(dob) {
  if (!dob || String(dob).startsWith('0000-00-00')) return '';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const md = today.getMonth() * 100 + today.getDate();
  const bd = d.getMonth() * 100 + d.getDate();
  if (md < bd) age -= 1;
  return String(age);
}

function buildAddress(parts) {
  let ref = '';
  if (parts.door) ref = parts.door;
  if (parts.street) ref += ` ${parts.street}`;
  if (parts.post) ref += `, ${parts.post}`;
  if (parts.taluk) ref += `, ${parts.taluk}`;
  if (parts.district) ref += `, ${parts.district}`;
  if (parts.state) ref += `, ${parts.state}`;
  if (parts.pincode) ref += ` - ${parts.pincode}`;
  return ref.trim();
}

async function loadLookups() {
  const [eduSetup, departments, designations, categories, payrollTypes] = await Promise.all([
    prisma.edu_setup_tb.findMany({ where: { del: 1 }, orderBy: { category_order: 'asc' } }),
    prisma.staff_dept_master.findMany({ where: { del: 1 }, orderBy: { d_order: 'asc' } }),
    prisma.staff_desg_master.findMany({ where: { del: 1 }, orderBy: { d_order: 'asc' } }),
    prisma.master_setup.findMany({ where: { del: { not: 0 } }, orderBy: { category_order: 'asc' } }),
    prisma.basic_setup_payroll_tb.findMany({ where: { del: 1 }, orderBy: { id: 'asc' } }),
  ]);

  const eduMap = {};
  for (const row of eduSetup) eduMap[row.id] = row.category_name;

  const deptMap = {};
  for (const row of departments) deptMap[row.id] = row.name;

  const desgMap = {};
  for (const row of designations) desgMap[row.id] = row.name;

  const categoryMap = {};
  for (const row of categories) categoryMap[row.id] = row.category_name;

  const payrollMap = {};
  for (const row of payrollTypes) payrollMap[row.id] = row.payroll_type;

  return { eduMap, deptMap, desgMap, categoryMap, payrollMap };
}

async function getStaffOrderClause() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT GROUP_CONCAT(s_order SEPARATOR ', ') AS staff_order FROM staff_order LIMIT 1`,
  );
  const order = String(rows[0]?.staff_order || '').trim().replace(/,\s*$/, '');
  if (!order) return ' ORDER BY A.staff_id ASC';
  return ` ORDER BY FIELD(A.id, ${order})`;
}

async function loadEducationSummary(staffId, courseNameId, field, eduMap) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT degree_name, major_name, yop, institution, regi_no, reg_council, university
     FROM staff_education_tb
     WHERE del = 1 AND staff_id = '${escapeSql(staffId)}' AND course_name = '${escapeSql(courseNameId)}'
     ORDER BY yop+0 ASC`,
  );
  const parts = [];
  for (const row of rows) {
    if (field === 'degree') parts.push(eduMap[row.degree_name] || '');
    else if (field === 'yop') parts.push(row.yop || '');
    else if (field === 'college') parts.push(row.institution || '');
    else if (field === 'reg') {
      const council = eduMap[row.reg_council] || '';
      parts.push(`${row.regi_no || ''}${council ? ` / ${council}` : ''}`.trim());
    } else if (field === 'university') parts.push(eduMap[row.university] || '');
  }
  return parts.filter(Boolean).join(', ');
}

async function loadCurrentDepartments(staffId, currentDate, deptMap) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT department FROM staff_designation_tb
     WHERE del = 1 AND staff_id = '${escapeSql(staffId)}'
       AND from_date <= '${escapeSql(currentDate)}'
       AND (to_date >= '${escapeSql(currentDate)}' OR CAST(to_date AS CHAR) = '0000-00-00')
     ORDER BY id ASC`,
  );
  return rows.map((r) => deptMap[r.department]).filter(Boolean).join(', ');
}

async function loadCurrentDesignations(staffId, currentDate, deptMap, desgMap) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT department, designation FROM staff_designation_tb
     WHERE del = 1 AND staff_id = '${escapeSql(staffId)}'
       AND from_date <= '${escapeSql(currentDate)}'
       AND (to_date >= '${escapeSql(currentDate)}' OR CAST(to_date AS CHAR) = '0000-00-00')
     ORDER BY id ASC`,
  );
  return rows.map((r) => {
    const desg = desgMap[r.designation] || '';
    const dept = deptMap[r.department] ? `(${deptMap[r.department]})` : '';
    return `${desg}${dept}`.trim();
  }).filter(Boolean).join(', ');
}

async function resolveField(field, staff, ctx) {
  const val = (v) => (v == null ? '' : String(v));
  const { eduMap, deptMap, desgMap, categoryMap, payrollMap, currentDate } = ctx;

  switch (field) {
    case 'Staff ID': return val(staff.staff_id);
    case 'Staff Full Name':
      return `${val(staff.staff_title)} ${val(staff.staff_name)} ${val(staff.staff_initial)}`.trim();
    case 'Staff Title': return val(staff.staff_title);
    case 'Staff Name': return val(staff.staff_name);
    case 'Staff Initial': return val(staff.staff_initial);
    case 'Joined Date': return formatDisplayDate(staff.joined_date);
    case 'Category': return val(categoryMap[staff.job_category]);
    case 'Department': return loadCurrentDepartments(staff.id, currentDate, deptMap);
    case 'Designation': return loadCurrentDesignations(staff.id, currentDate, deptMap, desgMap);
    case 'Levels': return val(staff.class_type);
    case 'Payroll Type': return val(payrollMap[staff.payroll_type]);
    case 'Gender': return val(staff.staff_gender);
    case 'DOB': return formatDisplayDate(staff.staff_dob);
    case 'Blood Group': return val(categoryMap[staff.staff_bg]);
    case 'Religion': return val(categoryMap[staff.staff_religion]);
    case 'Community': return val(categoryMap[staff.staff_community]);
    case 'Caste': return val(staff.staff_caste);
    case 'Marital Status': return val(staff.marital_status);
    case 'Age': return calcAge(staff.staff_dob);
    case 'Father Name': return val(staff.father_name);
    case 'Mobile1': return val(staff.mobile_1);
    case 'Mobile2': return val(staff.mobile_2);
    case 'Email': return val(staff.email_id);
    case 'Discontinued': return formatDisplayDate(staff.releaving_date);
    case 'Reason': return val(staff.releaving_info);
    case 'Aadhar No': return val(staff.aadhar_no);
    case 'Passport No': return val(staff.passport_no);
    case 'Driving License': return val(staff.driving_lic);
    case 'Voter-ID No': return val(staff.voter_id);
    case 'Electricity Service No.': return val(staff.eb_proof);
    case 'PAN No.': return val(staff.pan_no);
    case 'Quarters/Rental Agreement': return val(staff.rental_agree);
    case 'Full Address':
      return buildAddress({
        door: staff.door_no, street: staff.street, post: staff.post,
        taluk: staff.taluk, district: staff.district, state: staff.state, pincode: staff.pincode,
      });
    case 'Door No.': return val(staff.door_no);
    case 'Street': return val(staff.street);
    case 'Post': return val(staff.post);
    case 'Taluk': return val(staff.taluk);
    case 'District': return val(staff.district);
    case 'State': return val(staff.state);
    case 'Pincode': return val(staff.pincode);
    case 'Full_Address':
      return buildAddress({
        door: staff.c_door_no, street: staff.c_street, post: staff.c_post,
        taluk: staff.c_taluk, district: staff.c_district, state: staff.c_state, pincode: staff.c_pincode,
      });
    case 'Door_No.': return val(staff.c_door_no);
    case 'Street.': return val(staff.c_street);
    case 'Post.': return val(staff.c_post);
    case 'Taluk.': return val(staff.c_taluk);
    case 'District.': return val(staff.c_district);
    case 'State.': return val(staff.c_state);
    case 'Pincode.': return val(staff.c_pincode);
    case 'UG': return loadEducationSummary(staff.id, '5', 'degree', eduMap);
    case 'UG YOP': return loadEducationSummary(staff.id, '5', 'yop', eduMap);
    case 'UG College': return loadEducationSummary(staff.id, '5', 'college', eduMap);
    case 'UG Reg': return loadEducationSummary(staff.id, '5', 'reg', eduMap);
    case 'UG University': return loadEducationSummary(staff.id, '5', 'university', eduMap);
    case 'PG': return loadEducationSummary(staff.id, '6', 'degree', eduMap);
    case 'PG YOP': return loadEducationSummary(staff.id, '6', 'yop', eduMap);
    case 'PG College': return loadEducationSummary(staff.id, '6', 'college', eduMap);
    case 'PG Reg': return loadEducationSummary(staff.id, '6', 'reg', eduMap);
    case 'PG University': return loadEducationSummary(staff.id, '6', 'university', eduMap);
    case 'P.Hd': return loadEducationSummary(staff.id, '159', 'degree', eduMap);
    case 'P.Hd Year': return loadEducationSummary(staff.id, '159', 'yop', eduMap);
    case 'P.Hd University': return loadEducationSummary(staff.id, '159', 'university', eduMap);
    case 'Educational Qualification': {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT degree_name, major_name FROM staff_education_tb
         WHERE del = 1 AND staff_id = '${escapeSql(staff.id)}'
           AND course_name IN ('5','6','7','4','80','3','159')
         ORDER BY FIELD(course_name, '5','6','7','4','80','3','159'), yop+0 ASC`,
      );
      return rows.map((r) => {
        const deg = eduMap[r.degree_name] || '';
        const maj = eduMap[r.major_name] ? ` - ${eduMap[r.major_name]}` : '';
        return `${deg}${maj}`.trim();
      }).filter(Boolean).join(', ');
    }
    case 'A/c No.': return val(staff.b_ac_no);
    case 'A/c Name': return val(staff.b_ac_name);
    case 'Bank Name': return val(eduMap[staff.b_name]);
    case 'Branch': return val(staff.b_branch);
    case 'IFSC Code': return val(staff.b_ifsc);
    case 'PF Acc.No.': return val(staff.pfa_no);
    case 'ESI No.': return val(staff.esi_no);
    case 'Previous Experience':
    case 'APDCH Experience':
    case 'Total Experience':
      return '';
    default:
      return '';
  }
}

export async function getStaffReportFields() {
  const groups = Object.entries(STATIC_FIELD_GROUPS).map(([name, fields]) => ({
    name,
    fields: [...fields],
  }));
  return { groups };
}

export async function getStaffReportFilters() {
  const categories = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT B.id, B.category_name
     FROM staff_profile_tb AS A
     INNER JOIN edu_setup_tb AS B ON A.job_category = B.id
     WHERE A.del = 1
       AND (A.releaving_date > DATE(NOW()) OR CAST(A.releaving_date AS CHAR) = '0000-00-00')
       AND B.category = 'Category'
     ORDER BY A.job_category ASC`,
  );

  return {
    categoryOptions: [
      { value: '', label: 'All Categories' },
      ...categories.map((row) => ({
        value: String(row.id),
        label: row.category_name,
      })),
    ],
  };
}

async function loadStaffRows(categoryId, discontinued) {
  let filter = '';
  if (categoryId) {
    filter += ` AND A.job_category = '${escapeSql(categoryId)}'`;
  }
  if (discontinued === 'Regular') {
    filter += " AND (A.releaving_date = '0000-00-00' OR A.releaving_date >= DATE(NOW()))";
  } else if (discontinued === 'Discontinue') {
    filter += " AND (A.releaving_date != '0000-00-00' AND A.releaving_date < DATE(NOW()))";
  }

  const orderClause = await getStaffOrderClause();
  return prisma.$queryRawUnsafe(
    `SELECT A.*
     FROM staff_profile_tb AS A
     WHERE A.del = 1 ${filter}
     ${orderClause.replace('A.id', 'A.id')}`,
  );
}

function buildTableHtml(fields, rows, showSerialNo) {
  let header = `<table cellpadding="3" cellspacing="0" class="table table-bordered"><thead><tr>`;
  if (showSerialNo) header += '<th>S.No.</th>';
  for (const field of fields) {
    header += `<th>${escapeHtml(field)}</th>`;
  }
  header += '</tr></thead><tbody>';

  let body = '';
  for (const row of rows) {
    body += '<tr>';
    if (showSerialNo) body += `<td>${row.serial}</td>`;
    for (const cell of row.cells) {
      body += `<td nowrap valign="top">${escapeHtml(cell)}&nbsp;</td>`;
    }
    body += '</tr>';
  }
  return `${header}${body}</tbody></table>`;
}

export async function generateStaffReport(payload, memberId, audit = {}) {
  const fields = Array.isArray(payload.fields)
    ? payload.fields.map((f) => String(f).trim()).filter(Boolean)
    : String(payload.fields || '').split(',').map((f) => f.trim()).filter(Boolean);

  if (!fields.length) {
    return { error: 'At least one report field is required' };
  }

  const format = payload.format === 'xls' ? 'xls' : 'html';
  const discontinued = ['Regular', 'Discontinue', 'All'].includes(payload.discontinued)
    ? payload.discontinued
    : 'Regular';
  const showSerialNo = Boolean(payload.showSerialNo);
  const showHeader = Boolean(payload.showHeader);
  const reportTitle = String(payload.reportTitle || '');
  const categoryId = String(payload.categoryId || '').trim();

  const lookups = await loadLookups();
  const currentDate = new Date().toISOString().slice(0, 10);
  const ctx = { ...lookups, currentDate };

  const staffRows = await loadStaffRows(categoryId, discontinued);
  const tableRows = [];
  let counter = 1;

  for (const staff of staffRows) {
    const cells = [];
    for (const field of fields) {
      const resolved = await resolveField(field, staff, ctx);
      cells.push(typeof resolved === 'string' ? resolved : await resolved);
    }
    tableRows.push({ serial: counter, cells });
    counter += 1;
  }

  await insertLog(
    [PAGE, 'Report', 'Successful', fields.join(','), new Date(), audit.ip || '', audit.userAgent || '', memberId],
    audit.sessionId || '',
  );

  if (format === 'xls') {
    const headers = [...fields];
    if (showSerialNo) headers.unshift('S.No.');
    const lines = [headers.map(csvCell).join(',')];
    for (const row of tableRows) {
      const cells = showSerialNo ? [row.serial, ...row.cells] : row.cells;
      lines.push(cells.map(csvCell).join(','));
    }
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const filename = `staff_profile_report_${timestamp}.csv`;
    const excelDir = path.join(config.legacyFilesPath, 'excel');
    await fs.mkdir(excelDir, { recursive: true });
    await fs.writeFile(path.join(excelDir, filename), `\uFEFF${lines.join('\n')}`, 'utf8');
    return {
      downloadUrl: legacyPublicFileUrl(`excel/${filename}`),
      filename,
      format: 'csv',
    };
  }

  const categoryLabel = categoryId
    ? (lookups.eduMap[categoryId] || 'Selected Category')
    : 'All Categories';

  const metaBlock = showHeader
    ? `<p><strong>Staff Report</strong>${reportTitle ? `<br>${escapeHtml(reportTitle)}` : ''}<br>${escapeHtml(categoryLabel)}</p>`
    : `<p><strong>${escapeHtml(reportTitle || categoryLabel)}</strong></p>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Staff Report</title>
<link href="/legacy/css/bootstrap.min.css" rel="stylesheet">
<link href="/legacy/css/print_style.css?v=1" rel="stylesheet">
</head><body onload="window.print()" style="padding:30px;">
${metaBlock}
${buildTableHtml(fields, tableRows, showSerialNo)}
</body></html>`;

  if (!html || html.length < 50) {
    return { error: 'Report generation returned no data' };
  }

  return { html };
}
