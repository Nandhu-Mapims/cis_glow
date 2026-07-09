import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import {
  appendPayrollReportSignature,
  escapeHtml,
  formatIndianMoney,
  formatPayrollMonthLabel,
  loadPrintSetup,
  logPayrollPage,
} from './payrollHelpers.js';
import { normalizeReportFor, parseBankTransferRef } from './payrollReportCore.js';
import { parsePayrollMonthRef } from './payrollShared.js';
import {
  buildStipendCourseFilterSql,
  loadStipendCategoryOptions,
  loadStipendCategoryOptionsForMonth,
  loadStipendPayrollMonthOptions,
  studentDisplayName,
} from './stipendHelpers.js';

const STIPEND_SIGN_SETUP = {
  bank: '5',
  rental: '6',
  mess: '7',
  pf: '8',
  esi: '9',
  lop_amount: '10',
  lop_detail: '19',
  arrear_amount: '11',
  loan_amount: '12',
  other_deduction: '14',
  tds_amount: '13',
  prof_tax: '15',
  advance_amount: '18',
  gross_pay: '195',
};

const STIPEND_STATEMENT_PRINT_ID = '196';

function resolveStipendSignSetupId(reportFor) {
  return STIPEND_SIGN_SETUP[reportFor] || STIPEND_SIGN_SETUP.bank;
}

export async function appendStipendReportSignature(html, reportKey, reportFor) {
  if (!html) return html;
  const printId = reportKey === 'stipend-statement'
    ? STIPEND_STATEMENT_PRINT_ID
    : resolveStipendSignSetupId(reportFor);
  const printSetup = await loadPrintSetup(printId);
  return appendPayrollReportSignature(html, printSetup);
}

const STIPEND_PAY_COLUMN = {
  bank: 'net_pay',
  rental: 'rental_amount',
  mess: 'hostel_amount',
  pf: 'pf_amount',
  esi: 'esi_amount',
  lop_amount: 'lop_amount',
  lop_detail: 'lop_amount',
  arrear_amount: 'arrear_amount',
  loan_amount: 'loan_amount',
  other_deduction: 'other_deduction',
  tds_amount: 'tds_amount',
  prof_tax: 'prof_tax',
  advance_amount: 'advance_amount',
  gross_pay: 'gross_pay',
};

function buildSimpleStipendReportHtml(rows, reportFor, transferRef) {
  const column = STIPEND_PAY_COLUMN[reportFor] || 'net_pay';
  let bankFilter = () => true;
  if (reportFor === 'bank' && transferRef) {
    bankFilter = transferRef === 'cheque'
      ? (r) => r.pay_type === 'Cheque'
      : (r) => r.pay_type !== 'Cheque' && String(r.pay_bank) === String(transferRef);
  }

  let body = `<table class="table-bordered" cellpadding="3" cellspacing="0">
<thead><tr bgcolor="#e7e7e7">
<th>#</th><th>Reg No</th><th>Name</th><th>Amount (Rs)</th>
</tr></thead><tbody>`;

  let total = 0;
  let idx = 0;
  for (const row of rows) {
    if (!bankFilter(row)) continue;
    const amount = Number(row[column]) || 0;
    if (amount <= 0 && reportFor !== 'bank') continue;
    if (reportFor === 'bank' && amount <= 0) continue;
    idx += 1;
    total += amount;
    body += `<tr>
<td>${idx}</td>
<td>${escapeHtml(row.register_no)}</td>
<td nowrap>${escapeHtml(studentDisplayName(row))}</td>
<td class="text-right">${formatIndianMoney(amount)}</td>
</tr>`;
  }

  body += `</tbody><tfoot><tr bgcolor="#f4f4f4">
<td colspan="3" class="text-right"><strong>Total</strong></td>
<td class="text-right"><strong>${formatIndianMoney(total)}</strong></td>
</tr></tfoot></table>`;
  return body;
}

