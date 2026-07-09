import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import {
  appendPayrollReportSignature,
  buildCategoryFilter,
  escapeHtml,
  formatIndianMoney,
  formatPayrollMonthLabel,
  getStaffOrderClause,
  loadPrintSetup,
  logPayrollPage,
} from './payrollHelpers.js';
import { loadJobCategoryOptions, staffDisplayName } from './payrollShared.js';

const PAGE = 'staff_tax_report.php';

function buildTaxHalfYearAnchors() {
  const now = new Date();
  const cyear = now.getFullYear();
  const cmonth = now.getMonth() + 1;
  const anchors = [];

  for (let year = cyear; year >= 2017; year -= 1) {
    let yearArray = [];
    if (year === cyear) {
      if (cmonth <= 3) yearArray = [`${year}-03-01`];
      else if (cmonth <= 9) yearArray = [`${year}-09-01`, `${year}-03-01`];
      else yearArray = [`${year + 1}-03-01`, `${year}-09-01`, `${year}-03-01`];
    } else {
      yearArray = [`${year}-09-01`, `${year}-03-01`];
    }
    for (const anchor of yearArray) {
      const d = new Date(anchor);
      const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      anchors.push({ value: anchor, label });
    }
  }
  return anchors;
}

function sixMonthRange(anchorMonth) {
  const end = new Date(anchorMonth);
  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 10));
  }
  return months;
}

function monthKey(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function buildPayrollLookup(payrollRows) {
  const byStaff = new Map();
  for (const row of payrollRows) {
    const staffId = Number(row.staff_id);
    if (!byStaff.has(staffId)) byStaff.set(staffId, new Map());
    byStaff.get(staffId).set(monthKey(row.payroll_month), row);
  }
  return byStaff;
}

async function buildTaxReportHtml(anchorMonth, categoryFilterSql, reportType) {
  const months = sixMonthRange(anchorMonth);
  const monthFrom = escapeSql(months[0]);
  const monthTo = escapeSql(months[5]);
  const isTds = reportType === 'TDS';

  const [printSetup, orderClause] = await Promise.all([
    loadPrintSetup('3'),
    getStaffOrderClause(),
  ]);

  const [staffRows, payrollRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT A.id, A.staff_id, A.staff_name, A.staff_initial, A.staff_title, A.pan_no
       FROM staff_profile_tb AS A
       WHERE A.del = 1
         AND (CAST(A.releaving_date AS CHAR) = '0000-00-00' OR A.releaving_date >= '${monthFrom}')
         ${categoryFilterSql}
       ${orderClause}`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT B.staff_id,
              CAST(B.payroll_month AS CHAR) AS payroll_month,
              B.tds_amount, B.gross_pay, B.prof_tax
       FROM staff_payroll_tb AS B
       INNER JOIN staff_profile_tb AS A ON A.id = B.staff_id
       WHERE B.del = 1 AND A.del = 1
         AND B.payroll_month >= '${monthFrom}'
         AND B.payroll_month <= '${monthTo}'
         ${categoryFilterSql}`,
    ),
  ]);

  const payrollByStaff = buildPayrollLookup(payrollRows);
  const monthHeaders = months.map((m) => `<th>${escapeHtml(formatPayrollMonthLabel(m))}</th>`).join('');
  const footerTotals = Object.fromEntries([...months.map((m) => [m, 0]), ['total', 0], ['tax', 0]]);

  let html = `<p class="header1">${escapeHtml(printSetup.body_title || reportType)} Report</p>
<p class="header2">Period ending ${escapeHtml(formatPayrollMonthLabel(anchorMonth))}</p>
<table border="0" cellpadding="3" cellspacing="0" class="table table-bordered">
<thead><tr bgcolor="#CCC">
<th>S.No</th><th>Staff ID</th><th>Name</th><th>PAN</th>${monthHeaders}
<th>Total</th>${isTds ? '' : '<th>Prof.Tax</th>'}
</tr></thead><tbody>`;

  const bodyRows = [];
  let counter = 0;

  for (const staff of staffRows) {
    const staffPayroll = payrollByStaff.get(Number(staff.id)) || new Map();
    const monthCells = [];
    let rowTotal = 0;
    let rowTaxTotal = 0;

    for (const m of months) {
      const pay = staffPayroll.get(m);
      if (isTds) {
        const amt = Number(pay?.tds_amount) || 0;
        rowTotal += amt;
        footerTotals[m] += amt;
        footerTotals.total += amt;
        monthCells.push(`<td class="text-right">${formatIndianMoney(amt)}</td>`);
      } else {
        const gross = Number(pay?.gross_pay) || 0;
        const tax = Number(pay?.prof_tax) || 0;
        rowTotal += gross;
        rowTaxTotal += tax;
        footerTotals[m] += gross;
        footerTotals.total += gross;
        footerTotals.tax += tax;
        monthCells.push(`<td class="text-right">${formatIndianMoney(gross)}</td>`);
      }
    }

    const includeRow = isTds ? rowTotal > 0 : rowTaxTotal > 0;
    if (!includeRow) continue;

    counter += 1;
    bodyRows.push(`<tr>
<td>${counter}</td>
<td>${escapeHtml(staff.staff_id)}</td>
<td nowrap>${escapeHtml(staffDisplayName(staff))}</td>
<td>${escapeHtml(staff.pan_no || '')}</td>
${monthCells.join('')}
<td class="text-right" bgcolor="#F4F4F4"><strong>${formatIndianMoney(rowTotal)}</strong></td>
${isTds ? '' : `<td class="text-right" bgcolor="#EEEEEE"><strong>${formatIndianMoney(rowTaxTotal)}</strong></td>`}
</tr>`);
  }

  html += bodyRows.join('');

  if (footerTotals.total > 0) {
    const footerMonthCells = months.map((m) => (
      `<td class="text-right"><strong>${formatIndianMoney(footerTotals[m] || 0)}</strong></td>`
    )).join('');
    html += `<tr>
<td></td><td></td><td><strong>Total</strong></td><td></td>
${footerMonthCells}
<td class="text-right" bgcolor="#F4F4F4"><strong>${formatIndianMoney(footerTotals.total)}</strong></td>
${isTds ? '' : `<td class="text-right" bgcolor="#EEEEEE"><strong>${formatIndianMoney(footerTotals.tax)}</strong></td>`}
</tr>`;
  }

  html += '</tbody></table>';
  return appendPayrollReportSignature(html, printSetup);
}

