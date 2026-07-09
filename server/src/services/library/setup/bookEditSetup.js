import { prisma } from '../../../config/prisma.js';
import { bookCategorySelect } from '../../../utils/legacySelects.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logLibrarySetup } from '../setupAudit.js';
import { mapBook } from './bookAddSetup.js';

const PAGE = 'library_book_edit.php';

async function loadOptions() {
  const [courseTypes, resourceTypes, departments] = await Promise.all([
    prisma.book_category_tb.findMany({ where: { del: 1, category: 'Course Type' }, orderBy: { category_order: 'asc' }, select: bookCategorySelect }),
    prisma.book_category_tb.findMany({ where: { del: 1, category: 'Resource Type' }, orderBy: { category_order: 'asc' }, select: bookCategorySelect }),
    prisma.book_category_tb.findMany({ where: { del: 1, category: 'Department' }, orderBy: { category_order: 'asc' }, select: bookCategorySelect }),
  ]);
  return {
    courseTypes: courseTypes.map((r) => ({ id: r.id, name: r.category_name })),
    resourceTypes: resourceTypes.map((r) => ({ id: r.id, name: r.category_name })),
    departments: departments.map((r) => ({ id: r.id, name: r.category_name })),
  };
}

export async function loadBookEditSetup(memberId, fields = {}, audit = {}) {
  const options = await loadOptions();
  const search = String(fields.search || '').trim();
  let book = null;
  if (search) {
    const row = await prisma.book_tb.findFirst({
      where: { del: 1, OR: [{ accession_no: search }, { id: parseId(search) || -1 }] },
    });
    if (row) book = mapBook(row);
  }
  await logLibrarySetup(PAGE, 'View', 'Successful', search, memberId, audit);
  return { ...options, search, book };
}

export async function saveBookEditSetup(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      await prisma.book_tb.update({ where: { id }, data: { del: 0, ...update } });
      await logLibrarySetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return { success: true, message: 'Your details are deleted...', ...(await loadBookEditSetup(memberId, {}, { ...audit, skipLog: true })) };
    } catch {
      return { success: false, message: 'Please try again...' };
    }
  }

  const id = parseId(payload.id);
  if (!id) return { success: false, message: 'Book not found' };
  const { update } = auditFields(memberId, audit);
  await prisma.book_tb.update({
    where: { id },
    data: {
      course_type: String(payload.courseType || ''),
      resource_type: String(payload.resourceType || ''),
      resource_name: String(payload.resourceName || ''),
      author_name: String(payload.authorName || ''),
      publisher_name: String(payload.publisherName || ''),
      call_number: String(payload.callNumber || ''),
      resource_department: String(payload.resourceDepartment || ''),
      isbn_no: String(payload.isbnNo || ''),
      shelf_no: String(payload.shelfNo || ''),
      rack_no: String(payload.rackNo || ''),
      reference_copy: payload.referenceCopy ? 1 : 0,
      ...update,
    },
  });
  await logLibrarySetup(PAGE, 'Update', 'Successful', String(id), memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadBookEditSetup(memberId, { search: payload.accessionNo }, { ...audit, skipLog: true })),
  };
}
