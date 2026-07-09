import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logLibrarySetup } from '../setupAudit.js';

const PAGE = 'supplier_add.php';

export async function loadSupplierAddSetup(memberId, _fields = {}, audit = {}) {
  await logLibrarySetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return {};
}

export async function saveSupplierAddSetup(payload, memberId, audit = {}) {
  const supplierName = String(payload.supplierName || '').trim();
  if (!supplierName) return { success: false, message: 'Supplier Name is required' };

  const { create } = auditFields(memberId, audit);
  await prisma.$executeRawUnsafe(`
    INSERT INTO book_supplier (
      supplier_name, contact_person, contact_no, address,
      created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del
    ) VALUES (
      '${escapeSql(supplierName)}',
      '${escapeSql(String(payload.contactName || ''))}',
      '${escapeSql(String(payload.contactNo || ''))}',
      '${escapeSql(String(payload.address || ''))}',
      NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
      NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1
    )
  `);

  await logLibrarySetup(PAGE, 'Add', 'Successful', supplierName, memberId, audit);
  return { success: true, message: 'Your details are added...', ...(await loadSupplierAddSetup(memberId, {}, { ...audit, skipLog: true })) };
}
