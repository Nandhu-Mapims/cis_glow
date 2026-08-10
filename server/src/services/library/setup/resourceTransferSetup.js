import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { loadBookCategoryOptions } from '../libraryShared.js';
import { auditFields, logLibrarySetup, toIsoDate } from '../setupAudit.js';

const PAGE = 'resource_transfer.php';

function fmtDateExpr(col, alias) {
  const a = alias || col.split('.').pop();
  return `IF(${col}='0000-00-00' OR ${col}='0000-00-00 00:00:00','',DATE_FORMAT(${col},'%Y-%m-%d')) AS ${a}`;
}

async function lookupBookTransfer(accessionNo) {
  const acc = escapeSql(String(accessionNo || '').trim());
  if (!acc) return { error: 'Accession number is required' };

  const books = await prisma.$queryRawUnsafe(`
    SELECT accession_no, resource_name, author_name, resource_type
    FROM book_tb WHERE del = 1 AND accession_no = '${acc}' LIMIT 1
  `);
  const book = books[0];
  if (!book) return { error: 'Book not found' };

  const issued = await prisma.$queryRawUnsafe(`
    SELECT register_no FROM library_transaction_tb
    WHERE del = 1 AND book_id = '${acc}'
      AND (check_in_date = '0000-00-00 00:00:00' OR check_in_date = '1970-01-01 00:00:00' OR check_in_date IS NULL)
    LIMIT 1
  `);
  if (issued[0]) {
    return { error: `Resource not available. Issued to ${issued[0].register_no}` };
  }

  const pending = await prisma.$queryRawUnsafe(`
    SELECT id, transfer_to,
      ${fmtDateExpr('transfer_date', 'transfer_date')}
    FROM book_transfer
    WHERE del = 1 AND accession_no = '${acc}'
      AND (receive_date = '0000-00-00' OR receive_date IS NULL)
    ORDER BY id DESC LIMIT 1
  `);

  if (pending[0]) {
    const dest = await prisma.$queryRawUnsafe(`
      SELECT category_name FROM book_category_tb WHERE id = '${escapeSql(String(pending[0].transfer_to))}' LIMIT 1
    `);
    return {
      mode: 'return',
      book: {
        accessionNo: book.accession_no,
        resourceName: book.resource_name || '',
        authorName: book.author_name || '',
      },
      transfer: {
        id: Number(pending[0].id),
        transferTo: dest[0]?.category_name || pending[0].transfer_to,
        transferDate: pending[0].transfer_date || '',
      },
    };
  }

  return {
    mode: 'transfer',
    book: {
      accessionNo: book.accession_no,
      resourceName: book.resource_name || '',
      authorName: book.author_name || '',
    },
  };
}

export async function loadResourceTransferSetup(memberId, fields = {}, audit = {}) {
  const destinations = await loadBookCategoryOptions('Transfer');
  const accessionNo = String(fields.accessionNo || '').trim();
  let lookup = null;
  if (accessionNo) lookup = await lookupBookTransfer(accessionNo);

  await logLibrarySetup(PAGE, 'View', 'Successful', accessionNo, memberId, audit);
  return {
    accessionNo,
    destinations,
    transferDate: toIsoDate(fields.transferDate) || new Date().toISOString().slice(0, 10),
    receiveDate: toIsoDate(fields.receiveDate) || new Date().toISOString().slice(0, 10),
    lookup,
  };
}

export async function saveResourceTransferSetup(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);

  if (payload.action === 'transfer') {
    const accessionNo = String(payload.accessionNo || '').trim();
    // Legacy strtoupper()s transfer_to before insert (harmless no-op for the numeric
    // category id it actually stores, but kept for exact SQL parity).
    const transferTo = String(payload.transferTo || '').trim().toUpperCase();
    const transferDate = toIsoDate(payload.transferDate);
    if (!accessionNo || !transferTo) {
      return { success: false, message: 'Check Book ID and Transfer ID....' };
    }

    await prisma.$executeRawUnsafe(`
      INSERT INTO book_transfer (
        accession_no, transfer_to, transfer_date,
        created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del
      ) VALUES (
        '${escapeSql(accessionNo)}', '${escapeSql(transferTo)}', '${transferDate || new Date().toISOString().slice(0, 10)}',
        NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
        NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1
      )
    `);
    await logLibrarySetup(PAGE, 'Transfer', 'Successful', `${transferTo} | ${accessionNo}`, memberId, audit);
    return { success: true, message: 'Transfered...', ...(await loadResourceTransferSetup(memberId, {}, { ...audit, skipLog: true })) };
  }

  if (payload.action === 'return') {
    const id = Number(payload.transferId);
    const receiveDate = toIsoDate(payload.receiveDate);
    if (!id || !receiveDate) return { success: false, message: 'Check Book ID....' };

    await prisma.$executeRawUnsafe(`
      UPDATE book_transfer SET
        receive_date = '${receiveDate}',
        updated_dt = NOW(),
        updated_ip = '${escapeSql(update.updated_ip)}',
        updated_by = '${escapeSql(memberId)}'
      WHERE id = ${id}
    `);
    await logLibrarySetup(PAGE, 'Return', 'Successful', String(id), memberId, audit);
    return { success: true, message: 'Returned...', ...(await loadResourceTransferSetup(memberId, {}, { ...audit, skipLog: true })) };
  }

  return { success: false, message: 'Unknown action' };
}
