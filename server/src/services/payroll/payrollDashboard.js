import {
  buildCategoryFilter,
  loadCategoriesForMonth,
  loadPayrollMonthOptions,
  logPayrollPage,
} from './payrollHelpers.js';
import { buildDashboardReportHtml } from './payrollReportCore.js';

const PAGE = 'payroll_dashboard.php';

export async function loadPayrollDashboard(memberId, fields = {}, audit = {}) {
  const monthOptions = await loadPayrollMonthOptions();
  const payrollMonth = String(fields.payroll_month || '').trim();
  const selectedMonth = monthOptions.find((m) => m.value === payrollMonth) || null;

  let categoryOptions = [];
  let categoryFilterSql = '';
  let reportHtml = '';
  let generatedBy = null;

  if (payrollMonth) {
    categoryOptions = await loadCategoriesForMonth(payrollMonth);
    const autoCategories = await loadCategoriesForMonth(payrollMonth);
    categoryFilterSql = buildCategoryFilter(autoCategories.map((c) => c.value));

    if (selectedMonth) {
      generatedBy = {
        user: selectedMonth.generatedBy,
        date: selectedMonth.generatedOn,
      };
    }

    if (categoryFilterSql) {
      reportHtml = await buildDashboardReportHtml(payrollMonth, categoryFilterSql, generatedBy);
    }

    const operation = fields.Submit === 'Generate' ? 'Generate' : 'View';
    await logPayrollPage(
      PAGE,
      operation,
      `${payrollMonth}___${categoryOptions.map((c) => c.value).join(',')}`,
      memberId,
      audit,
    );
  } else {
    await logPayrollPage(PAGE, 'View', '', memberId, audit);
  }

  return {
    monthOptions,
    selectedMonth: payrollMonth,
    categoryOptions,
    generatedBy,
    canPrint: Boolean(reportHtml),
    reportHtml,
  };
}
