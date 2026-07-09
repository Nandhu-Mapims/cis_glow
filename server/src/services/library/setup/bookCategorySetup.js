import { prisma } from '../../../config/prisma.js';
import { bookCategorySelect } from '../../../utils/legacySelects.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logLibrarySetup } from '../setupAudit.js';

const PAGE = 'library_book_cate.php';

const CATEGORIES = ['Department', 'Resource Type', 'Course Type', 'Subject'];

function mapRow(row) {
  return {
    id: row.id,
    name: row.category_name,
    order: row.category_order,
    enabled: row.del === 1,
  };
}

export async function loadBookCategorySetup(memberId, fields = {}, audit = {}) {
  const category = String(fields.category || CATEGORIES[0]);
  const rows = await prisma.book_category_tb.findMany({
    where: { category, del: { in: [1, 2] } },
    orderBy: { category_order: 'asc' },
    select: bookCategorySelect,
  });
  await logLibrarySetup(PAGE, 'View', 'Successful', category, memberId, audit);
  return {
    categories: CATEGORIES,
    selectedCategory: category,
    rows: rows.length ? rows.map(mapRow) : [{ order: 1, name: '', enabled: true }],
  };
}

export async function saveBookCategorySetup(payload, memberId, audit = {}) {
  const category = String(payload.category || '').trim();
  if (!category) return { success: false, message: 'Category is required' };

  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      await prisma.book_category_tb.update({ where: { id }, data: { del: 0, ...update } });
      await logLibrarySetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return { success: true, message: 'Your details are deleted...', ...(await loadBookCategorySetup(memberId, { category }, { ...audit, skipLog: true })) };
    } catch {
      return { success: false, message: 'Please try again...' };
    }
  }

  const { create, update } = auditFields(memberId, audit);
  await prisma.book_category_tb.updateMany({ where: { category, del: 1 }, data: { del: 0, ...update } });

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  for (const row of rows) {
    const name = String(row.name || '').trim();
    const order = Number(row.order) || 0;
    const delVal = row.enabled === false ? 2 : 1;
    if (!row.id) {
      if (!name) continue;
      await prisma.book_category_tb.create({
        data: { category, category_name: name, category_order: order, ...create },
      });
    } else {
      await prisma.book_category_tb.update({
        where: { id: Number(row.id) },
        data: { category, category_name: name, category_order: order, del: delVal, ...update },
      });
    }
  }

  await logLibrarySetup(PAGE, 'Update', 'Successful', category, memberId, audit);
  return { success: true, message: 'Your details are Updated...', ...(await loadBookCategorySetup(memberId, { category }, { ...audit, skipLog: true })) };
}
