import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logLibrarySetup } from '../setupAudit.js';
import { mapBook, loadBookFieldOptions } from './bookAddSetup.js';
import { saveLegacyBinaryFile } from '../../web/webUpload.js';

const PAGE = 'library_book_edit.php';
const PAGE_SIZE = 20;
const EBOOK_FOLDER = 'library_ebook';
const EBOOK_EXT = new Set(['pdf']);

const SEARCH_BY_COLUMNS = new Set(['resource_name', 'accession_no', 'convert_name', 'call_number', 'author_name', 'publisher_name']);

function buildSearchWhere(fields) {
  const search = String(fields.search || '').trim();
  const searchBy = String(fields.searchBy || '').trim();
  const resourceType = String(fields.resourceType || '').trim();
  const department = String(fields.department || '').trim();

  let where = 'del = 1';
  if (search) {
    const s = escapeSql(search);
    if (searchBy && SEARCH_BY_COLUMNS.has(searchBy)) {
      where += ` AND ${searchBy} LIKE '%${s}%'`;
    } else {
      where += ` AND (course_type LIKE '%${s}%' OR resource_name LIKE '%${s}%' OR accession_no LIKE '%${s}%' OR convert_name LIKE '%${s}%' OR call_number LIKE '%${s}%' OR author_name LIKE '%${s}%' OR publisher_name LIKE '%${s}%')`;
    }
  }
  if (resourceType) where += ` AND resource_type = '${escapeSql(resourceType)}'`;
  if (department) {
    const d = escapeSql(department);
    where += ` AND (resource_department = '${d}' OR resource_department LIKE '${d}%,' OR resource_department LIKE ',%${d}' OR resource_department LIKE ',%${d}%,')`;
  }
  return where;
}

async function computeStatus(accessionNo) {
  const acc = escapeSql(accessionNo);
  const transfer = await prisma.$queryRawUnsafe(`
    SELECT B.category_name AS name FROM book_transfer AS A
    INNER JOIN book_category_tb AS B ON A.transfer_to = B.id
    WHERE A.accession_no = '${acc}' AND (A.receive_date = '0000-00-00' OR A.receive_date = '') AND A.del = 1 AND B.del = 1
    LIMIT 1
  `);
  if (transfer.length) return transfer[0].name;
  const issued = await prisma.$queryRawUnsafe(`
    SELECT id FROM library_transaction_tb
    WHERE book_id = '${acc}' AND (check_in_date = '0000-00-00' OR check_in_date = '') AND del = 1
  `);
  if (issued.length === 1) return 'Issued';
  return 'Library';
}

