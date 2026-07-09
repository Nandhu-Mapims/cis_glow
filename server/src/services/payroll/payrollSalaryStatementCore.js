import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import {
  appendPayrollReportSignature,
  escapeHtml,
  formatIndianMoney,
  formatPayrollMonthLabel,
  getStaffOrderClause,
  loadDesignationMap,
  loadPrintSetup,
} from './payrollHelpers.js';

function staffDisplayName(row) {
  const title = row.staff_title ? `${String(row.staff_title).trim()}. ` : '';
  return `${title}${String(row.staff_name || '').trim()} ${String(row.staff_initial || '').trim()}`.trim();
}

function num(val) {
  return Number(val) || 0;
}

function staffRow(idx, row, designationMap) {
  const netPay = num(row.net_pay);
  const bg = netPay <= 0 ? ' bgcolor="#F97A70"' : '';
  const bgGross = netPay <= 0 ? '' : ' bgcolor="#F4F4F4"';
  return `<tr${bg}>
<td height="25">${idx}</td>
<td>${escapeHtml(row.staff_id)}</td>
<td nowrap class="staff_name">${escapeHtml(staffDisplayName(row))}</td>
<td nowrap class="staff_desc">${escapeHtml(designationMap[row.designation] || '')}</td>
<td class="text-right">${formatIndianMoney(row.basic_pay)}</td>
<td class="text-right">${formatIndianMoney(row.basic_margin)}</td>
<td class="text-right">${formatIndianMoney(row.d_allowance)}</td>
<td class="text-right">${formatIndianMoney(row.hra_allowance)}</td>
<td class="text-right">${formatIndianMoney(row.m_allowance)}</td>
<td class="text-right">${formatIndianMoney(row.c_allowance)}</td>
<td class="text-right cls_total_amount">${formatIndianMoney(row.total_amount)}</td>
<td class="text-right cls_lop_amount">${formatIndianMoney(row.lop_amount)}</td>
<td class="text-right cls_arrear_amount">${formatIndianMoney(row.arrear_amount)}</td>
<td class="text-right cls_gross_pay"${bgGross}>${formatIndianMoney(row.gross_pay)}</td>
<td class="text-right cls_pf_amount">${formatIndianMoney(row.pf_amount)}</td>
<td class="text-right cls_esi_amount">${formatIndianMoney(row.esi_amount)}</td>
<td class="text-right cls_loan_amount">${formatIndianMoney(row.loan_amount)}</td>
<td class="text-right cls_security_amount">${formatIndianMoney(row.security_deposit)}</td>
<td class="text-right cls_transport_amount">${formatIndianMoney(row.transport_deduction)}</td>
<td class="text-right cls_other_deduction">${formatIndianMoney(row.other_deduction)}</td>
<td class="text-right cls_rental_amount">${formatIndianMoney(row.rental_amount)}</td>
<td class="text-right cls_mess_amount">${formatIndianMoney(row.hostel_amount)}</td>
<td class="text-right cls_tds_amount">${formatIndianMoney(row.tds_amount)}</td>
<td class="text-right cls_ptax_amount">${formatIndianMoney(row.prof_tax)}</td>
<td class="text-right cls_tot_deduction" bgcolor="#F4F4F4">${formatIndianMoney(row.total_deduction)}</td>
<td class="text-right cls_tot_advance">${formatIndianMoney(row.advance_amount)}</td>
<td class="text-right cls_sd_refund_amount">${formatIndianMoney(row.sdeposit_refund)}</td>
<td class="text-right">${formatIndianMoney(row.net_pay)}</td>
</tr>`;
}

function footerRow(totals) {
  return `<tr>
<th height="35" class="text-right" colspan="4">Grand Total</th>
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
<th class="text-right cls_security_amount">${formatIndianMoney(totals.security_deposit)}</th>
<th class="text-right cls_transport_amount">${formatIndianMoney(totals.transport_deduction)}</th>
<th class="text-right cls_other_deduction">${formatIndianMoney(totals.other_deduction)}</th>
<th class="text-right cls_rental_amount">${formatIndianMoney(totals.rental_amount)}</th>
<th class="text-right cls_mess_amount">${formatIndianMoney(totals.hostel_amount)}</th>
<th class="text-right cls_tds_amount">${formatIndianMoney(totals.tds_amount)}</th>
<th class="text-right cls_ptax_amount">${formatIndianMoney(totals.prof_tax)}</th>
<th class="text-right cls_tot_deduction" bgcolor="#F4F4F4">${formatIndianMoney(totals.total_deduction)}</th>
<th class="text-right cls_tot_advance">${formatIndianMoney(totals.advance_amount)}</th>
<th class="text-right cls_sd_refund_amount">${formatIndianMoney(totals.sdeposit_refund)}</th>
<th class="text-right">${formatIndianMoney(totals.net_pay)}</th>
</tr>`;
}

