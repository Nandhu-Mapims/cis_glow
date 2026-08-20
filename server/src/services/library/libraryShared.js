import { prisma } from '../../config/prisma.js';
import { escapeSql, parseId } from '../../utils/sqlSafe.js';
import { auditFields, logLibrarySetup, toIsoDate } from './setupAudit.js';
import { studentIdCardPhotoUrl } from '../students/studentShared.js';
import { staffPhotoDisplayUrl } from '../staff/staffShared.js';

function fmtDateExpr(col, alias) {
  const a = alias || col.split('.').pop();
  return `IF(${col}='0000-00-00' OR ${col}='0000-00-00 00:00:00','',DATE_FORMAT(${col},'%Y-%m-%d')) AS ${a}`;
}

const SEARCH_BY_COLUMNS = new Set([
  'resource_name',
  'accession_no',
  'convert_name',
  'call_number',
  'author_name',
  'publisher_name',
]);

export async function loadBookCategoryOptions(category) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, category_name FROM book_category_tb
    WHERE del = 1 AND category = '${escapeSql(category)}'
    ORDER BY category_order ASC
  `);
  return rows.map((row) => ({ id: String(row.id), name: row.category_name || '' }));
}

export async function searchBooks(filters = {}, { limit = 500 } = {}) {
  const search = String(filters.search || '').trim();
  const searchBy = String(filters.searchBy || '').trim();
  const resourceType = String(filters.resourceType || '').trim();
  const department = String(filters.department || '').trim();
  const fromAccession = String(filters.fromAccession || '').trim();
  const toAccession = String(filters.toAccession || '').trim();

  let where = 'del = 1';
  if (resourceType) where += ` AND resource_type = '${escapeSql(resourceType)}'`;
  if (department && department !== 'Others' && department !== 'others') {
    const dep = escapeSql(department);
    where += ` AND (resource_department = '${dep}' OR resource_department LIKE '${dep},%' OR resource_department LIKE '%,${dep}' OR resource_department LIKE '%,${dep},%')`;
  } else if (department === 'Others' || department === 'others') {
    const deps = await loadBookCategoryOptions('Department');
    for (const dep of deps) {
      const id = escapeSql(dep.id);
      where += ` AND resource_department != '${id}' AND resource_department NOT LIKE '${id},%' AND resource_department NOT LIKE '%,${id}' AND resource_department NOT LIKE '%,${id},%'`;
    }
  }

  if (fromAccession && toAccession) {
    where += ` AND accession_no+0 >= ${Number(fromAccession)} AND accession_no+0 <= ${Number(toAccession)}`;
  } else if (search) {
    const terms = search.split(',').map((s) => s.trim()).filter(Boolean);
    if (terms.length > 1 && (!searchBy || searchBy === 'accession_no')) {
      where += ` AND (${terms.map((t) => `accession_no = '${escapeSql(t)}'`).join(' OR ')})`;
    } else if (searchBy && SEARCH_BY_COLUMNS.has(searchBy)) {
      where += ` AND ${searchBy} LIKE '%${escapeSql(search)}%'`;
    } else {
      where += ` AND (accession_no LIKE '%${escapeSql(search)}%' OR resource_name LIKE '%${escapeSql(search)}%' OR author_name LIKE '%${escapeSql(search)}%' OR call_number LIKE '%${escapeSql(search)}%')`;
    }
  }

  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, accession_no, resource_name, author_name, call_number, shelf_no, rack_no,
      resource_type, resource_department, publisher_name, isbn_no, copy_no
    FROM book_tb WHERE ${where}
    ORDER BY accession_no+0 ASC, accession_no ASC
    LIMIT ${Number(limit)}
  `);

  return rows.map((row) => ({
    id: Number(row.id),
    accessionNo: row.accession_no || '',
    resourceName: row.resource_name || '',
    authorName: row.author_name || '',
    callNumber: row.call_number || '',
    shelfNo: row.shelf_no || '',
    rackNo: row.rack_no || '',
    resourceType: row.resource_type || '',
    resourceDepartment: row.resource_department || '',
    publisherName: row.publisher_name || '',
    isbnNo: row.isbn_no || '',
    copyNo: row.copy_no || '',
  }));
}

