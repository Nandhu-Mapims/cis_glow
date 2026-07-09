import { prisma } from '../../../config/prisma.js';
import { formatPayrollMonthLabel } from '../payrollHelpers.js';
import { auditFields, logPayrollSetup } from './setupAudit.js';
const PAGE = 'payroll_close.php';

export async function loadPayrollCloseSetup(fields = {}, memberId, audit = {}) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, payroll_month, payroll_complete
     FROM staff_payroll_log
     WHERE del = 1 AND payroll_type = 'Salary'
     ORDER BY payroll_month DESC`,
  );

  const selectedId = String(fields.payroll_month || '');
  const selected = rows.find((r) => String(r.id) === selectedId) || null;

  await logPayrollSetup(PAGE, 'View', 'Successful', selectedId, memberId, audit);

  return {
    monthOptions: rows.map((row) => ({
      value: String(row.id),
      label: formatPayrollMonthLabel(row.payroll_month),
      payrollComplete: Number(row.payroll_complete) === 1,
    })),
    selectedId,
    payrollComplete: selected ? Number(selected.payroll_complete) === 1 : false,
  };
}

export async function savePayrollCloseSetup(fields, memberId, audit = {}) {
  if (fields.Submit !== 'Update') {
    return loadPayrollCloseSetup(fields, memberId, audit);
  }

  const rowId = Number(fields.payroll_month);
  const payrollComplete = String(fields.payroll_complete || '0');
  if (!rowId) return { success: false, message: 'Please select a month' };

  const { update } = auditFields(memberId, audit);
  await prisma.staff_payroll_log.update({
    where: { id: rowId },
    data: {
      payroll_complete: Number(payrollComplete),
      ...update,
    },
  });

  await logPayrollSetup(PAGE, 'Close', 'Successful', String(rowId), memberId, audit);
  return {
    success: true,
    message: 'Payroll status updated.',
    selectedId: String(rowId),
    payrollComplete: Number(payrollComplete) === 1,
  };
}
