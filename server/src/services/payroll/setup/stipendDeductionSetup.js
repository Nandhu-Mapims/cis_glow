import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logPayrollSetup } from './setupAudit.js';
import { parsePayrollMonthRef } from '../payrollShared.js';
import {
  loadStipendCategoryOptions,
  loadStipendOpenPayrollMonthOptions,
  loadStipendStudentsGrid,
  studentDisplayName,
} from '../stipendHelpers.js';

const PAGE = 'stipend_deduction_add.php';

async function loadExistingDeductions(payrollMonthSql, staffIds) {
  if (!staffIds.length) return {};
  const idList = staffIds.map((id) => `'${escapeSql(String(id))}'`).join(',');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id, d_amount, d_reason
     FROM stipend_deductions
     WHERE del = 1 AND salary_month = '${escapeSql(payrollMonthSql)}'
       AND staff_id IN (${idList})`,
  );
  const map = {};
  for (const row of rows) {
    map[String(row.staff_id)] = row;
  }
  return map;
}

export async function loadStipendDeductionSetup(fields = {}, memberId, audit = {}) {
  const monthOptions = await loadStipendOpenPayrollMonthOptions();
  const payrollMonthRaw = String(fields.payroll_month || '').trim();
  const payrollMonthSql = parsePayrollMonthRef(payrollMonthRaw)
    || monthOptions.find((m) => m.value === payrollMonthRaw)?.monthSql
    || String(fields.salary_month || '').trim();

  const searchCategory = String(
    Array.isArray(fields.search_category)
      ? fields.search_category[0]
      : (fields.search_category || ''),
  ).trim();

  const categoryOptions = await loadStipendCategoryOptions(searchCategory);
  const isGenerate = fields.Submit === 'Generate';
  let rows = [];

  if (isGenerate && payrollMonthSql && searchCategory) {
    const students = await loadStipendStudentsGrid(searchCategory, payrollMonthSql);
    const existing = await loadExistingDeductions(payrollMonthSql, students.map((s) => s.id));
    rows = students.map((student, idx) => {
      const ex = existing[String(student.id)] || {};
      return {
        index: idx + 1,
        staffId: String(student.id),
        staffCode: student.register_no,
        name: studentDisplayName(student),
        rowId: ex.id ? String(ex.id) : '',
        amount: ex.d_amount ?? '',
        reason: ex.d_reason ?? '',
      };
    });
  }

  await logPayrollSetup(
    PAGE,
    isGenerate ? 'Generate' : 'View',
    'Successful',
    `${searchCategory}__${payrollMonthSql}`,
    memberId,
    audit,
  );

  return {
    monthOptions,
    categoryOptions,
    selected: { payrollMonth: payrollMonthRaw, payrollMonthSql, searchCategory },
    rows,
    canSubmit: rows.length > 0,
  };
}

export async function saveStipendDeductionSetup(fields, memberId, audit = {}) {
  if (fields.Submit !== 'Submit') {
    return loadStipendDeductionSetup(fields, memberId, audit);
  }

  const payrollMonthRaw = String(fields.payroll_month || '').trim();
  const payrollMonthSql = parsePayrollMonthRef(String(fields.salary_month || ''))
    || parsePayrollMonthRef(payrollMonthRaw)
    || String(fields.salary_month || '').trim();
  const staffIds = Array.isArray(fields.staff_id) ? fields.staff_id : [];
  const amounts = Array.isArray(fields.d_amount) ? fields.d_amount : [];
  const reasons = Array.isArray(fields.d_reason) ? fields.d_reason : [];
  const rowIds = Array.isArray(fields.tds_id) ? fields.tds_id : [];
  const { create, update } = auditFields(memberId, audit);

  for (let i = 0; i < staffIds.length; i++) {
    const amount = String(amounts[i] || '').trim();
    if (!amount) continue;
    const staffId = String(staffIds[i] || '').trim();
    const reason = String(reasons[i] || '').trim();
    const rowId = rowIds[i];

    if (!rowId) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO stipend_deductions
         (salary_month, staff_id, d_amount, d_reason, created_dt, created_ip, created_by,
          updated_dt, updated_ip, updated_by, del)
         VALUES ('${escapeSql(payrollMonthSql)}', '${escapeSql(staffId)}', '${escapeSql(amount)}',
          '${escapeSql(reason)}', NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
          NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1)`,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE stipend_deductions SET
         salary_month = '${escapeSql(payrollMonthSql)}',
         staff_id = '${escapeSql(staffId)}',
         d_amount = '${escapeSql(amount)}',
         d_reason = '${escapeSql(reason)}',
         del = 1,
         updated_by = '${escapeSql(memberId)}',
         updated_ip = '${escapeSql(update.updated_ip)}',
         updated_dt = NOW()
         WHERE id = ${Number(rowId)}`,
      );
    }
  }

  await logPayrollSetup(PAGE, 'Update', 'Successful', payrollMonthSql, memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadStipendDeductionSetup(
      {
        payroll_month: payrollMonthRaw,
        search_category: fields.search_category,
        Submit: 'Generate',
      },
      memberId,
      { ...audit, skipLog: true },
    )),
  };
}
