import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import {
  appendPayrollReportSignature,
  escapeHtml,
  formatIndianMoney,
  loadPrintSetup,
} from './payrollHelpers.js';
import { computePfTotals, computeEsiTotals } from './payrollPfEsiCore.js';

function num(val) {
  return Number(val) || 0;
}

function moneyCell(amount, tag = 'td') {
  return `<${tag} valign="top" class="text-right">${formatIndianMoney(amount)}</${tag}>`;
}

function liabilityRow(bg, label, total, employee, employer) {
  return `<tr bgcolor="${bg}">
<td height="20" valign="top">${escapeHtml(label)}</td>
${moneyCell(total)}
${moneyCell(employee)}
${moneyCell(employer)}
</tr>`;
}

async function loadPayrollDbTotals(payrollMonth, categoryFilterSql = '') {
  const monthSql = escapeSql(payrollMonth);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT
       SUM(B.net_pay) AS net_pay,
       SUM(B.gross_pay) AS gross_pay,
       SUM(B.lop_amount) AS lop_amount,
       SUM(B.arrear_amount) AS arrear_amount,
       SUM(B.advance_amount) AS advance_amount,
       SUM(B.loan_amount) AS loan_amount,
       SUM(B.other_deduction) AS other_deduction,
       SUM(B.tds_amount) AS tds_amount,
       SUM(B.prof_tax) AS prof_tax,
       SUM(B.rental_amount) AS rental_amount,
       SUM(B.h_rental_amount) AS h_rental_amount,
       SUM(B.hostel_amount) AS hostel_amount
     FROM staff_profile_tb AS A
     INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND B.del = 1
       AND B.payroll_month = '${monthSql}'
       ${categoryFilterSql}`,
  );
  return rows[0] || {};
}

async function loadBankTransferLines(payrollMonth, categoryFilterSql = '') {
  const monthSql = escapeSql(payrollMonth);
  const [banks, groupedRows] = await Promise.all([
    prisma.edu_setup_tb.findMany({
      where: { category: 'Bank', del: 1 },
      orderBy: { category_order: 'asc' },
    }),
    prisma.$queryRawUnsafe(
      `SELECT B.pay_bank, B.pay_type, SUM(B.net_pay) AS amount
       FROM staff_profile_tb AS A
       INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
       WHERE A.del = 1 AND B.del = 1 AND B.net_pay > 0
         AND B.payroll_month = '${monthSql}'
         ${categoryFilterSql}
       GROUP BY B.pay_bank, B.pay_type`,
    ),
  ]);

  const amountByBank = new Map();
  let chequeAmount = 0;
  let bankTotal = 0;

  for (const row of groupedRows) {
    const amount = num(row.amount);
    if (amount <= 0) continue;
    bankTotal += amount;
    if (row.pay_type === 'Cheque') {
      chequeAmount += amount;
      continue;
    }
    const bankId = String(row.pay_bank ?? '');
    amountByBank.set(bankId, (amountByBank.get(bankId) || 0) + amount);
  }

  const lines = [];
  let bankCounter = 0;

  for (const bank of banks) {
    const amount = amountByBank.get(String(bank.id)) || 0;
    if (amount <= 0) continue;
    bankCounter += 1;
    const bankName = bank.category_sname || bank.category_name;
    lines.push(`<tr bgcolor="#f3f3f3">
<td height="20" valign="top">1.${bankCounter}. Salary Bank Transfer – ${escapeHtml(bankName)}</td>
${moneyCell(amount)}
<td valign="top" class="text-right"></td>
<td valign="top" class="text-right"></td>
</tr>`);
  }

  if (chequeAmount > 0) {
    bankCounter += 1;
    lines.push(`<tr bgcolor="#f3f3f3">
<td height="20" valign="top">1.${bankCounter}. Salary Cheque</td>
${moneyCell(chequeAmount)}
<td valign="top" class="text-right"></td>
<td valign="top" class="text-right"></td>
</tr>`);
  }

  return { lines: lines.join(''), bankTotal };
}

async function loadRentalLiabilityLines(payrollMonth, categoryFilterSql = '') {
  const monthSql = escapeSql(payrollMonth);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT
       COALESCE(NULLIF(TRIM(HB.block_id), ''), 'Rental') AS block_name,
       SUM(B.rental_amount) AS employee,
       SUM(B.h_rental_amount) AS employer
     FROM staff_profile_tb AS A
     INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
     LEFT JOIN hostel_rooms_tb AS HR ON HR.id = B.room_id AND HR.del = 1
     LEFT JOIN hostel_blocks_tb AS HB ON HB.id = HR.block_id AND HB.del = 1
     WHERE A.del = 1 AND B.del = 1
       AND B.payroll_month = '${monthSql}'
       AND (B.rental_amount > 0 OR B.h_rental_amount > 0)
       ${categoryFilterSql}
     GROUP BY COALESCE(NULLIF(TRIM(HB.block_id), ''), 'Rental')
     ORDER BY block_name ASC`,
  );

  let pcount = 0;
  let employeeTotal = 0;
  let employerTotal = 0;
  let totalAmount = 0;
  const lines = [];

  for (const row of rows) {
    const employee = num(row.employee);
    const employer = num(row.employer);
    const total = employee + employer;
    if (total <= 0) continue;
    pcount += 1;
    employeeTotal += employee;
    employerTotal += employer;
    totalAmount += total;
    lines.push(liabilityRow('#e6e6e6', `2.1.${pcount}. ${row.block_name}`, total, employee, employer));
  }

  return { lines: lines.join(''), employeeTotal, employerTotal, totalAmount, pcount };
}