export async function loadOutstandingTransactions(search = '') {
  let sql = `
    SELECT id, register_no, book_id,
      ${fmtDateExpr('check_out_date', 'check_out_date')},
      ${fmtDateExpr('due_date', 'due_date')}
    FROM library_transaction_tb
    WHERE del = 1
      AND (check_in_date = '0000-00-00 00:00:00' OR check_in_date = '1970-01-01 00:00:00' OR check_in_date IS NULL)`;
  if (search) {
    const s = escapeSql(search.toUpperCase());
    sql += ` AND (register_no LIKE '%${s}%' OR book_id LIKE '%${s}%')`;
  }
  sql += ' ORDER BY check_out_date DESC LIMIT 100';
  return prisma.$queryRawUnsafe(sql);
}

export function mapTransactionRow(row) {
  return {
    id: Number(row.id),
    registerNo: row.register_no || '',
    bookId: row.book_id || '',
    checkOutDate: row.check_out_date || '',
    dueDate: row.due_date || '',
    isDamage: Number(row.is_damage) === 1,
  };
}

// ---------------------------------------------------------------------------
// Book Issue / Book Return shared logic
// (library_transaction1.php + transaction_more1.php  /  library_transaction.php
// + transaction_more.php — legacy runs byte-for-byte identical PHP for both
// screens; this module consolidates that shared "issue/return" behavior.)
// ---------------------------------------------------------------------------

// Legacy config.php: IDCARD_YEAR/IDCARD_LEN (staff), STU_IDCARD_YEAR/STU_IDCARD_LEN (students)
const ID_CARD_PREFIX = {
  student: { prefix: 'APS', len: 3 },
  staff: { prefix: 'APDS', len: 4 },
};

function stripIdCardPrefix(id, kind) {
  const cfg = ID_CARD_PREFIX[kind];
  const raw = String(id || '').trim();
  if (cfg?.prefix && raw.slice(0, cfg.len) === cfg.prefix) return raw.slice(cfg.len);
  return raw;
}

// register_no/check_in_date "still out" sentinel — legacy stores '0000-00-00'/'' ;
// this app's Prisma layer has historically also written '1970-01-01' for the same
// "empty" meaning (see saveLibraryTransaction below), so reads must match both.
const OPEN_CHECK_IN_SQL = "(check_in_date = '0000-00-00 00:00:00' OR check_in_date = '1970-01-01 00:00:00' OR check_in_date IS NULL)";

async function findStudentMember(registerNo, { activeOnly = true } = {}) {
  const src = stripIdCardPrefix(registerNo, 'student');
  let where = `A.register_no = '${escapeSql(src)}' AND B.del = 1 AND A.del = 1`;
  if (activeOnly) where += " AND (A.releaving_date = '0000-00-00' OR A.releaving_date > CURRENT_DATE())";
  const rows = await prisma.$queryRawUnsafe(`
    SELECT A.register_no, A.student_name, A.student_initial, B.degree_name, B.department_name, B.course_name
    FROM student_profile_tb A
    INNER JOIN basic_setup_course_tb B ON A.course_id = B.id
    WHERE ${where}
    LIMIT 1
  `);
  if (!rows.length) return null;
  const row = rows[0];
  let designation = row.degree_name || '';
  if (String(row.department_name || '').trim()) designation += ` - ${row.department_name}`;
  return {
    type: 'student',
    registerNo: row.register_no,
    name: `${row.student_name || ''} ${row.student_initial || ''}`.trim(),
    designation,
    courseName: row.course_name || '',
    photoUrl: (await studentIdCardPhotoUrl(row.register_no)) || '/legacy/img/empty_image.jpg',
  };
}

async function findStaffMember(registerNo, { activeOnly = true } = {}) {
  const src = stripIdCardPrefix(registerNo, 'staff');
  let where = `staff_id = '${escapeSql(src)}' AND del = 1`;
  if (activeOnly) where += " AND (releaving_date = '0000-00-00' OR releaving_date > CURRENT_DATE())";
  const rows = await prisma.$queryRawUnsafe(`
    SELECT staff_id, staff_name, staff_initial, job_category
    FROM staff_profile_tb WHERE ${where} LIMIT 1
  `);
  if (!rows.length) return null;
  const row = rows[0];
  let designation = '';
  if (row.job_category) {
    const cat = await prisma.$queryRawUnsafe(`
      SELECT category_name FROM edu_setup_tb WHERE category = 'Category' AND id = '${escapeSql(String(row.job_category))}' ORDER BY category_order ASC LIMIT 1
    `);
    designation = cat[0]?.category_name || '';
  }
  return {
    type: 'staff',
    registerNo: row.staff_id,
    name: `${row.staff_name || ''} ${row.staff_initial || ''}`.trim(),
    designation,
    courseName: '',
    photoUrl: await staffPhotoDisplayUrl(row.staff_id, 'idcard'),
  };
}

