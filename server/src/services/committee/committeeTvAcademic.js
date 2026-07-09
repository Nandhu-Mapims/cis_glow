import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { loadEventCategories } from './committeeShared.js';

const TV_EVENT_PAGE = 'tv_academic_event.php';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateOnly(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDateTime(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (s.startsWith('0000-00-00')) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.replace('T', ' ').slice(0, 16) + ':00';
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) return s.slice(0, 16) + ':00';
  const dm = s.match(/^(\d{2})-(\d{2})-(\d{4})(?: (\d{2}):(\d{2}))?/);
  if (dm) {
    const hh = dm[4] || '00';
    const mm = dm[5] || '00';
    return `${dm[3]}-${dm[2]}-${dm[1]} ${hh}:${mm}:00`;
  }
  return s;
}

function resolveEventDateTime(value, eventDate, fallbackTime) {
  const parsed = parseDateTime(value);
  if (parsed) return parsed;
  if (eventDate && fallbackTime) return `${eventDate} ${fallbackTime}`;
  return null;
}

function toInputDateTime(value) {
  if (!value) return '';
  const s = String(value);
  if (s.startsWith('0000-00-00')) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

async function loadEventTypes() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, category_name FROM master_setup
    WHERE category='Event Type' AND del!=0 ORDER BY category_order ASC
  `);
  return rows.map((r) => ({ id: String(r.id), name: r.category_name || '' }));
}

async function loadEventLocations() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, category_name FROM master_setup
    WHERE category='Event Location' AND del!=0 ORDER BY category_order ASC
  `);
  return rows.map((r) => ({ id: String(r.id), name: r.category_name || '' }));
}

async function loadDepartments() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, name FROM staff_dept_master WHERE del=1 ORDER BY d_order ASC
  `);
  return rows.map((r) => ({ id: String(r.id), name: r.name || '' }));
}

async function loadCommittees() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, title FROM t_committee WHERE del=1 ORDER BY title ASC
  `);
  return rows.map((r) => ({ id: `c_${r.id}`, name: r.title || '' }));
}

function mapEventStatus(row, taskStatus) {
  if (taskStatus === 'Completed') return 'completed';
  if (Number(row.e_task) === 1 && Number(row.e_status) === 1) return 'approved';
  if (Number(row.e_task) === 1 && Number(row.e_status) === 0) return 'created';
  if (Number(row.e_task) === 1 && Number(row.e_status) === 2) return 'rejected';
  return 'default';
}

function mapTvEvent(row, taskStatus) {
  const dept = row.e_department ? String(row.e_department).split(',').map((x) => x.trim()).filter(Boolean) : [];
  return {
    id: Number(row.id),
    eventId: row.event_id || '',
    title: row.title || '',
    fromDate: toInputDateTime(row.from_date),
    toDate: toInputDateTime(row.to_date),
    type: row.e_type ? String(row.e_type) : '',
    category: row.e_category ?? '',
    departments: dept,
    description: row.e_description || '',
    inCampus: Number(row.e_icampus) === 1,
    inLocation: row.e_ilocation ? String(row.e_ilocation) : '',
    outCampus: Number(row.e_ocampus) === 1,
    outLocation: row.e_olocation || '',
    task: Number(row.e_task) === 1,
    taskOwner: row.e_towner ? String(row.e_towner) : '',
    approved: Number(row.e_status) === 1,
    statusKey: mapEventStatus(row, taskStatus),
    refId: Number(row.ref_id) || 0,
    rescheduleDate: row.reschedule_date && String(row.reschedule_date).slice(0, 10) !== '0000-00-00'
      ? String(row.reschedule_date).slice(0, 10) : '',
  };
}

