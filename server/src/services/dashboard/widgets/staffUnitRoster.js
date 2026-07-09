import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { getStaffOrder } from '../../attendance/staffAttendanceCore.js';

function formatStaffName(row) {
  let title = row.staff_title || '';
  const name = row.staff_name || '';
  const initial = row.staff_initial || '';
  if (String(title).trim()) title = `${title}. `;
  else title = '';
  return `${title}${name} ${initial}`.trim();
}

async function loadRoster(unitType, academicDate) {
  const d = escapeSql(academicDate);
  const departments = await prisma.$queryRawUnsafe(
    `SELECT id, name FROM staff_dept_master WHERE del = 1 ORDER BY d_order ASC`,
  );
  const deptMap = Object.fromEntries(departments.map((r) => [String(r.id), r.name || '']));

  const designations = await prisma.$queryRawUnsafe(
    `SELECT id, name FROM staff_desg_master WHERE del = 1 ORDER BY d_order ASC`,
  );
  const desgMap = Object.fromEntries(designations.map((r) => [String(r.id), r.name || '']));

  const staffOrder = await getStaffOrder();
  const orderClause = staffOrder ? ` ORDER BY FIELD(A.id, ${staffOrder})` : '';

  const staffRows = await prisma.$queryRawUnsafe(
    `SELECT A.id, A.staff_id, A.staff_title, A.staff_name, A.staff_initial
     FROM staff_profile_tb AS A
     INNER JOIN edu_setup_tb AS B ON A.job_category = B.id
     WHERE A.del = 1
       AND (A.releaving_date = '0000-00-00' OR A.releaving_date > '${d}')
       AND A.job_category = 255 AND B.category = 'Category'
     ${orderClause}`,
  );

  const deptData = {};
  for (const row of staffRows) {
    const stId = row.id;
    const desgRows = await prisma.$queryRawUnsafe(
      `SELECT department, designation FROM staff_designation_tb
       WHERE del = 1 AND staff_id = '${escapeSql(String(stId))}'
         AND is_academic = 1 AND unit_type = '${escapeSql(unitType)}'
       ORDER BY id DESC LIMIT 1`,
    );
    if (!desgRows.length) continue;

    const deptId = String(desgRows[0].department || '0');
    const desgName = desgMap[String(desgRows[0].designation)] || '';
    const staffName = formatStaffName(row);
    if (!deptData[deptId]) deptData[deptId] = [];
    deptData[deptId].push(`
      <tr>
        <td nowrap valign="top">${stId}&nbsp;</td>
        <td nowrap valign="top">${row.staff_id || ''}&nbsp;</td>
        <td nowrap valign="top">${staffName}&nbsp;</td>
        <td valign="top">${desgName}&nbsp;</td>
      </tr>`);
  }

  let tableBody = '';
  for (const dept of departments) {
    const deptId = String(dept.id);
    const rows = deptData[deptId];
    if (!rows?.length) continue;
    tableBody += `<tr bgcolor="#F4F4F4"><td nowrap valign="top" colspan="4"><strong>${dept.name || ''}</strong></td></tr>`;
    tableBody += rows.join('');
  }

  const colspan = 4;
  const tableHtml = `<table cellpadding="5" cellspacing="0" class="table table-bordered">
  <thead>
  <tr bgcolor="#CCCCCC">
  <th width="150" nowrap height="30" align="left">Norms</th>
  <th width="50" nowrap height="30" align="left">S.ID</th>
  <th width="250" nowrap height="30" align="left">Staff Name</th>
  <th width="150" nowrap height="30" align="left">Designation</th>
  </tr></thead><tfoot>
    <tr><th nowrap valign="top" colspan="${colspan}" height="30" class="border_none"></th></tr>
    </tfoot><tbody>${tableBody}</tbody></table>`;

  return tableHtml;
}

export async function renderStaffUnit1({ academicDate }) {
  const tableHtml = await loadRoster('I', academicDate);
  return `
<div class="col-sm-6 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span><i class="fa fa-users" aria-hidden="true"></i></span>
      <h3>Faculty - Unit I</h3>
  </div>
<div class="dashboard-panel-unit">${tableHtml}</div></section>
</div>`;
}

export async function renderStaffUnit2({ academicDate }) {
  const tableHtml = await loadRoster('II', academicDate);
  return `
<div class="col-sm-6 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span><i class="fa fa-users" aria-hidden="true"></i></span>
      <h3>Faculty - Unit II</h3>
  </div>
<div class="dashboard-panel-unit">${tableHtml}</div></section>
</div>`;
}
