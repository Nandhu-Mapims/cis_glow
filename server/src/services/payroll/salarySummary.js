import {
  buildCategoryFilter,
  loadPayrollMonthOptions,
  loadSalarySummaryCategoryOptions,
  logPayrollPage,
} from './payrollHelpers.js';
import { buildSalarySummaryHtml } from './payrollSalarySummaryCore.js';

const PAGE = 'salary_summary.php';

export async function loadSalarySummary(memberId, fields = {}, audit = {}) {
  const payrollMonth = String(fields.payroll_month || '').trim();
  const searchCategory1 = Array.isArray(fields.search_category_1)
    ? fields.search_category_1.map(String)
    : (fields.search_category_1 ? [String(fields.search_category_1)] : []);
  const searchCategory2 = Array.isArray(fields.search_category_2)
    ? fields.search_category_2.map(String)
    : (fields.search_category_2 ? [String(fields.search_category_2)] : []);
  const categoryTitle1 = String(fields.category_title_1 || '').trim();
  const categoryTitle2 = String(fields.category_title_2 || '').trim();
  const isGenerate = fields.Submit === 'Generate';

  const [monthOptions, categoryOptions] = await Promise.all([
    loadPayrollMonthOptions(),
    payrollMonth ? loadSalarySummaryCategoryOptions(payrollMonth) : Promise.resolve([]),
  ]);

  const filters = [];
  if (searchCategory1.length) {
    filters.push({
      title: categoryTitle1 || 'Category 1',
      categoryFilterSql: buildCategoryFilter(searchCategory1),
    });
  }
  if (searchCategory2.length) {
    filters.push({
      title: categoryTitle2 || 'Category 2',
      categoryFilterSql: buildCategoryFilter(searchCategory2),
    });
  }

  const selectedMonth = monthOptions.find((m) => m.value === payrollMonth) || null;
  let reportHtml = '';

  if (isGenerate && payrollMonth && filters.length) {
    reportHtml = await buildSalarySummaryHtml({
      payrollMonth,
      filters,
      generatedBy: selectedMonth
        ? { user: selectedMonth.generatedBy, date: selectedMonth.generatedOn }
        : null,
    });
    await logPayrollPage(
      PAGE,
      'Generate',
      `${payrollMonth}___${searchCategory1.join(',')}___${searchCategory2.join(',')}`,
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
      searchCategory1,
      searchCategory2,
      categoryTitle1,
      categoryTitle2,
    },
    generatedBy: selectedMonth
      ? { user: selectedMonth.generatedBy, date: selectedMonth.generatedOn }
      : null,
    reportHtml,
    canPrint: Boolean(reportHtml),
  };
}
