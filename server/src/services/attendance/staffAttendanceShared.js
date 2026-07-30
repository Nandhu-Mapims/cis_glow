import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { formatDateDisplay, toIsoDate } from './setupAudit.js';

export function buildMonthOptions(monthsBack = 24, monthsForward = 3) {
  const options = [];
  const now = new Date();
  for (let i = -monthsBack; i <= monthsForward; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}

export async function loadStaffCategories() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT B.id, B.category_name
     FROM staff_profile_tb AS A
     INNER JOIN edu_setup_tb AS B ON A.job_category = B.id
     WHERE A.del = 1
       AND (CAST(A.releaving_date AS CHAR) > DATE(NOW())
         OR A.releaving_date = '0000-00-00'
         OR CAST(A.releaving_date AS CHAR) = '')
       AND B.category = 'Category'
     ORDER BY B.category_order ASC, B.category_name ASC`,
  );
  return rows.map((r) => ({ id: Number(r.id), name: r.category_name }));
}

/** Full admin-defined category list (edu_setup_tb) — unlike
 * loadStaffCategories() above, this isn't limited to categories that have
 * an active staff member assigned, matching staff_academic_calendar.php's
 * "Category" multi-select which tags a calendar day, not a specific staff
 * member. */
export async function loadCalendarCategories() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, category_name FROM edu_setup_tb WHERE category='Category' AND del=1 ORDER BY category_order ASC`,
  );
  return rows.map((r) => ({ id: Number(r.id), name: r.category_name }));
}

export async function loadDepartments() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, name FROM staff_dept_master WHERE del = 1 ORDER BY d_order ASC`,
  );
  return rows.map((r) => ({ id: Number(r.id), name: r.name }));
}

export async function loadReportAuthorities() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, authority_name FROM report_authority_tb WHERE del = 1 ORDER BY authority_name ASC`,
  );
  return rows.map((r) => ({ id: Number(r.id), name: r.authority_name }));
}

export async function loadAcademicEvents() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, event_name FROM basic_event_tb WHERE del = 1 ORDER BY event_name ASC`,
  );
  return rows.map((r) => ({ id: Number(r.id), name: r.event_name }));
}

export async function loadCalendarEventTypes() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, event_name FROM basic_cal_event WHERE del = 1 ORDER BY event_name ASC`,
  );
  return rows.map((r) => ({ id: Number(r.id), name: r.event_name }));
}

export async function searchStaffByCategory(categoryId, term = '', limit = 50) {
  let catFilter = '';
  if (categoryId && categoryId !== 'All') {
    catFilter = ` AND A.job_category = '${escapeSql(String(categoryId))}'`;
  }
  let termFilter = '';
  if (term) {
    const t = escapeSql(String(term));
    termFilter = ` AND (A.staff_id LIKE '%${t}%' OR A.staff_name LIKE '%${t}%')`;
  }
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.id, A.staff_id, A.staff_name, A.staff_initial, A.staff_title
     FROM staff_profile_tb AS A
     WHERE A.del = 1
       AND (A.releaving_date > DATE(NOW()) OR A.releaving_date = '0000-00-00')
       ${catFilter}${termFilter}
     ORDER BY A.staff_id ASC LIMIT ${Number(limit) || 50}`,
  );
  return rows.map((r) => ({
    id: Number(r.id),
    staffId: r.staff_id,
    name: `${r.staff_title || ''} ${r.staff_initial || ''} ${r.staff_name || ''}`.trim(),
  }));
}

export async function loadStaffProfileByStaffId(staffId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id, staff_name, staff_initial, staff_title, att_category, job_category,
            IF(joined_date='0000-00-00', '', CAST(joined_date AS CHAR)) AS joined_date,
            IF(releaving_date='0000-00-00', '', CAST(releaving_date AS CHAR)) AS releaving_date
     FROM staff_profile_tb WHERE del = 1 AND staff_id = '${escapeSql(String(staffId))}' LIMIT 1`,
  );
  return rows[0] || null;
}

export async function loadStaffProfileById(id) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id, staff_name, staff_initial, staff_title, att_category, job_category,
            IF(joined_date='0000-00-00', '', CAST(joined_date AS CHAR)) AS joined_date,
            IF(releaving_date='0000-00-00', '', CAST(releaving_date AS CHAR)) AS releaving_date
     FROM staff_profile_tb WHERE del = 1 AND id = ${Number(id)} LIMIT 1`,
  );
  return rows[0] || null;
}

export function parseDateRange(fields) {
  const fromDate = toIsoDate(fields.from_date || fields.fromDate) || new Date().toISOString().slice(0, 10);
  const toDate = toIsoDate(fields.to_date || fields.toDate) || fromDate;
  return { fromDate, toDate, fromDisplay: formatDateDisplay(fromDate), toDisplay: formatDateDisplay(toDate) };
}

export function categoryFilterSql(categories, col = 'A.job_category') {
  if (!categories?.length) return '';
  const ids = categories.map((c) => `'${escapeSql(String(c))}'`).join(',');
  return ` AND ${col} IN (${ids})`;
}

export async function loadActiveStaffList({ categories = [], deptIds = [], page = 1, limit = 50 } = {}) {
  const offset = (Math.max(1, Number(page)) - 1) * limit;
  let filters = `A.del = 1 AND (A.releaving_date > DATE(NOW()) OR A.releaving_date = '0000-00-00')`;
  if (categories.length) filters += categoryFilterSql(categories, 'A.job_category');
  if (deptIds.length) {
    const ids = deptIds.map((d) => Number(d)).filter(Boolean).join(',');
    if (ids) filters += ` AND A.id IN (SELECT staff_id FROM staff_designation_tb WHERE del=1 AND department IN (${ids}))`;
  }
  const countRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS cnt FROM staff_profile_tb AS A WHERE ${filters}`,
  );
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.id, A.staff_id, A.staff_name, A.staff_initial, A.staff_title, A.att_category, A.job_category
     FROM staff_profile_tb AS A WHERE ${filters}
     ORDER BY A.staff_id ASC LIMIT ${limit} OFFSET ${offset}`,
  );
  return {
    total: Number(countRows[0]?.cnt || 0),
    page: Number(page),
    limit,
    rows,
  };
}

export function htmlTable(headers, bodyRows) {
  const th = headers.map((h) => `<th>${h}</th>`).join('');
  const tr = bodyRows.map((row) => `<tr>${row.map((c) => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('');
  return `<div class="att_report_span"><table class="table table-bordered table-sm"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}
