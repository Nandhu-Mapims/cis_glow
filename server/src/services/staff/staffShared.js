import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/index.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { legacyPublicFileUrl, normalizeLegacyFilename } from '../../utils/fileUrls.js';
import { getStaffCategoryOptions } from './staffCategories.js';
import { searchStaff, listActiveStaff, listStaffPicker } from './staffSearch.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatDisplayDate(val) {
  if (!val || String(val).startsWith('0000-00-00')) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export function formatStaffName(row) {
  const title = row.staff_title ? `${row.staff_title}. ` : '';
  return `${title}${row.staff_name || ''} ${row.staff_initial || ''}`.trim();
}

const ACTIVE_STAFF = `(releaving_date > DATE(NOW()) OR CAST(releaving_date AS CHAR) = '0000-00-00')`;

const STAFF_REPORT_SELECT = `id, staff_id, staff_name, staff_initial, staff_title, job_category, designation,
              staff_profile, CAST(joined_date AS CHAR) AS joined_date, staff_gender, CAST(staff_dob AS CHAR) AS staff_dob,
              mobile_1, email_id, aadhar_no`;

export async function loadDeptDesignationLookups() {
  const [departmentRows, designationRows, categories] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT id, name FROM staff_dept_master
       WHERE del = 1 AND TRIM(name) <> ''
       ORDER BY d_order ASC, id ASC`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT id, name, d_id FROM staff_desg_master
       WHERE del = 1 AND TRIM(name) <> ''
       ORDER BY d_order ASC, id ASC`,
    ),
    getStaffCategoryOptions(),
  ]);
  return {
    departments: departmentRows.map((d) => ({ id: Number(d.id), name: d.name })),
    designations: designationRows.map((d) => ({ id: Number(d.id), name: d.name, departmentId: Number(d.d_id) })),
    categories,
  };
}

export async function loadAttachmentMainCategories() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, name, d_order FROM staff_attachment_mcategory
     WHERE del = 1 AND TRIM(name) <> ''
     ORDER BY d_order ASC, id ASC`,
  );
  return rows.map((m) => ({ id: Number(m.id), name: m.name, order: Number(m.d_order) }));
}

export async function loadAttachmentSubCategories(mainId) {
  const id = Number(mainId);
  if (!id) return [];
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, name, d_order FROM staff_attachment_scategory
     WHERE del = 1 AND d_id = ${id} AND TRIM(name) <> ''
     ORDER BY d_order ASC, id ASC`,
  );
  return rows.map((r) => ({ id: Number(r.id), name: r.name, order: Number(r.d_order) }));
}

export async function loadAllAttachmentSubCategories() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, name, d_id, d_order FROM staff_attachment_scategory
     WHERE del = 1 AND TRIM(name) <> ''
     ORDER BY d_order ASC, id ASC`,
  );
  return rows.map((s) => ({ id: Number(s.id), name: s.name, mainId: Number(s.d_id), order: Number(s.d_order) }));
}

export async function loadAllAttachmentMsCategories() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, category_name, category, sub_category, category_order
     FROM staff_attachment_mscategory
     WHERE del = 1 AND TRIM(category_name) <> ''
     ORDER BY category_order ASC, id ASC`,
  );
  return rows.map((m) => ({
    id: Number(m.id),
    name: m.category_name,
    mainId: Number(m.category),
    subId: Number(m.sub_category),
    order: Number(m.category_order),
  }));
}

export function resolveAttachmentMainId(mainCategories, requestedId) {
  const id = requestedId ? Number(requestedId) : null;
  if (id && mainCategories.some((m) => m.id === id)) return id;
  return mainCategories[0]?.id || null;
}

