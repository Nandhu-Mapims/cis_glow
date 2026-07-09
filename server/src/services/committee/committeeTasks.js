import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';

const DASHBOARD_PAGE = 'st_task_dashboard.php';
const ALLOCATION_PAGE = 'st_task_allocation_approved.php';
function mapTask(row) {
  return {
    id: Number(row.id),
    name: row.task_name || '',
    clientName: row.client_name || '',
    startDate: row.start_date ? String(row.start_date).slice(0, 10) : '',
    targetDate: row.target_date ? String(row.target_date).slice(0, 10) : '',
    status: row.status || '',
    refId: Number(row.ref_id) || 0,
  };
}

export async function loadCommitteeTaskDashboard(memberId, fields = {}, audit = {}) {
  const date = fields.attendanceDate || new Date().toISOString().slice(0, 10);
  const rows = await prisma.$queryRawUnsafe(`
    SELECT A.id, A.task_name, C.client_name, A.start_date, A.target_date, A.status, A.ref_id
    FROM t_task_allocation A
    LEFT JOIN t_client_master C ON C.id=A.client_id
    WHERE A.del=1 AND A.ref_id=0
      AND DATE(A.start_date)<='${escapeSql(date)}' AND DATE(A.target_date)>='${escapeSql(date)}'
    ORDER BY A.start_date ASC LIMIT 100
  `);
  await logModulePage(DASHBOARD_PAGE, 'View', 'Successful', date, memberId, audit);
  return { success: true, attendanceDate: date, tasks: rows.map(mapTask) };
}

export async function saveCommitteeTaskDashboard() {
  return { success: false, message: 'Task dashboard is read-only.' };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateOnly(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function deptFilterSql(column, departments = []) {
  if (!Array.isArray(departments) || !departments.length) return '';
  const parts = departments.map((id) => {
    const d = escapeSql(String(id).trim());
    if (!d) return '';
    return `(${column}='${d}' OR ${column} LIKE '${d},%' OR ${column} LIKE '%,${d}' OR ${column} LIKE '%,${d},%')`;
  }).filter(Boolean);
  if (!parts.length) return '';
  return ` AND (${parts.join(' OR ')})`;
}

function formatProgramDate(fromValue, toValue) {
  const from = fromValue ? new Date(fromValue) : null;
  const to = toValue ? new Date(toValue) : null;
  if (!from || Number.isNaN(from.getTime())) return '';
  const fmt = (d, withDate = true) => d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: withDate ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit',
  });
  if (!to || Number.isNaN(to.getTime())) return fmt(from);
  const sameDay = from.toDateString() === to.toDateString();
  return sameDay ? `${fmt(from)} - ${to.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : `${fmt(from)} - ${fmt(to)}`;
}

async function loadEventTypes() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, category_name FROM master_setup
    WHERE category='Event Type' AND del!=0 ORDER BY category_order ASC
  `);
  return rows.map((r) => ({ id: String(r.id), name: r.category_name || '' }));
}

async function loadDepartments() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, name FROM staff_dept_master WHERE del=1 ORDER BY d_order ASC
  `);
  return rows.map((r) => ({ id: String(r.id), name: r.name || '' }));
}

async function loadClientMap() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, client_name FROM t_client_master WHERE del=1 ORDER BY client_name ASC
  `);
  const map = {};
  for (const r of rows) map[Number(r.id)] = r.client_name || '';
  return map;
}

