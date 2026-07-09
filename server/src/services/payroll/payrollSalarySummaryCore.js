import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import {
  appendPayrollReportSignature,
  escapeHtml,
  formatIndianMoney,
  formatPayrollMonthLabel,
  loadPrintSetup,
} from './payrollHelpers.js';

const SUM_COLUMNS = `
  SUM(B.basic_pay) AS basic_pay,
  SUM(B.basic_margin) AS basic_margin,
  SUM(B.d_allowance) AS d_allowance,
  SUM(B.hra_allowance) AS hra_allowance,
  SUM(B.m_allowance) AS m_allowance,
  SUM(B.c_allowance) AS c_allowance,
  SUM(B.total_amount) AS total_amount,
  SUM(B.lop_amount) AS lop_amount,
  SUM(B.arrear_amount) AS arrear_amount,
  SUM(B.gross_pay) AS gross_pay,
  SUM(B.pf_amount) AS pf_amount,
  SUM(B.esi_amount) AS esi_amount,
  SUM(B.loan_amount) AS loan_amount,
  SUM(B.other_deduction) AS other_deduction,
  SUM(B.rental_amount) AS rental_amount,
  SUM(B.hostel_amount) AS hostel_amount,
  SUM(B.tds_amount) AS tds_amount,
  SUM(B.total_deduction) AS total_deduction,
  SUM(B.net_pay) AS net_pay,
  SUM(B.prof_tax) AS prof_tax,
  SUM(B.advance_amount) AS advance_amount`;

const TABLE_HEADER = `
<p class="header1">Salary Summary &nbsp;</p>
<table class="table-bordered" cellpadding="5" cellspacing="0" width="100%">
<thead><tr bgcolor="#e7e7e7">
<th width="20" height="35">#</th>
<th width="200">PARTICULARS</th>
<th width="50" align="center">Basic</th>
<th width="50" align="center">Scale</th>
<th width="50" align="center">D.A</th>
<th width="50" align="center">HRA</th>
<th width="50" align="center">Medical</th>
<th width="50" align="center"><small>Conveyance</small></th>
<th width="50" align="center" class="cls_tot_advance">Total</th>
<th width="50" align="center" class="cls_lop_amount">LOP</th>
<th width="50" align="center" class="cls_arrear_amount">AR</th>
<th width="50" align="center" class="cls_gross_pay" nowrap><small>Gross Pay</small></th>
<th width="50" align="center" class="cls_pf_amount">P.F</th>
<th width="50" align="center" class="cls_esi_amount">ESI</th>
<th width="50" align="center" class="cls_loan_amount">Loan</th>
<th width="50" align="center" class="cls_other_deduction"><small>O.Deduction</small></th>
<th width="50" align="center" class="cls_rental_amount">Rental</th>
<th width="50" align="center" class="cls_mess_amount">Mess</th>
<th width="50" align="center" class="cls_tds_amount">TDS</th>
<th width="50" align="center" class="cls_ptax_amount"><small>Prof.Tax</small></th>
<th width="50" align="center" class="cls_tot_deduction"><small>T.Deduction</small></th>
<th width="50" align="center" class="cls_tot_advance"><small>Advance</small></th>
<th width="50" align="center">Net Pay</th>
</tr></thead><tbody>`;

function num(row, key) {
  return Number(row[key]) || 0;
}