const TABLE_HEADER = `
<p class="header1">Salary Statement &nbsp;</p>
<table class="table-bordered" cellpadding="5" cellspacing="0" width="100%">
<thead><tr bgcolor="#e7e7e7">
<th width="20" height="35">#</th>
<th width="60">S.ID</th>
<th width="200">Name</th>
<th width="150">Designation</th>
<th width="50" align="center">Basic</th>
<th width="50" align="center">Scale</th>
<th width="50" align="center">D.A</th>
<th width="50" align="center">HRA</th>
<th width="50" align="center">Medical</th>
<th width="50" align="center"><small>Conveyance</small></th>
<th width="50" align="center" class="cls_total_amount">Total</th>
<th width="50" align="center" class="cls_lop_amount">LOP</th>
<th width="50" align="center" class="cls_arrear_amount">AR</th>
<th width="50" align="center" nowrap class="cls_gross_pay"><small>Gross Pay</small></th>
<th width="50" align="center" class="cls_pf_amount">P.F</th>
<th width="50" align="center" class="cls_esi_amount">ESI</th>
<th width="50" align="center" class="cls_loan_amount">Loan</th>
<th width="50" align="center" class="cls_security_amount">Security Deposit</th>
<th width="50" align="center" class="cls_transport_amount">Transport Deduction</th>
<th width="50" align="center" class="cls_other_deduction"><small>O.Deduction</small></th>
<th width="50" align="center" class="cls_rental_amount">Rental</th>
<th width="50" align="center" class="cls_mess_amount">Mess</th>
<th width="50" align="center" class="cls_tds_amount">TDS</th>
<th width="50" align="center" class="cls_ptax_amount"><small>Prof.Tax</small></th>
<th width="50" align="center" class="cls_tot_deduction"><small>T.Deduction</small></th>
<th width="50" align="center" class="cls_tot_advance"><small>Advance</small></th>
<th width="50" align="center" class="cls_sd_refund_amount">SDeposit Refund</th>
<th width="50" align="center">Net Pay</th>
</tr></thead><tbody>`;

export async function buildSalaryStatementHtml(options) {
  const { payrollMonth, categoryFilterSql, categoryLabels, rowPerPage = 27, generatedBy } = options;
  if (!payrollMonth || !categoryFilterSql) return '';

  const monthSql = escapeSql(payrollMonth);
  const joinCheck = new Date(payrollMonth);
  joinCheck.setMonth(joinCheck.getMonth() + 1);
  const joinCheckSql = joinCheck.toISOString().slice(0, 10);

  const orderClause = await getStaffOrderClause();
  const [designationMap, printSetup, rows] = await Promise.all([
    loadDesignationMap(),
    loadPrintSetup('3'),
    prisma.$queryRawUnsafe(
    `SELECT DISTINCT(A.id), A.staff_id, A.staff_title, A.staff_name, A.staff_initial,
            B.basic_pay, B.basic_margin, B.d_allowance, B.hra_allowance, B.m_allowance,
            B.c_allowance, B.total_amount, B.lop_amount, B.arrear_amount, B.gross_pay,
            B.pf_amount, B.esi_amount, B.loan_amount, B.other_deduction, B.rental_amount,
            B.hostel_amount, B.tds_amount, B.total_deduction, B.net_pay, B.prof_tax,
            B.designation, B.advance_amount, B.security_deposit, B.transport_deduction,
            B.sdeposit_refund
     FROM staff_profile_tb AS A
     INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND B.del = 1
       ${categoryFilterSql}
       AND B.payroll_month = '${monthSql}'
       AND A.joined_date < '${joinCheckSql}'
     ${orderClause}`,
    ),
  ]);

  if (!rows.length) return '';

  const totals = {};
  const totalKeys = ['basic_pay', 'basic_margin', 'd_allowance', 'hra_allowance', 'm_allowance',
    'c_allowance', 'total_amount', 'lop_amount', 'arrear_amount', 'gross_pay', 'pf_amount',
    'esi_amount', 'loan_amount', 'security_deposit', 'transport_deduction', 'other_deduction',
    'rental_amount', 'hostel_amount', 'tds_amount', 'prof_tax', 'total_deduction',
    'advance_amount', 'sdeposit_refund', 'net_pay'];
  const body = rows.map((row, idx) => {
    for (const key of totalKeys) {
      totals[key] = (totals[key] || 0) + num(row[key]);
    }
    return staffRow(idx + 1, row, designationMap);
  }).join('');

  const deptLabel = categoryLabels?.length
    ? `<p class="header2">Department(s): ${escapeHtml(categoryLabels.join(', '))}</p>`
    : '';

  const genLabel = generatedBy?.user
    ? `<p class="text-muted small">Generated by ${escapeHtml(generatedBy.user)} on ${escapeHtml(generatedBy.date || '')}</p>`
    : '';

  return appendPayrollReportSignature(`${genLabel}
<p class="header1">${escapeHtml(printSetup.body_title || 'Salary Statement')}</p>
${deptLabel}
<p class="header2">${formatPayrollMonthLabel(payrollMonth)}</p>
${TABLE_HEADER}${body}</tbody><tfoot>${footerRow(totals)}</tfoot></table>`, printSetup);
}
