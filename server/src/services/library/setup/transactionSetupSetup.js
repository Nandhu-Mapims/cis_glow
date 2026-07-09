import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logLibrarySetup } from '../setupAudit.js';

const PAGE = 'transaction_setup.php';

export async function loadTransactionSetupSetup(memberId, _fields = {}, audit = {}) {
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM library_setup_tb WHERE id = 1 AND del = 1 LIMIT 1');
  const row = rows[0] || {};
  await logLibrarySetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    ugLimit: row.ug_limit ?? '',
    ugDuration: row.ug_duration ?? '',
    pgLimit: row.pg_limit ?? '',
    pgDuration: row.pg_duration ?? '',
    staffLimit: row.staff_limit ?? '',
    staffDuration: row.staff_duration ?? '',
  };
}

export async function saveTransactionSetupSetup(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);
  await prisma.$executeRawUnsafe(`
    UPDATE library_setup_tb SET
      ug_limit = ${Number(payload.ugLimit) || 0},
      ug_duration = ${Number(payload.ugDuration) || 0},
      pg_limit = ${Number(payload.pgLimit) || 0},
      pg_duration = ${Number(payload.pgDuration) || 0},
      staff_limit = ${Number(payload.staffLimit) || 0},
      staff_duration = ${Number(payload.staffDuration) || 0},
      updated_dt = NOW(),
      updated_ip = '${escapeSql(update.updated_ip)}',
      updated_by = '${escapeSql(memberId)}'
    WHERE id = 1
  `);
  await logLibrarySetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadTransactionSetupSetup(memberId, {}, { ...audit, skipLog: true })),
  };
}