function dataRow(idx, title, row) {
  return `<tr>
<td height="30">${idx}</td>
<td nowrap>${escapeHtml(title)}</td>
<td class="text-right">${formatIndianMoney(num(row, 'basic_pay'))}</td>
<td class="text-right">${formatIndianMoney(num(row, 'basic_margin'))}</td>
<td class="text-right">${formatIndianMoney(num(row, 'd_allowance'))}</td>
<td class="text-right">${formatIndianMoney(num(row, 'hra_allowance'))}</td>
<td class="text-right">${formatIndianMoney(num(row, 'm_allowance'))}</td>
<td class="text-right">${formatIndianMoney(num(row, 'c_allowance'))}</td>
<td class="text-right cls_total_amount">${formatIndianMoney(num(row, 'total_amount'))}</td>
<td class="text-right cls_lop_amount">${formatIndianMoney(num(row, 'lop_amount'))}</td>
<td class="text-right cls_arrear_amount">${formatIndianMoney(num(row, 'arrear_amount'))}</td>
<td class="text-right cls_gross_pay" bgcolor="#F4F4F4">${formatIndianMoney(num(row, 'gross_pay'))}</td>
<td class="text-right cls_pf_amount">${formatIndianMoney(num(row, 'pf_amount'))}</td>
<td class="text-right cls_esi_amount">${formatIndianMoney(num(row, 'esi_amount'))}</td>
<td class="text-right cls_loan_amount">${formatIndianMoney(num(row, 'loan_amount'))}</td>
<td class="text-right cls_other_deduction">${formatIndianMoney(num(row, 'other_deduction'))}</td>
<td class="text-right cls_rental_amount">${formatIndianMoney(num(row, 'rental_amount'))}</td>
<td class="text-right cls_mess_amount">${formatIndianMoney(num(row, 'hostel_amount'))}</td>
<td class="text-right cls_tds_amount">${formatIndianMoney(num(row, 'tds_amount'))}</td>
<td class="text-right cls_ptax_amount">${formatIndianMoney(num(row, 'prof_tax'))}</td>
<td class="text-right cls_tot_deduction" bgcolor="#F4F4F4">${formatIndianMoney(num(row, 'total_deduction'))}</td>
<td class="text-right cls_tot_advance">${formatIndianMoney(num(row, 'advance_amount'))}</td>
<td class="text-right" bgcolor="#EEEEEE">${formatIndianMoney(num(row, 'net_pay'))}</td>
</tr>`;
}

function footerRow(title, totals) {
  return `<tr>
<th height="35" class="text-right" colspan="2">${escapeHtml(title)}</th>
<th class="text-right">${formatIndianMoney(totals.basic_pay)}</th>
<th class="text-right">${formatIndianMoney(totals.basic_margin)}</th>
<th class="text-right">${formatIndianMoney(totals.d_allowance)}</th>
<th class="text-right">${formatIndianMoney(totals.hra_allowance)}</th>
<th class="text-right">${formatIndianMoney(totals.m_allowance)}</th>
<th class="text-right">${formatIndianMoney(totals.c_allowance)}</th>
<th class="text-right cls_total_amount">${formatIndianMoney(totals.total_amount)}</th>
<th class="text-right cls_lop_amount">${formatIndianMoney(totals.lop_amount)}</th>
<th class="text-right cls_arrear_amount">${formatIndianMoney(totals.arrear_amount)}</th>
<th class="text-right cls_gross_pay" bgcolor="#F4F4F4">${formatIndianMoney(totals.gross_pay)}</th>
<th class="text-right cls_pf_amount">${formatIndianMoney(totals.pf_amount)}</th>
<th class="text-right cls_esi_amount">${formatIndianMoney(totals.esi_amount)}</th>
<th class="text-right cls_loan_amount">${formatIndianMoney(totals.loan_amount)}</th>
<th class="text-right cls_other_deduction">${formatIndianMoney(totals.other_deduction)}</th>
<th class="text-right cls_rental_amount">${formatIndianMoney(totals.rental_amount)}</th>
<th class="text-right cls_mess_amount">${formatIndianMoney(totals.hostel_amount)}</th>
<th class="text-right cls_tds_amount">${formatIndianMoney(totals.tds_amount)}</th>
<th class="text-right cls_ptax_amount">${formatIndianMoney(totals.prof_tax)}</th>
<th class="text-right cls_tot_deduction" bgcolor="#F4F4F4">${formatIndianMoney(totals.total_deduction)}</th>
<th class="text-right cls_tot_advance">${formatIndianMoney(totals.advance_amount)}</th>
<th class="text-right" bgcolor="#EEEEEE">${formatIndianMoney(totals.net_pay)}</th>
</tr>`;
}

