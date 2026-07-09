import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { loadEventCategories } from './committeeShared.js';
import { getStaffByDepartments } from './committeeTvAcademic.js';

const RESCHEDULE_PAGE = 'approve_reschedule_event_v1.php';
const STATUS_LABELS = ['Pending', 'Approved', 'Rejected', 'OnHold'];
const PAGE_SIZE = 20;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function parseDateTime(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s || s.startsWith('0000-00-00')) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return `${s.replace('T', ' ').slice(0, 16)}:00`;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) return `${s.slice(0, 16)}:00`;
  const dm = s.match(/^(\d{2})-(\d{2})-(\d{4})(?: (\d{2}):(\d{2}))?/);
  if (dm) return `${dm[3]}-${dm[2]}-${dm[1]} ${dm[4] || '00'}:${dm[5] || '00'}:00`;
  return s;
}

function toInputDateTime(value) {
  if (!value) return '';
  const s = String(value);
  if (s.startsWith('0000-00-00')) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatSchedule(fromValue, toValue) {
  const from = fromValue ? new Date(fromValue) : null;
  const to = toValue ? new Date(toValue) : null;
  if (!from || Number.isNaN(from.getTime())) return '';
  const fmt = (d, withDate = true) => d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: withDate ? '2-digit' : undefined,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  if (!to || Number.isNaN(to.getTime())) return fmt(from);
  const sameDay = from.toDateString() === to.toDateString();
  return sameDay ? `${fmt(from)} - ${to.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}` : `${fmt(from)} - ${fmt(to)}`;
}

async function loadLookups() {
  const [categories, eventTypes, departments, committees, locations] = await Promise.all([
    loadEventCategories(),
    prisma.$queryRawUnsafe(`
      SELECT id, category_name FROM master_setup
      WHERE category='Event Type' AND del!=0 ORDER BY category_order ASC
    `),
    prisma.$queryRawUnsafe(`SELECT id, name FROM staff_dept_master WHERE del=1 ORDER BY d_order ASC`),
    prisma.$queryRawUnsafe(`SELECT id, title FROM t_committee WHERE del=1 ORDER BY title ASC`),
    prisma.$queryRawUnsafe(`
      SELECT id, category_name FROM master_setup
      WHERE category='Event Location' AND del!=0 ORDER BY category_order ASC
    `),
  ]);

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const typeMap = Object.fromEntries(eventTypes.map((r) => [Number(r.id), r.category_name || '']));
  const deptMap = Object.fromEntries(departments.map((r) => [String(r.id), r.name || '']));
  const committeeMap = Object.fromEntries(committees.map((r) => [String(r.id), r.title || '']));
  const locationMap = Object.fromEntries(locations.map((r) => [String(r.id), r.category_name || '']));

  return {
    categories,
    eventTypes: eventTypes.map((r) => ({ id: String(r.id), name: r.category_name || '' })),
    departments: departments.map((r) => ({ id: String(r.id), name: r.name || '' })),
    committees: committees.map((r) => ({ id: String(r.id), name: r.title || '' })),
    locations: locations.map((r) => ({ id: String(r.id), name: r.category_name || '' })),
    categoryMap,
    typeMap,
    deptMap,
    committeeMap,
    locationMap,
  };
}

function resolveDeptNames(raw, deptMap, committeeMap) {
  const ids = raw ? String(raw).split(',').map((x) => x.trim()).filter(Boolean) : [];
  return ids.map((id) => deptMap[id] || committeeMap[id] || '').filter(Boolean).join(', ');
}

function buildListWhere(fields) {
  const fromDate = fields.fromDate ? String(fields.fromDate).slice(0, 10) : '';
  const toDate = fields.toDate ? String(fields.toDate).slice(0, 10) : '';
  const showPast = fields.showPast === true || fields.showPast === '1';
  let where = 'e.del=1 AND e.e_task=1 AND e.ref_id!=0 AND e.e_status=1';
  if (!showPast) where += ' AND DATE(e.from_date) >= CURDATE()';
  if (fromDate) where += ` AND DATE(e.event_date) >= '${escapeSql(fromDate)}'`;
  if (toDate) where += ` AND DATE(e.event_date) <= '${escapeSql(toDate)}'`;
  return { where, fromDate, toDate, showPast };
}

function mapListRow(row, lookups) {
  const { categoryMap, typeMap, deptMap, committeeMap } = lookups;
  const eventDate = row.event_date && !String(row.event_date).startsWith('0000-00-00')
    ? new Date(row.event_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  const createdAt = row.created_dt && !String(row.created_dt).startsWith('0000-00-00')
    ? new Date(row.created_dt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    : '';
  const status = Number(row.e_status) || 0;
  return {
    id: Number(row.id),
    title: row.title || '',
    categoryName: categoryMap[Number(row.e_category)] || '',
    typeName: typeMap[Number(row.e_type)] || '',
    eventDate,
    createdAt,
    department: resolveDeptNames(row.e_department, deptMap, committeeMap),
    schedule: formatSchedule(row.from_date, row.to_date),
    status,
    statusLabel: STATUS_LABELS[status] || 'Pending',
  };
}

function mapDetailRow(row, lookups) {
  const deptIds = row.e_department ? String(row.e_department).split(',').map((x) => x.trim()).filter(Boolean) : [];
  const status = Number(row.e_status) || 0;
  return {
    eventId: Number(row.id),
    title: row.title || '',
    eventType: row.e_type ? String(row.e_type) : '',
    category: row.e_category ?? '',
    departments: deptIds,
    fromDate: toInputDateTime(row.from_date),
    toDate: toInputDateTime(row.to_date),
    description: row.e_description || '',
    inCampus: Number(row.e_icampus) === 1,
    inLocation: row.e_ilocation ? String(row.e_ilocation) : '',
    outCampus: Number(row.e_ocampus) === 1,
    outLocation: row.e_olocation || '',
    taskOwner: row.e_towner ? String(row.e_towner) : '',
    requestOwner: row.e_rowner ? String(row.e_rowner) : '',
    reason: row.e_reason || '',
    aStatus: status,
    createdAt: row.created_dt && !String(row.created_dt).startsWith('0000-00-00')
      ? new Date(row.created_dt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
      : '',
    requestOwnerName: row.request_owner_name || '',
  };
}

export async function loadCommitteeApproveReschedule(memberId, fields = {}, audit = {}) {
  const lookups = await loadLookups();
  const { where, fromDate, toDate, showPast } = buildListWhere(fields);
  const page = Math.max(1, Number(fields.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const countRows = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS total FROM tv_academic_event e WHERE ${where}
  `);
  const total = Number(countRows[0]?.total) || 0;

  const rows = await prisma.$queryRawUnsafe(`
    SELECT e.id, e.event_id, e.event_date, e.title, e.created_dt, e.e_category, e.e_type, e.e_department, e.e_status,
      IF(e.from_date='0000-00-00 00:00:00', NULL, e.from_date) AS from_date,
      IF(e.to_date='0000-00-00 00:00:00', NULL, e.to_date) AS to_date
    FROM tv_academic_event e
    WHERE ${where}
    ORDER BY e.event_date ASC
    LIMIT ${offset}, ${PAGE_SIZE}
  `);

  let detail = null;
  const eventId = fields.eventId ? parseId(fields.eventId) : 0;
  if (eventId) {
    const d = await prisma.$queryRawUnsafe(`
      SELECT e.id, e.title, e.e_category, e.e_type, e.e_department, e.e_status, e.e_description,
        e.e_icampus, e.e_ilocation, e.e_ocampus, e.e_olocation, e.e_towner, e.e_rowner, e.e_reason, e.created_dt,
        IF(e.from_date='0000-00-00 00:00:00', NULL, e.from_date) AS from_date,
        IF(e.to_date='0000-00-00 00:00:00', NULL, e.to_date) AS to_date,
        CONCAT_WS(' ', sp.staff_title, sp.staff_name, sp.staff_initial) AS request_owner_name
      FROM tv_academic_event e
      LEFT JOIN staff_profile_tb sp ON sp.id=e.e_rowner AND sp.del=1
      WHERE e.del=1 AND e.id=${eventId}
      LIMIT 1
    `);
    if (d[0]) {
      detail = mapDetailRow(d[0], lookups);
      detail.staffOptions = await getStaffByDepartments(detail.departments);
    }
  }

  if (!audit.skipLog) {
    await logModulePage(RESCHEDULE_PAGE, 'View', 'Successful', String(page), memberId, audit);
  }

  return {
    success: true,
    fromDate,
    toDate,
    showPast,
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    events: rows.map((r) => mapListRow(r, lookups)),
    eventId: eventId || '',
    detail,
    categories: lookups.categories,
    eventTypes: lookups.eventTypes,
    departments: lookups.departments,
    committees: lookups.committees,
    locations: lookups.locations,
    statusLabels: STATUS_LABELS,
  };
}

export async function saveCommitteeApproveReschedule(payload, memberId, audit = {}) {
  const id = parseId(payload.eventId);
  if (!id) return { success: false, message: 'Select an event.' };

  const { update } = auditFields(memberId, audit);
  const aStatus = Number(payload.aStatus);
  const fromDate = parseDateTime(payload.fromDate);
  const toDate = parseDateTime(payload.toDate);
  const departments = Array.isArray(payload.departments) ? payload.departments.map(String).join(',') : '';
  const approvedDate = aStatus === 1 ? 'NOW()' : `'0000-00-00 00:00:00'`;
  const today = new Date().toISOString().slice(0, 10);

  await prisma.$executeRawUnsafe(`
    INSERT INTO tv_academic_event_log (
      tv_academic_event_id, event_id, event_date, title, from_date, to_date, approved_date,
      e_category, e_type, e_department, e_description, e_icampus, e_ilocation, e_ocampus, e_olocation,
      e_towner, e_rowner, e_task, e_task_created, e_status, e_reason, ref_id,
      created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del
    )
    SELECT id, event_id, event_date, title, from_date, to_date, approved_date,
      e_category, e_type, e_department, e_description, e_icampus, e_ilocation, e_ocampus, e_olocation,
      e_towner, e_rowner, e_task, e_task_created, e_status, e_reason, ref_id,
      created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del
    FROM tv_academic_event WHERE id=${id}
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE tv_academic_event SET
      title='${escapeSql(payload.title || '')}',
      from_date=${fromDate ? `'${escapeSql(fromDate)}'` : 'from_date'},
      to_date=${toDate ? `'${escapeSql(toDate)}'` : 'to_date'},
      e_category=${Number(payload.category) || 0},
      e_type='${escapeSql(payload.eventType || '')}',
      e_department='${escapeSql(departments)}',
      e_description='${escapeSql(payload.description || '')}',
      e_icampus=${payload.inCampus ? 1 : 0},
      e_ilocation='${escapeSql(payload.inLocation || '')}',
      e_ocampus=${payload.outCampus ? 1 : 0},
      e_olocation='${escapeSql(payload.outLocation || '')}',
      e_towner='${escapeSql(payload.taskOwner || '')}',
      e_rowner='${escapeSql(payload.requestOwner || '')}',
      e_status=${Number.isFinite(aStatus) ? aStatus : 1},
      approved_date=${approvedDate},
      reschedule_date='${today}',
      e_reason='${escapeSql(payload.reason || '')}',
      updated_by='${escapeSql(memberId)}',
      updated_ip='${escapeSql(update.updated_ip)}',
      updated_dt=NOW()
    WHERE id=${id}
  `);

  await logModulePage(RESCHEDULE_PAGE, 'Update', 'Successful', `${id}-${aStatus}`, memberId, audit);

  return {
    success: true,
    message: 'Event updated.',
    ...(await loadCommitteeApproveReschedule(memberId, {
      fromDate: payload.listFromDate,
      toDate: payload.listToDate,
      showPast: payload.showPast,
      page: payload.page,
      eventId: '',
    }, { ...audit, skipLog: true })),
  };
}
