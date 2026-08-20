import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { insertLog } from '../logService.js';

const ATT_MONTH_SHOW = true;
const ATT_MONTH_FROM = '2018-04-01';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatIndianMoney(amount) {
  const num = Number(amount) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// `monthStartDate` is a UTC-midnight DB date (see toSqlDate below) — always format
// it with timeZone: 'UTC' so the label matches the same calendar month as the SQL
// filter value regardless of the server's local timezone.
export function formatPayrollMonthLabel(monthStartDate) {
  const d = new Date(monthStartDate);
  if (Number.isNaN(d.getTime())) return String(monthStartDate);
  if (ATT_MONTH_SHOW) {
    return d.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  const prev = new Date(d);
  prev.setUTCMonth(prev.getUTCMonth() - 1);
  let fromLabel = prev.toLocaleString('en-IN', { month: 'long', year: d.getUTCMonth() === 0 ? '2-digit' : undefined, timeZone: 'UTC' });
  const toLabel = d.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  if (d.getUTCMonth() === 0) {
    fromLabel = prev.toLocaleString('en-IN', { month: 'long', year: '2-digit', timeZone: 'UTC' });
  }
  return `${fromLabel} - ${toLabel}`;
}

export function toSqlDate(val) {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export async function logPayrollPage(page, operation, description, memberId, audit = {}) {
  if (audit.skipLog) return;
  const logPromise = insertLog(
    [
      page,
      operation,
      'Successful',
      String(description || '').slice(0, 500),
      new Date(),
      audit.ip || '',
      audit.userAgent || '',
      memberId,
    ],
    audit.sessionId || '',
  );
  if (operation === 'View') return;
  await logPromise;
}

export async function loadAllPayrollMonthOptions() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT payroll_month FROM (
       SELECT payroll_month FROM staff_payroll_log
       WHERE del = 1 AND payroll_month >= '${escapeSql(ATT_MONTH_FROM)}'
       UNION
       SELECT payroll_month FROM staff_payroll_tb
       WHERE del = 1 AND payroll_month >= '${escapeSql(ATT_MONTH_FROM)}'
     ) AS months
     ORDER BY payroll_month DESC`,
  );
  return rows.map((row) => ({
    value: toSqlDate(row.payroll_month),
    label: formatPayrollMonthLabel(row.payroll_month),
  }));
}

export async function loadPayrollMonthOptions() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT L.payroll_month, L.generated_by, CAST(L.generated_on AS CHAR) AS generated_on
     FROM staff_payroll_log AS L
     INNER JOIN (
       SELECT payroll_month, MAX(generated_on) AS generated_on
       FROM staff_payroll_log
       WHERE del = 1 AND payroll_type = 'Salary'
       GROUP BY payroll_month
     ) AS latest
       ON L.payroll_month = latest.payroll_month AND L.generated_on = latest.generated_on
     WHERE L.del = 1 AND L.payroll_type = 'Salary'
     ORDER BY L.payroll_month DESC`,
  );
  return rows.map((row) => ({
    value: toSqlDate(row.payroll_month),
    label: formatPayrollMonthLabel(row.payroll_month),
    generatedBy: row.generated_by,
    generatedOn: row.generated_on,
  }));
}

/** Legacy salary_summary.php: active staff categories with payroll log for the month. */
export async function loadSalarySummaryCategoryOptions(payrollMonth) {
  if (!payrollMonth) return [];
  const monthSql = escapeSql(payrollMonth);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT B.id, B.category_name
     FROM staff_profile_tb AS A
     INNER JOIN edu_setup_tb AS B ON A.job_category = B.id
     INNER JOIN staff_payroll_log AS L
       ON L.del = 1 AND L.payroll_month = '${monthSql}'
       AND L.payroll_type = CAST(B.id AS CHAR)
     WHERE A.del = 1
       AND (A.releaving_date > '${monthSql}'
         OR CAST(A.releaving_date AS CHAR) = '0000-00-00')
       AND B.category = 'Category'
     ORDER BY B.category_order ASC`,
  );
  return rows.map((row) => ({
    value: String(row.id),
    label: row.category_name,
  }));
}

export async function getStaffOrderClause(idColumn = 'A.id') {
  const order = await getStaffOrderList();
  if (!order) return '';
  return ` ORDER BY FIELD(${idColumn}, ${order})`;
}

let staffOrderListCache = null;
let staffOrderListPromise = null;

async function getStaffOrderList() {
  if (staffOrderListCache !== null) return staffOrderListCache;
  if (!staffOrderListPromise) {
    staffOrderListPromise = prisma.$queryRawUnsafe(
      `SELECT GROUP_CONCAT(s_order SEPARATOR ', ') AS staff_order FROM staff_order LIMIT 1`,
    ).then((rows) => {
      staffOrderListCache = String(rows[0]?.staff_order || '').trim().replace(/,\s*$/, '');
      return staffOrderListCache;
    });
  }
  return staffOrderListPromise;
}

export async function loadCategoriesForMonth(payrollMonth) {
  if (!payrollMonth) return [];
  const monthSql = escapeSql(payrollMonth);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT B.id, B.category_name
     FROM edu_setup_tb AS B
     WHERE B.category = 'Category'
       AND (
         EXISTS (
           SELECT 1 FROM staff_payroll_log
           WHERE del = 1 AND payroll_month = '${monthSql}' AND payroll_type = CAST(B.id AS CHAR)
         )
         OR EXISTS (
           SELECT 1 FROM staff_payroll_tb AS P
           INNER JOIN staff_profile_tb AS A ON A.id = P.staff_id AND A.del = 1
           WHERE P.del = 1 AND P.payroll_month = '${monthSql}' AND A.job_category = B.id
         )
       )
     ORDER BY B.category_order ASC`,
  );
  return rows.map((row) => ({
    value: String(row.id),
    label: row.category_name,
  }));
}