function buildColumnStyles(monthSql) {
  const checks = [
    ['basic_pay', '.cls_basic_pay'],
    ['basic_margin', '.cls_basic_margin'],
    ['d_allowance', '.cls_d_allowance'],
    ['hra_allowance', '.cls_hra_allowance'],
    ['m_allowance', '.cls_m_allowance'],
    ['c_allowance', '.cls_c_allowance'],
    ['total_amount', '.cls_total_amount'],
    ['lop_amount', '.cls_lop_amount'],
    ['arrear_amount', '.cls_arrear_amount'],
    ['gross_pay', '.cls_gross_pay'],
    ['pf_amount', '.cls_pf_amount'],
    ['esi_amount', '.cls_esi_amount'],
    ['loan_amount', '.cls_loan_amount'],
    ['other_deduction', '.cls_other_deduction'],
    ['rental_amount', '.cls_rental_amount'],
    ['hostel_amount', '.cls_mess_amount'],
    ['tds_amount', '.cls_tds_amount'],
    ['advance_amount', '.cls_tot_advance'],
    ['prof_tax', '.cls_ptax_amount'],
  ];
  let css = '';
  let hiddenDeductionCols = 0;
  return prisma.$queryRawUnsafe(
    `SELECT ${checks.map(([col]) => `SUM(${col})`).join(', ')}
     FROM staff_payroll_tb WHERE del = 1 AND payroll_month = '${monthSql}'`,
  ).then((rows) => {
    const r = rows[0] || {};
    checks.forEach(([col, cls], i) => {
      const val = Number(Object.values(r)[i]) || 0;
      if (val === 0) {
        css += ` ${cls}{ display:none!important;}`;
        if (['pf_amount', 'esi_amount', 'loan_amount', 'other_deduction', 'rental_amount', 'hostel_amount', 'tds_amount', 'prof_tax'].includes(col)) {
          hiddenDeductionCols += 1;
        }
      }
    });
    if (hiddenDeductionCols === 0) css += ' .cls_tot_deduction{ display:none!important;}';
    return css;
  });
}

async function loadCategorySums(payrollMonth, categoryFilterSql) {
  const monthSql = escapeSql(payrollMonth);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ${SUM_COLUMNS}
     FROM staff_profile_tb AS A
     INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND B.del = 1
       ${categoryFilterSql}
       AND B.payroll_month = '${monthSql}'`,
  );
  return rows[0] || {};
}

export async function buildSalarySummaryHtml(options) {
  const { payrollMonth, filters, generatedBy } = options;
  const monthSql = escapeSql(payrollMonth);
  const activeFilters = filters.filter((filter) => filter.categoryFilterSql);

  const [printSetup, sumRows, styles] = await Promise.all([
    loadPrintSetup('4'),
    Promise.all(activeFilters.map((filter) => loadCategorySums(payrollMonth, filter.categoryFilterSql))),
    buildColumnStyles(monthSql),
  ]);

  let body = '';
  const totals = {};
  sumRows.forEach((row, index) => {
    const filter = activeFilters[index];
    const counter = index + 1;
    body += dataRow(counter, filter.title || `Category ${counter}`, row);
    for (const key of Object.keys(row)) {
      totals[key] = (totals[key] || 0) + num(row, key);
    }
  });

  if (!body) return '';

  const genLabel = generatedBy?.user
    ? `<p class="text-muted small">Generated by ${escapeHtml(generatedBy.user)} on ${escapeHtml(generatedBy.date || '')}</p>`
    : '';

  const footer = sumRows.length > 1 ? footerRow('Grand Total', totals) : '';

  return appendPayrollReportSignature(`${genLabel}
<p class="header1">${escapeHtml(printSetup.body_title || 'Salary Summary')}</p>
<p class="header2">${formatPayrollMonthLabel(payrollMonth)}</p>
${TABLE_HEADER}${body}</tbody><tfoot>${footer}</tfoot></table>
<style>${styles}</style>`, printSetup);
}
