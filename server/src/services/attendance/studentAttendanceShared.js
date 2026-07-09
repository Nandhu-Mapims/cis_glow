import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { formatDateDisplay, logStaffAttSetup, toIsoDate } from './setupAudit.js';

export { formatDateDisplay, toIsoDate, logStaffAttSetup as logStudentAtt };

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function htmlTable(headers, rows) {
  const th = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const trs = rows.map((row, i) => {
    const cells = row.map((c) => `<td>${c}</td>`).join('');
    return `<tr><td>${i + 1}</td>${cells}</tr>`;
  }).join('');
  return `<table class="table table-bordered table-sm"><thead><tr><th>S.No</th>${th}</tr></thead><tbody>${trs || '<tr><td colspan="99">No records</td></tr>'}</tbody></table>`;
}

export function wrapReportHtml(title, body) {
  return `<div class="report-print"><h4 class="text-center">${escapeHtml(title)}</h4>${body}</div>`;
}

export function parseDateRange(fields) {
  const today = new Date();
  const defaultTo = today.toISOString().slice(0, 10);
  const defaultFrom = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const fromDate = toIsoDate(fields.from_date || fields.fromDate) || defaultFrom;
  const toDate = toIsoDate(fields.to_date || fields.toDate) || defaultTo;
  return { fromDate, toDate };
}

export function parseApprovalDateRange(fields) {
  const fromDate = toIsoDate(fields.from_date || fields.fromDate);
  const toDate = toIsoDate(fields.to_date || fields.toDate);
  return { fromDate, toDate };
}

export function buildOptionalDateFilter(column, fromDate, toDate) {
  const validDate = `(CAST(${column} AS CHAR) NOT LIKE '0000-%' AND CAST(${column} AS CHAR) != '')`;
  if (fromDate && toDate) {
    return ` AND ${validDate} AND DATE(${column}) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'`;
  }
  if (fromDate) return ` AND ${validDate} AND DATE(${column}) >= '${escapeSql(fromDate)}'`;
  if (toDate) return ` AND ${validDate} AND DATE(${column}) <= '${escapeSql(toDate)}'`;
  return '';
}

export function buildStudentRollFilter(rollRef) {
  const rolls = String(rollRef || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (!rolls.length) return '';
  const clauses = rolls.map((roll) => `B.register_no='${escapeSql(roll)}'`).join(' OR ');
  return ` AND (${clauses})`;
}

export async function loadHolidayDates() {
  const currentDate = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - 270 * 86400000).toISOString().slice(0, 10);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT academic_date FROM academic_calender_tb
     WHERE del = 1 AND academic_events LIKE 'Holiday%'
       AND academic_date >= '${escapeSql(fromDate)}' AND academic_date <= '${escapeSql(currentDate)}'
     ORDER BY academic_date ASC`,
  );
  return rows.map((r) => formatDateDisplay(r.academic_date));
}

export async function loadPgCourses() {
  return prisma.$queryRawUnsafe(
    `SELECT id, degree_name, department_name FROM basic_setup_course_tb
     WHERE del = 1 AND course_name = 'P.G' ORDER BY c_order ASC`,
  );
}

export async function loadAttendanceBannerUrl() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT banner_image FROM basic_banner_tb WHERE del = 1 AND id = 1 LIMIT 1',
  );
  const image = rows[0]?.banner_image;
  return image ? `/legacy/img/global_images/${encodeURIComponent(image)}` : '';
}

export async function loadInternDepartments() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT department FROM internship_timetable WHERE del = 1 AND department != '' ORDER BY department ASC`,
  );
  return rows.map((r) => r.department);
}

export async function isWorkingDay(attendanceDate) {
  const d = toIsoDate(attendanceDate);
  if (!d) return { ok: false, error: 'Invalid date' };
  const rows = await prisma.$queryRawUnsafe(
    `SELECT academic_events, comments FROM academic_calender_tb WHERE academic_date='${escapeSql(d)}' AND del=1 LIMIT 1`,
  );
  if (!rows.length) return { ok: false, error: 'No calendar entry for this date' };
  const ev = String(rows[0].academic_events || '');
  const holiday = ev.startsWith('Holiday');
  return { ok: !holiday, event: ev, comments: rows[0].comments || '' };
}

export const PERIOD_IN_OUT = [
  { period: 'in', periodLabel: 'In' },
  { period: 'out', periodLabel: 'Out' },
];