export function buildCategoryFilter(categoryIds) {
  const ids = (Array.isArray(categoryIds) ? categoryIds : [categoryIds])
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  if (!ids.length) return '';
  return ` AND (${ids.map((id) => `A.job_category='${escapeSql(id)}'`).join(' OR ')})`;
}

export async function loadDesignationMap() {
  if (designationMapCache) return designationMapCache;
  if (!designationMapPromise) {
    designationMapPromise = prisma.$queryRawUnsafe(
      'SELECT id, name FROM staff_desg_master WHERE del = 1 ORDER BY d_order ASC',
    ).then((rows) => {
      const map = {};
      for (const row of rows) {
        map[row.id] = row.name;
      }
      designationMapCache = map;
      return map;
    });
  }
  return designationMapPromise;
}

let designationMapCache = null;
let designationMapPromise = null;

export async function loadPrintSignatureHtml(printId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT staff_name, staff_designation, print_format
     FROM print_signature_tb
     WHERE print_id = '${escapeSql(printId)}'
       AND category = 'signature'
       AND del != 0
     ORDER BY staff_order ASC`,
  );
  if (!rows.length) return '';

  const width = (100 / rows.length).toFixed(2);
  let tableClass = 'signature_table';
  const cells = rows.map((row) => {
    const formatSuffix = row.print_format ? `_${row.print_format}` : '';
    if (row.print_format) tableClass = `signature_table_${row.print_format}`;
    const nameClass = `footer_sign_name${formatSuffix}`;
    const desigClass = `footer_sign_desig${formatSuffix}`;
    return `<td valign="top" nowrap width="${width}%" align="center">
<p class="${nameClass}">${escapeHtml(row.staff_name)}</p>
${row.staff_designation ? `<p class="${desigClass}">${escapeHtml(row.staff_designation)}</p>` : ''}
</td>`;
  }).join('');

  return `<table border="0" cellpadding="3" cellspacing="0" width="100%" class="${tableClass}"><tr>${cells}</tr></table>`;
}

export function appendPayrollReportSignature(html, printSetup) {
  if (!html || !printSetup?.signatureHtml) return html;
  return `${html}${printSetup.signatureHtml}`;
}

export async function loadPayrollBannerUrl() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT banner_image FROM basic_banner_tb WHERE del = 1 AND id = 1 LIMIT 1',
  );
  const image = rows[0]?.banner_image;
  return image ? `/legacy/img/global_images/${encodeURIComponent(image)}` : '';
}

// Mirrors legacy widget.php's callPrintHeader() — logo cell + title/sub-title cell.
export async function prependPayrollLetterhead(html, printSetup) {
  if (!html) return html;
  const bannerUrl = await loadPayrollBannerUrl();
  const logo = bannerUrl ? `<img src="${bannerUrl}" alt="" style="max-height:70px;" />` : '';
  const title = printSetup?.title ? `<p class="pc_title title">${escapeHtml(printSetup.title)}</p>` : '';
  const subTitle = printSetup?.sub_title ? `<p class="pc_sub-title sub-title">${escapeHtml(printSetup.sub_title)}</p>` : '';
  if (!logo && !title && !subTitle) return html;
  const header = `<table class="header_table" border="0" cellpadding="0" cellspacing="0" width="100%"><tbody>
<tr><td height="70" valign="middle" width="30%">${logo}</td>
<td nowrap align="right" valign="top" width="70%"><div class="promote_card">${title}${subTitle}</div></td></tr>
</tbody></table>`;
  return `${header}${html}`;
}

export async function loadPrintSetup(printId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT title, sub_title, body_title, page_note, generated_by, page_no, row_count, footer,
            right_text, home_header, inner_header, home_height, inner_height, signature
     FROM print_setup_tb WHERE del = 1 AND id = '${escapeSql(printId)}' LIMIT 1`,
  );
  const setup = rows[0] || {
    title: 'Payroll Report',
    sub_title: '',
    body_title: '',
    page_note: '',
    generated_by: 1,
    page_no: 1,
    row_count: 30,
    footer: 0,
    right_text: '',
    home_header: '',
    inner_header: '',
    home_height: 0,
    inner_height: 0,
    signature: 0,
  };
  const signatureHtml = Number(setup.signature) === 1
    ? await loadPrintSignatureHtml(printId)
    : '';
  return { ...setup, signatureHtml };
}