export async function buildPayrollDbHtml(payrollMonth, categoryFilterSql = '') {
  const [printSetup, totals] = await Promise.all([
    loadPrintSetup('1'),
    loadPayrollDbTotals(payrollMonth, categoryFilterSql),
  ]);
  const [bankData, rentalData, pfTotals, esiTotals] = await Promise.all([
    loadBankTransferLines(payrollMonth, categoryFilterSql),
    loadRentalLiabilityLines(payrollMonth, categoryFilterSql),
    computePfTotals(payrollMonth, categoryFilterSql),
    computeEsiTotals(payrollMonth, categoryFilterSql),
  ]);

  const finalNetPay = num(totals.net_pay);
  const finalGrossPay = num(totals.gross_pay);
  const finalLopAmount = num(totals.lop_amount);
  const finalArrearAmount = num(totals.arrear_amount);
  const finalAdvanceAmount = num(totals.advance_amount);
  const finalLoanAmount = num(totals.loan_amount);
  const finalOtherDeduction = num(totals.other_deduction);
  const finalTdsAmount = num(totals.tds_amount);
  const finalPtaxAmount = num(totals.prof_tax);
  const messEmployee = num(totals.hostel_amount);

  let pcount = rentalData.pcount;
  let employeePayAmount = finalOtherDeduction + finalLoanAmount;
  let employerPayAmount = 0;
  let totalPayAmount = employeePayAmount;

  employeePayAmount += rentalData.employeeTotal;
  employerPayAmount += rentalData.employerTotal;
  totalPayAmount += rentalData.totalAmount;

  let rentalLines = rentalData.lines;
  if (messEmployee > 0) {
    pcount += 1;
    employeePayAmount += messEmployee;
    totalPayAmount += messEmployee;
    rentalLines += liabilityRow('#e6e6e6', `2.1.${pcount}. Mess`, messEmployee, messEmployee, 0);
  }

  if (pfTotals.employee + pfTotals.employer > 0) {
    pcount += 1;
    employeePayAmount += pfTotals.employee;
    employerPayAmount += pfTotals.employer;
    totalPayAmount += pfTotals.employee + pfTotals.employer;
    rentalLines += liabilityRow('#e6e6e6', `2.1.${pcount}. EPF`, pfTotals.employee + pfTotals.employer, pfTotals.employee, pfTotals.employer);
  }

  if (esiTotals.employee + esiTotals.employer > 0) {
    pcount += 1;
    employeePayAmount += esiTotals.employee;
    employerPayAmount += esiTotals.employer;
    totalPayAmount += esiTotals.employee + esiTotals.employer;
    rentalLines += liabilityRow('#e6e6e6', `2.1.${pcount}. ESI`, esiTotals.employee + esiTotals.employer, esiTotals.employee, esiTotals.employer);
  }

  if (finalOtherDeduction > 0) {
    pcount += 1;
    rentalLines += liabilityRow('#e6e6e6', `2.1.${pcount}. Other Deduction`, finalOtherDeduction, finalOtherDeduction, 0);
  }

  pcount += 1;
  rentalLines += liabilityRow('#e6e6e6', `2.1.${pcount}. Loan/Advance`, finalLoanAmount, finalLoanAmount, 0);

  employeePayAmount += finalTdsAmount + finalPtaxAmount;
  totalPayAmount += finalTdsAmount + finalPtaxAmount;

  const finalBankPayment = bankData.bankTotal;
  const finalNetPayment = finalBankPayment + totalPayAmount;

  const html = `<div class="printingBody payroll-db-report att_report_span">
<table class="table-bordered" cellpadding="2" cellspacing="0">
<tr bgcolor="#7f7f7f">
<td height="45" valign="middle" class="text-center pd_header" nowrap>1. Pay Checks</td>
<td valign="middle" class="text-center pd_header" nowrap>2. Pay Liabilities</td>
<td valign="middle" class="text-center pd_header" nowrap>Total</td>
<td valign="middle" class="text-center pd_header" nowrap>3. Reference</td>
</tr>
<tr>
<td rowspan="2" valign="top" class="text-center" width="180" bgcolor="#f3f3f3">
<p class="pd_header_1">${formatIndianMoney(finalNetPay)}</p>
<p class="pd_content_1">Total Payable</p>
</td>
<td rowspan="2" valign="top" class="text-center" width="180" bgcolor="#e6e6e6">
<p class="pd_header_1">${formatIndianMoney(totalPayAmount)}</p>
<p class="pd_content_1">Tax &amp; Non-Tax Payments</p>
</td>
<td rowspan="2" valign="top" class="text-center" width="180" bgcolor="#cecece">
<p class="pd_header_1">${formatIndianMoney(finalNetPayment)}</p>
<p class="pd_content_1">Total Employee CTC</p>
</td>
<td valign="top" height="45" class="text-center" width="180">
<p class="pd_header_2">${formatIndianMoney(finalLopAmount)}</p>
<p class="pd_content_2">LOP</p>
</td>
</tr>
<tr>
<td valign="top" height="45" class="text-center">
<p class="pd_header_2">${formatIndianMoney(finalGrossPay)}</p>
<p class="pd_content_2">Gross Salary</p>
</td>
</tr>
</table>
<br>
<table class="table-bordered" cellpadding="3" cellspacing="0">
<thead><tr bgcolor="#c7c7c7">
<th width="330" height="25" valign="top" align="center">Particulars</th>
<th width="130" valign="top" align="center">Net Pay</th>
<th width="130" valign="top" align="center">Employee</th>
<th width="130" valign="top" align="center">Employer</th>
</tr></thead><tbody>
<tr bgcolor="#f3f3f3">
<td height="28" colspan="4" valign="top"><strong style="color:#666; font-size:18px;">1. Pay Checks</strong></td>
</tr>
${bankData.lines}
<tr bgcolor="#f3f3f3">
<td height="20" valign="top" class="text-right"><strong>Total Payable</strong></td>
<td valign="top" class="text-right"><strong>${formatIndianMoney(finalBankPayment)}</strong></td>
<td valign="top" class="text-right"></td>
<td valign="top" class="text-right"></td>
</tr>
<tr bgcolor="#e6e6e6">
<td height="28" colspan="4" valign="top"><strong style="color:#666; font-size:18px;">2. Pay Liabilities</strong></td>
</tr>
<tr bgcolor="#e6e6e6">
<td height="28" colspan="4" valign="top">2.1. Non-Tax Payments</td>
</tr>
${rentalLines}
<tr bgcolor="#e6e6e6">
<td height="28" colspan="4" valign="top">2.2. Tax Payments</td>
</tr>
<tr bgcolor="#e6e6e6">
<td height="20" valign="top">2.2.1. TDS</td>
${moneyCell(finalTdsAmount)}
${moneyCell(finalTdsAmount)}
${moneyCell(0)}
</tr>
<tr bgcolor="#e6e6e6">
<td height="20" valign="top">2.2.2. Professional Tax</td>
${moneyCell(finalPtaxAmount)}
${moneyCell(finalPtaxAmount)}
${moneyCell(0)}
</tr>
<tr bgcolor="#e6e6e6">
<td height="20" valign="top" class="text-right"><strong>Total Pay Liabilities</strong></td>
<td valign="top" class="text-right"><strong>${formatIndianMoney(totalPayAmount)}</strong></td>
<td valign="top" class="text-right"><strong>${formatIndianMoney(employeePayAmount)}</strong></td>
<td valign="top" class="text-right"><strong>${formatIndianMoney(employerPayAmount)}</strong></td>
</tr>
<tr bgcolor="#cecece">
<td height="20" valign="top" class="text-right"><strong>Total Employee CTC</strong></td>
<td valign="top" class="text-right"><strong>${formatIndianMoney(finalNetPayment)}</strong></td>
<td valign="top" class="text-right"></td>
<td valign="top" class="text-right"></td>
</tr>
<tr>
<td height="28" colspan="4" valign="top"><strong style="color:#666; font-size:18px;">3. References</strong></td>
</tr>
<tr>
<td height="20" valign="top">3.1. Employer Contributtion</td>
${moneyCell(employerPayAmount)}
<td valign="top" class="text-right"></td>
<td valign="top" class="text-right"></td>
</tr>
<tr>
<td height="20" valign="top">3.2. Gross Salary</td>
${moneyCell(finalGrossPay)}
<td valign="top" class="text-right"></td>
<td valign="top" class="text-right"></td>
</tr>
<tr>
<td height="20" valign="top">3.3. LOP</td>
${moneyCell(finalLopAmount)}
<td valign="top" class="text-right"></td>
<td valign="top" class="text-right"></td>
</tr>
<tr>
<td height="20" valign="top">3.4. Arrear Amount</td>
${moneyCell(finalArrearAmount)}
<td valign="top" class="text-right"></td>
<td valign="top" class="text-right"></td>
</tr>
<tr>
<td height="20" valign="top">3.5. Advance Amount</td>
${moneyCell(finalAdvanceAmount)}
<td valign="top" class="text-right"></td>
<td valign="top" class="text-right"></td>
</tr>
</tbody></table></div>`;

  return appendPayrollReportSignature(html, printSetup);
}
