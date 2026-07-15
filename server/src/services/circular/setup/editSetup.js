import { prisma } from '../../../config/prisma.js';
import { parseId, parseOptionalId, escapeSql } from '../../../utils/sqlSafe.js';
import { fetchCircularById, fetchCircularList, searchCircularByTitle } from '../circularShared.js';
import { auditFields, logCircularSetup, saveCircularAttachment } from '../setupAudit.js';

const PAGE = 'circular_edit.php';

async function loadOptions() {
  const [depts, boards, signatures] = await Promise.all([
    prisma.circular_setup.findMany({ where: { del: 1, c_type: 'Copy To Department' }, orderBy: { c_order: 'asc' } }),
    prisma.circular_setup.findMany({ where: { del: 1, c_type: 'Copy To Board' }, orderBy: { c_order: 'asc' } }),
    prisma.circular_setup.findMany({ where: { del: 1, c_type: 'Signature' }, orderBy: { c_order: 'asc' } }),
  ]);
  return {
    departments: depts.map((d) => ({ id: String(d.id), name: d.name })),
    boards: boards.map((d) => ({ id: String(d.id), name: d.name })),
    signatures: signatures.map((d) => ({ id: String(d.id), name: d.name })),
  };
}

export async function loadCircularEditSetup(memberId, fields = {}, audit = {}) {
  const options = await loadOptions();
  const searchId = parseOptionalId(fields.id);
  const searchTitle = String(fields.search || '').trim();

  let circular = null;
  let list = [];
  if (searchId) {
    circular = await fetchCircularById(searchId);
  } else if (searchTitle) {
    list = await searchCircularByTitle(searchTitle);
  } else {
    list = await fetchCircularList();
  }

  await logCircularSetup(PAGE, 'View', 'Successful', String(searchId || searchTitle), memberId, audit);
  return { ...options, search: searchTitle, id: searchId, circular, list };
}

export async function saveCircularEditSetup(payload, memberId, files = [], audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    const { update } = auditFields(memberId, audit);
    await prisma.$executeRawUnsafe(`
      UPDATE circular_tb SET del = 0,
        updated_dt = NOW(), updated_by = '${escapeSql(update.updated_by)}', updated_ip = '${escapeSql(update.updated_ip)}'
      WHERE id = ${id}
    `);
    await logCircularSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
    return { success: true, message: 'Your details are deleted...', ...(await loadCircularEditSetup(memberId, {}, { ...audit, skipLog: true })) };
  }

  const id = parseId(payload.id);
  if (!id) return { success: false, message: 'Circular not found' };

  let attach = payload.attach || '';
  if (files?.[0]) {
    const uploaded = await saveCircularAttachment(files[0]);
    if (uploaded?.error) return { success: false, message: uploaded.error };
    attach = uploaded;
  }

  const { update } = auditFields(memberId, audit);
  const fromDate = payload.fromDate || new Date().toISOString().slice(0, 10);
  const toDate = payload.toDate || fromDate;
  await prisma.$executeRawUnsafe(`
    UPDATE circular_tb SET
      title = '${escapeSql(String(payload.title || ''))}',
      s_title = '${escapeSql(String(payload.subTitle || ''))}',
      c_date = '${escapeSql(fromDate)}',
      to_date = '${escapeSql(toDate)}',
      a_for = '${escapeSql(String(payload.audienceFor || ''))}',
      c_format = '${escapeSql(String(payload.format || ''))}',
      c_venue = '${escapeSql(String(payload.venue || ''))}',
      c_from = '${escapeSql(String(payload.circularFrom || ''))}',
      description = '${escapeSql(String(payload.description || ''))}',
      c_attach = '${escapeSql(String(attach))}',
      to_dept = '${escapeSql(Array.isArray(payload.copyToDept) ? payload.copyToDept.join(',') : '')}',
      to_board = '${escapeSql(Array.isArray(payload.copyToBoard) ? payload.copyToBoard.join(',') : '')}',
      c_signature = '${escapeSql(Array.isArray(payload.signatures) ? payload.signatures.join(',') : '')}',
      updated_dt = NOW(),
      updated_by = '${escapeSql(update.updated_by)}',
      updated_ip = '${escapeSql(update.updated_ip)}'
    WHERE id = ${id}
  `);

  await logCircularSetup(PAGE, 'Save', 'Successful', String(id), memberId, audit);
  return {
    success: true,
    message: 'Your details are saved...',
    ...(await loadCircularEditSetup(memberId, { id }, { ...audit, skipLog: true })),
  };
}
