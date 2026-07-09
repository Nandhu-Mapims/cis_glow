import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { logAdminOfficeSetup, toIsoDate } from '../setupAudit.js';
import { loadDepartmentMap } from '../shared.js';

const PAGE = 'incident_report.php';

export async function loadIncidentReportSetup(memberId, fields = {}, audit = {}) {
  const fromDate = toIsoDate(fields.fromDate) || new Date().toISOString().slice(0, 10);
  const toDate = toIsoDate(fields.toDate) || fromDate;
  const search = String(fields.search || '').trim();

  let sql = `
    SELECT id,
           CAST(incident_date AS CHAR) AS incident_date,
           incident_category, incident_title, incident_location,
           first_aid_by, incident_details
    FROM incident_tb
    WHERE del=1 AND DATE(incident_date) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'`;
  if (search) {
    sql += ` AND (incident_title LIKE '%${escapeSql(search)}%' OR incident_location LIKE '%${escapeSql(search)}%' OR first_aid_by LIKE '%${escapeSql(search)}%')`;
  }
  sql += ' ORDER BY incident_date DESC LIMIT 500';

  const rows = await prisma.$queryRawUnsafe(sql);
  const deptMap = await loadDepartmentMap();

  await logAdminOfficeSetup(PAGE, 'View', 'Successful', `${fromDate}-${toDate}`, memberId, audit);
  return {
    fromDate,
    toDate,
    search,
    rows: rows.map((r) => ({
      id: r.id,
      date: String(r.incident_date || '').slice(0, 16).replace('T', ' '),
      department: deptMap[String(r.incident_category)] || r.incident_category,
      title: r.incident_title,
      location: r.incident_location,
      firstAidBy: r.first_aid_by,
      details: r.incident_details,
    })),
  };
}

export async function saveIncidentReportSetup(payload, memberId, audit = {}) {
  return loadIncidentReportSetup(memberId, payload, audit);
}
