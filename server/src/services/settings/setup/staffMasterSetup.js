import { prisma } from '../../../config/prisma.js';
import { eduSetupTbSelect } from '../../../utils/legacySelects.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logSettingsSetup } from '../setupAudit.js';

const PAGE = 'staff_profile_setup.php';

const CATEGORY_OPTIONS = [
  { value: 'Staff Name Title', label: 'Staff Name Title', group: 'Staff' },
  { value: 'Dental Council', label: 'Dental Council', group: 'Staff' },
  { value: 'Address Proof', label: 'Address Proof', group: 'Staff' },
  { value: 'Identity Proof', label: 'Identity Proof', group: 'Staff' },
  { value: 'Category', label: 'Staff Category', group: 'Staff' },
  { value: 'Course', label: 'Course', group: 'Staff' },
  { value: 'Degree', label: 'Degree', group: 'Staff' },
  { value: 'Major', label: 'Major', group: 'Staff' },
  { value: 'Course Type', label: 'Course Type', group: 'Staff' },
  { value: 'University', label: 'University', group: 'Staff' },
  { value: 'Experience Institution', label: 'Experience Institution', group: 'Staff' },
  { value: 'Experience Type', label: 'Experience Type', group: 'Staff' },
  { value: 'Skills', label: 'Add-on Skillsets', group: 'Staff' },
  { value: 'Extra Curricular', label: 'Extension Activities', group: 'Staff' },
  { value: 'Area of Interest', label: 'Area of Specialization', group: 'Staff' },
  { value: 'Area of Interests', label: 'Sports', group: 'Staff' },
  { value: 'Languages Known', label: 'Languages Known', group: 'Staff' },
  { value: 'Attachments', label: 'Attachments', group: 'Staff' },
  { value: 'Bank', label: 'Bank Details', group: 'Other' },
  { value: 'Salary Advance', label: 'Salary Advance Type', group: 'Other' },
  { value: 'Salary Arrear', label: 'Salary Arrears Type', group: 'Other' },
  { value: 'Article Type', label: 'Article Type', group: 'Other' },
  { value: 'DCI Norms Category', label: 'DCI Norms Category', group: 'Other' },
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

export async function loadStaffMasterSetup(memberId, fields = {}, audit = {}) {
  const category = String(fields.category || '').trim();
  const rows = category
    ? (await prisma.edu_setup_tb.findMany({
      where: { category, del: { not: 0 } },
      orderBy: { category_order: 'asc' },
      select: eduSetupTbSelect,
    })).map(mapRow)
    : [];

  await logSettingsSetup(PAGE, 'View', 'Successful', category, memberId, audit);
  return {
    categoryOptions: CATEGORY_OPTIONS,
    category,
    rows: rows.length ? rows : (category ? [{ order: 1, name: '', shortName: '', subCategory: '' }] : []),
  };
}

export async function saveStaffMasterSetup(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      await prisma.edu_setup_tb.update({
        where: { id },
        data: { del: 0, ...update },
      });
      await logSettingsSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      const category = String(payload.category || '').trim();
      return {
        success: true,
        message: 'Your details are deleted...',
        ...(await loadStaffMasterSetup(memberId, { category }, { ...audit, skipLog: true })),
      };
    } catch {
      await logSettingsSetup(PAGE, 'Delete', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  const category = String(payload.category || '').trim();
  if (!category) return { success: false, message: 'Category is required' };

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const { create, update } = auditFields(memberId, audit);

  await prisma.edu_setup_tb.updateMany({
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
      await prisma.edu_setup_tb.create({
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
      await prisma.edu_setup_tb.update({
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

  await logSettingsSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadStaffMasterSetup(memberId, { category }, { ...audit, skipLog: true })),
  };
}