// Student profile is tried first, then staff — matches transaction_more1.php/transaction_more.php.
// activeOnly=false is used only when resolving the borrower of an already-open loan for display
// (legacy's flag=2 "resolve holder" queries omit the releaving_date filter there).
export async function findLibraryMember(registerNo, opts = {}) {
  const student = await findStudentMember(registerNo, opts);
  if (student) return student;
  return findStaffMember(registerNo, opts);
}

export async function getLibrarySetupLimits() {
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM library_setup_tb WHERE id = 1 LIMIT 1');
  const row = rows[0] || {};
  return {
    ugLimit: Number(row.ug_limit || 0),
    ugDuration: Number(row.ug_duration || 0),
    pgLimit: Number(row.pg_limit || 0),
    pgDuration: Number(row.pg_duration || 0),
    staffLimit: Number(row.staff_limit || 0),
    staffDuration: Number(row.staff_duration || 0),
  };
}

export function memberLimitDuration(member, limits) {
  if (!member) return { limit: 0, duration: 0 };
  if (member.type === 'staff') return { limit: limits.staffLimit, duration: limits.staffDuration };
  if (String(member.courseName || '').toLowerCase() === 'u.g') return { limit: limits.ugLimit, duration: limits.ugDuration };
  return { limit: limits.pgLimit, duration: limits.pgDuration };
}

export async function loadIssuedBooksForMember(registerNo) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT book_id FROM library_transaction_tb
    WHERE register_no = '${escapeSql(registerNo)}' AND del = 1 AND ${OPEN_CHECK_IN_SQL}
  `);
  const books = [];
  for (const r of rows) {
    const b = await prisma.$queryRawUnsafe(`
      SELECT accession_no, resource_name FROM book_tb WHERE accession_no = '${escapeSql(r.book_id)}' AND del = 1 LIMIT 1
    `);
    books.push({ accessionNo: b[0]?.accession_no || r.book_id, resourceName: b[0]?.resource_name || '-' });
  }
  return { count: rows.length, books };
}

export async function findBookByAccession(accessionNo) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT accession_no, resource_name, author_name, resource_type, is_damage, reference_copy
    FROM book_tb WHERE accession_no = '${escapeSql(accessionNo)}' AND del = 1 LIMIT 1
  `);
  if (!rows.length) return null;
  const row = rows[0];
  let resourceType = row.resource_type;
  if (resourceType) {
    const cat = await prisma.$queryRawUnsafe(`SELECT category_name FROM book_category_tb WHERE id = '${escapeSql(String(resourceType))}' LIMIT 1`);
    resourceType = cat[0]?.category_name || resourceType;
  }
  return {
    accessionNo: row.accession_no,
    resourceName: row.resource_name || '',
    authorName: row.author_name || '',
    resourceType: resourceType || '',
    isDamage: Number(row.is_damage) === 1,
    referenceCopy: Number(row.reference_copy) === 1,
  };
}

// Open (not-yet-received) transfer for a book — accession is "away" if this returns a value.
export async function checkOpenTransfer(accessionNo) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT transfer_to FROM book_transfer
    WHERE accession_no = '${escapeSql(accessionNo)}' AND (receive_date = '0000-00-00' OR receive_date IS NULL) AND del = 1
    ORDER BY id DESC LIMIT 1
  `);
  if (!rows.length) return null;
  const cat = await prisma.$queryRawUnsafe(`SELECT category_name FROM book_category_tb WHERE id = '${escapeSql(String(rows[0].transfer_to))}' LIMIT 1`);
  return cat[0]?.category_name || rows[0].transfer_to;
}

export async function findOpenTransactionForBook(bookId, { excludeRegisterNo, onlyRegisterNo } = {}) {
  let where = `del = 1 AND book_id = '${escapeSql(bookId)}' AND ${OPEN_CHECK_IN_SQL}`;
  if (excludeRegisterNo) where += ` AND register_no != '${escapeSql(excludeRegisterNo)}'`;
  if (onlyRegisterNo) where += ` AND register_no = '${escapeSql(onlyRegisterNo)}'`;
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, register_no, check_out_date, due_date FROM library_transaction_tb WHERE ${where} ORDER BY id DESC LIMIT 1
  `);
  return rows[0] || null;
}