export async function loadPayrollTaxReport(memberId, fields = {}, audit = {}) {
  const monthOptions = buildTaxHalfYearAnchors();
  const payrollMonth = String(fields.payroll_month || '').trim();
  const searchCategory = Array.isArray(fields.search_category)
    ? fields.search_category.map(String)
    : (fields.search_category ? [String(fields.search_category)] : []);
  const reportType = String(fields.report_type || 'TDS');
  const isGenerate = fields.Submit === 'Generate';

  const categoryOptions = payrollMonth
    ? await loadJobCategoryOptions(payrollMonth, searchCategory)
    : await loadJobCategoryOptions('', searchCategory);
  const categoryFilterSql = buildCategoryFilter(searchCategory);

  let reportHtml = '';
  if (isGenerate && payrollMonth && categoryFilterSql) {
    reportHtml = await buildTaxReportHtml(payrollMonth, categoryFilterSql, reportType);
    await logPayrollPage(
      PAGE,
      'Generate',
      `${payrollMonth}___${searchCategory.join(',')}___${reportType}`,
      memberId,
      audit,
    );
  } else {
    await logPayrollPage(PAGE, 'View', payrollMonth, memberId, audit);
  }

  return {
    monthOptions,
    categoryOptions,
    reportTypeOptions: [
      { value: 'Professional Tax', label: 'Professional Tax' },
      { value: 'TDS', label: 'TDS' },
    ],
    selected: { payrollMonth, searchCategory, reportType },
    reportHtml,
    canPrint: Boolean(reportHtml),
  };
}
