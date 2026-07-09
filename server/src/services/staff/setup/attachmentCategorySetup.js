import { prisma } from '../../../config/prisma.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logStaffModule } from '../staffModuleAudit.js';
import {
  loadAttachmentMainCategories,
  loadAttachmentSubCategories,
  resolveAttachmentMainId,
} from '../staffShared.js';

const PAGE = 'staff_attachment_category.php';

export async function loadAttachmentCategorySetup(memberId, fields = {}, audit = {}) {
  const mainCategories = await loadAttachmentMainCategories();
  const selectedMain = resolveAttachmentMainId(mainCategories, fields.mainCategoryId);
  const subRows = selectedMain ? await loadAttachmentSubCategories(selectedMain) : [];
  await logStaffModule(PAGE, 'View', 'Successful', String(selectedMain || ''), memberId, audit);
  const selected = mainCategories.find((m) => m.id === selectedMain);
  return {
    mainCategories,
    selectedMainId: selectedMain,
    mainName: selected?.name || '',
    mainOrder: selected?.order || 1,
    subRows: subRows.length
      ? subRows.map((r) => ({ id: r.id, name: r.name, order: r.order }))
      : [{ name: '', order: 1 }],
  };
}

export async function saveAttachmentCategorySetup(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  const action = payload.action;

  if (action === 'delete') {
    const id = parseId(payload.id);
    await prisma.staff_attachment_scategory.update({
      where: { id },
      data: { del: 0, ...update },
    });
    await logStaffModule(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
    return {
      success: true,
      message: 'Your details are deleted...',
      ...(await loadAttachmentCategorySetup(memberId, { mainCategoryId: payload.mainCategoryId }, { ...audit, skipLog: true })),
    };
  }

  let mainId = payload.mainCategoryId === 'add_new' ? null : parseId(payload.mainCategoryId || payload.selectedMainId);
  const mainName = String(payload.mainName || '').trim();
  const mainOrder = Number(payload.mainOrder) || 1;

  if (!mainId && mainName) {
    const created = await prisma.staff_attachment_mcategory.create({
      data: { name: mainName, d_order: mainOrder, ...create },
    });
    mainId = created.id;
  } else if (mainId && mainName) {
    await prisma.staff_attachment_mcategory.update({
      where: { id: mainId },
      data: { name: mainName, d_order: mainOrder, ...update },
    });
    await prisma.staff_attachment_scategory.updateMany({
      where: { d_id: mainId, del: 1 },
      data: { del: 0, ...update },
    });
  }

  if (!mainId) return { success: false, message: 'Main category is required' };

  const rows = Array.isArray(payload.subRows) ? payload.subRows : [];
  for (const row of rows) {
    const name = String(row.name || '').trim();
    const order = Number(row.order) || 0;
    if (!row.id && name) {
      await prisma.staff_attachment_scategory.create({
        data: { d_id: mainId, name, d_order: order, ...create },
      });
    } else if (row.id) {
      await prisma.staff_attachment_scategory.update({
        where: { id: Number(row.id) },
        data: { name, d_order: order, del: name ? 1 : 0, ...update },
      });
    }
  }

  await logStaffModule(PAGE, 'Update', 'Successful', String(mainId), memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadAttachmentCategorySetup(memberId, { mainCategoryId: mainId }, { ...audit, skipLog: true })),
  };
}
