import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import {
  appendPayrollReportSignature,
  escapeHtml,
  formatIndianMoney,
  formatPayrollMonthLabel,
  loadPrintSetup,
} from './payrollHelpers.js';
import { computeEsiTotals, computePfTotals } from './payrollPfEsiCore.js';

export async function loadConsolidatedMonthMetrics(payrollMonth, categoryFilterSql = '') {
  const monthSql = escapeSql(payrollMonth);
  const monthEnd = new Date(payrollMonth);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0);
  const monthEndSql = monthEnd.toISOString().slice(0, 10);

  const sums = await prisma.$queryRawUnsafe(
    `SELECT
       COUNT(B.id) AS staff_count,
       SUM(B.net_pay) AS net_pay_staff,
       SUM(B.lop_amount) AS lop_amount,
       SUM(B.loan_amount) AS loan_staff,
       SUM(B.tds_amount) AS tds_sal,
       SUM(B.prof_tax) AS ptax_sal
     FROM staff_profile_tb AS A
     INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND B.del = 1 AND B.total_days != ''
       AND B.payroll_month = '${monthSql}'
       ${categoryFilterSql}`,
  );
  const s = sums[0] || {};

  const pf = await computePfTotals(payrollMonth, categoryFilterSql);
  const esi = await computeEsiTotals(payrollMonth, categoryFilterSql);

  const newRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(A.id) AS cnt
     FROM staff_profile_tb AS A
     INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND B.del = 1
       AND A.joined_date >= '${monthSql}' AND A.joined_date <= '${monthEndSql}'
       AND A.joined_date != '0000-00-00'
       AND B.payroll_month = '${monthSql}'
       ${categoryFilterSql}`,
  );

  const resignedRows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(A.id) AS cnt
     FROM staff_profile_tb AS A
     INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND B.del = 1
       AND A.releaving_date >= '${monthSql}' AND A.releaving_date <= '${monthEndSql}'
       AND A.releaving_date != '0000-00-00'
       AND B.payroll_month = '${monthSql}'
       ${categoryFilterSql}`,
  );

  return {
    month: payrollMonth,
    monthLabel: formatPayrollMonthLabel(payrollMonth),
    staffCount: Number(s.staff_count) || 0,
    newJoined: Number(newRows[0]?.cnt) || 0,
    resigned: Number(resignedRows[0]?.cnt) || 0,
    netPayStaff: Number(s.net_pay_staff) || 0,
    netEmpLop: Number(s.lop_amount) || 0,
    pfStaff: pf.employee,
    esiStaff: esi.employee,
    pfEmployer: pf.employer,
    esiEmployer: esi.employer,
    loanStaff: Number(s.loan_staff) || 0,
    tdsSal: Number(s.tds_sal) || 0,
    ptaxSal: Number(s.ptax_sal) || 0,
  };
}

function metricsRowHtml(m, isTotal = false) {
  const tag = isTotal ? 'th' : 'td';
  const monthCell = isTotal
    ? '<th>Grand Total</th><th></th>'
    : `<td>${escapeHtml(m.monthLabel)}</td>`;
  const employeeCells = isTotal
    ? `<th style="text-align: right">${m.newJoined}</th>
<th style="text-align: right">${m.resigned}</th>`
    : `<${tag} style="text-align: right">${m.staffCount}</${tag}>
<${tag} style="text-align: right">${m.newJoined}</${tag}>
<${tag} style="text-align: right">${m.resigned}</${tag}>`;
  return `<tr>
${monthCell}
${employeeCells}
<${tag} style="text-align: right">${formatIndianMoney(m.netPayStaff)}</${tag}>
<${tag} style="text-align: right">${formatIndianMoney(m.netEmpLop)}</${tag}>
<${tag} style="text-align: right">${formatIndianMoney(m.pfStaff)}</${tag}>
<${tag} style="text-align: right">${formatIndianMoney(m.esiStaff)}</${tag}>
<${tag} style="text-align: right">${formatIndianMoney(m.pfEmployer)}</${tag}>
<${tag} style="text-align: right">${formatIndianMoney(m.esiEmployer)}</${tag}>
<${tag} style="text-align: right">${formatIndianMoney(m.loanStaff)}</${tag}>
<${tag} style="text-align: right">${formatIndianMoney(m.tdsSal)}</${tag}>
<${tag} style="text-align: right">${formatIndianMoney(m.ptaxSal)}</${tag}>
</tr>`;
}

