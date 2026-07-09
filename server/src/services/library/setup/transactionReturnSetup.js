import { escapeSql, parseId } from '../../../utils/sqlSafe.js';
import { prisma } from '../../../config/prisma.js';
import { loadOutstandingTransactions, mapTransactionRow } from '../libraryShared.js';
import { auditFields, logLibrarySetup, toIsoDate } from '../setupAudit.js';

const PAGE = 'library_transaction.php';

export async function loadTransactionReturnSetup(memberId, fields = {}, audit = {}) {
  const search = String(fields.search || '').trim().toUpperCase();
  const rows = await loadOutstandingTransactions(search);
  await logLibrarySetup(PAGE, 'View', 'Successful', search, memberId, audit);
  return {
    search,
    rows: rows.map(mapTransactionRow),
    returnDate: toIsoDate(fields.returnDate) || new Date().toISOString().slice(0, 10),
  };
}

export async function saveTransactionReturnSetup(payload, memberId, audit = {}) {
  const id = parseId(payload.id);
  const returnDate = toIsoDate(payload.returnDate);
  if (!id || !returnDate) return { success: false, message: 'Transaction and return date are required' };

  const { update } = auditFields(memberId, audit);
  await prisma.$executeRawUnsafe(`
    UPDATE library_transaction_tb SET
      check_in_date = '${returnDate} 00:00:00',
      is_damage = ${payload.isDamage ? 1 : 0},
      updated_dt = NOW(),
      updated_ip = '${escapeSql(update.updated_ip)}',
      updated_by = '${escapeSql(memberId)}'
    WHERE id = ${id}
  `);

  await logLibrarySetup(PAGE, 'Return', 'Successful', String(id), memberId, audit);
  return {
    success: true,
    message: 'Returned...',
    ...(await loadTransactionReturnSetup(memberId, { search: payload.search }, { ...audit, skipLog: true })),
  };
}