/** Legacy stipend_salary_statement.php — JOIN academic + payroll for each category. */
async function loadStipendStatementRows(categories, payrollMonthSql) {
  const monthSql = escapeSql(payrollMonthSql);
  const allRows = [];

  for (const course of categories) {
    const parts = String(course).split('_');
    const courseName = parts[0];
    const currentYear = parts[1];
    const acYear = parts[2];
    if (!courseName || !currentYear || !acYear) continue;

    const courseIdSql = await buildStipendCourseFilterSql(courseName);
    const rows = await prisma.$queryRawUnsafe(
      `SELECT C.*, A.register_no, B.student_title, B.student_name, B.student_initial
       FROM student_academic_tb AS A
       INNER JOIN student_profile_tb AS B ON A.register_no = B.register_no AND B.del = 1
       INNER JOIN stipend_payroll_tb AS C ON B.id = C.staff_id AND C.del = 1
       WHERE A.del = 1
         AND A.academic_year = '${escapeSql(acYear)}'
         AND A.current_year = '${escapeSql(currentYear)}'
         ${courseIdSql}
         AND (CAST(B.releaving_date AS CHAR) = '0000-00-00' OR B.releaving_date > '${monthSql}')
         AND C.payroll_month = '${monthSql}'
       ORDER BY A.register_no ASC`,
    );
    allRows.push(...rows);
  }

  return allRows;
}

const STIPEND_REPORT_SUM_COLUMNS = {
  rental: 'rental_amount',
  mess: 'hostel_amount',
  pf: 'pf_amount',
  esi: 'esi_amount',
  lop_amount: 'lop_amount',
  lop_detail: 'lop_amount',
  arrear_amount: 'arrear_amount',
  loan_amount: 'loan_amount',
  tds_amount: 'tds_amount',
  prof_tax: 'prof_tax',
  other_deduction: 'other_deduction',
  advance_amount: 'advance_amount',
  gross_pay: 'gross_pay',
};

async function loadStipendReportTypeOptions(payrollMonthSql) {
  const monthSql = escapeSql(payrollMonthSql || '');
  if (!monthSql || monthSql.startsWith('0000')) return [];

  const sums = await prisma.$queryRawUnsafe(
    `SELECT
       SUM(rental_amount) AS rental_amount,
       SUM(hostel_amount) AS hostel_amount,
       SUM(pf_amount) AS pf_amount,
       SUM(esi_amount) AS esi_amount,
       SUM(lop_amount) AS lop_amount,
       SUM(arrear_amount) AS arrear_amount,
       SUM(loan_amount) AS loan_amount,
       SUM(tds_amount) AS tds_amount,
       SUM(prof_tax) AS prof_tax,
       SUM(other_deduction) AS other_deduction,
       SUM(advance_amount) AS advance_amount,
       SUM(gross_pay) AS gross_pay,
       SUM(net_pay) AS net_pay
     FROM stipend_payroll_tb
     WHERE del = 1 AND payroll_month = '${monthSql}'`,
  );
  const s = sums[0] || {};

  const banks = await prisma.$queryRawUnsafe(
    `SELECT id, category_name, category_sname
     FROM edu_setup_tb
     WHERE category = 'Bank' AND del = 1
     ORDER BY category_order ASC`,
  );

  const options = [];
  for (const bank of banks) {
    options.push({
      value: `bank_${bank.id}`,
      label: `${bank.category_sname || bank.category_name} Transfer`,
      group: 'Bank Transfer',
    });
  }
  options.push({ value: 'bank_cheque', label: 'Cheque Payment', group: 'Bank Transfer' });

  const deductions = [
    ['rental', 'Rental'],
    ['mess', 'Mess'],
    ['pf', 'PF'],
    ['esi', 'ESI'],
    ['lop_amount', 'LOP'],
    ['lop_detail', 'LOP Detail'],
    ['arrear_amount', 'Arrear'],
    ['loan_amount', 'Loan'],
    ['tds_amount', 'TDS'],
    ['prof_tax', 'Professional Tax'],
    ['other_deduction', 'Other Deduction'],
    ['advance_amount', 'Advance'],
    ['gross_pay', 'Gross Pay'],
  ];

  for (const [key, label] of deductions) {
    const col = STIPEND_REPORT_SUM_COLUMNS[key] || key;
    const amount = Number(s[col]) || 0;
    if (amount > 0 || ['lop_amount', 'other_deduction', 'gross_pay'].includes(key)) {
      options.push({ value: key, label, group: 'Deductions & Pay' });
    }
  }

  return options.length ? options : [
    { value: 'bank_cheque', label: 'Cheque Payment', group: 'Bank Transfer' },
    { value: 'gross_pay', label: 'Gross Pay', group: 'Deductions & Pay' },
  ];
}

