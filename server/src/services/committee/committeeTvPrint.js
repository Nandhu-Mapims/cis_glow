import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { logModulePage } from '../shared/moduleAudit.js';

const TV_PRINT_PAGE = 'tv_academic_print.php';

async function loadDepartments() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, name FROM staff_dept_master WHERE del=1 ORDER BY d_order ASC
  `);
  return rows.map((r) => ({ id: Number(r.id), name: r.name || '' }));
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function deptFilterSql(departments = []) {
  if (!Array.isArray(departments) || !departments.length) return '';
  const parts = departments.map((id) => {
    const d = escapeSql(String(id).trim());
    if (!d) return '';
    return `(e.e_department='${d}' OR e.e_department LIKE '${d},%' OR e.e_department LIKE '%,${d}' OR e.e_department LIKE '%,${d},%')`;
  }).filter(Boolean);
  if (!parts.length) return '';
  return ` AND (${parts.join(' OR ')})`;
}

function mapEventStatus(row, taskStatus) {
  if (taskStatus === 'Completed') return 'completed';
  if (Number(row.e_task) === 1 && Number(row.e_status) === 1) return 'approved';
  if (Number(row.e_task) === 1 && Number(row.e_status) === 0) return 'created';
  if (Number(row.e_task) === 1 && Number(row.e_status) === 2) return 'rejected';
  return 'default';
}

function formatEventTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-GB', {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function loadPrintMonthEvents(calMonth, calYear, departments = []) {
  const deptWhere = deptFilterSql(departments);
  const rows = await prisma.$queryRawUnsafe(`
    SELECT e.id, e.title, e.from_date, e.e_status, e.e_task, e.ref_id,
      t.status AS task_status
    FROM tv_academic_event e
    LEFT JOIN t_task_allocation t ON t.id=e.ref_id AND t.del=1
    WHERE e.del=1
      AND MONTH(e.from_date)=${Number(calMonth)}
      AND YEAR(e.from_date)=${Number(calYear)}
      ${deptWhere}
    ORDER BY e.from_date ASC
  `);

  const lastDate = new Date(calYear, calMonth, 0);
  const daysInMonth = lastDate.getDate();
  const byDate = {};
  for (let d = 1; d <= daysInMonth; d += 1) {
    byDate[d] = [];
  }

  for (const row of rows) {
    const from = new Date(row.from_date);
    if (Number.isNaN(from.getTime())) continue;
    if (from.getMonth() + 1 !== Number(calMonth) || from.getFullYear() !== Number(calYear)) continue;
    const day = from.getDate();
    byDate[day].push({
      id: Number(row.id),
      title: row.title || '',
      statusKey: mapEventStatus(row, row.task_status),
    });
  }

  const startWeekday = new Date(calYear, calMonth - 1, 1).getDay();
  return { daysInMonth, startWeekday, eventsByDay: byDate };
}

async function loadPrintDayEvents(eventDate, departments = []) {
  const deptWhere = deptFilterSql(departments);
  const rows = await prisma.$queryRawUnsafe(`
    SELECT e.id, e.title,
      IF(e.from_date='0000-00-00 00:00:00', NULL, e.from_date) AS from_date,
      e.e_status, t.id AS task_id
    FROM tv_academic_event e
    LEFT JOIN t_task_allocation t ON t.id=e.ref_id AND t.del=1
    WHERE e.del=1
      AND DATE(e.from_date)='${escapeSql(eventDate)}'
      ${deptWhere}
    ORDER BY e.from_date ASC
  `);

  return rows.map((r) => ({
    id: Number(r.id),
    title: r.title || '',
    fromDate: formatEventTime(r.from_date),
    approved: Number(r.e_status) === 1,
    hasTask: !!r.task_id,
  }));
}

export async function loadCommitteeTvPrint(memberId, fields = {}, audit = {}) {
  const departments = Array.isArray(fields.departments) ? fields.departments.map(String) : [];
  const now = new Date();
  const calMonth = Number(fields.calMonth) || now.getMonth() + 1;
  const calYear = Number(fields.calYear) || now.getFullYear();
  const view = fields.view || (fields.eventDate ? 'day' : 'calendar');

  if (view === 'day' && fields.eventDate) {
    const eventDate = String(fields.eventDate).slice(0, 10);
    const events = await loadPrintDayEvents(eventDate, departments);
    await logModulePage(TV_PRINT_PAGE, 'View', 'Successful', eventDate, memberId, audit);
    return {
      success: true,
      view: 'day',
      eventDate,
      calMonth,
      calYear,
      departments,
      departmentsList: await loadDepartments(),
      events,
    };
  }

  const { daysInMonth, startWeekday, eventsByDay } = await loadPrintMonthEvents(calMonth, calYear, departments);
  await logModulePage(TV_PRINT_PAGE, 'View', 'Successful', `${calYear}-${pad2(calMonth)}`, memberId, audit);
  return {
    success: true,
    view: 'calendar',
    calMonth,
    calYear,
    departments,
    departmentsList: await loadDepartments(),
    daysInMonth,
    startWeekday,
    eventsByDay,
  };
}

export async function saveCommitteeTvPrint() {
  return { success: false, message: 'Print view is read-only.' };
}
