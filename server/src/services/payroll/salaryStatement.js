import {
  buildCategoryFilter,
  formatPayrollMonthLabel,
  loadAllPayrollMonthOptions,
  logPayrollPage,
} from './payrollHelpers.js';
import { loadJobCategoryOptions } from './payrollShared.js';
import { buildSalaryStatementHtml } from './payrollSalaryStatementCore.js';

const PAGE = 'salary_statement.php';

export async function loadSalaryStatement(memberId, fields = {}, audit = {}) {
  const monthOptions = await loadAllPayrollMonthOptions();
  const payrollMonth = String(fields.payroll_month || '').trim();
  const searchCategory = Array.isArray(fields.search_category)
    ? fields.search_category.map(String)
    : (fields.search_category ? [String(fields.search_category)] : []);
  const rowPerPage = Number(fields.row_per_page) || 27;
  const isGenerate = fields.Submit === 'Generate';

  let categoryOptions = [];
  const categoryLabels = [];
  if (payrollMonth) {
    categoryOptions = await loadJobCategoryOptions(payrollMonth, searchCategory);
    for (const id of searchCategory) {
      const match = categoryOptions.find((c) => c.value === id);
      if (match) categoryLabels.push(match.label);
    }
  }

  const categoryFilterSql = buildCategoryFilter(searchCategory);
  let reportHtml = '';
  let reportEmpty = false;
  let reportMessage = '';

  if (isGenerate && payrollMonth && categoryFilterSql) {
    reportHtml = await buildSalaryStatementHtml({
      payrollMonth,
      categoryFilterSql,
      categoryLabels,
      rowPerPage,
      generatedBy: null,
    });
    if (!reportHtml) {
      reportEmpty = true;
      const dept = categoryLabels.length ? categoryLabels.join(', ') : 'selected category';
      reportMessage = `No salary records found for ${dept} in ${formatPayrollMonthLabel(payrollMonth)}. `
        + 'Run Payroll → Generate Payroll for this month and category first, then return here.';
    }
    await logPayrollPage(
      PAGE,
      'Generate',
      `${payrollMonth}___${searchCategory.join(',')}___${rowPerPage}`,
      memberId,
      audit,
    );
  } else {
    await logPayrollPage(PAGE, 'View', payrollMonth, memberId, audit);
  }

  return {
    monthOptions,
    categoryOptions,
    selected: {
      payrollMonth,
      searchCategory,
      rowPerPage,
    },
    reportHtml,
    canPrint: Boolean(reportHtml),
    reportEmpty,
    reportMessage,
  };
}