function reportTypeLabel(options, reportForRaw) {
  const match = options.find((opt) => opt.value === reportForRaw);
  if (match) return match.label;
  const normalized = normalizeReportFor(reportForRaw);
  if (normalized === 'bank') return 'Bank Transfer';
  return normalized.replace(/_/g, ' ');
}

function buildStatementFooterRow(totals, title) {
  return `<tr>
<th height="35" class="text-right" colspan="3">${escapeHtml(title)}</th>
<th class="text-right">${formatIndianMoney(totals.basic)}</th>
<th class="text-right">${formatIndianMoney(totals.total)}</th>
<th class="text-right cls_lop_amount">${formatIndianMoney(totals.lop)}</th>
<th class="text-right cls_gross_pay" bgcolor="#F4F4F4">${formatIndianMoney(totals.gross)}</th>
<th class="text-right cls_other_deduction">${formatIndianMoney(totals.other)}</th>
<th class="text-right cls_tot_deduction" bgcolor="#F4F4F4">${formatIndianMoney(totals.deduction)}</th>
<th class="text-right" bgcolor="#EEEEEE">${formatIndianMoney(totals.net)}</th>
</tr>`;
}

function accumulateStatementTotals(totals, row) {
  const basic = Number(row.basic_pay) || 0;
  const total = Number(row.total_amount) || 0;
  const lop = Number(row.lop_amount) || 0;
  const gross = Number(row.gross_pay) || 0;
  const other = Number(row.other_deduction) || 0;
  const deduction = Number(row.total_deduction) || 0;
  const net = Number(row.net_pay) || 0;
  totals.basic += basic;
  totals.total += total;
  totals.lop += lop;
  totals.gross += gross;
  totals.other += other;
  totals.deduction += deduction;
  totals.net += net;
  return { basic, total, lop, gross, other, deduction, net };
}

function newStatementTotals() {
  return { basic: 0, total: 0, lop: 0, gross: 0, other: 0, deduction: 0, net: 0 };
}