/**
 * Shared Issue/Return save handler for Book Issue (library_transaction1.php) and
 * Book Return (library_transaction.php) — legacy runs byte-for-byte identical
 * POST-handling SQL for both screens, so this one function backs both.
 *
 * Parity fix: legacy's Book Return screen (transaction_more.php flag=2 "Issue"
 * sub-path) does not always re-check the person's issue limit the way Book Issue's
 * equivalent step does. Because this function is the single save path for both
 * screens, the issue-limit check below is enforced uniformly for every Issue action
 * regardless of which screen triggered it — closing that gap for real, not just in
 * the UI that decides whether to show the Issue button.
 */
export async function saveLibraryTransaction(action, payload, memberId, audit, page) {
  const { create, update } = auditFields(memberId, audit);

  if (action === 'issue') {
    const bookId = String(payload.bookId || payload.accessionNo || '').trim();
    const registerNo = String(payload.registerNo || '').trim().toUpperCase();
    if (!bookId || !registerNo) {
      await logLibrarySetup(page, 'Issued', 'Unsuccessful', '', memberId, audit);
      return { success: false, message: 'Check Book ID and Student/Staff ID....' };
    }
    const checkOutDate = toIsoDate(payload.checkOutDate);
    const dueDate = toIsoDate(payload.dueDate);

    const existing = await prisma.$queryRawUnsafe(`
      SELECT id FROM library_transaction_tb WHERE del = 1 AND book_id = '${escapeSql(bookId)}' AND ${OPEN_CHECK_IN_SQL} LIMIT 1
    `);
    if (existing.length) {
      await logLibrarySetup(page, 'Issued', 'Unsuccessful', `Already Issued${bookId}`, memberId, audit);
      return { success: false, message: 'Book ID Already Issued ....' };
    }

    // Issue-limit enforcement — see doc comment above.
    const member = await findLibraryMember(registerNo);
    if (member) {
      const limits = await getLibrarySetupLimits();
      const { limit } = memberLimitDuration(member, limits);
      const issued = await loadIssuedBooksForMember(member.registerNo);
      if (issued.count >= limit) {
        await logLibrarySetup(page, 'Issued', 'Unsuccessful', `Issue Limit Exceed ${registerNo}`, memberId, audit);
        return { success: false, message: 'Issue Limit Exceed....' };
      }
    }

    await prisma.$executeRawUnsafe(`
      INSERT INTO library_transaction_tb
        (register_no, book_id, check_out_date, due_date, check_in_date, is_damage, status,
         created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del)
      VALUES (
        '${escapeSql(registerNo)}', '${escapeSql(bookId)}',
        '${checkOutDate || '0000-00-00'}', '${dueDate || '0000-00-00'}',
        '0000-00-00 00:00:00', 0, '',
        NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}',
        NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1
      )
    `);
    await logLibrarySetup(page, 'Issued', 'Successful', `${registerNo} | ${bookId}`, memberId, audit);
    return { success: true, message: 'Issued...' };
  }

  if (action === 'return') {
    const id = parseId(payload.transId ?? payload.id);
    const returnDate = toIsoDate(payload.returnDate);
    const isDamage = payload.isDamage || payload.returnDamage ? 1 : 0;
    if (!id || !returnDate) {
      await logLibrarySetup(page, 'Return', 'Unsuccessful', '', memberId, audit);
      return { success: false, message: 'Check Book ID....' };
    }

    await prisma.$executeRawUnsafe(`
      UPDATE library_transaction_tb SET
        check_in_date = '${returnDate} 00:00:00',
        is_damage = ${isDamage},
        updated_dt = NOW(),
        updated_ip = '${escapeSql(update.updated_ip)}',
        updated_by = '${escapeSql(memberId)}'
      WHERE id = ${id}
    `);

    if (isDamage === 1) {
      const rows = await prisma.$queryRawUnsafe(`SELECT book_id FROM library_transaction_tb WHERE id = ${id} AND del = 1 LIMIT 1`);
      const bkId = rows[0]?.book_id;
      if (bkId) {
        await prisma.$executeRawUnsafe(`
          UPDATE book_tb SET is_damage = 1, updated_dt = NOW(), updated_ip = '${escapeSql(update.updated_ip)}', updated_by = '${escapeSql(memberId)}'
          WHERE accession_no = '${escapeSql(bkId)}'
        `);
      }
    }

    await logLibrarySetup(page, 'Return', 'Successful', String(id), memberId, audit);
    return { success: true, message: 'Returned...' };
  }

  return { success: false, message: 'Unknown action' };
}
