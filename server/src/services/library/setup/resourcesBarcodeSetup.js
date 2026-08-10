import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { loadBookCategoryOptions } from '../libraryShared.js';
import { logLibrarySetup } from '../setupAudit.js';

const PAGE = 'resources_barcode.php';

async function buildDepartmentNotLike(departments) {
  let clause = '';
  for (const dep of departments) {
    const id = escapeSql(String(dep.id));
    clause += ` AND resource_department != '${id}' AND resource_department NOT LIKE '${id}%,' AND resource_department NOT LIKE ',%${id}' AND resource_department NOT LIKE ',%${id}%,'`;
  }
  return clause;
}

// Barcode's "Find" box is always an accession-number list (comma separated, each
// term trimmed and matched exactly), never a fuzzy title/author search — distinct
// from Resources Edit/Report/OPAC's "search everything" behavior. See
// resources_barcode.php's $search_input_list construction.
function buildAccessionOr(search) {
  const terms = String(search || '').split(',').map((t) => t.trim()).filter(Boolean);
  if (!terms.length) return '';
  return ` AND (${terms.map((t) => `accession_no = '${escapeSql(t)}'`).join(' OR ')})`;
}

async function buildWhere(fields, departments) {
  const search = String(fields.search || '').trim();
  const resourceType = String(fields.resourceType || '').trim();
  const department = String(fields.department || '').trim();
  const fromAccession = String(fields.fromAccession || '').trim();
  const toAccession = String(fields.toAccession || '').trim();

  let where = 'del = 1';
  let hasFilter = false;
  if (search) { hasFilter = true; where += buildAccessionOr(search); }
  if (resourceType) { hasFilter = true; where += ` AND resource_type = '${escapeSql(resourceType)}'`; }
  if (department) {
    hasFilter = true;
    // Legacy dropdown value is lowercase 'others' but the PHP compares against
    // 'Others' (case-sensitive) — a legacy bug that makes that option silently
    // match nothing. Accept either case here so the option actually works.
    if (department.toLowerCase() === 'others') {
      where += await buildDepartmentNotLike(departments);
    } else {
      const d = escapeSql(department);
      where += ` AND (resource_department = '${d}' OR resource_department LIKE '${d}%,' OR resource_department LIKE ',%${d}' OR resource_department LIKE ',%${d}%,')`;
    }
  }
  if (fromAccession && toAccession && Number.isFinite(Number(fromAccession)) && Number.isFinite(Number(toAccession))) {
    hasFilter = true;
    where += ` AND accession_no >= '${escapeSql(fromAccession)}' AND accession_no <= '${escapeSql(toAccession)}'`;
  }
  return { where, hasFilter };
}

export async function loadResourcesBarcodeSetup(memberId, fields = {}, audit = {}) {
  const [resourceTypes, departments] = await Promise.all([
    loadBookCategoryOptions('Resource'),
    loadBookCategoryOptions('Department'),
  ]);

  const filters = {
    search: fields.search || '',
    resourceType: fields.resourceType || '',
    department: fields.department || '',
    fromAccession: fields.fromAccession || '',
    toAccession: fields.toAccession || '',
  };
  const copiesPerLabel = [1, 2, 3, 4].includes(Number(fields.copiesPerLabel)) ? Number(fields.copiesPerLabel) : 4;

  const { where, hasFilter } = await buildWhere(filters, departments);
  let rows = [];
  if (hasFilter) {
    const bookRows = await prisma.$queryRawUnsafe(
      `SELECT id, accession_no, call_number, copy_no, author_name FROM book_tb WHERE ${where} ORDER BY accession_no ASC`,
    );
    rows = bookRows.map((r) => ({
      id: Number(r.id),
      accessionNo: r.accession_no || '',
      callNumber: r.call_number || '',
      copyNo: r.copy_no || '',
      authorName: r.author_name || '',
    }));
  }

  await logLibrarySetup(PAGE, fields.search || fields.fromAccession ? 'Generate' : 'View', 'Successful', filters.search, memberId, audit);
  return { filters, resourceTypes, departments, copiesPerLabel, hasFilter, rows };
}

export async function saveResourcesBarcodeSetup(payload, memberId, audit = {}) {
  return loadResourcesBarcodeSetup(memberId, payload, audit);
}