export async function loadBookEditSetup(memberId, fields = {}, audit = {}) {
  const options = await loadBookFieldOptions();
  const editRowId = parseId(fields.editRowId);

  if (editRowId) {
    const row = await prisma.book_tb.findFirst({ where: { del: 1, id: editRowId } });
    if (!row) return { ...options, list: null, book: null, filters: fields };
    await logLibrarySetup(PAGE, 'View', 'Successful', String(editRowId), memberId, audit);
    return { ...options, book: mapBook(row), filters: fields };
  }

  const where = buildSearchWhere(fields);
  const page = Math.max(1, Number(fields.page) || 1);
  const start = (page - 1) * PAGE_SIZE;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT * FROM book_tb WHERE ${where} ORDER BY resource_name ASC LIMIT ${start},${PAGE_SIZE}`),
    prisma.$queryRawUnsafe(`SELECT COUNT(*) AS total FROM book_tb WHERE ${where}`),
  ]);
  const total = Number(countRows[0]?.total || 0);

  const list = [];
  for (const row of rows) {
    list.push({
      id: Number(row.id),
      resourceType: row.resource_type,
      accessionNo: row.accession_no,
      resourceName: row.resource_name,
      status: await computeStatus(row.accession_no),
    });
  }

  await logLibrarySetup(PAGE, 'View', 'Successful', String(fields.search || ''), memberId, audit);
  return {
    ...options,
    filters: {
      search: fields.search || '',
      searchBy: fields.searchBy || '',
      resourceType: fields.resourceType || '',
      department: fields.department || '',
      page,
    },
    list,
    total,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    book: null,
  };
}

export async function saveBookEditSetup(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      // Soft delete: del=1 active, del=0 deleted.
      await prisma.book_tb.update({ where: { id }, data: { del: 0, ...update } });
      await logLibrarySetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return { success: true, message: 'Your details are deleted...', ...(await loadBookEditSetup(memberId, payload.filters || {}, { ...audit, skipLog: true })) };
    } catch {
      return { success: false, message: 'Please try again...' };
    }
  }

  if (payload.action === 'add-copies') {
    const copyBookId = parseId(payload.copyBookId);
    const pairs = Array.isArray(payload.copies) ? payload.copies : [];
    if (!copyBookId || !pairs.length) return { success: false, message: 'Nothing to add' };
    const { create } = auditFields(memberId, audit);
    const source = await prisma.book_tb.findFirst({ where: { id: copyBookId, del: 1 } });
    if (!source) return { success: false, message: 'Book not found' };
    let added = 0;
    for (const pair of pairs) {
      const accessionNo = String(pair.accessionNo || '').trim();
      const copyNo = String(pair.copyNo || '').trim();
      if (!accessionNo) continue;
      // True clone of the source row (every column except accession_no/copy_no),
      // no uniqueness re-check on the new accession number — matches legacy.
      await prisma.book_tb.create({
        data: {
          course_type: source.course_type,
          resource_type: source.resource_type,
          accession_no: accessionNo,
          resource_code: source.resource_code,
          resource_name: source.resource_name,
          resource_subname: source.resource_subname,
          convert_title: source.convert_title,
          convert_name: source.convert_name,
          call_number: source.call_number,
          copy_no: copyNo,
          resource_subject: source.resource_subject,
          resource_department: source.resource_department,
          author_name: source.author_name,
          publisher_name: source.publisher_name,
          publisher_place: source.publisher_place,
          isbn_no: source.isbn_no,
          issn_month: source.issn_month,
          edition: source.edition,
          redition: source.redition,
          year: source.year,
          volume: source.volume,
          shelf_no: source.shelf_no,
          rack_no: source.rack_no,
          page_no: source.page_no,
          price: source.price,
          status: source.status,
          position: source.position,
          source: source.source,
          remarks: source.remarks,
          disc: source.disc,
          billno: source.billno,
          billdate: source.billdate,
          supplier_code: source.supplier_code,
          no_of_book: source.no_of_book,
          transfer_to: source.transfer_to,
          rack_self: source.rack_self,
          is_damage: 0,
          ...create,
        },
      });
      added += 1;
    }
    await logLibrarySetup(PAGE, 'Add', added ? 'Successful' : 'Unsuccessful', String(copyBookId), memberId, audit);
    return { success: true, message: 'Resource added...', ...(await loadBookEditSetup(memberId, { editRowId: copyBookId }, { ...audit, skipLog: true })) };
  }

  const id = parseId(payload.id);
  if (!id) return { success: false, message: 'Book not found' };

  const { ebookCategoryId } = await loadBookFieldOptions();
  const resourceType = String(payload.resourceType || '');

  let ebookAttachment = String(payload.ebookAttachment || '');
  if (ebookCategoryId && resourceType === ebookCategoryId && payload.ebookFile?.data && payload.ebookFile?.name) {
    const uploaded = await saveLegacyBinaryFile({
      folder: EBOOK_FOLDER,
      file: payload.ebookFile,
      allowedExt: EBOOK_EXT,
      maxBytes: 25 * 1024 * 1024,
    });
    if (!uploaded.error) ebookAttachment = uploaded.filename;
  }

  const resourceDepartment = Array.isArray(payload.resourceDepartment)
    ? payload.resourceDepartment.filter(Boolean).join(',')
    : String(payload.resourceDepartment || '');

  const billDate = payload.billDate ? new Date(payload.billDate) : new Date('1970-01-01');

  const { update } = auditFields(memberId, audit);
  await prisma.book_tb.update({
    where: { id },
    data: {
      course_type: String(payload.courseType || ''),
      resource_type: resourceType,
      resource_name: String(payload.resourceName || ''),
      convert_title: String(payload.convertTitle || ''),
      convert_name: String(payload.convertName || ''),
      call_number: String(payload.callNumber || ''),
      copy_no: String(payload.copyNo || ''),
      resource_department: resourceDepartment,
      author_name: String(payload.authorName || ''),
      publisher_name: String(payload.publisherName || ''),
      resource_subname: String(payload.resourceSubname || ''),
      resource_subject: String(payload.resourceSubject || ''),
      isbn_no: String(payload.isbnNo || ''),
      issn_month: String(payload.issnMonth || ''),
      edition: String(payload.edition || ''),
      redition: payload.revisedEdition ? 1 : 0,
      year: Number(payload.year) || 0,
      volume: String(payload.volume || ''),
      shelf_no: String(payload.shelfNo || ''),
      rack_no: String(payload.rackNo || ''),
      page_no: String(payload.pageNo || ''),
      price: String(payload.price || ''),
      source: Number(payload.source) || 0,
      remarks: String(payload.remarks || ''),
      disc: Number(payload.numberOfDisks) || 0,
      billno: String(payload.billNo || ''),
      billdate: billDate,
      supplier_code: String(payload.supplierCode || ''),
      is_damage: payload.isDamage ? 1 : 0,
      ebook_attachment: ebookAttachment,
      reference_copy: payload.referenceCopy ? 1 : 0,
      ...update,
    },
  });
  await logLibrarySetup(PAGE, 'Update', 'Successful', String(id), memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadBookEditSetup(memberId, payload.filters || {}, { ...audit, skipLog: true })),
  };
}
