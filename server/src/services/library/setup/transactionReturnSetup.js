import {
  checkOpenTransfer,
  findBookByAccession,
  findLibraryMember,
  findOpenTransactionForBook,
  getLibrarySetupLimits,
  loadIssuedBooksForMember,
  memberLimitDuration,
  saveLibraryTransaction,
} from '../libraryShared.js';
import { addDaysIso, formatDateDisplay, logLibrarySetup, todayIso } from '../setupAudit.js';

const PAGE = 'library_transaction.php';

// Book Return — book-first flow (library_transaction.php + transaction_more.php).
// Step 1: resolve the book by accession no. If it has exactly one open loan, the book
//         alone determines the transaction -> render the Return form directly.
//         If it has no open loan, this is really a "new issue" desk flow -> ask for
//         the Student/Staff ID next.
// Step 2 (only reached from the "no open loan" branch): resolve the person and render
//         the Issue form.
//
// Parity fix: legacy's Book Return "Issue" sub-path does not reliably re-check the
// person's issue limit the way Book Issue's equivalent step does (see
// CISFLOW/library-module.md §10 / open question 5). The load flow below enforces the
// same limit check Book Issue uses before allowing "mode: issue" to be returned, and
// saveLibraryTransaction() (shared with Book Issue) enforces it again server-side at
// save time — so this screen can no longer be used to issue a book past someone's limit.
export async function loadTransactionReturnSetup(memberId, fields = {}, audit = {}) {
  const accessionNo = String(fields.bookId || fields.accessionNo || '').trim();
  const registerNo = String(fields.registerNo || '').trim().toUpperCase();
  const limits = await getLibrarySetupLimits();

  if (!accessionNo) {
    await logLibrarySetup(PAGE, 'View', 'Successful', '', memberId, audit);
    return { accessionNo: '', book: null, limits };
  }

  const book = await findBookByAccession(accessionNo);
  if (!book) {
    await logLibrarySetup(PAGE, 'View', 'Successful', accessionNo, memberId, audit);
    return { accessionNo, book: { error: 'Invalid Resource....' }, limits };
  }

  const transferTo = await checkOpenTransfer(accessionNo);
  if (transferTo) {
    await logLibrarySetup(PAGE, 'View', 'Successful', accessionNo, memberId, audit);
    return { accessionNo, book: { ...book, error: `Resource trasfer to ${transferTo}.....` }, limits };
  }

  const openTxn = await findOpenTransactionForBook(accessionNo);
  const result = { accessionNo, limits, book, mode: null };

  if (openTxn) {
    // Book fully determines the transaction — resolve the holder (no releaving_date
    // filter here, matching legacy: a releaved holder can still be the one returning).
    const holder = await findLibraryMember(openTxn.register_no, { activeOnly: false });
    result.mode = 'return';
    result.transId = Number(openTxn.id);
    result.holder = holder || { registerNo: openTxn.register_no, name: '', designation: '' };
    result.checkOutDate = formatDateDisplay(openTxn.check_out_date);
    result.dueDate = formatDateDisplay(openTxn.due_date);
    result.returnDate = todayIso();
  } else {
    result.mode = 'need-member';
    if (registerNo) {
      const member = await findLibraryMember(registerNo);
      if (!member) {
        result.member = null;
        result.memberError = 'Invalid Student/Staff ID....';
      } else {
        const { limit, duration } = memberLimitDuration(member, limits);
        const issued = await loadIssuedBooksForMember(member.registerNo);
        const limitExceeded = issued.count >= limit;
        result.member = member;
        result.issuedCount = issued.count;
        result.limit = limit;
        result.limitExceeded = limitExceeded;
        if (limitExceeded) {
          result.mode = 'limit-exceeded';
        } else {
          const checkOutDate = todayIso();
          const dueDate = addDaysIso(checkOutDate, duration);
          result.mode = 'issue';
          result.checkOutDate = checkOutDate;
          result.dueDate = dueDate;
        }
      }
    }
  }

  await logLibrarySetup(PAGE, 'View', 'Successful', accessionNo, memberId, audit);
  return result;
}

export async function saveTransactionReturnSetup(payload, memberId, audit = {}) {
  const result = await saveLibraryTransaction(payload.action, payload, memberId, audit, PAGE);
  return {
    ...result,
    ...(await loadTransactionReturnSetup(memberId, {}, { ...audit, skipLog: true })),
  };
}
