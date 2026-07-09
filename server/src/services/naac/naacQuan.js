import { prisma } from '../../config/prisma.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { parseId } from '../../utils/sqlSafe.js';
import { loadNaacQuanItems, loadNaacQuanSections } from './naacQuanShared.js';

const PAGE = 'naac_quan.php';

function mapSub(row) {
  return {
    id: row.id,
    name: row.name,
    order: row.d_order,
    docNumber: row.doc_number,
    docType: row.doc_type,
    attachment: row.attachment,
    attachmentSize: row.attachment_size,
  };
}

export async function loadNaacQuan(memberId, fields = {}, audit = {}) {
  const sections = await loadNaacQuanSections();
  const deptRef = String(fields.deptRef ?? '').trim();
  const selected = deptRef && deptRef !== 'add_new'
    ? sections.find((s) => String(s.id) === deptRef) || null
    : null;
  let items = [];
  if (selected) {
    const rows = await loadNaacQuanItems(selected.id);
    items = rows.map(mapSub);
  } else if (deptRef === 'add_new') {
    items = [{ name: '', docNumber: '', docType: 'QN', attachment: '', attachmentSize: '' }];
  }

  await logModulePage(PAGE, 'View', 'Successful', deptRef, memberId, audit);
  return {
    sections: sections.map((s) => ({ id: s.id, name: s.name, order: s.d_order })),
    deptRef,
    deptName: selected?.name || (deptRef === 'add_new' ? '' : ''),
    deptOrder: selected?.d_order ?? '',
    items: items.length ? items : (deptRef === 'add_new' ? [{ name: '', docNumber: '', docType: 'QN', attachment: '', attachmentSize: '' }] : []),
  };
}

export async function saveNaacQuan(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    await prisma.naac_quan_sub.update({ where: { id: Number(payload.id) }, data: { del: 0, ...update } });
    await logModulePage(PAGE, 'Delete', 'Successful', String(payload.id), memberId, audit);
    return { success: true, message: 'Deleted...', ...(await loadNaacQuan(memberId, { deptRef: payload.deptRef }, { ...audit, skipLog: true })) };
  }

  let deptId = payload.deptRef === 'add_new' ? null : parseId(payload.deptRef);
  const deptName = String(payload.deptName || '').trim();
  const deptOrder = Number(payload.deptOrder) || 0;

  if (payload.deptRef === 'add_new') {
    const created = await prisma.naac_quan_main.create({
      data: { name: deptName, d_order: deptOrder, s_name: '', d_dept: 0, ...create },
    });
    deptId = created.id;
  } else if (deptId) {
    await prisma.naac_quan_main.update({ where: { id: deptId }, data: { name: deptName, d_order: deptOrder, ...update } });
    await prisma.naac_quan_sub.updateMany({ where: { d_id: deptId, del: 1 }, data: { del: 0, ...update } });
  }

  const rows = Array.isArray(payload.items) ? payload.items : [];
  for (const row of rows) {
    const name = String(row.name || '').trim();
    if (!name) continue;
    const data = {
      name,
      d_order: Number(row.order) || Number(row.docNumber) || 0,
      doc_number: String(row.docNumber || ''),
      doc_type: String(row.docType || ''),
      attachment: String(row.attachment || ''),
      attachment_size: String(row.attachmentSize || ''),
      desg_catg: '',
      d_id: deptId,
    };
    if (row.id) {
      await prisma.naac_quan_sub.update({ where: { id: Number(row.id) }, data: { ...data, del: 1, ...update } });
    } else {
      await prisma.naac_quan_sub.create({ data: { ...data, ...create } });
    }
  }

  await logModulePage(PAGE, 'Update', 'Successful', deptName, memberId, audit);
  return { success: true, message: 'Updated...', ...(await loadNaacQuan(memberId, { deptRef: String(deptId) }, { ...audit, skipLog: true })) };
}
