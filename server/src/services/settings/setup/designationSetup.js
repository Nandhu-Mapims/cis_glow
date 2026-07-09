import { prisma } from '../../../config/prisma.js';
import { staffDeptMasterSelect, staffDesgOrderSelect } from '../../../utils/legacySelects.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logSettingsSetup } from '../setupAudit.js';

const PAGE = 'staff_dept_setup.php';

function mapDesg(row) {
  return { id: row.id, name: row.name, order: row.d_order };
}

export async function loadDesignationSetup(memberId, fields = {}, audit = {}) {
  const deptRef = String(fields.deptRef || '').trim();
  const departments = await prisma.staff_dept_master.findMany({
    where: { del: 1 },
    orderBy: { d_order: 'asc' },
    select: staffDeptMasterSelect,
  });

  let selectedDept = null;
  let designations = [];
  if (deptRef && deptRef !== 'add_new') {
    const deptId = parseId(deptRef);
    selectedDept = departments.find((d) => d.id === deptId) || null;
    if (selectedDept) {
      const rows = await prisma.staff_desg_master.findMany({
        where: { del: 1, d_id: selectedDept.id },
        orderBy: { d_order: 'asc' },
        select: staffDesgOrderSelect,
      });
      designations = rows.map(mapDesg);
    }
  }

  await logSettingsSetup(PAGE, 'View', 'Successful', deptRef, memberId, audit);
  return {
    departments: departments.map((d) => ({ id: d.id, name: d.name, order: d.d_order })),
    deptRef: deptRef || '',
    deptName: selectedDept?.name || (deptRef === 'add_new' ? '' : ''),
    deptOrder: selectedDept?.d_order ?? '',
    showGrid: Boolean(selectedDept || deptRef === 'add_new'),
    designations: designations.length ? designations : [{ order: 1, name: '' }],
  };
}

export async function saveDesignationSetup(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      await prisma.staff_desg_master.update({
        where: { id },
        data: { del: 0, ...update },
      });
      await logSettingsSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return {
        success: true,
        message: 'Your details are deleted...',
        ...(await loadDesignationSetup(memberId, { deptRef: payload.deptRef }, { ...audit, skipLog: true })),
      };
    } catch {
      await logSettingsSetup(PAGE, 'Delete', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  const deptRef = String(payload.deptRef || '').trim();
  const deptName = String(payload.deptName || '').trim();
  const deptOrder = Number(payload.deptOrder) || 0;
  let deptId = deptRef === 'add_new' ? null : parseId(deptRef);

  if (deptRef === 'add_new') {
    if (!deptName) return { success: false, message: 'Department name is required' };
    const created = await prisma.staff_dept_master.create({
      data: { name: deptName, d_order: deptOrder, s_name: '', d_dept: 0, category: '', course_id: '', college: '', ...create },
    });
    deptId = created.id;
  } else if (deptId) {
    await prisma.staff_dept_master.update({
      where: { id: deptId },
      data: { name: deptName, d_order: deptOrder, ...update },
    });
    await prisma.staff_desg_master.updateMany({
      where: { d_id: deptId, del: 1 },
      data: { del: 0, ...update },
    });
  } else {
    return { success: false, message: 'Department is required' };
  }

  const rows = Array.isArray(payload.designations) ? payload.designations : [];
  for (const row of rows) {
    const name = String(row.name || '').trim();
    const order = Number(row.order) || 0;
    if (!row.id) {
      if (!name) continue;
      await prisma.staff_desg_master.create({
        data: { d_id: deptId, name, d_order: order, desg_catg: '', ...create },
      });
    } else {
      await prisma.staff_desg_master.update({
        where: { id: Number(row.id) },
        data: { name, d_order: order, del: 1, d_id: deptId, ...update },
      });
    }
  }

  await logSettingsSetup(PAGE, 'Update', 'Successful', deptName, memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadDesignationSetup(memberId, { deptRef: String(deptId) }, { ...audit, skipLog: true })),
  };
}
