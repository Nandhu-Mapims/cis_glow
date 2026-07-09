import { prisma } from '../../config/prisma.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { parseId } from '../../utils/sqlSafe.js';

const PAGE = 'naac_qual.php';

function mapSub(row) {
  return {
    id: row.id,
    name: row.name,
    order: row.d_order,
    attachment: row.attachment,
    attachmentSize: row.attachment_size,
  };
}

export async function loadNaacQual(memberId, fields = {}, audit = {}) {
  const sections = await prisma.naac_qual_main.findMany({ where: { del: 1 }, orderBy: { d_order: 'asc' } });
  const deptRef = String(fields.deptRef ?? '').trim();
  const selected = deptRef && deptRef !== 'add_new'
    ? sections.find((s) => String(s.id) === deptRef) || null
    : null;
  let items = [];
  if (selected) {
    const rows = await prisma.naac_qual_sub.findMany({
      where: { del: 1, d_id: selected.id },
      orderBy: { d_order: 'asc' },
    });
    items = rows.map(mapSub);
  }

  await logModulePage(PAGE, 'View', 'Successful', deptRef, memberId, audit);
  return {
    sections: sections.map((s) => ({ id: s.id, name: s.name, order: s.d_order })),
    deptRef,
    deptName: selected?.name || (deptRef === 'add_new' ? '' : ''),
    deptOrder: selected?.d_order ?? '',
    items: items.length ? items : (deptRef === 'add_new' ? [{ order: 1, name: '', attachment: '' }] : []),
  };
}

export async function saveNaacQual(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    await prisma.naac_qual_sub.update({ where: { id: Number(payload.id) }, data: { del: 0, ...update } });
    await logModulePage(PAGE, 'Delete', 'Successful', String(payload.id), memberId, audit);
    return { success: true, message: 'Deleted...', ...(await loadNaacQual(memberId, { deptRef: payload.deptRef }, { ...audit, skipLog: true })) };
  }

  let deptId = payload.deptRef === 'add_new' ? null : parseId(payload.deptRef);
  const deptName = String(payload.deptName || '').trim();
  const deptOrder = Number(payload.deptOrder) || 0;

  if (payload.deptRef === 'add_new') {
    const created = await prisma.naac_qual_main.create({
      data: { name: deptName, d_order: deptOrder, s_name: '', d_dept: 0, ...create },
    });
    deptId = created.id;
  } else if (deptId) {
    await prisma.naac_qual_main.update({ where: { id: deptId }, data: { name: deptName, d_order: deptOrder, ...update } });
    await prisma.naac_qual_sub.updateMany({ where: { d_id: deptId, del: 1 }, data: { del: 0, ...update } });
  }

  const rows = Array.isArray(payload.items) ? payload.items : [];
  for (const row of rows) {
    const name = String(row.name || '').trim();
    const order = Number(row.order) || 0;
    if (!name) continue;
    if (row.id) {
      await prisma.naac_qual_sub.update({
        where: { id: Number(row.id) },
        data: {
          name,
          d_order: order,
          attachment: String(row.attachment || ''),
          attachment_size: String(row.attachmentSize || ''),
          del: 1,
          d_id: deptId,
          desg_catg: '',
          ...update,
        },
      });
    } else {
      await prisma.naac_qual_sub.create({
        data: {
          d_id: deptId,
          name,
          d_order: order,
          attachment: String(row.attachment || ''),
          attachment_size: String(row.attachmentSize || ''),
          desg_catg: '',
          ...create,
        },
      });
    }
  }

  await logModulePage(PAGE, 'Update', 'Successful', deptName, memberId, audit);
  return { success: true, message: 'Updated...', ...(await loadNaacQual(memberId, { deptRef: String(deptId) }, { ...audit, skipLog: true })) };
}
