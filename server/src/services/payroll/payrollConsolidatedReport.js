import { loadPayrollMonthOptions, logPayrollPage } from './payrollHelpers.js';
import { buildConsolidatedReportHtml, buildConsolidatedMonthRangeLabel } from './payrollConsolidatedCore.js';

const PAGE = 'payroll_consolidated_report.php';

function normalizeMonths(fields) {
  const raw = fields.payroll_month;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((m) => String(m).trim()).filter(Boolean);
}

export async function loadPayrollConsolidatedReport(memberId, fields = {}, audit = {}) {
  const monthOptions = await loadPayrollMonthOptions();
  const payrollMonths = normalizeMonths(fields);
  const isGenerate = fields.Submit === 'Generate';

  let reportHtml = '';

  if (isGenerate && payrollMonths.length) {
    reportHtml = await buildConsolidatedReportHtml(payrollMonths, { printedBy: memberId });
    await logPayrollPage(
      PAGE,
      'Generate',
      payrollMonths.join(','),
      memberId,
      audit,
    );
  } else {
    await logPayrollPage(PAGE, 'View', payrollMonths.join(','), memberId, audit);
  }

  return {
    monthOptions,
    selectedMonths: payrollMonths,
    reportHtml,
    reportMonthLabel: payrollMonths.length ? buildConsolidatedMonthRangeLabel(payrollMonths) : '',
    canPrint: Boolean(reportHtml),
  };
}
