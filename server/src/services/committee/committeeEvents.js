import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';

const APPROVE_PAGE = 'approve_event.php';
const RESCHEDULE_PAGE = 'approve_reschedule_event_v1.php';
const REPORT_PAGE = 'approve_event_report.php';

function mapEvent(row) {
  return {
    id: Number(row.id),
    title: row.title || '',
    fromDate: row.from_date ? String(row.from_date).slice(0, 10) : '',
    toDate: row.to_date ? String(row.to_date).slice(0, 10) : '',
    type: row.e_type || '',
    category: row.e_category ?? '',
    description: row.e_description || '',
    aStatus: row.e_status ?? 0,
    refId: Number(row.ref_id) || 0,
  };
}

export async function loadCommitteeApproveEvent(memberId, fields = {}, audit = {}) {
  const status = fields.aStatus !== undefined ? String(fields.aStatus) : '0';
  const where = status === 'all' ? 'del=1 AND e_task=1' : `del=1 AND e_task=1 AND e_status=${Number(status)}`;
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, title, from_date, to_date, e_type, e_category, e_description, e_status, ref_id
    FROM tv_academic_event WHERE ${where} ORDER BY from_date DESC LIMIT 100
  `);
  await logModulePage(APPROVE_PAGE, 'View', 'Successful', status, memberId, audit);
  return { success: true, aStatus: status, events: rows.map(mapEvent) };
}

export async function saveCommitteeApproveEvent(payload, memberId, audit = {}) {
  const id = parseId(payload.eventId);
  const { update } = auditFields(memberId, audit);
  const aStatus = Number(payload.aStatus) || 1;
  await prisma.$executeRawUnsafe(`
    UPDATE tv_academic_event SET e_status=${aStatus},
      updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
    WHERE id=${id}
  `);
  await logModulePage(APPROVE_PAGE, 'Update', 'Successful', String(id), memberId, audit);
  return { success: true, message: 'Event updated.', ...(await loadCommitteeApproveEvent(memberId, {}, { ...audit, skipLog: true })) };
}

export async function loadCommitteeApproveReschedule(memberId, fields = {}, audit = {}) {
  const { loadCommitteeApproveReschedule: load } = await import('./committeeApproveReschedule.js');
  return load(memberId, fields, audit);
}

export async function saveCommitteeApproveReschedule(payload, memberId, audit = {}) {
  const { saveCommitteeApproveReschedule: save } = await import('./committeeApproveReschedule.js');
  return save(payload, memberId, audit);
}

export async function loadCommitteeApproveEventReport(memberId, fields = {}, audit = {}) {
  const fromDate = fields.fromDate || '';
  const toDate = fields.toDate || '';
  let where = 'del=1';
  if (fromDate) where += ` AND from_date>='${escapeSql(fromDate)}'`;
  if (toDate) where += ` AND from_date<='${escapeSql(toDate)}'`;
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, title, from_date, to_date, e_status, ref_id
    FROM tv_academic_event WHERE ${where} ORDER BY from_date DESC LIMIT 200
  `);
  await logModulePage(REPORT_PAGE, 'View', 'Successful', '', memberId, audit);
  return { success: true, fromDate, toDate, events: rows.map(mapEvent) };
}

export async function saveCommitteeApproveEventReport() {
  return { success: false, message: 'Report is read-only.' };
}

export { loadCommitteeTvEvent, saveCommitteeTvEvent } from './committeeTvAcademic.js';

export { loadCommitteeTvPrint, saveCommitteeTvPrint } from './committeeTvPrint.js';
