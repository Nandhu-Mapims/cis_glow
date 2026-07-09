import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';

function formatStaffName(row) {
  const title = row.staff_title ? `${row.staff_title}. ` : '';
  return `${title}${row.staff_name || ''} ${row.staff_initial || ''}`.trim();
}

function isStaffResigned(releavingDate) {
  if (!releavingDate || String(releavingDate).startsWith('0000-00-00')) return false;
  const relieved = new Date(releavingDate);
  if (Number.isNaN(relieved.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  relieved.setHours(0, 0, 0, 0);
  return relieved < today;
}

function mapStaffSearchRow(row, index = 0, selectedId = null) {
  return {
    id: Number(row.id),
    staffId: row.staff_id,
    name: formatStaffName(row),
    jobCategory: row.job_category,
    designation: row.designation,
    resigned: isStaffResigned(row.releaving_date),
    selected: (index === 0 && !selectedId) || selectedId === Number(row.id),
  };
}

const STAFF_SEARCH_SELECT = `id, staff_id, staff_name, staff_initial, staff_title, job_category, designation,
  CAST(releaving_date AS CHAR) AS releaving_date`;

function staffDisplayNameSql(alias = '') {
  const p = alias ? `${alias}.` : '';
  return `TRIM(CONCAT(
    CASE WHEN ${p}staff_title IS NOT NULL AND TRIM(${p}staff_title) <> '' THEN CONCAT(${p}staff_title, '. ') ELSE '' END,
    IFNULL(${p}staff_name, ''),
    CASE WHEN ${p}staff_initial IS NOT NULL AND TRIM(${p}staff_initial) <> '' THEN CONCAT(' ', ${p}staff_initial) ELSE '' END
  ))`;
}

/**
 * Legacy searchByStaffId parity (staff_profile_edit_more.php).
 * by: name | staff_id | category
 */
export async function searchStaff({ by, q, staffId }) {
  let sql = '';
  const term = escapeSql(String(q || '').trim());

  if (by === 'staff_id' && term) {
    const ids = String(q).split(',').map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return [];
    const clauses = ids.map((id) => `staff_id='${escapeSql(id)}'`).join(' OR ');
    sql = `SELECT ${STAFF_SEARCH_SELECT}
      FROM staff_profile_tb WHERE del=1 AND (${clauses})
      ORDER BY staff_name ASC, staff_initial ASC`;
  } else if (by === 'name' && term) {
    const displayName = staffDisplayNameSql();
    sql = `SELECT ${STAFF_SEARCH_SELECT}
      FROM staff_profile_tb
      WHERE del = 1 AND (
        staff_name LIKE '%${term}%'
        OR staff_initial LIKE '%${term}%'
        OR staff_id LIKE '%${term}%'
        OR ${displayName} LIKE '%${term}%'
      )
      ORDER BY staff_name ASC, staff_initial ASC`;
  } else if (by === 'category' && term) {
    sql = `SELECT ${STAFF_SEARCH_SELECT}
      FROM staff_profile_tb WHERE del=1 AND job_category LIKE '%${term}%'
      ORDER BY staff_name ASC, staff_initial ASC`;
  } else {
    return [];
  }

  const rows = await prisma.$queryRawUnsafe(sql);
  const selectedId = staffId ? Number(staffId) : null;

  return rows.map((row, index) => mapStaffSearchRow(row, index, selectedId));
}

/** Legacy staff_attachments.php initial list (all staff, first 50). */
export async function listStaffPicker(limit = 50) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ${STAFF_SEARCH_SELECT}
     FROM staff_profile_tb
     WHERE del = 1
     ORDER BY staff_name ASC, staff_initial ASC
     LIMIT ${Number(limit) || 50}`,
  );
  return rows.map((row, index) => mapStaffSearchRow(row, index));
}

/** Legacy staff_transport_setup.php initial list (active staff, first 50). */
export async function listActiveStaff(limit = 50) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ${STAFF_SEARCH_SELECT}
     FROM staff_profile_tb
     WHERE del = 1 AND (releaving_date = '0000-00-00' OR releaving_date > DATE(NOW()))
     ORDER BY staff_name ASC, staff_initial ASC
     LIMIT ${Number(limit) || 50}`,
  );
  return rows.map((row, index) => mapStaffSearchRow(row, index));
}
