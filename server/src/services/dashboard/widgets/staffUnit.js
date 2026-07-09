import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';

function num(val) {
  return Number(val) || 0;
}

function vacantBgStyle(value) {
  if (value > 0.5) {
    return "style='text-align:center; padding-right:15px;background-color:#ff1800;border-right: 15px solid;'";
  }
  return "style='text-align:center; padding-right:15px;border-right: 15px solid;'";
}

function vacantBgStyleLast(value) {
  if (value > 0.5) {
    return "style='text-align:center; padding-right:15px;background-color:#ff1800;'";
  }
  return "style='text-align:center; padding-right:15px;'";
}

/** Zero vacant → em dash in a muted chip; surplus stays negative number. */
function formatVacant(value) {
  const v = num(value);
  if (v > 0.5) return String(v);
  if (v === 0) return '<span class="cell-blank" title="No deficit">—</span>';
  return String(v);
}

async function countStaffByDesignation(departmentId, unitType, designationSql, currentDate) {
  const d = escapeSql(currentDate);
  const dept = escapeSql(String(departmentId));
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.id
     FROM staff_profile_tb AS A
     INNER JOIN staff_designation_tb AS B ON A.id = B.staff_id
     INNER JOIN staff_desg_master AS C ON C.id = B.designation
     WHERE A.del = 1
       AND (A.releaving_date = '0000-00-00' OR A.releaving_date < '${d}')
       AND B.del = 1 AND B.department = '${dept}'
       AND B.is_academic = 1 AND C.del = 1 AND B.unit_type = '${escapeSql(unitType)}'
       AND (${designationSql})
     ORDER BY A.staff_id ASC`,
  );
  return rows.length;
}

/**
 * Legacy dashboard_unit_more.php staff_unit($current_date)
 */
export async function renderStaffUnit({ academicDate }) {
  const colspan = 10;
  const professorSql = "(C.name LIKE '%Professor%' OR C.name LIKE '%Principal%')";
  const readerSql = "(C.name LIKE '%Reader%' OR C.name LIKE '%Associate%')";
  const lecturerSql = "(C.name LIKE '%Lect%' OR C.name LIKE '%Senior%')";

  let finalInfoTemp = `<table cellpadding='5' cellspacing='0' class='table table-bordered'>
  <thead>
  <tr bgcolor='#CCCCCC'>
  <th style='text-align: center;vertical-align: middle;' width='300' rowspan='2' nowrap height='30' align='center'>Department</th>
  <th style='text-align: center;vertical-align: middle;' width='150' colspan='3' nowrap height='30' align='left'>Professor</th>
  <th style='text-align: center;vertical-align: middle;' width='150' colspan='3' nowrap height='30' align='left'>Reader</th>
  <th style='text-align: center;vertical-align: middle;' width='150' colspan='3' nowrap height='30' align='left'>Lecturer</th>
  </tr>
  <tr bgcolor='#CCCCCC'>
  
  <th style='text-align: center;vertical-align: middle;' width='50' nowrap height='30' align='left'>Norms</th>
  <th style='text-align: center;vertical-align: middle;' width='50' nowrap height='30' align='left'>Avai.</th>
  <th style='text-align: center;vertical-align: middle;' width='50' nowrap height='30' align='left'>Vacant</th>
   <th style='text-align: center;vertical-align: middle;' width='50' nowrap height='30' align='left'>Norms</th>
  <th style='text-align: center;vertical-align: middle;' width='50' nowrap height='30' align='left'>Avai.</th>
  <th style='text-align: center;vertical-align: middle;' width='50' nowrap height='30' align='left'>Vacant</th>
   <th style='text-align: center;vertical-align: middle;' width='50' nowrap height='30' align='left'>Norms</th>
  <th style='text-align: center;vertical-align: middle;' width='50' nowrap height='30' align='left'>Avai.</th>
  <th style='text-align: center;vertical-align: middle;' width='50' nowrap height='30' align='left'>Vacant</th>
  </tr>
  </thead><tfoot>
    <tr >
      <th nowrap valign='top' colspan='${colspan}' height='30' class='border_none' > </th>
    </tr>
    </tfoot><tbody>`;

  const departments = await prisma.$queryRawUnsafe(
    `SELECT id, name FROM staff_dept_master
     WHERE del = 1 AND d_dept = 1 ORDER BY d_order ASC`,
  );

  for (const dept of departments) {
    const cId = dept.id;
    const categoryName = dept.name ?? '';

    finalInfoTemp += `<tr bgcolor='#F4F4F4'>
                  <td nowrap valign='top' colspan='${colspan}'><strong style='font-size: 18px;'>${categoryName}</strong></td></tr>`;

    const units = await prisma.$queryRawUnsafe(
      `SELECT d_id, name, profess_hod, reader_assoc, lecturer_assist
       FROM staff_dept_unit_master
       WHERE del = 1 AND d_id = '${escapeSql(String(cId))}'
       ORDER BY id ASC`,
    );

    for (const unit of units) {
      const gName = unit.name ?? '';
      const gProfessor = num(unit.profess_hod);
      const gReader = num(unit.reader_assoc);
      const gLecturer = num(unit.lecturer_assist);
      const unitType = gName === 'Unit I' ? 'I' : 'II';

      const [aProfessor, aReader, aLecturer] = await Promise.all([
        countStaffByDesignation(cId, unitType, professorSql, academicDate),
        countStaffByDesignation(cId, unitType, readerSql, academicDate),
        countStaffByDesignation(cId, unitType, lecturerSql, academicDate),
      ]);

      let vProf = gProfessor - aProfessor;
      let vRead = gReader - aReader;
      const vLect = gLecturer - aLecturer;

      if (vProf < 0) {
        vRead = vRead + vProf;
      }

      const bgColor1 = vacantBgStyle(vProf);
      const bgColor2 = vacantBgStyle(vRead);
      const bgColor3 = vacantBgStyleLast(vLect);

      finalInfoTemp += `<tr><td   style='text-align:center; padding-right:15px;border-right: 15px solid;'>
  <p class='class_name cinfo' style='font-size: 18px;'>${gName}</p></td>
 <td   style='text-align:center; padding-right:15px;'>
  <p class='class_name cinfo' style='font-size: 18px;'>${gProfessor}</p></td>
  <td   style='text-align:center; padding-right:15px;'>
  <p class='class_name cinfo' style='font-size: 18px;'>${aProfessor}</p></td>
   <td   ${bgColor1}>
  <p class='class_name cinfo' style='font-size: 18px;'>${formatVacant(vProf)}</p></td>
   
   <td   style='text-align:center; padding-right:15px;'>
  <p class='class_name cinfo' style='font-size: 18px;'>${gReader}</p></td>
  <td   style='text-align:center; padding-right:15px;'>
  <p class='class_name cinfo' style='font-size: 18px;'> ${aReader}</p></td>
   <td   ${bgColor2}>
  <p class='class_name cinfo' style='font-size: 18px;'>${formatVacant(vRead)}</p></td>
   <td   style='text-align:center; padding-right:15px;'>
  <p class='class_name cinfo' style='font-size: 18px;'>${gLecturer}</p></td>
  <td   style='text-align:center; padding-right:15px;'>
  <p class='class_name cinfo' style='font-size: 18px;'>${aLecturer} </p></td>
  <td   ${bgColor3}>
  <p class='class_name cinfo' style='font-size: 18px;' >${formatVacant(vLect)}</p></td></tr>`;
    }
  }

  return `
<div class="col-sm-12 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span aria-hidden="true"><i class="icon-sitemap"></i></span>
      <h3>Faculty - DCI Norms</h3>
      
  </div>
<div class="dashboard-panel-unit"><table width="283" cellpadding="0" cellspacing="0" class="table table-bordered">

        ${finalInfoTemp} </table></div></section>
</div>`;
}
