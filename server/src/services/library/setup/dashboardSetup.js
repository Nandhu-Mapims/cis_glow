import { prisma } from '../../../config/prisma.js';
import { bookCategorySelect } from '../../../utils/legacySelects.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, formatDateDisplay, logLibrarySetup, toIsoDate } from '../setupAudit.js';

const PAGE = 'dashboard_library.php';

export async function loadLibraryDashboard(memberId, fields = {}, audit = {}) {
  const dateIso = toIsoDate(fields.date) || new Date().toISOString().slice(0, 10);

  const deptCategories = await prisma.book_category_tb.findMany({
    where: { del: 1, category: 'Department' },
    orderBy: { category_order: 'asc' },
    select: bookCategorySelect,
  });

  const departmentCounts = [];
  for (const cat of deptCategories) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS cnt FROM book_tb WHERE del = 1 AND (
        resource_department = '${escapeSql(String(cat.id))}'
        OR resource_department LIKE '${escapeSql(String(cat.id))},%'
        OR resource_department LIKE '%,${escapeSql(String(cat.id))}'
        OR resource_department LIKE '%,${escapeSql(String(cat.id))},%'
      )`,
    );
    const count = Number(rows[0]?.cnt || 0);
    if (count > 0) {
      departmentCounts.push({ id: cat.id, name: cat.category_name, count });
    }
  }

  const issuedToday = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS cnt FROM library_transaction_tb
     WHERE del = 1 AND DATE(check_out_date) = '${escapeSql(dateIso)}'`,
  );
  const returnedToday = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS cnt FROM library_transaction_tb
     WHERE del = 1 AND DATE(check_in_date) = '${escapeSql(dateIso)}' AND check_in_date != '0000-00-00 00:00:00'`,
  );
  const outstanding = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS cnt FROM library_transaction_tb
     WHERE del = 1 AND (check_in_date = '0000-00-00 00:00:00' OR check_in_date IS NULL)`,
  );

  const attRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(DISTINCT tktno) AS visitors FROM library_attendance
     WHERE DATE(p_date) = '${escapeSql(dateIso)}'`,
  );

  await logLibrarySetup(PAGE, 'View', 'Successful', dateIso, memberId, audit);
  return {
    date: dateIso,
    dateDisplay: formatDateDisplay(dateIso),
    departmentCounts,
    stats: {
      issuedToday: Number(issuedToday[0]?.cnt || 0),
      returnedToday: Number(returnedToday[0]?.cnt || 0),
      outstanding: Number(outstanding[0]?.cnt || 0),
      visitors: Number(attRows[0]?.visitors || 0),
    },
  };
}

export async function saveLibraryDashboard(_payload, memberId, audit = {}) {
  return loadLibraryDashboard(memberId, _payload, audit);
}