export function buildStipendStatementHtml(rows, options = {}) {
  const bodyTitle = String(options.bodyTitle || '').trim();
  const negativeNet = [];

  let body = bodyTitle ? `<p class="header1">${escapeHtml(bodyTitle)} &nbsp;</p>` : '';
  body += `<table class="table-bordered" cellpadding="5" cellspacing="0" width="100%">
<thead><tr bgcolor="#e7e7e7">
<th width="20" height="35">#</th>
<th width="60">Register No</th>
<th width="200">Student Name</th>
<th width="50" align="center" class="cls_total_amount">Stipend</th>
<th width="50" align="center" class="cls_total_amount">Total</th>
<th width="50" align="center" class="cls_total_amount">LOP</th>
<th width="50" align="center" class="cls_total_amount">Gross Pay</th>
<th width="50" align="center" class="cls_lop_amount">Other Deductions</th>
<th width="50" align="center" class="cls_lop_amount">T.Deductions</th>
<th width="50" align="center" class="cls_lop_amount">Net Pay</th>
</tr></thead><tbody>`;

  const grandTotals = newStatementTotals();

  if (!rows.length) {
    body += `<tr><td colspan="10" class="text-center payroll-report-empty">No stipend payroll records for the selected month and category. Generate stipend payroll for this month first, or choose the category listed for that month in payroll log.</td></tr>`;
  }

  rows.forEach((row, idx) => {
    const amounts = accumulateStatementTotals(grandTotals, row);
    const rowBg = amounts.net <= 0 ? ' bgcolor="#F97A70"' : '';
    if (amounts.net <= 0) {
      negativeNet.push(`${row.register_no} - ${studentDisplayName(row)}`);
    }

    body += `<tr${rowBg}>
<td height="25">${idx + 1}</td>
<td>${escapeHtml(row.register_no)}</td>
<td nowrap class="staff_name">${escapeHtml(studentDisplayName(row))}</td>
<td class="text-right">${formatIndianMoney(amounts.basic)}</td>
<td class="text-right">${formatIndianMoney(amounts.total)}</td>
<td class="text-right">${formatIndianMoney(amounts.lop)}</td>
<td class="text-right">${formatIndianMoney(amounts.gross)}</td>
<td class="text-right">${formatIndianMoney(amounts.other)}</td>
<td class="text-right">${formatIndianMoney(amounts.deduction)}</td>
<td class="text-right">${formatIndianMoney(amounts.net)}</td>
</tr>`;
  });

  body += `</tbody><tfoot>${buildStatementFooterRow(grandTotals, 'Grand Total')}</tfoot></table>`;

  if (negativeNet.length) {
    body += `<p><strong>Negative Net Pay:</strong> ${escapeHtml(negativeNet.join(', '))}</p>`;
  }

  return body;
}

