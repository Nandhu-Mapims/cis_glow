import { prisma } from '../../../config/prisma.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logAcademicSetup } from './setupAudit.js';

const PAGE = 'master_setup.php';

const CATEGORY_OPTIONS = [
  { value: 'Account', label: 'Account', group: 'Student' },
  { value: 'Department', label: 'Department', group: 'Student' },
  { value: 'Student Title', label: 'Student Name Title', group: 'Student' },
  { value: 'Parent Title', label: 'Parent Name Title', group: 'Student' },
  { value: 'Quota', label: 'Quota/Source', group: 'Student' },
  { value: 'BloodGroup', label: 'Blood Group', group: 'Student' },
  { value: 'Religion', label: 'Religion', group: 'Student' },
  { value: 'Community', label: 'Community', group: 'Student' },
  { value: 'Activity', label: 'Activity', group: 'Student' },
  { value: 'Attendance Auth', label: 'Attendance Auth.', group: 'Student' },
  { value: 'Attencance', label: 'Ext. Activity Attencance', group: 'Student' },
  { value: 'Attachment', label: 'Attachment', group: 'Student' },
  { value: 'Internship Department', label: 'Internship Department', group: 'Other' },
  { value: 'Inspection Inspector Type', label: 'Inspection Inspector Type', group: 'Other' },
  { value: 'No-due', label: 'No-due', group: 'Other' },
  { value: 'HostelOutPass', label: 'Hostel Out Pass', group: 'Other' },
  { value: 'HostelHomePass', label: 'Hostel Home Pass', group: 'Other' },
  { value: 'Event Location', label: 'Event Location', group: 'Other' },
];

function mapRow(row) {
  return {
    id: row.id,
    order: row.category_order,
    name: row.category_name,
    shortName: row.category_sname,
    subCategory: row.sub_category,
    ug: row.ug === 1,
    pg: row.pg === 2,
  };
}

async function fetchRows(category) {
  if (!category) return [];
  const rows = await prisma.master_setup.findMany({
    where: { category, del: { not: 0 } },
    orderBy: { category_order: 'asc' },
    select: {
      id: true,
      category_order: true,
      category_name: true,
      category_sname: true,
      sub_category: true,
      ug: true,
      pg: true,
    },
  });
  return rows.map(mapRow);
}

function emptyRow(order = 1) {
  return { order, name: '', shortName: '', subCategory: '', ug: false, pg: false };
}

export async function loadMasterSetup(memberId, fields = {}, audit = {}) {
  const category = String(fields.category || '').trim();
  const rows = category ? await fetchRows(category) : [];
  await logAcademicSetup(PAGE, 'View', 'Successful', category || '', memberId, audit);
  return {
    categoryOptions: CATEGORY_OPTIONS,
    category,
    showDegree: category === 'Attachment',
    rows: rows.length ? rows : (category ? [emptyRow(1)] : []),
  };
}

export async function saveMasterSetup(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      await prisma.master_setup.update({
        where: { id },
        data: { del: 0, ...update },
      });
      await logAcademicSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      const category = String(payload.category || '').trim();
      return {
        success: true,
        message: 'Your details are deleted...',
        ...(await loadMasterSetup(memberId, { category }, { ...audit, skipLog: true })),
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
  const showDegree = category === 'Attachment';

  await prisma.master_setup.updateMany({
    where: { category, del: 1 },
    data: { del: 0, ...update },
  });

  for (const row of rows) {
    const name = String(row.name || '').trim();
    const shortName = String(row.shortName || '').trim();
    const order = Number(row.order) || 0;
    const subCategory = String(row.subCategory || '').trim();
    const ug = showDegree && row.ug ? 1 : 0;
    const pg = showDegree && row.pg ? 2 : 0;

    if (!row.id) {
      if (!name) continue;
      await prisma.master_setup.create({
        data: {
          category,
          category_name: name,
          category_sname: shortName,
          category_order: order,
          sub_category: subCategory,
          ug,
          pg,
          ...create,
        },
      });
    } else {
      await prisma.master_setup.update({
        where: { id: Number(row.id) },
        data: {
          del: 1,
          category,
          category_name: name,
          category_sname: shortName,
          category_order: order,
          sub_category: subCategory,
          ug,
          pg,
          ...update,
        },
      });
    }
  }

  await logAcademicSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadMasterSetup(memberId, { category }, { ...audit, skipLog: true })),
  };
}
