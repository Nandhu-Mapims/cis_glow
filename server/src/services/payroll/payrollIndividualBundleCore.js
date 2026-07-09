import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { buildCategoryFilter, escapeHtml, loadPrintSetup } from './payrollHelpers.js';
import { buildPayrollDbHtml } from './payrollDbCore.js';
import { buildSalaryStatementHtml } from './payrollSalaryStatementCore.js';
import { buildSalarySummaryHtml } from './payrollSalarySummaryCore.js';
import {
  buildIndividualReportHtml,
  REPORT_SIGN_SETUP,
} from './payrollReportCore.js';

const PAGE_BREAK = '<div style="width:100%; height:10px; clear:both; page-break-after:always;"></div>';

export function buildBundleSummaryFilters(categoryOptions) {
  const group1Ids = [];
  const group2Ids = [];
  for (const cat of categoryOptions) {
    const name = String(cat.label || '').toLowerCase();
    if (name.startsWith('admin') || name.startsWith('teach')) {
      group1Ids.push(cat.value);
    } else {
      group2Ids.push(cat.value);
    }
  }
  const filters = [];
  if (group1Ids.length) {
    filters.push({ title: 'Dentist', categoryFilterSql: buildCategoryFilter(group1Ids) });
  }
  if (group2Ids.length) {
    filters.push({ title: 'Hygienist, Tech & Others', categoryFilterSql: buildCategoryFilter(group2Ids) });
  }
  return filters;
}

export async function getBundleReportQueue(payrollMonth) {
  const monthSql = escapeSql(payrollMonth);
  const queue = [];

  const banks = await prisma.edu_setup_tb.findMany({
    where: { category: 'Bank', del: 1 },
    orderBy: { category_order: 'asc' },
  });
  for (const bank of banks) {
    queue.push({ reportFor: 'bank', transferRef: String(bank.id) });
  }
  queue.push({ reportFor: 'bank', transferRef: 'cheque' });

  const sums = (await prisma.$queryRawUnsafe(
    `SELECT
       SUM(rental_amount) AS rental,
       SUM(hostel_amount) AS mess,
       SUM(pf_amount) AS pf,
       SUM(esi_amount) AS esi,
       SUM(lop_amount) AS lop_amount,
       SUM(loan_amount) AS loan_amount,
       SUM(arrear_amount) AS arrear_amount,
       SUM(tds_amount) AS tds_amount,
       SUM(prof_tax) AS prof_tax,
       SUM(other_deduction) AS other_deduction,
       SUM(advance_amount) AS advance_amount,
       SUM(security_deposit) AS security_deposit,
       SUM(transport_deduction) AS transport_deduction,
       SUM(sdeposit_refund) AS sdeposit_refund
     FROM staff_payroll_tb WHERE del = 1 AND payroll_month = '${monthSql}'`,
  ))[0] || {};

  const deductions = [
    ['rental', 'rental'],
    ['mess', 'mess'],
    ['pf', 'pf'],
    ['esi', 'esi'],
    ['lop_amount', 'lop_amount'],
    ['loan_amount', 'loan_amount'],
    ['arrear_amount', 'arrear_amount'],
    ['tds_amount', 'tds_amount'],
    ['prof_tax', 'prof_tax'],
    ['other_deduction', 'other_deduction'],
    ['advance_amount', 'advance_amount'],
    ['security_deposit', 'security_deposit'],
    ['transport_deduction', 'transport_deduction'],
    ['sdeposit_refund', 'sdeposit_refund'],
  ];

  for (const [reportFor, key] of deductions) {
    if (Number(sums[key]) > 0) {
      queue.push({ reportFor });
    }
  }

  return queue;
}

async function sectionWithTitle(printId, html) {
  if (!html) return '';
  const setup = await loadPrintSetup(printId);
  const title = setup.title || setup.body_title || '';
  return `<h3>${escapeHtml(title)}</h3>${html}${PAGE_BREAK}`;
}

export async function buildPayrollIndividualBundleHtml(options) {
  const {
    payrollMonth,
    categoryFilterSql,
    categoryOptions,
    rowPerPage = 27,
    copyType = 'Original Copy',
    generatedBy,
  } = options;

  const summaryFilters = buildBundleSummaryFilters(categoryOptions);
  const reportQueue = await getBundleReportQueue(payrollMonth);

  const [payrollDbSetup, salaryStmtSetup, salarySummarySetup, payrollDbHtml, salaryStatementHtml, salarySummaryHtml] = await Promise.all([
    loadPrintSetup('1'),
    loadPrintSetup('3'),
    loadPrintSetup('4'),
    buildPayrollDbHtml(payrollMonth, categoryFilterSql),
    buildSalaryStatementHtml({
      payrollMonth,
      categoryFilterSql,
      categoryLabels: categoryOptions.map((c) => c.label),
      rowPerPage,
      generatedBy,
    }),
    summaryFilters.length
      ? buildSalarySummaryHtml({ payrollMonth, filters: summaryFilters, generatedBy })
      : Promise.resolve(''),
  ]);

  const sections = [];
  if (payrollDbHtml) {
    sections.push(`<h3>${escapeHtml(payrollDbSetup.title || 'Payroll Dashboard')}</h3>${payrollDbHtml}${PAGE_BREAK}`);
  }
  if (salaryStatementHtml) {
    sections.push(`<h3>${escapeHtml(salaryStmtSetup.title || 'Salary Statement')}</h3>${salaryStatementHtml}${PAGE_BREAK}`);
  }
  if (salarySummaryHtml) {
    sections.push(`<h3>${escapeHtml(salarySummarySetup.title || 'Salary Summary')}</h3>${salarySummaryHtml}${PAGE_BREAK}`);
  }

  const reportSections = await Promise.all(reportQueue.map(async (item) => {
    const html = await buildIndividualReportHtml({
      payrollMonth,
      categoryFilterSql,
      reportFor: item.reportFor,
      transferRef: item.transferRef || '',
      rowPerPage: ['rental', 'mess'].includes(item.reportFor) ? -1 : rowPerPage,
      copyType,
      generatedBy,
    });
    if (!html || html.includes('not yet ported')) return '';
    const signId = REPORT_SIGN_SETUP[item.reportFor] || '5';
    return sectionWithTitle(signId, html);
  }));

  sections.push(...reportSections.filter(Boolean));
  return sections.join('').replace(new RegExp(`${PAGE_BREAK}$`), '');
}
