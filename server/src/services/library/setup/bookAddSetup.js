import { prisma } from '../../../config/prisma.js';
import { bookCategorySelect } from '../../../utils/legacySelects.js';
import { auditFields, logLibrarySetup } from '../setupAudit.js';
import { saveLegacyBinaryFile } from '../../web/webUpload.js';

const PAGE = 'library_book_add.php';
const EBOOK_FOLDER = 'library_ebook';
const EBOOK_EXT = new Set(['pdf']);

function legacyBillDate(value) {
  if (!value) return new Date('1970-01-01');
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date('1970-01-01') : d;
}

function mapBook(row) {
  return {
    id: row.id,
    accessionNo: row.accession_no,
    courseType: row.course_type,
    resourceType: row.resource_type,
    resourceName: row.resource_name,
    resourceSubname: row.resource_subname,
    convertTitle: row.convert_title,
    convertName: row.convert_name,
    ebookAttachment: row.ebook_attachment,
    referenceCopy: row.reference_copy === 1,
    authorName: row.author_name,
    publisherName: row.publisher_name,
    callNumber: row.call_number,
    resourceDepartment: row.resource_department ? String(row.resource_department).split(',').filter(Boolean) : [],
    isbnNo: row.isbn_no,
    issnMonth: row.issn_month,
    shelfNo: row.shelf_no,
    rackNo: row.rack_no,
    resourceSubject: row.resource_subject,
    copyNo: row.copy_no,
    edition: row.edition,
    revisedEdition: row.redition === 1,
    year: row.year || '',
    volume: row.volume,
    pageNo: row.page_no,
    numberOfDisks: row.disc ?? '',
    billNo: row.billno,
    billDate: row.billdate ? row.billdate.toISOString().slice(0, 10) : '',
    price: row.price,
    remarks: row.remarks,
    supplierCode: row.supplier_code,
    source: String(row.source),
    isDamage: row.is_damage === 1,
  };
}

// resource_type==1 in the legacy PHP is a "magic number" — the id of whichever
// book_category_tb row happens to be first under category='Resource'. Per doc
// open-question #9, prefer resolving it by category_name match (contains
// "E-Book"/"E-book") and only fall back to the first Resource row (mirroring the
// legacy magic-1 assumption) if no such row exists.
async function resolveEbookCategoryId(resourceTypes) {
  const byName = resourceTypes.find((r) => /e-?book/i.test(r.name || ''));
  if (byName) return String(byName.id);
  return resourceTypes.length ? String(resourceTypes[0].id) : null;
}

async function loadOptions() {
  const [resourceTypes, sources, subjects, departments, suppliers] = await Promise.all([
    prisma.book_category_tb.findMany({ where: { del: 1, category: 'Resource' }, orderBy: { category_order: 'asc' }, select: bookCategorySelect }),
    prisma.book_category_tb.findMany({ where: { del: 1, category: 'Source' }, orderBy: { category_order: 'asc' }, select: bookCategorySelect }),
    prisma.book_category_tb.findMany({ where: { del: 1, category: 'Subject' }, orderBy: { category_order: 'asc' }, select: bookCategorySelect }),
    prisma.book_category_tb.findMany({ where: { del: 1, category: 'Department' }, orderBy: { category_order: 'asc' }, select: bookCategorySelect }),
    prisma.book_supplier.findMany({ where: { del: 1 }, orderBy: { supplier_name: 'asc' }, select: { id: true, supplier_name: true, address: true } }),
  ]);
  const resourceTypeOptions = resourceTypes.map((r) => ({ id: r.id, name: r.category_name }));
  return {
    resourceTypes: resourceTypeOptions,
    sources: sources.map((r) => ({ id: r.id, name: r.category_name })),
    subjects: subjects.map((r) => ({ id: r.id, name: r.category_name })),
    departments: departments.map((r) => ({ id: r.id, name: r.category_name })),
    suppliers: suppliers.map((r) => ({ id: r.id, name: r.supplier_name, address: r.address })),
    ebookCategoryId: await resolveEbookCategoryId(resourceTypeOptions),
  };
}

export async function loadBookAddSetup(memberId, fields = {}, audit = {}) {
  // AJAX-equivalent of library_book_more.php?flag=1 (checkavailable()).
  if (fields.action === 'check-availability') {
    const accessionNo = String(fields.accessionNo || '').trim();
    const count = accessionNo
      ? await prisma.book_tb.count({ where: { del: 1, accession_no: accessionNo } })
      : 0;
    return { available: count === 0 };
  }

  const options = await loadOptions();
  await logLibrarySetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return { ...options, book: { referenceCopy: false, copyNo: '1', source: '0', resourceDepartment: [] } };
}

export async function saveBookAddSetup(payload, memberId, audit = {}) {
  const accessionNo = String(payload.accessionNo || '').trim();
  if (!accessionNo) return { success: false, message: 'Accession number is required' };

  const existing = await prisma.book_tb.count({ where: { del: 1, accession_no: accessionNo } });
  if (existing > 0) {
    await logLibrarySetup(PAGE, 'Add', 'Unsuccessful', '', memberId, audit);
    return { success: false, message: 'Oops! Accession no. Already Exists....' };
  }

  const { ebookCategoryId } = await loadOptions();
  const resourceType = String(payload.resourceType || '');

  let ebookAttachment = '';
  if (ebookCategoryId && resourceType === ebookCategoryId && payload.ebookFile?.data && payload.ebookFile?.name) {
    const uploaded = await saveLegacyBinaryFile({
      folder: EBOOK_FOLDER,
      file: payload.ebookFile,
      allowedExt: EBOOK_EXT,
      maxBytes: 25 * 1024 * 1024,
    });
    // Non-PDF uploads are silently ignored, matching legacy (no error surfaced).
    if (!uploaded.error) ebookAttachment = uploaded.filename;
  }

  const resourceDepartment = Array.isArray(payload.resourceDepartment)
    ? payload.resourceDepartment.filter(Boolean).join(',')
    : String(payload.resourceDepartment || '');

  const { create } = auditFields(memberId, audit);
  await prisma.book_tb.create({
    data: {
      course_type: String(payload.courseType || ''),
      resource_type: resourceType,
      accession_no: accessionNo,
      resource_code: '',
      resource_name: String(payload.resourceName || ''),
      resource_subname: String(payload.resourceSubname || ''),
      convert_title: String(payload.convertTitle || ''),
      ebook_attachment: ebookAttachment,
      reference_copy: payload.referenceCopy ? 1 : 0,
      convert_name: String(payload.convertName || ''),
      call_number: String(payload.callNumber || ''),
      copy_no: String(payload.copyNo || '1'),
      resource_subject: String(payload.resourceSubject || ''),
      resource_department: resourceDepartment,
      author_name: String(payload.authorName || ''),
      publisher_name: String(payload.publisherName || ''),
      publisher_place: '',
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
      status: 1,
      position: 0,
      source: Number(payload.source) || 0,
      remarks: String(payload.remarks || ''),
      disc: Number(payload.numberOfDisks) || 0,
      billno: String(payload.billNo || ''),
      billdate: legacyBillDate(payload.billDate),
      supplier_code: String(payload.supplierCode || ''),
      no_of_book: '1',
      transfer_to: '',
      rack_self: '',
      is_damage: 0,
      ...create,
    },
  });

  await logLibrarySetup(PAGE, 'Add', 'Successful', accessionNo, memberId, audit);
  return { success: true, message: 'Your details are added...', ...(await loadBookAddSetup(memberId, {}, { ...audit, skipLog: true })) };
}

export { mapBook, loadOptions as loadBookFieldOptions };