export async function loadTeachingDepartments() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT D.id, D.name
     FROM staff_profile_tb AS A
     INNER JOIN edu_setup_tb AS B ON A.job_category = B.id
     INNER JOIN staff_designation_tb AS C ON C.staff_id = A.id
     INNER JOIN staff_dept_master AS D ON D.id = C.department
     WHERE A.del = 1 AND B.del = 1 AND C.del = 1 AND D.del = 1
       AND ${ACTIVE_STAFF.replace('releaving_date', 'A.releaving_date')}
       AND B.category = 'Category'
       AND (A.job_category = '255' OR A.job_category = '271' OR A.job_category = '357')
       AND C.is_academic = 1
     ORDER BY A.job_category ASC`,
  );
  return rows.map((r) => ({ id: Number(r.id), name: r.name }));
}

export async function resolveStaffFilter(fields = {}) {
  let searchBy = String(fields.search_by || fields.searchBy || '').trim();
  const searchInput = String(fields.search_input || fields.searchInput || '').trim();
  const categoryId = fields.search_category || fields.categoryId;

  if (!searchBy && searchInput) {
    searchBy = 'roll_no';
  }

  if (searchBy === 'all' && searchInput) {
    searchBy = 'roll_no';
  }

  if (searchBy === 'roll_no' && searchInput) {
    const ids = searchInput.split(',').map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return [];
    const clauses = ids.map((id) => `staff_id='${escapeSql(id)}'`).join(' OR ');
    return prisma.$queryRawUnsafe(
      `SELECT ${STAFF_REPORT_SELECT}
       FROM staff_profile_tb WHERE del = 1 AND (${clauses}) AND ${ACTIVE_STAFF} ORDER BY staff_name ASC`,
    );
  }
  if (searchBy === 'category' && categoryId) {
    return prisma.$queryRawUnsafe(
      `SELECT ${STAFF_REPORT_SELECT}
       FROM staff_profile_tb WHERE del = 1 AND job_category = '${escapeSql(String(categoryId))}'
         AND ${ACTIVE_STAFF} ORDER BY staff_name ASC`,
    );
  }
  if (searchBy === 'all') {
    return prisma.$queryRawUnsafe(
      `SELECT ${STAFF_REPORT_SELECT}
       FROM staff_profile_tb WHERE del = 1 AND ${ACTIVE_STAFF} ORDER BY staff_name ASC LIMIT 500`,
    );
  }
  if (fields.staffId || fields.st_id) {
    const sid = Number(fields.staffId || fields.st_id);
    if (sid) {
      return prisma.$queryRawUnsafe(
        `SELECT ${STAFF_REPORT_SELECT}
         FROM staff_profile_tb WHERE del = 1 AND id = ${sid} LIMIT 1`,
      );
    }
  }
  return [];
}

export async function loadAcademicDesignation(staffRowId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT C.department, C.designation,
            CAST(C.from_date AS CHAR) AS from_date, CAST(C.to_date AS CHAR) AS to_date,
            C.is_academic, D.name AS dept_name, G.name AS desg_name
     FROM staff_designation_tb AS C
     LEFT JOIN staff_dept_master AS D ON D.id = C.department
     LEFT JOIN staff_desg_master AS G ON G.id = C.designation
     WHERE C.del = 1 AND C.staff_id = ${Number(staffRowId)}
       AND CAST(C.from_date AS CHAR) NOT LIKE '0000-00-00%' AND C.from_date <= CURDATE()
       AND (CAST(C.to_date AS CHAR) LIKE '0000-00-00%' OR C.to_date >= CURDATE())
       AND C.is_academic = 1
     ORDER BY C.id ASC LIMIT 1`,
  );
  return rows[0] || null;
}

export async function loadInstitutionBranding() {
  const [basic, banner] = await Promise.all([
    prisma.basic_setup_tb.findFirst({ where: { del: 1 } }),
    prisma.basic_banner_tb.findFirst({ where: { del: 1 } }),
  ]);
  return {
    institutionName: basic?.institution_name || '',
    address: basic?.institution_address || '',
    bannerUrl: banner?.banner_image ? legacyPublicFileUrl(`banner/${banner.banner_image}`) : '',
  };
}

export const DEFAULT_STAFF_PHOTO_URL = '/legacy/img/profile-avatar.jpg';

async function staffPhotoFileUrl(folder, filename) {
  const name = normalizeLegacyFilename(filename);
  if (!name) return null;
  try {
    await fs.access(path.join(config.legacyFilesPath, folder, name));
    return legacyPublicFileUrl(`${folder}/${name}`);
  } catch {
    return null;
  }
}

export async function staffPhotoUrl(staffCode, kind = 'profile', storedPhoto = '') {
  const code = String(staffCode || '').trim();
  if (!code) return null;

  const stored = normalizeLegacyFilename(storedPhoto);
  if (stored) {
    const fromColumn = await staffPhotoFileUrl('staff_images', stored);
    if (fromColumn) return fromColumn;
  }

  const exts = ['png', 'jpg', 'jpeg'];
  const folders = kind === 'idcard'
    ? ['staff_idcard', 'staff_profile']
    : ['staff_profile', 'staff_idcard'];

  for (const folder of folders) {
    for (const ext of exts) {
      const url = await staffPhotoFileUrl(folder, `${code}.${ext}`);
      if (url) return url;
    }
  }
  return null;
}

export async function staffPhotoDisplayUrl(staffCode, kind = 'profile', storedPhoto = '') {
  return (await staffPhotoUrl(staffCode, kind, storedPhoto)) || DEFAULT_STAFF_PHOTO_URL;
}

export async function loadTransportOptions() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT id, transport_number, transport_route FROM transport_tb WHERE del = 1 ORDER BY transport_number ASC',
  );
  return rows.map((r) => ({
    id: Number(r.id),
    transportNumber: r.transport_number,
    transportRoute: r.transport_route,
  }));
}

export { searchStaff, listActiveStaff, listStaffPicker, getStaffCategoryOptions };
