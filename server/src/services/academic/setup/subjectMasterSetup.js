import { prisma } from '../../../config/prisma.js';
import { subjectMasterSelect } from '../../../utils/legacySelects.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logAcademicSetup } from './setupAudit.js';

const PAGE = 'subject_master.php';

const CATEGORY_OPTIONS = [
  { value: 'Category', label: 'Category (Main)' },
  { value: 'Type', label: 'Category (Exam)' },
  { value: 'Timetable', label: 'Category (Timetable)' },
];

function mapRow(row) {
  return {
    id: row.id,
    order: row.category_order,
    name: row.category_name,
    shortName: row.category_sname,
    subCategory: row.sub_category,
  };
}

async function fetchRows(category) {
  if (!category) return [];
  const rows = await prisma.subject_master.findMany({
    where: { category, del: { not: 0 } },
    orderBy: { category_order: 'asc' },
    select: subjectMasterSelect,
  });
  return rows.map(mapRow);
}

export async function loadSubjectMaster(memberId, fields = {}, audit = {}) {
  const category = String(fields.category || '').trim();
  const rows = category ? await fetchRows(category) : [];
  await logAcademicSetup(PAGE, 'View', 'Successful', category || '', memberId, audit);
  return {
    categoryOptions: CATEGORY_OPTIONS,
    category,
    rows: rows.length ? rows : (category ? [{ order: 1, name: '', shortName: '', subCategory: '' }] : []),
  };
}

export async function saveSubjectMaster(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      await prisma.subject_master.update({
        where: { id },
        data: { del: 0, ...update },
      });
      await logAcademicSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      const category = String(payload.category || '').trim();
      return {
        success: true,
        message: 'Your details are deleted...',
        ...(await loadSubjectMaster(memberId, { category }, { ...audit, skipLog: true })),
      };
    } catch {
      await logAcademicSetup(PAGE, 'Delete', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  const category = String(payload.category || '').trim();
  if (!category) {
    return { success: false, message: 'Category is required' };
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const { create, update } = auditFields(memberId, audit);

  await prisma.subject_master.updateMany({
    where: { category, del: 1 },
    data: { del: 0, ...update },
  });

  for (const row of rows) {
    const name = String(row.name || '').trim();
    const shortName = String(row.shortName || '').trim();
    const order = Number(row.order) || 0;
    const subCategory = String(row.subCategory || '').trim();

    if (!row.id) {
      if (!name) continue;
      await prisma.subject_master.create({
        data: {
          category,
          category_name: name,
          category_sname: shortName,
          category_order: order,
          sub_category: subCategory,
          ...create,
        },
      });
    } else {
      await prisma.subject_master.update({
        where: { id: Number(row.id) },
        data: {
          del: 1,
          category,
          category_name: name,
          category_sname: shortName,
          category_order: order,
          sub_category: subCategory,
          ...update,
        },
      });
    }
  }

  await logAcademicSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadSubjectMaster(memberId, { category }, { ...audit, skipLog: true })),
  };
}
