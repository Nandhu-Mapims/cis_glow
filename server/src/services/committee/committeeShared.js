import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';

export const EVENT_TYPE_FLAGS = [
  'Participants', 'Sponsors', 'Budget', 'To-Do List', 'Circular', 'Chief Guest', 'Agenda',
  'Meeting Agenda', 'Minutes of Meeting', 'Media Content', 'Gallery', 'Resources', 'Status',
  'Event Logo', 'Attendance', 'Certificate',
];

export async function loadEventCategories() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, client_name FROM t_client_master WHERE del=1 ORDER BY client_name ASC
  `);
  return rows.map((r) => ({ id: Number(r.id), name: r.client_name || '' }));
}

export async function loadCommitteeOptions() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, title FROM t_committee WHERE del=1 ORDER BY title ASC
  `);
  return rows.map((r) => ({ id: Number(r.id), title: r.title || '' }));
}

export async function loadDesignationOptions() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, category_name FROM master_setup
    WHERE del=1 AND category='Committee Designation' ORDER BY category_order ASC
  `);
  return rows.map((r) => ({ id: Number(r.id), name: r.category_name || '' }));
}

export async function loadStaffOptions() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, staff_id, staff_title, staff_name, staff_initial
    FROM staff_profile_tb
    WHERE del=1 AND (releaving_date='0000-00-00' OR releaving_date > DATE(NOW()))
    ORDER BY staff_id ASC
  `);
  return rows.map((r) => ({
    id: Number(r.id),
    staffId: r.staff_id || '',
    label: `${r.staff_id} | ${String(r.staff_title || '').trim()} ${r.staff_name || ''} ${r.staff_initial || ''}`.trim(),
  }));
}

export async function loadWorkTypeOptions() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, title FROM t_task_type WHERE del=1 AND t_type='worktype' ORDER BY t_order ASC
  `);
  return rows.map((r) => ({ id: Number(r.id), title: r.title || '' }));
}

export function categoryMatchSql(categoryId) {
  const id = escapeSql(String(categoryId));
  return `((c_category='${id}') OR (c_category LIKE '%,${id}') OR (c_category LIKE '%,${id},%') OR (c_category LIKE '${id},%'))`;
}
