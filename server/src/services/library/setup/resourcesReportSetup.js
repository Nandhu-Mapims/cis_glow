import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { loadBookCategoryOptions } from '../libraryShared.js';
import { loadBookFieldOptions } from './bookAddSetup.js';
import { logLibrarySetup } from '../setupAudit.js';

const PAGE = 'resources_report.php';
const PAGE_SIZE = 50;

const SEARCH_FIELDS = [
  { value: '', label: 'All' },
  { value: 'resource_name', label: 'Title' },
  { value: 'accession_no', label: 'Accession No.' },
  { value: 'call_number', label: 'Call Number' },
  { value: 'author_name', label: 'Author' },
  { value: 'publisher_name', label: 'Publisher' },
];

async function buildDepartmentNotLike(departments) {
  let clause = '';
  for (const dep of departments) {
    const id = escapeSql(String(dep.id));
    clause += ` AND resource_department != '${id}' AND resource_department NOT LIKE '${id}%,' AND resource_department NOT LIKE ',%${id}' AND resource_department NOT LIKE ',%${id}%,'`;
  }
  return clause;
}

function buildWhere(fields, departmentNotLike) {
  const search = String(fields.search || '').trim();
  const searchBy = String(fields.searchBy || '').trim();
  const resourceType = String(fields.resourceType || '').trim();
  const department = String(fields.department || '').trim();
  const searchByCols = new Set(SEARCH_FIELDS.map((f) => f.value).filter(Boolean));

  let where = 'del = 1';
  let hasFilter = false;
  if (search) {
    hasFilter = true;
    const s = escapeSql(search);
    if (searchBy && searchByCols.has(searchBy)) {
      where += ` AND ${searchBy} LIKE '%${s}%'`;
    } else {
      where += ` AND (course_type LIKE '%${s}%' OR resource_name LIKE '%${s}%' OR accession_no LIKE '%${s}%' OR call_number LIKE '%${s}%' OR author_name LIKE '%${s}%' OR publisher_name LIKE '%${s}%')`;
    }
  }
  if (resourceType) {
    hasFilter = true;
    where += ` AND resource_type = '${escapeSql(resourceType)}'`;
  }
  if (department) {
    hasFilter = true;
    if (department === 'Others') {
      where += departmentNotLike;
    } else {
      const d = escapeSql(department);
      where += ` AND (resource_department = '${d}' OR resource_department LIKE '${d}%,' OR resource_department LIKE ',%${d}' OR resource_department LIKE ',%${d}%,')`;
    }
  }
  return { where, hasFilter };
}

async function computeStatus(accessionNo) {
  const acc = escapeSql(accessionNo);
  const transfer = await prisma.$queryRawUnsafe(`
    SELECT B.category_name AS name FROM book_transfer AS A
    INNER JOIN book_category_tb AS B ON A.transfer_to = B.id
    WHERE A.accession_no = '${acc}' AND (A.receive_date = '0000-00-00' OR A.receive_date = '') AND A.del = 1 AND B.del = 1
    LIMIT 1
  `);
  if (transfer.length) return { status: transfer[0].name, highlight: true };
  const issued = await prisma.$queryRawUnsafe(`
    SELECT id FROM library_transaction_tb
    WHERE book_id = '${acc}' AND (check_in_date = '0000-00-00' OR check_in_date = '') AND del = 1
  `);
  if (issued.length === 1) return { status: 'Issued', highlight: true };
  return { status: 'Library', highlight: false };
}