export async function getStaffByDepartments(deptList = []) {
  const ids = Array.isArray(deptList) ? deptList : [];
  if (!ids.length) return [];

  let deptSearch = '';
  let committeeSearch = '';
  for (const deptId of ids) {
    const id = String(deptId).trim();
    if (!id) continue;
    if (id.startsWith('c_')) committeeSearch += ` committee_id='${escapeSql(id.slice(2))}' OR`;
    else deptSearch += ` department='${escapeSql(id)}' OR`;
  }

  const toDt = toDateOnly(new Date());
  let staffIdSearch = '';

  if (deptSearch) {
    const cond = deptSearch.slice(0, -2);
    const stfRows = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT staff_id FROM staff_designation_tb
      WHERE del=1 AND from_date<='${toDt}' AND (to_date>='${toDt}' OR to_date='0000-00-00')
      AND (${cond})
    `);
    for (const r of stfRows) staffIdSearch += ` id='${escapeSql(String(r.staff_id))}' OR`;
  }

  if (committeeSearch) {
    const cond = committeeSearch.slice(0, -2);
    const stfRows = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT staff_id FROM t_committee_member
      WHERE del=1 AND from_date<='${toDt}' AND (to_date>='${toDt}' OR to_date='0000-00-00')
      AND (${cond})
    `);
    for (const r of stfRows) staffIdSearch += ` id='${escapeSql(String(r.staff_id))}' OR`;
  }

  if (!staffIdSearch) return [];

  const cond = staffIdSearch.slice(0, -2);
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, staff_id, staff_title, staff_initial, staff_name
    FROM staff_profile_tb
    WHERE del=1 AND (releaving_date > DATE(NOW()) OR releaving_date='0000-00-00')
    AND (${cond})
    ORDER BY staff_id ASC
  `);
  return rows.map((r) => ({
    id: String(r.id),
    label: `${r.staff_id} - ${String(r.staff_title || '').trim()} ${r.staff_initial || ''} ${r.staff_name || ''}`.trim(),
  }));
}

async function loadMonthEvents(calMonth, calYear) {
  const firstDay = `${calYear}-${pad2(calMonth)}-01`;
  const lastDate = new Date(calYear, calMonth, 0);
  const lastDay = toDateOnly(lastDate);

  const rows = await prisma.$queryRawUnsafe(`
    SELECT e.id, e.title, e.from_date, e.to_date, e.e_status, e.e_task, e.ref_id,
      t.status AS task_status
    FROM tv_academic_event e
    LEFT JOIN t_task_allocation t ON t.id=e.ref_id AND t.del=1
    WHERE e.del=1
      AND DATE(e.from_date)<='${escapeSql(lastDay)}'
      AND DATE(e.to_date)>='${escapeSql(firstDay)}'
    ORDER BY e.from_date ASC
  `);

  const daysInMonth = lastDate.getDate();
  const byDate = {};
  for (let d = 1; d <= daysInMonth; d += 1) {
    byDate[d] = [];
  }

  for (const row of rows) {
    const from = new Date(row.from_date);
    const to = new Date(row.to_date);
    const start = Math.max(1, from.getFullYear() === calYear && from.getMonth() + 1 === calMonth ? from.getDate() : 1);
    const end = Math.min(daysInMonth, to.getFullYear() === calYear && to.getMonth() + 1 === calMonth ? to.getDate() : daysInMonth);
    const ev = {
      id: Number(row.id),
      title: row.title || '',
      statusKey: mapEventStatus(row, row.task_status),
    };
    for (let d = start; d <= end; d += 1) {
      if (byDate[d]) byDate[d].push(ev);
    }
  }

  const startWeekday = new Date(calYear, calMonth - 1, 1).getDay();
  return { daysInMonth, startWeekday, eventsByDay: byDate };
}

async function loadDayEvents(eventDate) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT e.id, e.event_id, e.title,
      IF(e.from_date='0000-00-00 00:00:00', NULL, e.from_date) AS from_date,
      IF(e.to_date='0000-00-00 00:00:00', NULL, e.to_date) AS to_date,
      e.e_type, e.e_category,
      e.e_department, e.e_description, e.e_icampus, e.e_ilocation, e.e_ocampus, e.e_olocation,
      e.e_towner, e.e_task, e.e_status, e.ref_id,
      IF(e.reschedule_date='0000-00-00', NULL, e.reschedule_date) AS reschedule_date,
      t.status AS task_status
    FROM tv_academic_event e
    LEFT JOIN t_task_allocation t ON t.id=e.ref_id AND t.del=1
    WHERE e.del=1
      AND DATE(e.from_date)<='${escapeSql(eventDate)}'
      AND DATE(e.to_date)>='${escapeSql(eventDate)}'
    ORDER BY e.event_id ASC
  `);
  return rows.map((r) => mapTvEvent(r, r.task_status));
}

