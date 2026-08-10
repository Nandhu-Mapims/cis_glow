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

const PAGE = 'library_transaction1.php';

// Book Issue — student/staff-first flow (library_transaction1.php + transaction_more1.php).
// Step 1: resolve student/staff by register/staff ID, compute issue limit + currently
//         issued books.
// Step 2: once an accession number is supplied, resolve the book (transfer / other-holder
//         / already-held-by-this-person / free) and render the Issue or Return sub-form.
export async function loadTransactionIssueSetup(memberId, fields = {}, audit = {}) {
  const registerNo = String(fields.registerNo || '').trim().toUpperCase();
  const accessionNo = String(fields.bookId || fields.accessionNo || '').trim();
  const limits = await getLibrarySetupLimits();

  if (!registerNo) {
    await logLibrarySetup(PAGE, 'View', 'Successful', '', memberId, audit);
    return { registerNo: '', member: null, limits, book: null };
  }

  const member = await findLibraryMember(registerNo);
  if (!member) {
    await logLibrarySetup(PAGE, 'View', 'Successful', registerNo, memberId, audit);
    return { registerNo, member: null, error: 'Invalid Student/Staff ID....', limits, book: null };
  }

  const { limit, duration } = memberLimitDuration(member, limits);
  const issued = await loadIssuedBooksForMember(member.registerNo);
  const limitExceeded = issued.count >= limit;

  const result = {
    registerNo: member.registerNo,
    member,
    issuedCount: issued.count,
    issuedBooks: issued.books,
    limit,
    duration,
    limitExceeded,
    limits,
    book: null,
  };

  if (limitExceeded) {
    await logLibrarySetup(PAGE, 'View', 'Successful', registerNo, memberId, audit);
    return result;
  }

  if (accessionNo) {
    const book = await findBookByAccession(accessionNo);
    if (!book) {
      result.book = { error: 'Invalid Resource....' };
    } else {
      const transferTo = await checkOpenTransfer(accessionNo);
      if (transferTo) {
        result.book = { ...book, error: `Resource trasfer to ${transferTo}.....` };
      } else {
        const otherHolder = await findOpenTransactionForBook(accessionNo, { excludeRegisterNo: member.registerNo });
        if (otherHolder) {
          result.book = { ...book, error: `Issued to ${otherHolder.register_no}.....` };
        } else {
          const own = await findOpenTransactionForBook(accessionNo, { onlyRegisterNo: member.registerNo });
          if (own) {
            result.book = {
              ...book,
              mode: 'return',
              transId: Number(own.id),
              checkOutDate: formatDateDisplay(own.check_out_date),
              dueDate: formatDateDisplay(own.due_date),
              returnDate: todayIso(),
            };
          } else {
            const checkOutDate = todayIso();
            const dueDate = addDaysIso(checkOutDate, duration);
            result.book = {
              ...book,
              mode: 'issue',
              checkOutDate,
              dueDate,
              referenceCopyWarning: book.referenceCopy,
            };
          }
        }
      }
    }
  }

  await logLibrarySetup(PAGE, 'View', 'Successful', registerNo, memberId, audit);
  return result;
}

export async function saveTransactionIssueSetup(payload, memberId, audit = {}) {
  const result = await saveLibraryTransaction(payload.action, payload, memberId, audit, PAGE);
  return {
    ...result,
    ...(await loadTransactionIssueSetup(memberId, {}, { ...audit, skipLog: true })),
  };
}
