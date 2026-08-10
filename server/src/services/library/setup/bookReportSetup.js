import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { logLibrarySetup } from '../setupAudit.js';
import { loadBookCategoryOptions } from '../libraryShared.js';
import { loadBookFieldOptions } from './bookAddSetup.js';

const PAGE = 'library_book_report.php';

// Note: this screen's blank ("--All--") search intentionally omits convert_name
// from the OR-list, unlike Resources Edit's blank search — a real, documented
// difference between the two screens (doc §6).
const SEARCH_BY_COLUMNS = new Set(['resource_name', 'accession_no', 'call_number', 'author_name', 'publisher_name']);

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

  let where = 'del = 1';
  let hasFilter = false;
  if (search) {
    hasFilter = true;
    const s = escapeSql(search);
    if (searchBy && SEARCH_BY_COLUMNS.has(searchBy)) {
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
  return { status: 'Available', highlight: false };
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

function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function buildPrintHtml(rows) {
  const body = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td nowrap>${esc(r.resourceTypeName)}</td>
      <td${r.highlight ? ' style="background-color:#F6C3C3"' : ''}>${esc(r.status)}${r.isDamage ? '(Damaged)' : ''}</td>
      <td>${esc(r.accessionNo)}</td>
      <td>${r.remainBook} of ${r.totalBookAvailable}</td>
      <td>${esc(r.resourceName)}${r.convertName ? `<br>(${esc(r.convertName)})` : ''}</td>
      <td>${esc(r.resourceSubname)}</td>
      <td>${esc(r.callNumber)}</td>
      <td>${esc(r.subjectName)}</td>
      <td>${esc(r.departmentNames)}</td>
      <td>${esc(r.authorName)}</td>
      <td>${esc(r.publisherName)}</td>
      <td nowrap>${esc(r.year || '-')} / ${esc(r.volume || '-')} / ${esc(r.edition || '-')}${r.revisedEdition ? ' (Revised)' : ''}</td>
      <td>${esc(r.shelfNo)}/${esc(r.rackNo)}</td>
      <td>${r.ebookAttachment ? `<a href="https://www.cis.apdch.edu.in/files/library_ebook/${esc(r.ebookAttachment)}" target="_blank" rel="noreferrer">View</a>` : ''}</td>
    </tr>`).join('');
  return `<h3>Resources Report</h3><table border="1" cellspacing="0" cellpadding="4"><thead><tr>
    <th>S.No.</th><th>Resource</th><th>Status</th><th>Accession No</th><th>No. Available</th><th>Title</th><th>Sub Title</th>
    <th>Call No</th><th>Subject</th><th>Branch</th><th>Author</th><th>Publication</th><th>Year / Volume / Edition</th>
    <th>Shelf / Rack No</th><th>E-book</th>
  </tr></thead><tbody>${body}</tbody></table>`;
}

export async function loadBookReportSetup(memberId, fields = {}, audit = {}) {
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

  let rows = [];
  let printHtml = '';
  if (hasFilter) {
    const bookRows = await prisma.$queryRawUnsafe(`SELECT * FROM book_tb WHERE ${where} ORDER BY resource_name ASC`);
    for (const row of bookRows) {
      const [{ status, highlight }, availability] = await Promise.all([
        computeStatus(row.accession_no),
        computeAvailability(row.resource_name),
      ]);
      const deptList = String(row.resource_department || '').split(',').filter(Boolean);
      rows.push({
        id: Number(row.id),
        resourceType: row.resource_type,
        resourceTypeName: resourceTypeNames[String(row.resource_type)] || row.resource_type,
        accessionNo: row.accession_no,
        resourceName: row.resource_name,
        convertName: row.convert_name,
        resourceSubname: row.resource_subname,
        callNumber: row.call_number,
        subjectName: subjectNames[String(row.resource_subject)] || '',
        departmentNames: deptList.map((id) => departmentNames[id]).filter(Boolean).join(', '),
        authorName: row.author_name,
        publisherName: row.publisher_name,
        year: row.year,
        volume: row.volume,
        edition: row.edition,
        revisedEdition: row.redition === 1,
        shelfNo: row.shelf_no,
        rackNo: row.rack_no,
        isDamage: row.is_damage === 1,
        ebookAttachment: ebookCategoryId && String(row.resource_type) === String(ebookCategoryId) ? row.ebook_attachment : '',
        status,
        highlight,
        ...availability,
      });
    }
    printHtml = buildPrintHtml(rows);
  }

  await logLibrarySetup(PAGE, fields.searchbtn ? 'Generate' : 'View', 'Successful', String(fields.search || ''), memberId, audit);
  return {
    filters: {
      search: fields.search || '',
      searchBy: fields.searchBy || '',
      resourceType: fields.resourceType || '',
      department: fields.department || '',
    },
    searchFields: [
      { value: '', label: '--All--' },
      { value: 'resource_name', label: 'Title' },
      { value: 'accession_no', label: 'Accession No.' },
      { value: 'call_number', label: 'Call Number' },
      { value: 'author_name', label: 'Author' },
      { value: 'publisher_name', label: 'Publisher' },
    ],
    resourceTypes,
    departments: departmentOptions,
    hasFilter,
    rows,
    printHtml,
  };
}

export async function saveBookReportSetup(payload, memberId, audit = {}) {
  return loadBookReportSetup(memberId, { ...payload, searchbtn: 'Search' }, audit);
}