export async function loadPayrollTotals(payrollMonth, categoryFilterSql) {
  const monthSql = escapeSql(payrollMonth);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT
       SUM(B.total_amount) AS assured,
       SUM(B.gross_pay) AS gross,
       SUM(B.total_deduction) AS deduction,
       SUM(B.net_pay) AS net_pay,
       SUM(B.lop_amount) AS lop,
       SUM(B.arrear_amount) AS arrear,
       SUM(B.loan_amount) AS loan,
       SUM(B.other_deduction) AS other_deduction,
       SUM(B.tds_amount) AS tds,
       SUM(B.prof_tax) AS prof_tax,
       SUM(B.advance_amount) AS advance,
       SUM(B.rental_amount) AS rental,
       SUM(B.hostel_amount) AS hostel,
       SUM(B.pf_amount) AS pf,
       SUM(B.esi_amount) AS esi
     FROM staff_profile_tb AS A
     INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND B.del = 1
       AND B.payroll_month = '${monthSql}'
       ${categoryFilterSql}`,
  );
  return rows[0] || {};
}

export async function loadBankTransferSummary(payrollMonth, categoryFilterSql) {
  const monthSql = escapeSql(payrollMonth);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT B.pay_bank, B.pay_type, SUM(B.net_pay) AS amount
     FROM staff_profile_tb AS A
     INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND B.del = 1 AND B.net_pay > 0
       AND B.payroll_month = '${monthSql}'
       ${categoryFilterSql}
     GROUP BY B.pay_bank, B.pay_type`,
  );

  const banks = await prisma.edu_setup_tb.findMany({
    where: { category: 'Bank', del: 1 },
    orderBy: { category_order: 'asc' },
  });
  const bankNames = {};
  for (const bank of banks) {
    bankNames[bank.id] = bank.category_sname || bank.category_name;
  }

  const lines = [];
  let total = 0;
  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    if (amount <= 0) continue;
    total += amount;
    const name = row.pay_type === 'Cheque'
      ? 'Cheque'
      : (bankNames[row.pay_bank] || 'Bank Transfer');
    lines.push({ name, amount });
  }
  return { lines, total };
}
