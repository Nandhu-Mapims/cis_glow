import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import {
  appendPayrollReportSignature,
  escapeHtml,
  formatIndianMoney,
  getStaffOrderClause,
  loadDesignationMap,
  loadPrintSetup,
} from './payrollHelpers.js';
import { normalizeReportFor, parseBankTransferRef } from './payrollReportCore.js';

const SIGN_SETUP = {
  bank: '5',
  rental: '6',
  mess: '7',
  pf: '8',
  esi: '9',
  lop_amount: '10',
  arrear_amount: '11',
  loan_amount: '12',
  other_deduction: '14',
  tds_amount: '13',
  prof_tax: '15',
  advance_amount: '18',
  gross_pay: '195',
};

const PAY_COLUMN = {
  bank: 'net_pay',
  rental: 'rental_amount',
  mess: 'hostel_amount',
  pf: 'pf_amount',
  esi: 'esi_amount',
  lop_amount: 'lop_amount',
  arrear_amount: 'arrear_amount',
  loan_amount: 'loan_amount',
  other_deduction: 'other_deduction',
  tds_amount: 'tds_amount',
  prof_tax: 'prof_tax',
  advance_amount: 'advance_amount',
  gross_pay: 'gross_pay',
};

function staffDisplayName(row) {
  const title = row.staff_title ? `${String(row.staff_title).trim()}. ` : '';
  return `${title}${String(row.staff_name || '').trim()} ${String(row.staff_initial || '').trim()}`.trim();
}

function normalizeMonthSql(month) {
  const d = new Date(month);
  return Number.isNaN(d.getTime()) ? String(month).slice(0, 10) : d.toISOString().slice(0, 10);
}

function formatGroupMonthColumnHeader(monthSql) {
  const d = new Date(monthSql);
  if (Number.isNaN(d.getTime())) return escapeHtml(String(monthSql));
  const monthName = d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const year = d.getUTCFullYear();
  return `${escapeHtml(monthName)}<br>${year}`;
}

function buildBankFilter(reportFor, reportForRaw) {
  if (reportFor !== 'bank') return '';
  const transferRef = parseBankTransferRef(reportForRaw);
  if (transferRef === 'cheque') return " AND B.pay_type = 'Cheque'";
  if (transferRef) return ` AND B.pay_bank = '${escapeSql(transferRef)}'`;
  return '';
}

async function loadBankTitle(reportFor, reportForRaw) {
  if (reportFor !== 'bank') return '';
  const transferRef = parseBankTransferRef(reportForRaw);
  if (transferRef === 'cheque') return 'Cheque';
  if (!transferRef) return '';
  const rows = await prisma.$queryRawUnsafe(
    `SELECT category_name FROM edu_setup_tb WHERE id = '${escapeSql(transferRef)}' AND del = 1 LIMIT 1`,
  );
  return rows[0]?.category_name || '';
}

