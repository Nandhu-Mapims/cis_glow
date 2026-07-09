import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { staffAuthentication } from '../widgetAuth.js';

function num(val) {
  return Number(val) || 0;
}

/**
 * Legacy dashboard_more.php staff_permission($current_date)
 * Does not depend on staff_attendance.php (include was unused in PHP).
 */
export async function renderStaffPermission({ memberId, academicDate }) {
  const d = escapeSql(academicDate);
  const staffFilter = await staffAuthentication(memberId, 'A.');
  const staffFilterB = staffFilter.replace(/A\./g, 'B.');

  let attendanceDetails = `
  <div class="col-sm-4 dashboard-container">
    <section class="panel">
        <div class="revenue-head">
            <span>
                <i class="icon-user-follow"></i>
            </span>
            <h3>Staff Permission </h3>
        </div>
  <div class="dashboard-panel"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered staff_attendance">
  <tr class="td_head_color">
    <th width="40" rowspan="2">Cat.</th>
    <th width="30" rowspan="2" title="Total" class="att_work_header">#T</th>
    <th colspan="2" class="text-center att_in_header" height="10" >Personal</th>
    <th colspan="2" class="text-center att_out_header">Official</th>
    </tr>
    <tr class="td_head_color">
    <th width="20" height="10" title="Apply" class="att_in_header">A</th>
    <th width="20" title="Waiting for Approval" class="att_in_header">A</th>
    <th width="20" title="Apply" class="att_out_header">A</th>
    <th width="20" title="Waiting for Approval" class="att_out_header">A</th>
    </tr>`;

  const totalAttArray = {
    personal: { apply: 0, approve: 0 },
    official: { apply: 0, approve: 0 },
    total: 0,
  };

  const categories = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT(B.id) AS id, B.category_sname
     FROM staff_profile_tb AS A
     INNER JOIN edu_setup_tb AS B ON A.job_category = B.id
     WHERE A.del = 1
       AND (A.releaving_date > '${d}' OR A.releaving_date = '0000-00-00')
       AND B.category = 'Category'
       AND B.category_name != 'hostel'
       AND B.category_name != 'Teaching Basic Science'
       AND B.category_name != 'College Support' ${staffFilter}
     ORDER BY A.job_category ASC`,
  );

  for (const cat of categories) {
    const cid = cat.id;
    const categoryName = cat.category_sname ?? '';
    const categoryWise = {
      personal: { apply: 0, approve: 0 },
      official: { apply: 0, approve: 0 },
    };

    const permRows = await prisma.$queryRawUnsafe(
      `SELECT A.status, A.p_type
       FROM att_permission_request AS A
       INNER JOIN staff_profile_tb AS B ON A.staff_id = B.id
       WHERE A.del = 1 AND DATE(A.from_date) = '${d}' AND A.status <= 1
         AND B.del = 1 AND B.job_category = '${escapeSql(String(cid))}' ${staffFilterB}
         AND (B.releaving_date > '${d}' OR B.releaving_date = '0000-00-00')`,
    );

    for (const row of permRows) {
      const pType = row.p_type;
      if (!pType) continue;
      if (!categoryWise[pType]) continue;
      categoryWise[pType].apply += 1;
      if (num(row.status) === 1) {
        categoryWise[pType].approve += 1;
      }
    }

    const tApply =
      num(categoryWise.personal.apply) + num(categoryWise.official.apply);
    totalAttArray.personal.apply += categoryWise.personal.apply;
    totalAttArray.personal.approve += categoryWise.personal.approve;
    totalAttArray.official.apply += categoryWise.official.apply;
    totalAttArray.official.approve += categoryWise.official.approve;
    totalAttArray.total += tApply;

    if (tApply > 0) {
      attendanceDetails += `<tr class="td_bottom_border">
      <td nowrap><p class="class_name" > ${categoryName} </p></td>
      <td class="att_work_body"><p class="class_name cinfo" onclick="callstaffpermission('${cid}','${academicDate}','Personal & Official')"><strong>${tApply}</strong></p></td>
      <td class="att_in_body"><p class="class_name cinfo" onclick="callstaffpermission('${cid}','${academicDate}','Personal')"><strong>${num(categoryWise.personal.apply)}</strong></p></td>
      <td class="att_in_body trans"><p class="class_name cinfo" onclick="callstaffpermission('${cid}','${academicDate}','Personal Approve')">${num(categoryWise.personal.approve)}</p></td>
      <td class="att_out_body"><p class="class_name cinfo" onclick="callstaffpermission('${cid}','${academicDate}','Official')"><strong>${num(categoryWise.official.apply)}</strong></p></td>
      <td class="att_out_body trans"><p class="class_name cinfo" onclick="callstaffpermission('${cid}','${academicDate}','Official Approve')">${num(categoryWise.official.approve)}</p></td>
      </tr>`;
    }
  }

  if (totalAttArray.total > 0) {
    attendanceDetails += `<tr class="td_bottom_border" bgcolor="#F4F4F4">
    <td nowrap><p class="class_name" > Total </p></td>
    <td class="att_work_header"><p class="class_name cinfo" onclick="callstaffpermission('','${academicDate}','Personal & Official')"><strong>${totalAttArray.total}</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="callstaffpermission('','${academicDate}','Personal')"><strong>${num(totalAttArray.personal.apply)}</strong></p></td>
    <td class="att_in_header ar"><p class="class_name cinfo" onclick="callstaffpermission('','${academicDate}','Personal Approve')">${num(totalAttArray.personal.approve)}</p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="callstaffpermission('','${academicDate}','Official')"><strong>${num(totalAttArray.official.apply)}</strong></p></td>
    <td class="att_out_header ar"><p class="class_name cinfo" onclick="callstaffpermission('','${academicDate}','Official Approve')">${num(totalAttArray.official.approve)}</p></td>
    </tr>`;
  }

  attendanceDetails += '</table></div></section> </div>';
  return attendanceDetails;
}
