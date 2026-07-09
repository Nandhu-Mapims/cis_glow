import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { staffAuthentication } from '../widgetAuth.js';

function num(val) {
  return Number(val) || 0;
}

/**
 * Legacy dashboard_more.php staff_details($current_date)
 */
export async function renderStaffDetails({ memberId, academicDate }) {
  const staffFilter = await staffAuthentication(memberId, 'A.');
  const d = escapeSql(academicDate);

  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(A.id) AS cnt, B.category_name, B.id
     FROM staff_profile_tb AS A
     INNER JOIN edu_setup_tb AS B ON A.job_category = B.id
     WHERE A.del = 1 AND B.del = 1
       AND (A.releaving_date = '0000-00-00' OR A.releaving_date > '${d}')
       AND B.category = 'Category' ${staffFilter}
     GROUP BY B.id
     ORDER BY B.category_order ASC`,
  );

  let finalInfoTemp = `<tr class="td_head_color">
      <th width="190" ><p class="staff_period">Category</p></th>
      <th  align="right" width="100" ><p class="staff_period" >#T</p></th>
      </th>`;

  let totalStaff = 0;
  for (const row of rows) {
    const categoryCount = num(row.cnt);
    const categoryName = row.category_name ?? '';
    const categoryId = row.id;
    totalStaff += categoryCount;

    finalInfoTemp += `<tr class="td_bottom_border">
  <td ><p class="class_name" style="padding-left:10px;">${categoryName}</p></td><td width=""  style="text-align:right; padding-right:15px;"><p class="class_name cinfo"  onclick="callstaff('${categoryId}','${academicDate}')">${categoryCount}</p></td></tr>`;
  }

  return `
<div class="col-sm-4 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span>
          <i class="icon-users"></i>
      </span>
      <h3>Staff Details</h3>
      <span class="rev-combo pull-right">
        ${totalStaff}
      </span>
  </div>
<div class="dashboard-panel"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered">

        ${finalInfoTemp} </table></div></section>
</div>`;
}