export async function buildGroupReportHtml(options) {
  const {
    payrollMonths,
    categoryFilterSql,
    reportForRaw,
  } = options;

  if (!payrollMonths?.length || !categoryFilterSql || !reportForRaw) return '';

  const reportFor = normalizeReportFor(reportForRaw);
  const payColumn = PAY_COLUMN[reportFor];
  if (!payColumn) {
    return `<p class="text-muted">Report type "${escapeHtml(reportFor)}" is not yet ported natively.</p>`;
  }

  const sortedMonths = [...new Set(payrollMonths.map(normalizeMonthSql))].sort();
  const monthFrom = sortedMonths[0];
  const monthListSql = sortedMonths.map((m) => `'${escapeSql(m)}'`).join(', ');
  const bankFilter = buildBankFilter(reportFor, reportForRaw);
  const categoryOnlyFilter = categoryFilterSql.replace(/A\.job_category/g, 'job_category');

  const [designationMap, orderClause, printSetup, bankTitle] = await Promise.all([
    loadDesignationMap(),
    getStaffOrderClause('A.id'),
    loadPrintSetup(SIGN_SETUP[reportFor] || SIGN_SETUP.gross_pay),
    loadBankTitle(reportFor, reportForRaw),
  ]);
  const staffOrderClause = orderClause.replace(/A\.id/g, 'id');

  const [staffRows, payrollRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT id, staff_id, staff_title, staff_name, staff_initial
       FROM staff_profile_tb AS A
       WHERE del = 1
         ${categoryOnlyFilter}
         AND (CAST(releaving_date AS CHAR) = '0000-00-00' OR releaving_date >= '${escapeSql(monthFrom)}')
       ${staffOrderClause}`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT B.staff_id, CAST(B.payroll_month AS CHAR) AS payroll_month,
              B.${payColumn} AS amount, B.designation
       FROM staff_payroll_tb AS B
       WHERE B.del = 1
         AND B.payroll_month IN (${monthListSql})
         ${bankFilter}`,
    ),
  ]);

  const payrollByStaff = new Map();
  for (const row of payrollRows) {
    const staffKey = String(row.staff_id);
    const monthKey = String(row.payroll_month).slice(0, 10);
    if (!payrollByStaff.has(staffKey)) payrollByStaff.set(staffKey, new Map());
    payrollByStaff.get(staffKey).set(monthKey, row);
  }

  const monthHeaders = sortedMonths.map((m) =>
    `<th width="10%">${formatGroupMonthColumnHeader(m)}</th>`,
  ).join('');

  const subtitle = [printSetup.sub_title, bankTitle].filter(Boolean).join(' ').trim();
  let body = `${subtitle ? `<p class="header2">${escapeHtml(subtitle)}</p>` : ''}
<table border="0" cellpadding="5" cellspacing="0" class="table table-bordered">
<thead><tr>
<th width="10%">#</th>
<th width="15%">Staff ID</th>
<th width="30%">Name</th>
<th width="30%">Designation</th>
${monthHeaders}
<th width="15%">Total</th>
</tr></thead><tbody>`;

  const monthTotals = {};
  let counter = 0;

  for (const staff of staffRows) {
    let rowTotal = 0;
    let designation = '';
    const monthCells = [];
    const staffPayroll = payrollByStaff.get(String(staff.id)) || new Map();

    for (const month of sortedMonths) {
      const payRow = staffPayroll.get(month);
      const amount = Number(payRow?.amount) || 0;
      if (!designation && payRow?.designation) {
        designation = designationMap[payRow.designation] || '';
      }
      rowTotal += amount;
      monthTotals[month] = (monthTotals[month] || 0) + amount;
      monthCells.push(`<td align="right">${formatIndianMoney(amount)}</td>`);
    }

    if (rowTotal > 0) {
      counter += 1;
      monthTotals.total = (monthTotals.total || 0) + rowTotal;
      body += `<tr>
<td>${counter}</td>
<td>${escapeHtml(staff.staff_id)}</td>
<td nowrap>${escapeHtml(staffDisplayName(staff))}</td>
<td>${escapeHtml(designation)}</td>
${monthCells.join('')}
<td align="right" bgcolor="#F4F4F4"><strong>${formatIndianMoney(rowTotal)}</strong></td>
</tr>`;
    }
  }

  if ((monthTotals.total || 0) > 0) {
    const totalCells = sortedMonths.map((m) =>
      `<td align="right"><strong>${formatIndianMoney(monthTotals[m] || 0)}</strong></td>`,
    ).join('');

    body += `<tr>
<td> </td>
<td> </td>
<td> </td>
<td><strong>Total</strong></td>
${totalCells}
<td align="right" bgcolor="#F4F4F4"><strong>${formatIndianMoney(monthTotals.total || 0)}</strong></td>
</tr>`;
  }

  body += '</tbody></table>';
  const title = printSetup.title || printSetup.body_title || 'Payroll Group Report';
  return appendPayrollReportSignature(`<p class="header1">${escapeHtml(title)}</p>${body}`, printSetup);
}
