import {
  buildCategoryFilter,
  loadPayrollMonthOptions,
  loadSalarySummaryCategoryOptions,
  logPayrollPage,
} from './payrollHelpers.js';
import { buildPayrollIndividualBundleHtml } from './payrollIndividualBundleCore.js';

const PAGE = 'payroll_individual_report1.php';

export async function loadPayrollIndividualBundle(memberId, fields = {}, audit = {}) {
  const monthOptions = await loadPayrollMonthOptions();
  const payrollMonth = String(fields.payroll_month || '').trim();
  const copyType = String(fields.copy_type || 'Original Copy').trim();
  const isGenerate = fields.Submit === 'Generate';
  const selectedMonth = monthOptions.find((m) => m.value === payrollMonth) || null;

  let reportHtml = '';
  let categoryOptions = [];

  if (payrollMonth) {
    categoryOptions = await loadSalarySummaryCategoryOptions(payrollMonth);
    const categoryFilterSql = buildCategoryFilter(categoryOptions.map((c) => c.value));
    const generatedBy = selectedMonth
      ? { user: selectedMonth.generatedBy, date: selectedMonth.generatedOn }
      : null;

    if (isGenerate && categoryFilterSql) {
      reportHtml = await buildPayrollIndividualBundleHtml({
        payrollMonth,
        categoryFilterSql,
        categoryOptions,
        rowPerPage: Number(fields.row_per_page) || 27,
        copyType,
        generatedBy,
      });

      await logPayrollPage(
        PAGE,
        'Generate',
        `${payrollMonth}___${copyType}`,
        memberId,
        audit,
      );
    } else {
      await logPayrollPage(PAGE, 'View', payrollMonth, memberId, audit);
    }
  } else {
    await logPayrollPage(PAGE, 'View', '', memberId, audit);
  }

  return {
    monthOptions,
    categoryOptions,
    selected: {
      payrollMonth,
      copyType,
      rowPerPage: Number(fields.row_per_page) || 27,
    },
    generatedBy: selectedMonth
      ? { user: selectedMonth.generatedBy, date: selectedMonth.generatedOn }
      : null,
    reportHtml,
    canPrint: Boolean(reportHtml),
  };
}
