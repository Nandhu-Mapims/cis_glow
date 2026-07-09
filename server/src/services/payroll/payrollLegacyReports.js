import {
  buildCategoryFilter,
  loadPayrollMonthOptions,
  logPayrollPage,
} from './payrollHelpers.js';
import { loadJobCategoryOptions } from './payrollShared.js';
import { buildGroupReportHtml } from './payrollGroupReportCore.js';
import { loadReportTypeOptions } from './payrollReportCore.js';
import { loadStipendAttReport, runStipendAttReportMore } from './stipendAttReportCore.js';
import { loadStipendGeneratePayroll, runStipendGeneratePayrollMore } from './stipendGenerateCore.js';
import { loadStipendReport } from './stipendReportsCore.js';

const REPORT_LOADERS = {
  'group-report': {
    page: 'payroll_group_report.php',
    loader: loadGroupReport,
  },
  'stipend-report': {
    page: 'stipend_payroll_report.php',
    loader: (memberId, fields, audit) => loadStipendReport('stipend-report', memberId, fields, audit),
  },
  'stipend-statement': {
    page: 'stipend_salary_statement.php',
    loader: (memberId, fields, audit) => loadStipendReport('stipend-statement', memberId, fields, audit),
  },
  'stipend-individual-report': {
    page: 'stipend_payroll_individual_report1.php',
    loader: (memberId, fields, audit) => loadStipendReport('stipend-individual-report', memberId, fields, audit),
  },
};

export function assertPayrollLegacyReport(reportKey) {
  if (!REPORT_LOADERS[reportKey]) {
    return { error: 'Unknown payroll report' };
  }
  return null;
}

async function loadGroupReport(memberId, fields = {}, audit = {}) {
  const payrollMonths = (Array.isArray(fields.payroll_month) ? fields.payroll_month : [fields.payroll_month])
    .map((m) => String(m || '').trim())
    .filter(Boolean);
  const searchCategory = Array.isArray(fields.search_category)
    ? fields.search_category.map(String)
    : (fields.search_category ? [String(fields.search_category)] : []);
  const reportForRaw = String(fields.report_for || '').trim();
  const isGenerate = fields.Submit === 'Generate';

  const monthOptions = await loadPayrollMonthOptions();
  const categoryMonth = payrollMonths[0] || monthOptions[0]?.value || '';
  const [categoryOptions, reportTypeOptions] = await Promise.all([
    categoryMonth ? loadJobCategoryOptions(categoryMonth) : Promise.resolve([]),
    categoryMonth ? loadReportTypeOptions(categoryMonth) : Promise.resolve([]),
  ]);

  const categoryFilterSql = buildCategoryFilter(searchCategory);
  let reportHtml = '';
  if (isGenerate && payrollMonths.length && categoryFilterSql && reportForRaw) {
    reportHtml = await buildGroupReportHtml({
      payrollMonths,
      categoryFilterSql,
      reportForRaw,
    });
    await logPayrollPage(
      'payroll_group_report.php',
      'Generate',
      `${payrollMonths.join(',')}___${searchCategory.join(',')}___${reportForRaw}`,
      memberId,
      audit,
    );
  } else {
    await logPayrollPage('payroll_group_report.php', 'View', payrollMonths.join(','), memberId, audit);
  }

  return {
    monthOptions,
    categoryOptions,
    reportTypeOptions,
    selected: {
      payrollMonths,
      searchCategory,
      reportFor: reportForRaw,
    },
    reportHtml,
    canPrint: Boolean(reportHtml),
  };
}

export function loadPayrollLegacyReport(reportKey, memberId, fields = {}, audit = {}) {
  const invalid = assertPayrollLegacyReport(reportKey);
  if (invalid) return Promise.resolve(invalid);
  return REPORT_LOADERS[reportKey].loader(memberId, fields, audit);
}

export { loadStipendGeneratePayroll, runStipendGeneratePayrollMore, loadStipendAttReport, runStipendAttReportMore };
