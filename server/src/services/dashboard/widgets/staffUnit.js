import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';

function num(val) {
  return Number(val) || 0;
}

function vacantCellClass(value) {
  return value > 0.5 ? ' class="cis-dept-num cis-flag-deficit"' : ' class="cis-dept-num"';
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

  let finalInfoTemp = `<table class="table table-bordered cis-dept-table">
  <thead>
  <tr>
  <th rowspan="2">Department</th>
  <th colspan="3">Professor</th>
  <th colspan="3">Reader</th>
  <th colspan="3">Lecturer</th>
  </tr>
  <tr>
  <th>Norms</th><th>Avai.</th><th>Vacant</th>
  <th>Norms</th><th>Avai.</th><th>Vacant</th>
  <th>Norms</th><th>Avai.</th><th>Vacant</th>
  </tr>
  </thead><tbody>`;

  const departments = await prisma.$queryRawUnsafe(
    `SELECT id, name FROM staff_dept_master
     WHERE del = 1 AND d_dept = 1 ORDER BY d_order ASC`,
  );

  const chartRows = [];

  for (const dept of departments) {
    const cId = dept.id;
    const categoryName = dept.name ?? '';

    finalInfoTemp += `<tr class="cis-dept-group-row"><td colspan="${colspan}">${categoryName}</td></tr>`;

    const units = await prisma.$queryRawUnsafe(
      `SELECT d_id, name, profess_hod, reader_assoc, lecturer_assist
       FROM staff_dept_unit_master
       WHERE del = 1 AND d_id = '${escapeSql(String(cId))}'
       ORDER BY id ASC`,
    );

    let deptSanctioned = 0;
    let deptAvailable = 0;

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

      const vacantClass1 = vacantCellClass(vProf);
      const vacantClass2 = vacantCellClass(vRead);
      const vacantClass3 = vacantCellClass(vLect);

      finalInfoTemp += `<tr>
  <td class="cis-dept-name">${gName}</td>
  <td class="cis-dept-num">${gProfessor}</td>
  <td class="cis-dept-num">${aProfessor}</td>
  <td${vacantClass1}>${formatVacant(vProf)}</td>
  <td class="cis-dept-num">${gReader}</td>
  <td class="cis-dept-num">${aReader}</td>
  <td${vacantClass2}>${formatVacant(vRead)}</td>
  <td class="cis-dept-num">${gLecturer}</td>
  <td class="cis-dept-num">${aLecturer}</td>
  <td${vacantClass3}>${formatVacant(vLect)}</td>
</tr>`;

      deptSanctioned += gProfessor + gReader + gLecturer;
      deptAvailable += aProfessor + aReader + aLecturer;
    }

    if (deptSanctioned > 0 || deptAvailable > 0) {
      chartRows.push({
        department: categoryName,
        sanctioned: deptSanctioned,
        available: deptAvailable,
        vacant: Math.max(deptSanctioned - deptAvailable, 0),
        surplus: Math.max(deptAvailable - deptSanctioned, 0),
      });
    }
  }

  finalInfoTemp += '</tbody></table>';

  const html = `
<div class="col-sm-12 dashboard-container">
  <section class="panel">
  <div class="revenue-head">
      <span aria-hidden="true"><i class="icon-sitemap"></i></span>
      <h3>Faculty - DCI Norms</h3>
  </div>
  <div class="dashboard-panel-unit">${finalInfoTemp}</div>
  </section>
</div>`;

  return { html, chart: { type: 'dept-staffing', rows: chartRows } };
}
