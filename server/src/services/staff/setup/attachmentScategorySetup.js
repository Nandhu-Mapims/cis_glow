import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logStaffModule } from '../staffModuleAudit.js';
import {
  loadAttachmentMainCategories,
  loadAttachmentSubCategories,
  resolveAttachmentMainId,
} from '../staffShared.js';

const PAGE = 'staff_attachment_scategory.php';

export async function loadAttachmentScategorySetup(memberId, fields = {}, audit = {}) {
  const mainCategories = await loadAttachmentMainCategories();
  const mainId = fields.mainCategoryId
    ? resolveAttachmentMainId(mainCategories, fields.mainCategoryId)
    : null;
  const subCategories = mainId ? await loadAttachmentSubCategories(mainId) : [];
  const subId = fields.subCategoryId ? Number(fields.subCategoryId) : null;
  const validSubId = subId && subCategories.some((s) => s.id === subId) ? subId : null;
  let msRows = [];
  if (mainId && validSubId) {
    msRows = await prisma.$queryRawUnsafe(
      `SELECT id, category_name, category_sname, category_order
       FROM staff_attachment_mscategory
       WHERE del = 1
         AND category = '${escapeSql(String(mainId))}'
         AND sub_category = '${escapeSql(String(validSubId))}'
         AND TRIM(category_name) <> ''
       ORDER BY category_order ASC, id ASC`,
    );
  }
  await logStaffModule(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    mainCategories: mainCategories.map((m) => ({ id: m.id, name: m.name })),
    subCategories: subCategories.map((s) => ({ id: s.id, name: s.name })),
    selectedMainId: mainId,
    selectedSubId: validSubId,
    rows: mainId && validSubId
      ? (msRows.length
        ? msRows.map((r) => ({ id: r.id, name: r.category_name, shortName: r.category_sname, order: r.category_order }))
        : [{ name: '', shortName: '', order: 1 }])
      : [],
  };
}

export async function saveAttachmentScategorySetup(payload, memberId, audit = {}) {
  const mainId = parseId(payload.mainCategoryId);
  const subId = parseId(payload.subCategoryId);
  if (!mainId || !subId) return { success: false, message: 'Category and sub-category are required' };
  const { create, update } = auditFields(memberId, audit);

  await prisma.staff_attachment_mscategory.updateMany({
    where: { category: String(mainId), sub_category: String(subId), del: 1 },
    data: { del: 0, ...update },
  });

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  for (const row of rows) {
    const name = String(row.name || '').trim();
    const shortName = String(row.shortName || '').trim();
    const order = Number(row.order) || 0;
    if (!row.id && name) {
      await prisma.staff_attachment_mscategory.create({
        data: {
          category: String(mainId),
          sub_category: String(subId),
          category_name: name,
          category_sname: shortName,
          category_order: order,
          ...create,
        },
      });
    } else if (row.id) {
      await prisma.staff_attachment_mscategory.update({
        where: { id: Number(row.id) },
        data: {
          category_name: name,
          category_sname: shortName,
          category_order: order,
          del: name ? 1 : 0,
          ...update,
        },
      });
    }
  }

  await logStaffModule(PAGE, 'Update', 'Successful', `${mainId}/${subId}`, memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadAttachmentScategorySetup(memberId, { mainCategoryId: mainId, subCategoryId: subId }, { ...audit, skipLog: true })),
  };
}