export function buildConsolidatedMonthRangeLabel(months) {
  const sorted = [...months].sort();
  if (!sorted.length) return '';
  if (sorted.length === 1) return formatPayrollMonthLabel(sorted[0]);
  return `${formatPayrollMonthLabel(sorted[0])} to ${formatPayrollMonthLabel(sorted[sorted.length - 1])}`;
}

function buildConsolidatedPrintHeader(printSetup, monthRangeLabel, printedBy) {
  const now = new Date();
  const dateLabel = now.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeLabel = now.toLocaleString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const printedLabel = printedBy
    ? `Printed by ${escapeHtml(printedBy)} on ${dateLabel} at ${timeLabel}`
    : '';
  return `<div class="payroll-consolidated-print-header att_report_span" id="att_report_span">
<p class="header1">Payroll Consolidated Report &nbsp;</p>
${printSetup.sub_title ? `<p class="header2">${escapeHtml(printSetup.sub_title)}</p>` : ''}
<p class="header2">${escapeHtml(monthRangeLabel)}</p>
${printedLabel ? `<p class="text-muted small">${printedLabel}</p>` : ''}`;
}

export async function buildConsolidatedReportHtml(months, options = {}) {
  const printSetup = await loadPrintSetup('1');
  const sorted = [...months].sort();
  const rows = await Promise.all(sorted.map((m) => loadConsolidatedMonthMetrics(m)));
  const monthRangeLabel = buildConsolidatedMonthRangeLabel(sorted);

  const totals = rows.reduce((acc, m) => ({
    staffCount: acc.staffCount + m.staffCount,
    newJoined: acc.newJoined + m.newJoined,
    resigned: acc.resigned + m.resigned,
    netPayStaff: acc.netPayStaff + m.netPayStaff,
    netEmpLop: acc.netEmpLop + m.netEmpLop,
    pfStaff: acc.pfStaff + m.pfStaff,
    esiStaff: acc.esiStaff + m.esiStaff,
    pfEmployer: acc.pfEmployer + m.pfEmployer,
    esiEmployer: acc.esiEmployer + m.esiEmployer,
    loanStaff: acc.loanStaff + m.loanStaff,
    tdsSal: acc.tdsSal + m.tdsSal,
    ptaxSal: acc.ptaxSal + m.ptaxSal,
  }), {
    staffCount: 0, newJoined: 0, resigned: 0, netPayStaff: 0, netEmpLop: 0,
    pfStaff: 0, esiStaff: 0, pfEmployer: 0, esiEmployer: 0,
    loanStaff: 0, tdsSal: 0, ptaxSal: 0,
  });

  let body = `${buildConsolidatedPrintHeader(printSetup, monthRangeLabel, options.printedBy)}
<table border="0" cellpadding="5" cellspacing="0" class="table table-bordered payroll-consolidated-table">
<thead><tr>
<th rowspan="2">Month</th>
<th colspan="3">Employee Details</th>
<th>Net Pay</th>
<th>LOP</th>
<th>EPF(Staff)</th>
<th>ESI(Staff)</th>
<th>EPF(Employer)</th>
<th>ESI(Employer)</th>
<th>Loan</th>
<th>TDS</th>
<th>Professional Tax</th>
</tr>
<tr>
<th>Total No. of Employees</th>
<th>Newly Joined Employees</th>
<th>Resigned Employees</th>
</tr></thead><tbody>`;

  for (const m of rows) {
    body += metricsRowHtml(m);
  }
  body += metricsRowHtml({ monthLabel: 'Grand Total', ...totals }, true);
  body += '</tbody></table>';
  body = appendPayrollReportSignature(body, printSetup);
  body += '</div>';
  return body;
}