function defaultEventRow(eventDate, index) {
  const ymd = eventDate.replace(/-/g, '').slice(2);
  const eventId = `${ymd}${pad2(index + 1)}`;
  return {
    eventId,
    title: '',
    type: '',
    category: '',
    departments: [],
    fromDate: `${eventDate}T09:00`,
    toDate: `${eventDate}T17:00`,
    description: '',
    inCampus: false,
    inLocation: '',
    outCampus: false,
    outLocation: '',
    task: false,
    taskOwner: '',
    approved: false,
  };
}

async function loadMasterData() {
  const [eventTypes, eventLocations, departments, committees, categories] = await Promise.all([
    loadEventTypes(),
    loadEventLocations(),
    loadDepartments(),
    loadCommittees(),
    loadEventCategories(),
  ]);
  return { eventTypes, eventLocations, departments, committees, categories };
}

export async function loadCommitteeTvEvent(memberId, fields = {}, audit = {}) {
  if (fields.staffForDepts) {
    const staffOptions = await getStaffByDepartments(fields.staffForDepts);
    return { success: true, staffOptions, staffRowIndex: fields.staffRowIndex };
  }

  const now = new Date();
  const calMonth = Number(fields.calMonth) || now.getMonth() + 1;
  const calYear = Number(fields.calYear) || now.getFullYear();
  const view = fields.view || (fields.eventDate ? 'day' : 'calendar');

  if (view === 'day' && fields.eventDate) {
    const eventDate = String(fields.eventDate).slice(0, 10);
    const events = await loadDayEvents(eventDate);
    const master = await loadMasterData();
    await logModulePage(TV_EVENT_PAGE, 'View', 'Successful', eventDate, memberId, audit);
    return {
      success: true,
      view: 'day',
      eventDate,
      calMonth,
      calYear,
      ...master,
      events: events.length ? events : [defaultEventRow(eventDate, 0)],
    };
  }

  const { daysInMonth, startWeekday, eventsByDay } = await loadMonthEvents(calMonth, calYear);
  await logModulePage(TV_EVENT_PAGE, 'View', 'Successful', `${calYear}-${pad2(calMonth)}`, memberId, audit);
  return {
    success: true,
    view: 'calendar',
    calMonth,
    calYear,
    daysInMonth,
    startWeekday,
    eventsByDay,
  };
}