export async function loadStipendReport(reportKey, memberId, fields = {}, audit = {}) {
  const pageMap = {
    'stipend-report': 'stipend_payroll_report.php',
    'stipend-statement': 'stipend_salary_statement.php',
    'stipend-individual-report': 'stipend_payroll_individual_report1.php',
  };
  const page = pageMap[reportKey] || reportKey;

  const monthOptions = await loadStipendPayrollMonthOptions(false);
  const payrollMonthRaw = String(fields.payroll_month || '').trim();
  const payrollMonthSql = parsePayrollMonthRef(payrollMonthRaw) || payrollMonthRaw;
  const searchCategory = Array.isArray(fields.search_category)
    ? fields.search_category.map(String)
    : (fields.search_category ? [String(fields.search_category)] : []);
  const reportForRaw = String(fields.report_for || '').trim();
  const copyType = String(fields.copy_type || 'Original Copy').trim();
  const rowPerPage = Number(fields.row_per_page) || 27;
  const isGenerate = fields.Submit === 'Generate';

  const categoryOptions = (reportKey === 'stipend-statement' || reportKey === 'stipend-report')
    ? await loadStipendCategoryOptionsForMonth(payrollMonthSql, searchCategory)
    : (reportKey === 'stipend-individual-report'
      ? []
      : await loadStipendCategoryOptions(searchCategory));
  const reportTypeOptions = reportKey === 'stipend-report' && payrollMonthSql
    ? await loadStipendReportTypeOptions(payrollMonthSql)
    : [];
  const selectedMonth = monthOptions.find((m) => m.value === payrollMonthRaw) || null;

  let reportHtml = '';
  let printMeta = null;
  let bannerUrl = '';
  let reportEmpty = false;

  if (isGenerate && payrollMonthSql) {
    if (reportKey === 'stipend-individual-report') {
      const { buildStipendIndividualBundleHtml } = await import('./stipendIndividualBundleCore.js');
      reportHtml = await buildStipendIndividualBundleHtml({ payrollMonth: payrollMonthSql, copyType });
      reportEmpty = !reportHtml;
      printMeta = {
        title: 'Stipend Individual Report',
        subtitleLine1: copyType === 'Default Copy' ? '' : copyType,
        dateRange: formatPayrollMonthLabel(payrollMonthSql),
      };
      const { loadAttendanceBannerUrl } = await import('../attendance/studentAttendanceShared.js');
      bannerUrl = await loadAttendanceBannerUrl();
    } else if (searchCategory.length && (reportKey !== 'stipend-report' || reportForRaw)) {
      if (reportKey === 'stipend-statement') {
        const printSetup = await loadPrintSetup(STIPEND_STATEMENT_PRINT_ID);
        const rows = await loadStipendStatementRows(searchCategory, payrollMonthSql);
        reportEmpty = rows.length === 0;
        reportHtml = await appendStipendReportSignature(
          buildStipendStatementHtml(rows, { bodyTitle: printSetup.body_title || '' }),
          reportKey,
        );
        printMeta = {
          title: printSetup.title || 'Stipend Salary Statement',
          subtitleLine1: printSetup.sub_title || '',
          dateRange: formatPayrollMonthLabel(payrollMonthSql),
        };
        const { loadAttendanceBannerUrl } = await import('../attendance/studentAttendanceShared.js');
        bannerUrl = await loadAttendanceBannerUrl();
      } else {
        const rows = await loadStipendStatementRows(searchCategory, payrollMonthSql);
        const reportFor = normalizeReportFor(reportForRaw || 'bank');
        const transferRef = parseBankTransferRef(reportForRaw);
        reportEmpty = rows.length === 0;
        reportHtml = await appendStipendReportSignature(
          buildSimpleStipendReportHtml(rows, reportFor, transferRef),
          reportKey,
          reportFor,
        );
        printMeta = {
          title: reportTypeLabel(reportTypeOptions, reportForRaw) || 'Stipend Payroll Report',
          subtitleLine1: searchCategory.join(', '),
          dateRange: formatPayrollMonthLabel(payrollMonthSql),
        };
        const { loadAttendanceBannerUrl } = await import('../attendance/studentAttendanceShared.js');
        bannerUrl = await loadAttendanceBannerUrl();
      }
    }

    const logPayload = reportKey === 'stipend-individual-report'
      ? `${payrollMonthSql}___${copyType}`
      : `${payrollMonthSql}___${searchCategory.join(',')}___${reportForRaw}`;
    await logPayrollPage(
      page,
      'Generate',
      logPayload,
      memberId,
      audit,
    );
  } else {
    await logPayrollPage(page, 'View', payrollMonthSql, memberId, audit);
  }

  return {
    monthOptions,
    categoryOptions,
    reportTypeOptions,
    selected: {
      payrollMonth: payrollMonthRaw,
      payrollMonthSql,
      searchCategory,
      reportFor: reportForRaw,
      copyType,
      rowPerPage,
    },
    generatedBy: selectedMonth
      ? { user: selectedMonth.generatedBy, date: selectedMonth.generatedOn }
      : null,
    reportHtml,
    reportTitle: payrollMonthSql ? formatPayrollMonthLabel(payrollMonthSql) : '',
    reportEmpty: (reportKey === 'stipend-report' || reportKey === 'stipend-individual-report') ? reportEmpty : false,
    reportMessage: reportEmpty
      ? (reportKey === 'stipend-individual-report'
        ? 'No stipend payroll records for the selected month. Generate stipend payroll first.'
        : 'No stipend payroll records for the selected month, category, and report type.')
      : (reportKey === 'stipend-statement' && reportEmpty
        ? 'No stipend payroll records for the selected month and category. Choose a category from the payroll log for that month, or generate stipend payroll first.'
        : ''),
    canPrint: Boolean(reportHtml && !((reportKey === 'stipend-report' || reportKey === 'stipend-individual-report') && reportEmpty)),
    printMeta,
    bannerUrl,
  };
}
