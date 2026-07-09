import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, formatDateDisplay, logLibrarySetup, toIsoDate } from '../setupAudit.js';

const PAGE = 'library_transaction1.php';

export async function loadTransactionIssueSetup(memberId, fields = {}, audit = {}) {
  const registerNo = String(fields.registerNo || '').trim().toUpperCase();
  let member = null;
  if (registerNo) {
    const student = await prisma.student_profile_tb.findFirst({
      where: { del: 1, register_no: registerNo },
      select: { register_no: true, student_name: true, student_initial: true },
    });
    if (student) {
      member = { registerNo: student.register_no, name: `${student.student_initial || ''} ${student.student_name}`.trim() };
    } else {
      const staff = await prisma.staff_profile_tb.findFirst({
        where: { del: 1, staff_id: registerNo },
        select: { staff_id: true, staff_name: true, staff_initial: true },
      });
      if (staff) {
        member = { registerNo: staff.staff_id, name: `${staff.staff_initial || ''} ${staff.staff_name}`.trim() };
      }
    }
  }

  const setup = await prisma.library_setup_tb.findFirst({ where: { del: 1 } });
  await logLibrarySetup(PAGE, 'View', 'Successful', registerNo, memberId, audit);
  return {
    registerNo,
    member,
    checkOutDate: toIsoDate(fields.checkOutDate) || new Date().toISOString().slice(0, 10),
    dueDate: fields.dueDate || '',
    limits: setup ? {
      ugLimit: setup.ug_limit,
      ugDuration: setup.ug_duration,
      pgLimit: setup.pg_limit,
      pgDuration: setup.pg_duration,
      staffLimit: setup.staff_limit,
      staffDuration: setup.staff_duration,
    } : null,
  };
}

export async function saveTransactionIssueSetup(payload, memberId, audit = {}) {
  const bookId = String(payload.bookId || '').trim();
  const registerNo = String(payload.registerNo || '').trim().toUpperCase();
  const checkOutDate = toIsoDate(payload.checkOutDate);
  const dueDate = toIsoDate(payload.dueDate);

  if (!bookId || !registerNo) {
    return { success: false, message: 'Check Book ID and Student/Staff ID.' };
  }

  const outstanding = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS cnt FROM library_transaction_tb
     WHERE del = 1 AND book_id = '${escapeSql(bookId)}'
       AND (check_in_date = '0000-00-00 00:00:00' OR check_in_date IS NULL)`,
  );
  if (Number(outstanding[0]?.cnt || 0) > 0) {
    await logLibrarySetup(PAGE, 'Issued', 'Unsuccessful', `Already Issued ${bookId}`, memberId, audit);
    return { success: false, message: 'Book ID Already Issued.' };
  }

  const { create } = auditFields(memberId, audit);
  await prisma.library_transaction_tb.create({
    data: {
      register_no: registerNo,
      book_id: bookId,
      check_out_date: checkOutDate ? new Date(`${checkOutDate}T00:00:00`) : new Date(),
      due_date: dueDate ? new Date(`${dueDate}T00:00:00`) : new Date(),
      check_in_date: new Date('1970-01-01'),
      is_damage: 0,
      status: '',
      ...create,
    },
  });

  await logLibrarySetup(PAGE, 'Issued', 'Successful', `${registerNo} | ${bookId}`, memberId, audit);
  return { success: true, message: 'Issued...', ...(await loadTransactionIssueSetup(memberId, {}, { ...audit, skipLog: true })) };
}
