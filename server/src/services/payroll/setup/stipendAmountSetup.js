import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logPayrollSetup } from './setupAudit.js';

const PAGE = 'stipend_amount_setup.php';

const COURSE_TYPES = ['U.G', 'P.G-I Year', 'P.G-II Year', 'P.G-III Year'];

async function findStipendAmountRecord(courseType) {
  if (!courseType) return null;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, stipend_amount FROM stipend_amount_setup_tb
     WHERE del = 1 AND course_type = '${escapeSql(courseType)}'
     ORDER BY id ASC LIMIT 1`,
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    stipendAmount: row.stipend_amount != null ? String(row.stipend_amount) : '',
  };
}

export async function loadStipendAmountSetup(fields = {}, memberId, audit = {}) {
  const courseType = String(fields.course_type || '');
  const record = await findStipendAmountRecord(courseType);

  await logPayrollSetup(PAGE, 'View', 'Successful', courseType, memberId, audit);
  return {
    courseTypeOptions: COURSE_TYPES.map((value) => ({ value, label: value })),
    selectedCourseType: courseType,
    record: record || { id: null, stipendAmount: '' },
  };
}

export async function saveStipendAmountSetup(fields, memberId, audit = {}) {
  if (fields.Submit !== 'Update') {
    return loadStipendAmountSetup(fields, memberId, audit);
  }

  const courseType = String(fields.course_type || '').trim();
  const amount = String(fields.leave_apply || fields.stipend_amount || '').trim();
  const rowId = fields.r_id ? Number(fields.r_id) : null;

  if (!courseType || !amount) {
    return { success: false, message: 'Please fill all required fields' };
  }

  const { create, update } = auditFields(memberId, audit);
  let existingId = rowId;
  if (!existingId) {
    const existing = await findStipendAmountRecord(courseType);
    existingId = existing?.id || null;
  }

  if (!existingId) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO stipend_amount_setup_tb
       (course_type, stipend_amount, created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del)
       VALUES ('${escapeSql(courseType)}', '${escapeSql(amount)}', NOW(),
        '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', NOW(),
        '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1)`,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE stipend_amount_setup_tb SET
       course_type = '${escapeSql(courseType)}',
       stipend_amount = '${escapeSql(amount)}',
       updated_by = '${escapeSql(memberId)}',
       updated_ip = '${escapeSql(update.updated_ip)}',
       updated_dt = NOW()
       WHERE id = ${Number(existingId)}`,
    );
  }

  await logPayrollSetup(PAGE, 'Update', 'Successful', courseType, memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadStipendAmountSetup({ course_type: courseType }, memberId, { ...audit, skipLog: true })),
  };
}
