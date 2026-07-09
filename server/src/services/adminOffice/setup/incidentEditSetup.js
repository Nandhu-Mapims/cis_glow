import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logAdminOfficeSetup, parseDateTimeInput } from '../setupAudit.js';
import { loadDepartmentMap, loadDepartmentOptions } from '../shared.js';

const PAGE = 'incident_edit.php';

function mapRow(row) {
  return {
    id: row.id,
    incidentDate: String(row.incident_date || '').slice(0, 16).replace('T', ' '),
    category: row.incident_category,
    title: row.incident_title,
    location: row.incident_location,
    firstAidBy: row.first_aid_by,
    details: row.incident_details,
  };
}

async function loadIncidentById(id) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id,
           CAST(incident_date AS CHAR) AS incident_date,
           incident_category, incident_title, incident_location,
           first_aid_by, incident_details, del
    FROM incident_tb WHERE del=1 AND id=${Number(id)} LIMIT 1`);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function loadIncidentEditSetup(memberId, fields = {}, audit = {}) {
  const searchId = fields.id ? parseId(fields.id) : null;
  const search = String(fields.search || '').trim();
  const page = Math.max(1, Number(fields.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  let incident = null;
  let list = [];
  let total = 0;

  if (searchId) {
    incident = await loadIncidentById(searchId);
  } else {
    let where = 'del=1';
    if (search) {
      where += ` AND incident_title LIKE '%${escapeSql(search)}%'`;
    }
    const countRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS cnt FROM incident_tb WHERE ${where}`);
    total = Number(countRows[0]?.cnt || 0);
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, CAST(incident_date AS CHAR) AS incident_date,
             incident_title, incident_category
      FROM incident_tb WHERE ${where}
      ORDER BY incident_date DESC LIMIT ${limit} OFFSET ${offset}`);
    const deptMap = await loadDepartmentMap();
    list = rows.map((r) => ({
      id: r.id,
      date: String(r.incident_date || '').slice(0, 10),
      title: r.incident_title,
      department: deptMap[String(r.incident_category)] || r.incident_category,
    }));
  }

  await logAdminOfficeSetup(PAGE, 'View', 'Successful', String(searchId || search), memberId, audit);
  return {
    departmentOptions: await loadDepartmentOptions(),
    search,
    page,
    limit,
    total,
    id: searchId || null,
    incident,
    list,
  };
}

export async function saveIncidentEditSetup(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    const { update } = auditFields(memberId, audit);
    await prisma.incident_tb.update({ where: { id }, data: { del: 0, ...update } });
    await logAdminOfficeSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
    return {
      success: true,
      message: 'Your details are deleted...',
      ...(await loadIncidentEditSetup(memberId, {}, { ...audit, skipLog: true })),
    };
  }

  const id = parseId(payload.id);
  if (!id) return { success: false, message: 'Incident not found' };

  const incidentDate = parseDateTimeInput(payload.incidentDate);
  if (!incidentDate) return { success: false, message: 'Date and time are required' };

  const { update } = auditFields(memberId, audit);
  await prisma.incident_tb.update({
    where: { id },
    data: {
      incident_date: incidentDate,
      incident_category: String(payload.category || ''),
      incident_title: String(payload.title || ''),
      incident_location: String(payload.location || ''),
      first_aid_by: String(payload.firstAidBy || ''),
      incident_details: String(payload.details || ''),
      del: 1,
      ...update,
    },
  });

  await logAdminOfficeSetup(PAGE, 'Update', 'Successful', String(id), memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadIncidentEditSetup(memberId, { id }, { ...audit, skipLog: true })),
  };
}
