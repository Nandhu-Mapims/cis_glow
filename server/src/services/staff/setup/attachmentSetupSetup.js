import { prisma } from '../../../config/prisma.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logStaffModule } from '../staffModuleAudit.js';
import { loadDeptDesignationLookups, loadAllAttachmentMsCategories, loadAllAttachmentSubCategories, loadAttachmentMainCategories } from '../staffShared.js';

const PAGE = 'staff_attachment_setup.php';

export async function loadAttachmentSetupSetup(memberId, fields = {}, audit = {}) {
  const lookups = await loadDeptDesignationLookups();
  const departmentId = fields.departmentId ? parseId(fields.departmentId) : (lookups.departments[0]?.id || null);
  const designationId = fields.designationId
    ? parseId(fields.designationId)
    : (lookups.designations.find((d) => d.departmentId === departmentId)?.id || null);

  const [mcats, scats, mscats, setupRows] = await Promise.all([
    loadAttachmentMainCategories(),
    loadAllAttachmentSubCategories(),
    loadAllAttachmentMsCategories(),
    departmentId && designationId
      ? prisma.$queryRawUnsafe(
        `SELECT id, mandatory, mcategory, scategory, mscategory, notes
         FROM staff_attachment_setup WHERE del = 1 AND department = ${departmentId} AND designation = ${designationId}
         ORDER BY mcategory ASC`,
      )
      : Promise.resolve([]),
  ]);

  await logStaffModule(PAGE, 'View', 'Successful', `${departmentId}/${designationId}`, memberId, audit);
  return {
    ...lookups,
    selectedDepartmentId: departmentId,
    selectedDesignationId: designationId,
    mcategories: mcats.map((m) => ({ id: m.id, name: m.name })),
    scategories: scats.map((s) => ({ id: s.id, name: s.name, mainId: s.mainId })),
    mscategories: mscats.map((m) => ({
      id: m.id,
      name: m.name,
      mainId: m.mainId,
      subId: m.subId,
    })),
    rows: setupRows.length
      ? setupRows.map((r) => ({
          id: r.id,
          mandatory: r.mandatory === 1,
          mcategoryId: r.mcategory,
          scategoryId: r.scategory,
          mscategoryId: r.mscategory,
          notes: r.notes,
        }))
      : [{ mandatory: false, mcategoryId: '', scategoryId: '', mscategoryId: '', notes: 0 }],
  };
}

export async function saveAttachmentSetupSetup(payload, memberId, audit = {}) {
  const departmentId = parseId(payload.departmentId);
  const designationId = parseId(payload.designationId);
  if (!departmentId || !designationId) return { success: false, message: 'Department and designation are required' };
  const { create, update } = auditFields(memberId, audit);

  await prisma.staff_attachment_setup.updateMany({
    where: { del: 1, department: departmentId, designation: designationId },
    data: { del: 0, ...update },
  });

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  for (const row of rows) {
    const mcat = Number(row.mcategoryId);
    if (!mcat) continue;
    const data = {
      department: departmentId,
      designation: designationId,
      mandatory: row.mandatory ? 1 : 0,
      mcategory: mcat,
      scategory: Number(row.scategoryId) || 0,
      mscategory: Number(row.mscategoryId) || 0,
      notes: Number(row.notes) || 0,
      del: 1,
      ...update,
    };
    if (row.id) {
      await prisma.staff_attachment_setup.update({ where: { id: Number(row.id) }, data });
    } else {
      await prisma.staff_attachment_setup.create({ data: { ...data, ...create } });
    }
  }

  await logStaffModule(PAGE, 'Update', 'Successful', `${departmentId}/${designationId}`, memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadAttachmentSetupSetup(memberId, { departmentId, designationId }, { ...audit, skipLog: true })),
  };
}