export async function loadCommitteeTaskAllocation(memberId, fields = {}, audit = {}) {
  const tab = fields.tab === 'completed' ? 'completed' : 'open';
  const taskStatus = tab === 'completed' ? 'Completed' : 'Open';
  const fromDate = fields.fromDate ? String(fields.fromDate).slice(0, 10) : '';
  const toDate = fields.toDate ? String(fields.toDate).slice(0, 10) : '';
  const title = fields.title ? String(fields.title).trim() : '';
  const eventType = fields.eventType ? String(fields.eventType) : '';
  const departments = Array.isArray(fields.departments) ? fields.departments.map(String) : [];
  const deptEventFilter = deptFilterSql('e.e_department', departments);
  const deptTaskFilter = deptFilterSql('B.e_department', departments);

  const [clientMap, departmentsList, eventTypes] = await Promise.all([
    loadClientMap(),
    loadDepartments(),
    loadEventTypes(),
  ]);

  const items = [];

  if (tab === 'open') {
    let eventWhere = 'e.del=1 AND e.e_status=1 AND e.e_task=1 AND e.ref_id=0';
    if (eventType && eventType !== '0') eventWhere += ` AND e.e_type='${escapeSql(eventType)}'`;
    if (title) eventWhere += ` AND e.title LIKE '%${escapeSql(title)}%'`;
    eventWhere += deptEventFilter;

    if (fromDate && toDate) {
      eventWhere += ` AND DATE(e.from_date)>='${escapeSql(fromDate)}' AND DATE(e.from_date)<='${escapeSql(toDate)}'`;
    } else if (fromDate) {
      eventWhere += ` AND DATE(e.from_date)>='${escapeSql(fromDate)}'`;
    } else if (!toDate) {
      const today = toDateOnly(new Date());
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      eventWhere += ` AND DATE(e.from_date)>='${today}' AND DATE(e.to_date)<='${toDateOnly(nextMonth)}'`;
    }

    const eventRows = await prisma.$queryRawUnsafe(`
      SELECT e.id, e.title, e.e_category,
        IF(e.from_date='0000-00-00 00:00:00', NULL, e.from_date) AS from_date,
        IF(e.to_date='0000-00-00 00:00:00', NULL, e.to_date) AS to_date,
        IF(e.approved_date='0000-00-00 00:00:00', NULL, e.approved_date) AS approved_date
      FROM tv_academic_event e
      WHERE ${eventWhere}
      ORDER BY e.event_date ASC
      LIMIT 100
    `);

    for (const row of eventRows) {
      items.push({
        key: `event-${row.id}`,
        kind: 'event',
        id: Number(row.id),
        manageId: `a_${row.id}`,
        categoryName: clientMap[Number(row.e_category)] || '',
        title: row.title || '',
        programDate: formatProgramDate(row.from_date, row.to_date),
        approvedOn: row.approved_date
          ? new Date(row.approved_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : '',
      });
    }
  }

  let taskWhere = `A.del=1 AND A.status='${taskStatus}'`;
  let directWhere = `del=1 AND status='${taskStatus}'`;
  if (title) {
    taskWhere += ` AND A.task_name LIKE '%${escapeSql(title)}%'`;
    directWhere += ` AND task_name LIKE '%${escapeSql(title)}%'`;
  }

  const taskLimit = (!fromDate && !toDate) ? ' LIMIT 12' : ' LIMIT 100';
  const useEventJoin = !!(deptTaskFilter || (eventType && eventType !== '0'));
  let taskSql;

  if (useEventJoin) {
    taskWhere += deptTaskFilter;
    if (eventType && eventType !== '0') taskWhere += ` AND B.e_type='${escapeSql(eventType)}'`;
    if (fromDate && toDate) {
      taskWhere += ` AND DATE(A.start_date)>='${escapeSql(fromDate)}' AND DATE(A.start_date)<='${escapeSql(toDate)}'`;
    } else if (fromDate) {
      taskWhere += ` AND DATE(A.start_date)>='${escapeSql(fromDate)}'`;
    }
    taskSql = `
      SELECT A.id, A.task_id, A.task_name, A.client_id, A.start_date, A.status
      FROM t_task_allocation A
      INNER JOIN tv_academic_event B ON A.id=B.ref_id AND B.del=1
      WHERE ${taskWhere}
      ORDER BY A.start_date ASC
      ${taskLimit}
    `;
  } else {
    if (fromDate && toDate) {
      directWhere += ` AND DATE(start_date)>='${escapeSql(fromDate)}' AND DATE(start_date)<='${escapeSql(toDate)}'`;
    } else if (fromDate) {
      directWhere += ` AND DATE(start_date)>='${escapeSql(fromDate)}'`;
    }
    taskSql = `
      SELECT id, task_id, task_name, client_id, start_date, status
      FROM t_task_allocation
      WHERE ${directWhere}
      ORDER BY start_date ASC
      ${taskLimit}
    `;
  }

  const taskRows = await prisma.$queryRawUnsafe(taskSql);
  for (const row of taskRows) {
    items.push({
      key: `task-${row.id}`,
      kind: 'task',
      id: Number(row.id),
      manageId: String(row.id),
      categoryName: clientMap[Number(row.client_id)] || '',
      title: `${row.id}: ${row.task_name || ''}`,
      programDate: row.start_date
        ? new Date(row.start_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '',
      approvedOn: '',
    });
  }

  let detail = null;
  const manageId = fields.manageId || fields.taskId || null;
  if (manageId) {
    if (String(manageId).startsWith('a_')) {
      const eventId = Number(String(manageId).slice(2));
      const d = await prisma.$queryRawUnsafe(`
        SELECT e.id, e.title, e.e_category,
          IF(e.from_date='0000-00-00 00:00:00', NULL, e.from_date) AS from_date,
          IF(e.to_date='0000-00-00 00:00:00', NULL, e.to_date) AS to_date,
          e.e_description
        FROM tv_academic_event e WHERE e.del=1 AND e.id=${eventId} LIMIT 1
      `);
      if (d[0]) {
        detail = {
          manageId,
          kind: 'event',
          taskName: d[0].title || '',
          clientName: clientMap[Number(d[0].e_category)] || '',
          startDate: d[0].from_date ? String(d[0].from_date).slice(0, 16) : '',
          targetDate: d[0].to_date ? String(d[0].to_date).slice(0, 16) : '',
          circularNotes: d[0].e_description || '',
        };
      }
    } else {
      const d = await prisma.$queryRawUnsafe(`
        SELECT A.id, A.task_name, A.client_id, A.start_date, A.target_date, A.priority, A.staff_id,
          A.circular_notes, A.minutes_meeting
        FROM t_task_allocation A
        WHERE A.del=1 AND A.id=${Number(manageId)} LIMIT 1
      `);
      if (d[0]) {
        detail = {
          manageId: String(d[0].id),
          kind: 'task',
          taskName: d[0].task_name || '',
          clientName: clientMap[Number(d[0].client_id)] || '',
          startDate: d[0].start_date ? String(d[0].start_date).slice(0, 10) : '',
          targetDate: d[0].target_date ? String(d[0].target_date).slice(0, 10) : '',
          priority: d[0].priority || '',
          staffId: d[0].staff_id || '',
          circularNotes: d[0].circular_notes || '',
          minutesMeeting: d[0].minutes_meeting || '',
        };
      }
    }
  }

  await logModulePage(ALLOCATION_PAGE, 'View', 'Successful', tab, memberId, audit);
  return {
    success: true,
    tab,
    fromDate,
    toDate,
    title,
    eventType,
    departments,
    departmentsList,
    eventTypes,
    items,
    manageId,
    detail,
  };
}

export async function saveCommitteeTaskAllocation(payload, memberId, audit = {}) {
  const manageId = payload.manageId || payload.taskId;
  if (!manageId || String(manageId).startsWith('a_')) {
    return { success: false, message: 'Event tasks must be created from the Manage Task workflow (legacy parity).' };
  }
  const taskId = Number(manageId);
  if (!taskId) return { success: false, message: 'Invalid task.' };
  const { update } = auditFields(memberId, audit);
  await prisma.$executeRawUnsafe(`
    UPDATE t_task_allocation SET task_name='${escapeSql(payload.taskName || '')}',
      start_date=${payload.startDate ? `'${escapeSql(payload.startDate)}'` : 'NULL'},
      target_date=${payload.targetDate ? `'${escapeSql(payload.targetDate)}'` : 'NULL'},
      priority='${escapeSql(payload.priority || '')}', staff_id='${escapeSql(payload.staffId || '')}',
      circular_notes='${escapeSql(payload.circularNotes || '')}',
      minutes_meeting='${escapeSql(payload.minutesMeeting || '')}',
      updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
    WHERE id=${taskId}
  `);
  await logModulePage(ALLOCATION_PAGE, 'Update', 'Successful', String(taskId), memberId, audit);
  return {
    success: true,
    message: 'Task saved.',
    ...(await loadCommitteeTaskAllocation(memberId, {
      tab: payload.tab,
      manageId: String(taskId),
      fromDate: payload.fromDate,
      toDate: payload.toDate,
      title: payload.title,
      eventType: payload.eventType,
      departments: payload.departments,
    }, { ...audit, skipLog: true })),
  };
}

export async function loadCommitteeTaskDocument(memberId, fields = {}, audit = {}) {
  const { loadCommitteeTaskDocument: load } = await import('./committeeTaskDocument.js');
  return load(memberId, fields, audit);
}

export async function saveCommitteeTaskDocument(payload, memberId, files = [], audit = {}) {
  const { saveCommitteeTaskDocument: save } = await import('./committeeTaskDocument.js');
  return save(payload, memberId, files, audit);
}

export async function loadCommitteeTaskBudget(memberId, fields = {}, audit = {}) {
  const { loadCommitteeTaskBudget: load } = await import('./committeeTaskBudgetApproved.js');
  return load(memberId, fields, audit);
}

export async function saveCommitteeTaskBudget(payload, memberId, audit = {}) {
  const { saveCommitteeTaskBudget: save } = await import('./committeeTaskBudgetApproved.js');
  return save(payload, memberId, audit);
}
