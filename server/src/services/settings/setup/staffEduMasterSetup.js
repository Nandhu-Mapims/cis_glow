import { prisma } from '../../../config/prisma.js';
import { eduAlliedTbSelect, eduSetupTbSelect } from '../../../utils/legacySelects.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logSettingsSetup } from '../setupAudit.js';

const PAGE = 'staff_edu_allied.php';

async function loadDegreeOptions() {
  const rows = await prisma.edu_setup_tb.findMany({
    where: { category: 'Degree', del: 1 },
    orderBy: { category_order: 'asc' },
    select: eduSetupTbSelect,
  });
  return rows.map((r) => ({ value: String(r.id), label: r.category_name }));
}

async function loadMajorOptions() {
  const rows = await prisma.edu_setup_tb.findMany({
    where: { category: 'Major', del: 1 },
    orderBy: { category_order: 'asc' },
    select: eduSetupTbSelect,
  });
  return rows.map((r) => ({ value: String(r.id), label: r.category_name }));
}

function mapRow(row) {
  return {
    id: row.id,
    order: row.category_order,
    name: row.category_name,
    shortName: row.category_sname,
  };
}

export async function loadStaffEduMasterSetup(memberId, fields = {}, audit = {}) {
  const category = String(fields.category || '').trim();
  const subCategory = String(fields.subCategory || '').trim();

  let rows = [];
  if (category && subCategory) {
    const data = await prisma.edu_allied_tb.findMany({
      where: { category, sub_category: subCategory, del: { not: 0 } },
      orderBy: { category_order: 'asc' },
      select: eduAlliedTbSelect,
    });
    rows = data.map(mapRow);
  }

  await logSettingsSetup(PAGE, 'View', 'Successful', `${category}/${subCategory}`, memberId, audit);
  return {
    degreeOptions: await loadDegreeOptions(),
    majorOptions: await loadMajorOptions(),
    category,
    subCategory,
    rows: rows.length ? rows : (category && subCategory ? [{ order: 1, name: '', shortName: '' }] : []),
  };
}

export async function saveStaffEduMasterSetup(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      await prisma.edu_allied_tb.update({
        where: { id },
        data: { del: 0, ...update },
      });
      await logSettingsSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return {
        success: true,
        message: 'Your details are deleted...',
        ...(await loadStaffEduMasterSetup(memberId, {
          category: payload.category,
          subCategory: payload.subCategory,
        }, { ...audit, skipLog: true })),
      };
    } catch {
      await logSettingsSetup(PAGE, 'Delete', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  const category = String(payload.category || '').trim();
  const subCategory = String(payload.subCategory || '').trim();
  if (!category || !subCategory) {
    return { success: false, message: 'Category and sub-category are required' };
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const { create, update } = auditFields(memberId, audit);

  await prisma.edu_allied_tb.updateMany({
    where: { category, sub_category: subCategory, del: 1 },
    data: { del: 0, ...update },
  });

  for (const row of rows) {
    const name = String(row.name || '').trim();
    const shortName = String(row.shortName || '').trim();
    const order = Number(row.order) || 0;
    if (!row.id) {
      if (!name) continue;
      await prisma.edu_allied_tb.create({
        data: {
          category,
          sub_category: subCategory,
          category_name: name,
          category_sname: shortName,
          category_order: order,
          ...create,
        },
      });
    } else {
      await prisma.edu_allied_tb.update({
        where: { id: Number(row.id) },
        data: {
          del: 1,
          category,
          sub_category: subCategory,
          category_name: name,
          category_sname: shortName,
          category_order: order,
          ...update,
        },
      });
    }
  }

  await logSettingsSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadStaffEduMasterSetup(memberId, { category, subCategory }, { ...audit, skipLog: true })),
  };
}
