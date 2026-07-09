import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { logModulePage } from '../shared/moduleAudit.js';
import { categoryMatchSql, loadEventCategories } from './committeeShared.js';

const PAGE = 'committee_dashboard.php';
const MORE_PAGE = 'committee_dashboard_more.php';

function formatEventDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' });
}

function mapEvent(row) {
  return {
    id: Number(row.id),
    title: row.title || '',
    fromDate: formatEventDate(row.from_date),
    type: row.e_type || '',
    category: row.e_category || '',
    hasTask: Number(row.ref_id) > 0,
  };
}

export async function loadCommitteeDashboard(memberId, fields = {}, audit = {}) {
  const calendarMonth = fields.calendarMonth || new Date().toISOString().slice(0, 7);
  const categories = await loadEventCategories();
  const stats = [];
  for (const cat of categories) {
    const countRows = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS cnt FROM t_committee WHERE del=1 AND ${categoryMatchSql(cat.id)}
    `);
    stats.push({ ...cat, committeeCount: Number(countRows[0]?.cnt || 0) });
  }
  const events = await prisma.$queryRawUnsafe(`
    SELECT id, title, from_date, e_type, e_category, ref_id
    FROM tv_academic_event
    WHERE del=1 AND DATE_FORMAT(from_date, '%Y-%m')='${escapeSql(calendarMonth)}'
    ORDER BY from_date ASC LIMIT 100
  `);
  await logModulePage(PAGE, 'View', 'Successful', calendarMonth, memberId, audit);
  return { success: true, calendarMonth, categories: stats, events: events.map(mapEvent) };
}

export async function loadCommitteeDashboardDetails(memberId, fields = {}, audit = {}) {
  const flag = Number(fields.flag) || 1;
  const categoryId = fields.categoryId ? String(fields.categoryId) : '';
  const eventDate = fields.eventDate || '';
  const categoryName = fields.categoryName || '';

  const base = await loadCommitteeDashboard(memberId, { calendarMonth: fields.calendarMonth }, { ...audit, skipLog: true });

  let committees = [];
  let detailEvents = [];
  let members = [];

  if (flag === 1 && categoryId) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT title FROM t_committee WHERE del=1 AND ${categoryMatchSql(categoryId)} ORDER BY title ASC
    `);
    committees = rows.map((r, i) => ({ sno: i + 1, title: r.title }));
  } else if (flag === 10 && categoryId && eventDate) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, title, ref_id, from_date, e_category, e_department
      FROM tv_academic_event
      WHERE del=1 AND e_type='${escapeSql(categoryId)}'
        AND MONTH(from_date)=MONTH('${escapeSql(eventDate)}')
        AND YEAR(from_date)=YEAR('${escapeSql(eventDate)}')
      ORDER BY from_date ASC
    `);
    detailEvents = rows.map((r, i) => ({
      sno: i + 1,
      id: Number(r.id),
      title: r.title,
      date: r.from_date ? String(r.from_date).slice(0, 16) : '',
      status: Number(r.ref_id) > 0 ? 'Task Created' : 'Pending',
    }));
  } else if (flag === 2 && fields.committeeId && eventDate) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT m.staff_id, s.staff_name, s.staff_title, d.category_name
      FROM t_committee_member m
      LEFT JOIN staff_profile_tb s ON s.id=m.staff_id
      LEFT JOIN master_setup d ON d.id=m.designation
      WHERE m.del=1 AND m.committee_id=${Number(fields.committeeId)}
        AND m.from_date<='${escapeSql(eventDate)}'
        AND (m.to_date='0000-00-00' OR m.to_date>='${escapeSql(eventDate)}')
      ORDER BY m.s_order ASC
    `);
    members = rows.map((r, i) => ({
      sno: i + 1,
      name: `${r.staff_title || ''} ${r.staff_name || ''}`.trim() || r.staff_id,
      designation: r.category_name || '',
    }));
  }

  await logModulePage(MORE_PAGE, 'View', 'Successful', String(flag), memberId, audit);
  return {
    ...base,
    flag,
    categoryName,
    selectedCategoryId: categoryId ? Number(categoryId) : null,
    committees,
    detailEvents,
    members,
  };
}

export async function saveCommitteeDashboard() {
  return { success: false, message: 'Dashboard is read-only.' };
}
