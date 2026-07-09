import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId, parseOptionalId } from '../../../utils/sqlSafe.js';
import { auditFields, logLibrarySetup } from '../setupAudit.js';

const PAGE = 'supplier_edit.php';
const PAGE_SIZE = 20;

export async function loadSupplierEditSetup(memberId, fields = {}, audit = {}) {
  const editId = parseOptionalId(fields.id);

  if (editId) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, supplier_name, contact_person, contact_no, address
      FROM book_supplier WHERE del = 1 AND id = ${editId} LIMIT 1
    `);
    const row = rows[0];
    if (!row) return { error: 'Supplier not found' };
    await logLibrarySetup(PAGE, 'View', 'Successful', String(editId), memberId, audit);
    return {
      mode: 'edit',
      supplier: {
        id: Number(row.id),
        supplierName: row.supplier_name || '',
        contactName: row.contact_person || '',
        contactNo: row.contact_no || '',
        address: row.address || '',
      },
      listContext: { search: fields.search || '', page: Number(fields.page) || 1 },
    };
  }

  const search = escapeSql(String(fields.search || '').trim());
  const page = Math.max(1, Number(fields.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  let where = 'del = 1';
  if (search) where += ` AND (supplier_name LIKE '%${search}%' OR contact_person LIKE '%${search}%' OR contact_no LIKE '%${search}%')`;

  const [countRows, listRows] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT COUNT(*) AS cnt FROM book_supplier WHERE ${where}`),
    prisma.$queryRawUnsafe(`
      SELECT id, supplier_name, contact_person, contact_no, address
      FROM book_supplier WHERE ${where}
      ORDER BY supplier_name ASC LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `),
  ]);

  const total = Number(countRows[0]?.cnt || 0);
  await logLibrarySetup(PAGE, 'View', 'Successful', search, memberId, audit);
  return {
    mode: 'list',
    search: fields.search || '',
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows: listRows.map((row) => ({
      id: Number(row.id),
      supplierName: row.supplier_name || '',
      contactName: row.contact_person || '',
      contactNo: row.contact_no || '',
      address: row.address || '',
    })),
  };
}

export async function saveSupplierEditSetup(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);

  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    await prisma.$executeRawUnsafe(`
      UPDATE book_supplier SET del = 0,
        updated_dt = NOW(), updated_ip = '${escapeSql(update.updated_ip)}',
        updated_by = '${escapeSql(memberId)}'
      WHERE id = ${id}
    `);
    await logLibrarySetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
    return {
      success: true,
      message: 'Your details are deleted...',
      ...(await loadSupplierEditSetup(memberId, { search: payload.search, page: payload.page }, { ...audit, skipLog: true })),
    };
  }

  const id = parseId(payload.id);
  await prisma.$executeRawUnsafe(`
    UPDATE book_supplier SET
      supplier_name = '${escapeSql(String(payload.supplierName || ''))}',
      contact_person = '${escapeSql(String(payload.contactName || ''))}',
      contact_no = '${escapeSql(String(payload.contactNo || ''))}',
      address = '${escapeSql(String(payload.address || ''))}',
      updated_dt = NOW(),
      updated_ip = '${escapeSql(update.updated_ip)}',
      updated_by = '${escapeSql(memberId)}'
    WHERE id = ${id}
  `);

  await logLibrarySetup(PAGE, 'Update', 'Successful', String(id), memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadSupplierEditSetup(memberId, { id, search: payload.search, page: payload.page }, { ...audit, skipLog: true })),
  };
}
