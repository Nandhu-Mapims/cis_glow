import { prisma } from '../../../config/prisma.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logCircularSetup } from '../setupAudit.js';

const PAGE = 'circular_setup.php';

const SETUP_TYPES = ['Copy To Department', 'Copy To Board', 'Signature'];

function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    mobileNo: row.mobile_no,
    attach: row.attach,
    order: row.c_order,
  };
}

export async function loadCircularSetupSetup(memberId, fields = {}, audit = {}) {
  const category = String(fields.category || SETUP_TYPES[0]);
  const rows = await prisma.circular_setup.findMany({
    where: { del: 1, c_type: category },
    orderBy: { c_order: 'asc' },
  });
  await logCircularSetup(PAGE, 'View', 'Successful', category, memberId, audit);
  return {
    categories: SETUP_TYPES,
    selectedCategory: category,
    rows: rows.length ? rows.map(mapRow) : [{ order: 1, name: '', mobileNo: '', attach: '' }],
  };
}

export async function saveCircularSetupSetup(payload, memberId, audit = {}) {
  const category = String(payload.category || '').trim();
  if (!category) return { success: false, message: 'Category is required' };

  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    const { update } = auditFields(memberId, audit);
    await prisma.circular_setup.update({ where: { id }, data: { del: 0, ...update } });
    await logCircularSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
    return { success: true, message: 'Your details are deleted...', ...(await loadCircularSetupSetup(memberId, { category }, { ...audit, skipLog: true })) };
  }

  const { create, update } = auditFields(memberId, audit);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  for (const row of rows) {
    const name = String(row.name || '').trim();
    if (!name && !row.id) continue;
    const data = {
      c_type: category,
      name,
      mobile_no: String(row.mobileNo || ''),
      attach: String(row.attach || ''),
      c_order: Number(row.order) || 0,
    };
    if (row.id) {
      await prisma.circular_setup.update({ where: { id: Number(row.id) }, data: { ...data, del: 1, ...update } });
    } else {
      await prisma.circular_setup.create({ data: { ...data, ...create } });
    }
  }

  await logCircularSetup(PAGE, 'Update', 'Successful', category, memberId, audit);
  return { success: true, message: 'Your details are Updated...', ...(await loadCircularSetupSetup(memberId, { category }, { ...audit, skipLog: true })) };
}
