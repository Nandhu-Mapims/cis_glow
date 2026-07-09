import { prisma } from '../../../config/prisma.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logSettingsSetup } from '../setupAudit.js';

const PAGE = 'salary_signature.php';

const CATEGORY_OPTIONS = [{ value: 'progress card', label: 'Progress Card' }];

function mapRow(row) {
  return {
    id: row.id,
    refName: row.ref_name,
    designation: row.staff_designation,
    order: row.staff_order,
    enabled: row.staff_order === 1,
    existingFile: row.staff_name || '',
  };
}

export async function loadSignatureSetup(memberId, fields = {}, audit = {}) {
  const category = String(fields.category || '').trim();
  let rows = [];
  if (category) {
    const data = await prisma.signature_setup.findMany({
      where: { category, del: { not: 0 } },
      orderBy: { ref_name: 'asc' },
    });
    rows = data.map(mapRow);
  }

  await logSettingsSetup(PAGE, 'View', 'Successful', category, memberId, audit);
  return {
    categoryOptions: CATEGORY_OPTIONS,
    category,
    rows: rows.length ? rows : (category ? [{ refName: '', designation: '', order: 1, enabled: true, existingFile: '' }] : []),
  };
}

export async function saveSignatureSetup(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      await prisma.signature_setup.update({
        where: { id },
        data: { del: 0, ...update },
      });
      await logSettingsSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return {
        success: true,
        message: 'Your details are deleted...',
        ...(await loadSignatureSetup(memberId, { category: payload.category }, { ...audit, skipLog: true })),
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

  await prisma.signature_setup.updateMany({
    where: { category, del: 1 },
    data: { del: 0, ...update },
  });

  for (const row of rows) {
    const refName = String(row.refName || '').trim();
    const designation = String(row.designation || '').trim();
    const order = row.enabled ? 1 : 0;
    const existingFile = String(row.existingFile || '').trim();
    if (!row.id) {
      if (!refName && !designation) continue;
      await prisma.signature_setup.create({
        data: {
          category,
          ref_name: refName,
          staff_designation: designation,
          staff_order: order,
          staff_name: existingFile,
          ...create,
        },
      });
    } else {
      await prisma.signature_setup.update({
        where: { id: Number(row.id) },
        data: {
          del: 1,
          category,
          ref_name: refName,
          staff_designation: designation,
          staff_order: order,
          staff_name: existingFile,
          ...update,
        },
      });
    }
  }

  await logSettingsSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadSignatureSetup(memberId, { category }, { ...audit, skipLog: true })),
  };
}