async function computeAvailability(resourceName) {
  const name = escapeSql(resourceName);
  const [[total], [transfer], [issued]] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM book_tb WHERE del = 1 AND resource_name = '${name}'`),
    prisma.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM book_tb A INNER JOIN book_transfer B ON A.accession_no = B.accession_no WHERE A.del = 1 AND B.del = 1 AND A.resource_name = '${name}' AND (B.receive_date = '0000-00-00' OR B.receive_date = '')`),
    prisma.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM book_tb A INNER JOIN library_transaction_tb B ON A.accession_no = B.book_id WHERE A.del = 1 AND B.del = 1 AND A.resource_name = '${name}' AND (B.check_in_date = '0000-00-00' OR B.check_in_date = '')`),
  ]);
  const totalBookAvailable = Number(total.n);
  const bookTransfer = Number(transfer.n);
  const bookIssued = Number(issued.n);
  return { totalBookAvailable, remainBook: totalBookAvailable - (bookIssued + bookTransfer) };
}

export async function loadResourcesReportSetup(memberId, fields = {}, audit = {}) {
  const [resourceTypes, subjects, departments, { ebookCategoryId }] = await Promise.all([
    loadBookCategoryOptions('Resource'),
    loadBookCategoryOptions('Subject'),
    loadBookCategoryOptions('Department'),
    loadBookFieldOptions(),
  ]);
  const departmentOptions = [...departments, { id: 'Others', name: 'Others' }];
  const resourceTypeNames = Object.fromEntries(resourceTypes.map((r) => [String(r.id), r.name]));
  const subjectNames = Object.fromEntries(subjects.map((r) => [String(r.id), r.name]));
  const departmentNames = Object.fromEntries(departments.map((r) => [String(r.id), r.name]));

  const departmentNotLike = await buildDepartmentNotLike(departments);
  const { where, hasFilter } = buildWhere(fields, departmentNotLike);

  const page = Math.max(1, Number(fields.page) || 1);
  const start = (page - 1) * PAGE_SIZE;

  let rows = [];
  let total = 0;
  if (hasFilter) {
    const [countRows, bookRows] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT COUNT(*) AS total FROM book_tb WHERE ${where}`),
      prisma.$queryRawUnsafe(`SELECT * FROM book_tb WHERE ${where} ORDER BY resource_name ASC LIMIT ${start},${PAGE_SIZE}`),
    ]);
    total = Number(countRows[0]?.total || 0);
    for (const row of bookRows) {
      const [{ status, highlight }, availability] = await Promise.all([
        computeStatus(row.accession_no),
        computeAvailability(row.resource_name),
      ]);
      const deptList = String(row.resource_department || '').split(',').filter(Boolean);
      rows.push({
        id: Number(row.id),
        resourceTypeName: resourceTypeNames[String(row.resource_type)] || row.resource_type,
        accessionNo: row.accession_no,
        authorName: row.author_name,
        resourceName: row.resource_name,
        convertName: row.convert_name,
        resourceSubname: row.resource_subname,
        edition: row.edition,
        revisedEdition: row.redition === 1,
        volume: row.volume,
        year: row.year,
        callNumber: row.call_number,
        subjectName: subjectNames[String(row.resource_subject)] || '',
        departmentNames: deptList.map((id) => departmentNames[id]).filter(Boolean).join(', '),
        publisherName: row.publisher_name,
        shelfNo: row.shelf_no,
        rackNo: row.rack_no,
        pageNo: row.page_no,
        disc: row.disc,
        isDamage: row.is_damage === 1,
        ebookAttachment: ebookCategoryId && String(row.resource_type) === String(ebookCategoryId) ? row.ebook_attachment : '',
        status,
        highlight,
        ...availability,
      });
    }
  }

  // Every GET/no-POST view is logged 'View'; an explicit Search submit is 'Generate'.
  await logLibrarySetup(PAGE, fields.searchbtn === 'Search' ? 'Generate' : 'View', 'Successful', String(fields.search || ''), memberId, audit);
  return {
    filters: {
      search: fields.search || '',
      searchBy: fields.searchBy || '',
      resourceType: fields.resourceType || '',
      department: fields.department || '',
      page,
    },
    searchFields: SEARCH_FIELDS,
    resourceTypes,
    departments: departmentOptions,
    hasFilter,
    rows,
    total,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function saveResourcesReportSetup(payload, memberId, audit = {}) {
  return loadResourcesReportSetup(memberId, { ...payload, searchbtn: 'Search' }, audit);
}
