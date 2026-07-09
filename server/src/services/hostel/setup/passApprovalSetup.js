import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId } from '../../../utils/sqlSafe.js';
import { loadPassRequests } from '../hostelShared.js';
import { auditFields, formatDateDisplay, logHostelSetup } from '../setupAudit.js';

const PAGE = 'hostel_pass_approval.php';

export async function loadPassApprovalSetup(memberId, fields = {}, audit = {}) {
  const statusFilter = fields.status ?? '0';
  const status = statusFilter === 'all' ? null : Number(statusFilter);
  const rows = await loadPassRequests({ status, limit: 100 });

  await logHostelSetup(PAGE, 'View', 'Successful', String(status ?? 'all'), memberId, audit);
  return {
    statusFilter,
    rows: rows.map((r) => ({
      ...r,
      fromDate: formatDateDisplay(r.fromDate) || r.fromDate,
      toDate: formatDateDisplay(r.toDate) || r.toDate,
    })),
  };
}

export async function savePassApprovalSetup(payload, memberId, audit = {}) {
  const id = parseId(payload.id);
  const status = Number(payload.status);
  if (!id || !status) return { success: false, message: 'Request and status are required' };

  const { update } = auditFields(memberId, audit);
  await prisma.$executeRawUnsafe(`
    UPDATE hostel_pass_request SET status = ${status},
      comments = '${escapeSql(String(payload.comments || ''))}',
      updated_dt = NOW(), updated_by = '${escapeSql(memberId)}', updated_ip = '${escapeSql(update.updated_ip)}'
    WHERE id = ${id}
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE hostel_pass_request_more SET status = ${status},
      updated_dt = NOW(), updated_by = '${escapeSql(memberId)}', updated_ip = '${escapeSql(update.updated_ip)}'
    WHERE request_id = ${id} AND del = 1
  `);

  await logHostelSetup(PAGE, 'Update', 'Successful', String(id), memberId, audit);
  return {
    success: true,
    message: 'Pass request updated...',
    ...(await loadPassApprovalSetup(memberId, { status: payload.statusFilter }, { ...audit, skipLog: true })),
  };
}
