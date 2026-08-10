import { prisma } from '../../../config/prisma.js';
import { bookCategorySelect } from '../../../utils/legacySelects.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logLibrarySetup } from '../setupAudit.js';

const PAGE = 'library_book_cate.php';

// Internal category key -> dropdown label, exactly as in library_book_cate.php's
// <select name="category">. Value sent/stored is the key; label shown differs for
// Department ("Branch") and Transfer ("Transfer To").
const CATEGORIES = [
  { value: 'Department', label: 'Branch' },
  { value: 'Resource', label: 'Resource' },
  { value: 'Source', label: 'Source' },
  { value: 'Subject', label: 'Subject' },
  { value: 'Transfer', label: 'Transfer To' },
];
const CATEGORY_VALUES = new Set(CATEGORIES.map((c) => c.value));

function mapRow(row) {
  return {
    id: row.id,
    name: row.category_name,
    order: row.category_order,
  };
}

export async function loadBookCategorySetup(memberId, fields = {}, audit = {}) {
  const category = CATEGORY_VALUES.has(fields.category) ? fields.category : CATEGORIES[0].value;
  const rows = await prisma.book_category_tb.findMany({
    where: { category, del: 1 },
    orderBy: { category_order: 'asc' },
    select: bookCategorySelect,
  });
  await logLibrarySetup(PAGE, 'View', 'Successful', category, memberId, audit);
  return {
    categories: CATEGORIES,
    selectedCategory: category,
    rows: rows.length ? rows.map(mapRow) : [{ order: 1, name: '' }],
  };
}

export async function saveBookCategorySetup(payload, memberId, audit = {}) {
  const category = String(payload.category || '').trim();
  if (!category) return { success: false, message: 'Category is required' };

  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      // Soft delete: del=1 is active, del=0 is deleted (see library_book_cate.php delete branch).
      await prisma.book_category_tb.update({ where: { id }, data: { del: 0, ...update } });
      await logLibrarySetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return { success: true, message: 'Your details are deleted...', ...(await loadBookCategorySetup(memberId, { category }, { ...audit, skipLog: true })) };
    } catch {
      return { success: false, message: 'Please try again...' };
    }
  }

  const { create, update } = auditFields(memberId, audit);
  // Legacy behavior: mark the ENTIRE category soft-deleted first, then re-insert/
  // re-activate every row that was posted back. Any row missing from the posted
  // grid is therefore left deleted, even if the user never clicked its trash icon.
  // This is intentional legacy parity (see doc §3 "Business logic / edge cases"),
  // not a bug to silently "fix" here.
  await prisma.book_category_tb.updateMany({ where: { category, del: 1 }, data: { del: 0, ...update } });

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  for (const row of rows) {
    const name = String(row.name || '').trim();
    const order = Number(row.order) || 0;
    // Note: legacy computes $del_val from act_enable[] but never uses it in the
    // INSERT/UPDATE SQL (dead code) — there is no "enable" toggle concept here.
    // Existing rows are always reactivated with del=1 on save.
    if (!row.id) {
      if (!name) continue;
      await prisma.book_category_tb.create({
        data: { category, category_name: name, category_order: order, ...create },
      });
    } else {
      await prisma.book_category_tb.update({
        where: { id: Number(row.id) },
        data: { category, category_name: name, category_order: order, del: 1, ...update },
      });
    }
  }

  await logLibrarySetup(PAGE, 'Update', 'Successful', category, memberId, audit);
  return { success: true, message: 'Your details are Updated...', ...(await loadBookCategorySetup(memberId, { category }, { ...audit, skipLog: true })) };
}
