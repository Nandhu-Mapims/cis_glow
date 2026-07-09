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
import { loadJobCategoryOptions, loadSalaryPayrollMonthOptions, staffDisplayName } from './payrollShared.js';

const PAGE = 'payroll_monthly_report.php';

const REPORT_COLUMNS = {
  net_pay: { label: 'Net Pay', field: 'net_pay' },
  rental: { label: 'Rental', field: 'rental_amount' },
  mess: { label: 'Mess', field: 'hostel_amount' },
  pf: { label: 'PF', field: 'pf_amount' },
  esi: { label: 'ESI', field: 'esi_amount' },
  lop_amount: { label: 'LOP', field: 'lop_amount' },
  arrear_amount: { label: 'Arrear', field: 'arrear_amount' },
  loan_amount: { label: 'Loan', field: 'loan_amount' },
  tds_amount: { label: 'TDS', field: 'tds_amount' },
  prof_tax: { label: 'Prof. Tax', field: 'prof_tax' },
  other_deduction: { label: 'Other Ded.', field: 'other_deduction' },
  advance_amount: { label: 'Advance', field: 'advance_amount' },
};

const PAYROLL_FIELDS = [...new Set(Object.values(REPORT_COLUMNS).map((meta) => meta.field))];

function monthRange(fromMonth, toMonth) {
  const months = [];
  let current = new Date(fromMonth);
  const end = new Date(toMonth);
  if (current > end) return months;
  while (current <= end) {
    months.push(current.toISOString().slice(0, 10));
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
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

async function buildMonthlyReportHtml(fromMonth, toMonth, categoryFilterSql, reportFor) {
  const months = monthRange(fromMonth, toMonth);
  if (!months.length) return '';

  const fromSql = escapeSql(fromMonth);
  const toSql = escapeSql(toMonth);

  const [printSetup, orderClause] = await Promise.all([
    loadPrintSetup('3'),
    getStaffOrderClause(),
  ]);

  const [staffRows, payrollRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT DISTINCT A.id, A.staff_id, A.staff_name, A.staff_initial, A.staff_title
       FROM staff_profile_tb AS A
       INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
       WHERE A.del = 1 AND B.del = 1
         AND B.payroll_month >= '${fromSql}'
         AND B.payroll_month <= '${toSql}'
         ${categoryFilterSql}
       ${orderClause}`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT B.staff_id,
              CAST(B.payroll_month AS CHAR) AS payroll_month,
              ${PAYROLL_FIELDS.map((field) => `B.${field}`).join(', ')}
       FROM staff_payroll_tb AS B
       INNER JOIN staff_profile_tb AS A ON A.id = B.staff_id
       WHERE B.del = 1 AND A.del = 1
         AND B.payroll_month >= '${fromSql}'
         AND B.payroll_month <= '${toSql}'
         ${categoryFilterSql}`,
    ),
  ]);

  const payrollByStaff = buildPayrollLookup(payrollRows);
  const activeColumns = reportFor
    .map((col) => REPORT_COLUMNS[col])
    .filter(Boolean);

  const monthHeaders = activeColumns.flatMap((meta) => (
    months.map((m) => `<th>${escapeHtml(meta.label)}<br><small>${escapeHtml(formatPayrollMonthLabel(m))}</small></th>`)
  )).join('');

  const bodyRows = staffRows.map((staff, idx) => {
    const staffPayroll = payrollByStaff.get(Number(staff.id)) || new Map();
    const cells = activeColumns.flatMap((meta) => (
      months.map((m) => {
        const pay = staffPayroll.get(m);
        const amt = Number(pay?.[meta.field]) || 0;
        return `<td class="text-right">${amt ? formatIndianMoney(amt) : '—'}</td>`;
      })
    )).join('');

    return `<tr>
<td>${idx + 1}</td>
<td>${escapeHtml(staff.staff_id)}</td>
<td nowrap>${escapeHtml(staffDisplayName(staff))}</td>
${cells}
</tr>`;
  });

  const html = `<p class="header1">${escapeHtml(printSetup.body_title || 'Monthly Payroll Report')}</p>
<p class="header2">${escapeHtml(formatPayrollMonthLabel(fromMonth))} to ${escapeHtml(formatPayrollMonthLabel(toMonth))}</p>
<table border="0" cellpadding="3" cellspacing="0" class="table table-bordered">
<thead><tr bgcolor="#CCC">
<th>S.No</th><th>Staff ID</th><th>Name</th>${monthHeaders}
</tr></thead><tbody>${bodyRows.join('')}</tbody></table>`;

  return appendPayrollReportSignature(html, printSetup);
}

export async function loadPayrollMonthlyReport(memberId, fields = {}, audit = {}) {
  const monthOptions = await loadSalaryPayrollMonthOptions();
  const payrollFmonth = String(fields.payroll_fmonth || '').trim();
  const payrollTmonth = String(fields.payroll_tmonth || payrollFmonth).trim();
  const searchCategory = Array.isArray(fields.search_category)
    ? fields.search_category.map(String)
    : (fields.search_category ? [String(fields.search_category)] : []);
  const reportFor = Array.isArray(fields.report_for)
    ? fields.report_for.map(String)
    : (fields.report_for ? [String(fields.report_for)] : []);
  const isGenerate = fields.Submit === 'Generate';

  const categoryOptions = await loadJobCategoryOptions(payrollFmonth, searchCategory);
  const categoryFilterSql = buildCategoryFilter(searchCategory);

  let reportHtml = '';
  if (isGenerate && payrollFmonth && payrollTmonth && categoryFilterSql && reportFor.length) {
    reportHtml = await buildMonthlyReportHtml(
      payrollFmonth, payrollTmonth, categoryFilterSql, reportFor,
    );
    await logPayrollPage(
      PAGE,
      'Generate',
      `${payrollFmonth}___${payrollTmonth}___${reportFor.join(',')}`,
      memberId,
      audit,
    );
  } else {
    await logPayrollPage(PAGE, 'View', payrollFmonth, memberId, audit);
  }

  return {
    monthOptions,
    categoryOptions,
    reportForOptions: Object.entries(REPORT_COLUMNS).map(([value, meta]) => ({
      value,
      label: meta.label,
    })),
    selected: { payrollFmonth, payrollTmonth, searchCategory, reportFor },
    reportHtml,
    canPrint: Boolean(reportHtml),
  };
}
