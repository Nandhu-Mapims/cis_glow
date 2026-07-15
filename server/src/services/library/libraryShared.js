import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';

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
