import { prisma } from '../../../config/prisma.js';
import { auditFields, logCircularSetup, saveCircularAttachment, toIsoDate } from '../setupAudit.js';

const PAGE = 'circular_add.php';

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

export async function loadCircularAddSetup(memberId, _fields = {}, audit = {}) {
  const options = await loadOptions();
  await logCircularSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    ...options,
    form: {
      title: '',
      subTitle: '',
      fromDate: new Date().toISOString().slice(0, 10),
      toDate: new Date().toISOString().slice(0, 10),
      audienceFor: 'Staff',
      format: 'General',
      venue: '',
      circularFrom: '',
      description: '',
      copyToDept: [],
      copyToBoard: [],
      signatures: [],
    },
  };
}

export async function saveCircularAddSetup(payload, memberId, files = [], audit = {}) {
  const title = String(payload.title || '').trim();
  if (!title) return { success: false, message: 'Title is required' };

  let attach = '';
  if (files?.[0]) {
    const uploaded = await saveCircularAttachment(files[0]);
    if (uploaded?.error) return { success: false, message: uploaded.error };
    attach = uploaded;
  }

  const signatures = Array.isArray(payload.signatures) ? payload.signatures.join(',') : String(payload.signatures || '');
  const cStatus = signatures ? 0 : 1;
  const { create } = auditFields(memberId, audit);

  await prisma.circular_tb.create({
    data: {
      title,
      s_title: String(payload.subTitle || ''),
      c_date: new Date(`${toIsoDate(payload.fromDate) || new Date().toISOString().slice(0, 10)}T00:00:00`),
      c_from: String(payload.circularFrom || ''),
      a_for: String(payload.audienceFor || ''),
      st_course_id: '',
      c_format: String(payload.format || ''),
      c_venue: String(payload.venue || ''),
      dear_include: String(payload.dearInclude || ''),
      address_type: String(payload.addressType || ''),
      c_acknowledge: payload.acknowledge ? 1 : 0,
      description: String(payload.description || ''),
      c_attach: attach,
      to_date: new Date(`${toIsoDate(payload.toDate) || new Date().toISOString().slice(0, 10)}T00:00:00`),
      to_dept: Array.isArray(payload.copyToDept) ? payload.copyToDept.join(',') : '',
      to_staff: '',
      to_board: Array.isArray(payload.copyToBoard) ? payload.copyToBoard.join(',') : '',
      c_signature: signatures,
      c_approved: '',
      c_status: cStatus,
      ...create,
    },
  });

  await logCircularSetup(PAGE, 'Update', 'Successful', title, memberId, audit);
  return { success: true, message: 'Your details are added...', ...(await loadCircularAddSetup(memberId, {}, { ...audit, skipLog: true })) };
}
