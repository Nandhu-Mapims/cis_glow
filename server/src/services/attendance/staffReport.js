import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { getAttendance, getLPTime, getStaffOrder } from './staffAttendanceCore.js';

function parseDisplayDate(dateStr) {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [d, m, y] = String(dateStr).split('-');
  if (d && m && y) return `${y}-${m}-${d}`;
  return dateStr;
}

export async function buildStaffAttendanceReport(payload) {
  const categories = Array.isArray(payload.categories)
    ? payload.categories
    : String(payload.categories || '').split(',').filter(Boolean);
  if (!categories.length) return { error: 'At least one category is required' };

  const fromDateRef = parseDisplayDate(payload.fromDate) || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const toDateRef = parseDisplayDate(payload.toDate) || new Date().toISOString().slice(0, 10);

  const categoryFilter = categories
    .map((c) => `job_category='${escapeSql(String(c).trim())}'`)
    .join(' OR ');
  const searchInputList = ` AND (${categoryFilter})`;

  const deptRows = await prisma.$queryRawUnsafe('SELECT id, name FROM staff_dept_master WHERE del=1 ORDER BY d_order ASC');
  const desgRows = await prisma.$queryRawUnsafe('SELECT id, name FROM staff_desg_master WHERE del=1 ORDER BY d_order ASC');
  const departmentArray = Object.fromEntries(deptRows.map((r) => [String(r.id), r.name]));
  const designationArray = Object.fromEntries(desgRows.map((r) => [String(r.id), r.name]));

  const staffOrder = await getStaffOrder();
  const orderStr = staffOrder ? ` ORDER BY FIELD(id, ${staffOrder})` : '';
  const staffRows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id, staff_name, staff_initial, staff_title, att_category, job_category
     FROM staff_profile_tb WHERE del=1
       AND (releaving_date='0000-00-00' OR releaving_date > '${escapeSql(fromDateRef)}') ${searchInputList} ${orderStr}`,
  );

  let attendanceBody = '<div class="row">';
  let counter = 0;

  for (const row of staffRows) {
    const sId = row.id;
    const staffId = row.staff_id;
    const nameTitle = row.staff_title ? `${row.staff_title}. ` : '';
    const staffName = `${nameTitle}${row.staff_name || ''} ${row.staff_initial || ''}`.trim();
    const latePermission = await getLPTime(row.att_category);

    let department = '';
    let designation = '';
    const desigSearch = await prisma.$queryRawUnsafe(
      `SELECT department, designation FROM staff_designation_tb WHERE del=1 AND staff_id='${escapeSql(String(sId))}' AND is_academic=1 ORDER BY id DESC LIMIT 1`,
    );
    if (desigSearch.length) {
      designation = designationArray[String(desigSearch[0].designation)] || '';
      department = departmentArray[String(desigSearch[0].department)] || '';
    }

    let totalAttWorkingDays = 0;
    let totalAttPresent = 0;
    let totalAttAbsent = 0;
    let totalAttPermission = 0;
    let totalAttLate = 0;
    const totalAuthorisedLeave = {
      cl: 0, el: 0, od: 0, lop: 0,
      unauth: { m: 0, e: 0 },
      per: { persional: 0, official: 0, unauth: 0 },
    };

    const attFrom = new Date(`${fromDateRef}T00:00:00`).getTime();
    const attTo = new Date(`${toDateRef}T00:00:00`).getTime();

    for (let m = attFrom; m <= attTo; m += 86400000) {
      const attCurrentDate = new Date(m).toISOString().slice(0, 10);
      const attendanceStatus = await getAttendance(sId, staffId, attCurrentDate, latePermission);
      totalAttWorkingDays += attendanceStatus.total || 0;

      let mauthLeave = 0;
      let eauthLeave = 0;
      let mauthPermission = 0;
      let eauthPermission = 0;

      const leaveReq = await prisma.$queryRawUnsafe(
        `SELECT r_session FROM att_leave_request_more WHERE del=1 AND req_date='${escapeSql(attCurrentDate)}' AND staff_id='${escapeSql(String(sId))}' AND status=1`,
      );
      for (const lr of leaveReq) {
        if (lr.r_session === 'fullday') {
          attendanceStatus.m = 'a';
          attendanceStatus.e = 'a';
          mauthLeave = 1;
          eauthLeave = 1;
        } else if (lr.r_session === 'forenoon') {
          attendanceStatus.m = 'a';
          mauthLeave = 1;
        } else if (lr.r_session === 'afternoon') {
          attendanceStatus.e = 'a';
          eauthLeave = 1;
        }
      }

      const defaulterReq = await prisma.$queryRawUnsafe(
        `SELECT A.leave_stype, B.r_session, B.m_att, B.e_att FROM att_defaulter AS A
         INNER JOIN att_defaulter_more AS B ON A.id=B.request_id
         WHERE A.del=1 AND B.del=1 AND B.req_date='${escapeSql(attCurrentDate)}' AND B.staff_id='${escapeSql(String(sId))}' AND B.status=1`,
      );
      for (const dr of defaulterReq) {
        const authStyp = dr.leave_stype;
        const authSes = dr.r_session;
        const applySession = (sessionKey, attVal) => {
          if (attVal === 'p') attendanceStatus[sessionKey] = 'p';
          else if (attVal === 'la') attendanceStatus[sessionKey] = 'la';
          else if (attVal === 'pe') {
            attendanceStatus[sessionKey] = 'pe';
            const atyp = authStyp === 'Persional' ? 'persional' : 'official';
            totalAuthorisedLeave.per[atyp] = (totalAuthorisedLeave.per[atyp] || 0) + 1;
            if (sessionKey === 'm') mauthPermission = 1;
            else eauthPermission = 1;
          } else if (['LOP', 'CL', 'EL', 'OD'].includes(String(attVal).toUpperCase())) {
            if (authSes === 'fullday') { mauthLeave = 1; eauthLeave = 1; }
            else if (authSes === 'forenoon') mauthLeave = 1;
            else if (authSes === 'afternoon') eauthLeave = 1;
            attendanceStatus[sessionKey] = 'a';
          }
        };
        applySession('m', dr.m_att);
        applySession('e', dr.e_att);
      }

      if (attendanceStatus.m === 'pe' && !mauthPermission) totalAuthorisedLeave.per.unauth += 1;
      if (attendanceStatus.e === 'pe' && !eauthPermission) totalAuthorisedLeave.per.unauth += 1;
      if (attendanceStatus.m === 'a' && !mauthLeave) totalAuthorisedLeave.unauth.m += 1;
      if (attendanceStatus.e === 'a' && !eauthLeave) totalAuthorisedLeave.unauth.e += 1;

      if (attendanceStatus.m === 'p') totalAttPresent += 0.5;
      if (attendanceStatus.e === 'p') totalAttPresent += 0.5;
      if (attendanceStatus.m === 'a') totalAttAbsent += 0.5;
      if (attendanceStatus.e === 'a') totalAttAbsent += 0.5;
      if (attendanceStatus.m === 'la') { totalAttLate += 1; totalAttPresent += 0.5; }
      if (attendanceStatus.e === 'la') { totalAttLate += 1; totalAttPresent += 0.5; }
      if (attendanceStatus.m === 'pe') { totalAttPermission += 1; totalAttPresent += 0.5; }
      if (attendanceStatus.e === 'pe') { totalAttPermission += 1; totalAttPresent += 0.5; }
    }

    const leaveSums = await prisma.$queryRawUnsafe(
      `SELECT SUM(cl_days) AS cl, SUM(el_days) AS el, SUM(od_days) AS od, SUM(lop_days) AS lop
       FROM att_leave_request_more WHERE del=1 AND req_date >= '${escapeSql(fromDateRef)}' AND req_date <= '${escapeSql(toDateRef)}'
         AND staff_id='${escapeSql(String(sId))}' AND status=1`,
    );
    totalAuthorisedLeave.cl += Number(leaveSums[0]?.cl) || 0;
    totalAuthorisedLeave.el += Number(leaveSums[0]?.el) || 0;
    totalAuthorisedLeave.od += Number(leaveSums[0]?.od) || 0;
    totalAuthorisedLeave.lop += Number(leaveSums[0]?.lop) || 0;

    const defSums = await prisma.$queryRawUnsafe(
      `SELECT SUM(cl_days) AS cl, SUM(el_days) AS el, SUM(od_days) AS od, SUM(lop_days) AS lop
       FROM att_defaulter_more WHERE del=1 AND req_date >= '${escapeSql(fromDateRef)}' AND req_date <= '${escapeSql(toDateRef)}'
         AND staff_id='${escapeSql(String(sId))}' AND status=1`,
    );
    totalAuthorisedLeave.cl += Number(defSums[0]?.cl) || 0;
    totalAuthorisedLeave.el += Number(defSums[0]?.el) || 0;
    totalAuthorisedLeave.od += Number(defSums[0]?.od) || 0;
    totalAuthorisedLeave.lop += Number(defSums[0]?.lop) || 0;

    const perPersonal = await prisma.$queryRawUnsafe(
      `SELECT COUNT(id) AS cnt FROM att_permission_request WHERE del=1 AND DATE(from_date) >= '${escapeSql(fromDateRef)}'
         AND DATE(from_date) <= '${escapeSql(toDateRef)}' AND staff_id='${escapeSql(String(sId))}' AND status=1 AND p_type='personal'`,
    );
    const perOfficial = await prisma.$queryRawUnsafe(
      `SELECT COUNT(id) AS cnt FROM att_permission_request WHERE del=1 AND DATE(from_date) >= '${escapeSql(fromDateRef)}'
         AND DATE(from_date) <= '${escapeSql(toDateRef)}' AND staff_id='${escapeSql(String(sId))}' AND status=1 AND p_type='official'`,
    );
    totalAuthorisedLeave.per.persional += Number(perPersonal[0]?.cnt) || 0;
    totalAuthorisedLeave.per.official += Number(perOfficial[0]?.cnt) || 0;

    attendanceBody += `<div class="col-sm-3"><section class="panel "><div class="panel-body"><table>
      <tr><td><h4>${staffId}</h4><p><strong>${staffName}</strong><br>${designation}<br>${department}</p></td></tr></table>
      <table class="table table-bordered">
      <tr><td>Working Days</td><td>${totalAttWorkingDays}</td></tr>
      <tr><td>Present</td><td>${totalAttPresent}</td></tr>
      <tr><td colspan="2"><strong>Absent</strong></td></tr>
      <tr><td>CL</td><td>${totalAuthorisedLeave.cl}</td></tr>
      <tr><td>EL</td><td>${totalAuthorisedLeave.el}</td></tr>
      <tr><td>LOP</td><td>${totalAuthorisedLeave.lop}</td></tr>
      <tr><td>Unauthorized</td><td>F: ${totalAuthorisedLeave.unauth.m}, A: ${totalAuthorisedLeave.unauth.e}</td></tr>
      <tr><td colspan="2"><strong>Permission</strong></td></tr>
      <tr><td>Personal</td><td>${totalAuthorisedLeave.per.persional}</td></tr>
      <tr><td>Official</td><td>${totalAuthorisedLeave.per.official}</td></tr>
      <tr><td>Unauthorized</td><td>${totalAuthorisedLeave.per.unauth}</td></tr>
      <tr><td>OD</td><td>${totalAuthorisedLeave.od}</td></tr>
      <tr><td>Late</td><td>${totalAttLate}</td></tr>
      </table></div></section></div>`;

    counter += 1;
    if (counter % 4 === 0) attendanceBody += '</div><div class="row">';
  }

  attendanceBody += '</div>';
  if (!staffRows.length) {
    return { error: 'No staff found for selected categories' };
  }
  return { html: attendanceBody, staffCount: staffRows.length };
}
