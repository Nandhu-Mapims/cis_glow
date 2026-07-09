import { prisma } from '../../../config/prisma.js';
import { bookCategorySelect } from '../../../utils/legacySelects.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { logLibrarySetup } from '../setupAudit.js';

const PAGE = 'library_book_report.php';

export async function loadBookReportSetup(memberId, fields = {}, audit = {}) {
  const resourceType = String(fields.resourceType || '').trim();
  const department = String(fields.department || '').trim();
  const search = String(fields.search || '').trim();

  let where = 'del = 1';
  if (resourceType) where += ` AND resource_type = '${escapeSql(resourceType)}'`;
  if (department) where += ` AND (resource_department = '${escapeSql(department)}' OR resource_department LIKE '${escapeSql(department)},%' OR resource_department LIKE '%,${escapeSql(department)}' OR resource_department LIKE '%,${escapeSql(department)},%')`;
  if (search) where += ` AND (accession_no LIKE '%${escapeSql(search)}%' OR resource_name LIKE '%${escapeSql(search)}%' OR author_name LIKE '%${escapeSql(search)}%')`;

  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, accession_no, resource_name, author_name, call_number, shelf_no, rack_no, resource_type
     FROM book_tb WHERE ${where} ORDER BY accession_no ASC LIMIT 500`,
  );

  const [resourceTypes, departments] = await Promise.all([
    prisma.book_category_tb.findMany({ where: { del: 1, category: 'Resource Type' }, orderBy: { category_order: 'asc' }, select: bookCategorySelect }),
    prisma.book_category_tb.findMany({ where: { del: 1, category: 'Department' }, orderBy: { category_order: 'asc' }, select: bookCategorySelect }),
  ]);

  await logLibrarySetup(PAGE, 'View', 'Successful', search, memberId, audit);
  return {
    filters: { resourceType, department, search },
    resourceTypes: resourceTypes.map((r) => ({ id: String(r.id), name: r.category_name })),
    departments: departments.map((r) => ({ id: String(r.id), name: r.category_name })),
    rows: rows.map((r) => ({
      id: r.id,
      accessionNo: r.accession_no,
      resourceName: r.resource_name,
      authorName: r.author_name,
      callNumber: r.call_number,
      shelfNo: r.shelf_no,
      rackNo: r.rack_no,
    })),
  };
}

export async function saveBookReportSetup(payload, memberId, audit = {}) {
  return loadBookReportSetup(memberId, payload, audit);
}