export async function saveCommitteeTvEvent(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    const id = parseId(payload.eventId);
    const eventDate = String(payload.eventDate || '').slice(0, 10);
    await prisma.$executeRawUnsafe(`
      UPDATE tv_academic_event SET del=0,
        updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
      WHERE id=${id} AND del=1
    `);
    await logModulePage(TV_EVENT_PAGE, 'Update', 'Successful', String(id), memberId, audit);
    return {
      success: true,
      message: 'Event deleted.',
      ...(await loadCommitteeTvEvent(memberId, {
        view: 'day',
        eventDate,
        calMonth: payload.calMonth,
        calYear: payload.calYear,
      }, { ...audit, skipLog: true })),
    };
  }

  const eventDate = String(payload.eventDate || '').slice(0, 10);
  const refEventDate = eventDate;
  const events = Array.isArray(payload.events) ? payload.events : [];

  for (const ev of events) {
    if (!ev.title && !ev.id) continue;

    const fromDt = resolveEventDateTime(ev.fromDate, eventDate, '09:00:00');
    const toDt = resolveEventDateTime(ev.toDate, eventDate, '17:00:00');
    const deptList = Array.isArray(ev.departments) ? ev.departments.join(',') : '';
    const category = Number(ev.category) || 1;
    const inCampus = ev.inCampus ? 1 : 0;
    const outCampus = ev.outCampus ? 1 : 0;
    const task = ev.task ? 1 : 0;
    const prevTask = ev.prevTask ? 1 : 0;
    let taskCreatedSql = '';
    if (prevTask !== task && task === 1) {
      taskCreatedSql = `e_task_created=NOW(), `;
    }
    let approve = 0;
    let approveDt = '0000-00-00 00:00:00';
    if (task === 1) {
      approve = 1;
      approveDt = fromDt || `${eventDate} 09:00:00`;
    }

    if (ev.id) {
      await prisma.$executeRawUnsafe(`
        UPDATE tv_academic_event SET
          title='${escapeSql(ev.title || '')}',
          from_date='${escapeSql(fromDt || `${eventDate} 09:00:00`)}',
          to_date='${escapeSql(toDt || `${eventDate} 17:00:00`)}',
          e_category=${category},
          e_type='${escapeSql(ev.type || '')}',
          e_department='${escapeSql(deptList)}',
          e_description='${escapeSql(ev.description || '')}',
          e_icampus=${inCampus},
          e_ilocation='${escapeSql(ev.inLocation || '')}',
          e_ocampus=${outCampus},
          e_olocation='${escapeSql(ev.outLocation || '')}',
          e_towner='${escapeSql(ev.taskOwner || '')}',
          e_rowner='${escapeSql(ev.taskOwner || '')}',
          e_task=${task},
          ${taskCreatedSql}
          e_status=${approve},
          approved_date='${escapeSql(approveDt)}',
          del=1,
          updated_by='${escapeSql(memberId)}',
          updated_ip='${escapeSql(update.updated_ip)}',
          updated_dt=NOW()
        WHERE id=${Number(ev.id)}
      `);
    } else if (ev.title) {
      const eventId = ev.eventId || `${eventDate.replace(/-/g, '').slice(2)}01`;
      await prisma.$executeRawUnsafe(`
        INSERT INTO tv_academic_event (
          event_date, event_id, title, from_date, to_date, e_category, e_type, e_department,
          e_description, e_icampus, e_ilocation, e_ocampus, e_olocation, e_towner, e_rowner,
          e_task, e_task_created, e_status, approved_date, reschedule_date, e_reason, ref_id,
          created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del
        ) VALUES (
          '${escapeSql(refEventDate)}', '${escapeSql(eventId)}', '${escapeSql(ev.title)}',
          '${escapeSql(fromDt || `${eventDate} 09:00:00`)}',
          '${escapeSql(toDt || `${eventDate} 17:00:00`)}',
          ${category}, '${escapeSql(ev.type || '')}', '${escapeSql(deptList)}',
          '${escapeSql(ev.description || '')}', ${inCampus}, '${escapeSql(ev.inLocation || '')}',
          ${outCampus}, '${escapeSql(ev.outLocation || '')}',
          '${escapeSql(ev.taskOwner || '')}', '${escapeSql(ev.taskOwner || '')}',
          ${task}, ${task === 1 ? 'NOW()' : "'0000-00-00 00:00:00'"},
          ${approve}, '${escapeSql(approveDt)}', '0000-00-00', '', 0,
          NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
          '0000-00-00 00:00:00', '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', 1
        )
      `);
    }
  }

  await logModulePage(TV_EVENT_PAGE, 'Update', 'Successful', eventDate, memberId, audit);
  return {
    success: true,
    message: 'Events saved.',
    ...(await loadCommitteeTvEvent(memberId, {
      view: 'day',
      eventDate,
      calMonth: payload.calMonth,
      calYear: payload.calYear,
    }, { ...audit, skipLog: true })),
  };
}
