import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import {
  appendPayrollReportSignature,
  buildCategoryFilter,
  escapeHtml,
  formatPayrollMonthLabel,
  getStaffOrderClause,
  loadCategoriesForMonth,
  loadPrintSetup,
  logPayrollPage,
  toSqlDate,
} from './payrollHelpers.js';
import {
  loadGeneratedPayrollMonthOptions,
  staffDisplayName,
} from './payrollShared.js';

const PAGE = 'payroll_report.php';

function parseAttStatement(raw) {
  if (!raw) return {};
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return {};
  }
}

function addCalendarDay(ymd, delta) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function formatStatementDayLabel(ymd) {
  const d = new Date(`${ymd}T00:00:00Z`);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(d.getUTCFullYear()).slice(-2);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${dd}-${mm}-${yy} | ${days[d.getUTCDay()]}`;
}

function buildStatementHeader(fromDate, toDate) {
  let header = '';
  const from = toSqlDate(fromDate);
  const to = toSqlDate(toDate);
  if (!from || !to || from === '0000-00-00' || to === '0000-00-00') return header;
  for (let key = from; key <= to; key = addCalendarDay(key, 1)) {
    header += `<th width="20" nowrap class="valign_btm"><div class="att_vtext">${escapeHtml(formatStatementDayLabel(key))}</div></th>`;
  }
  return header;
}

function buildStatementCells(stmt, fromDate, toDate) {
  let cells = '';
  const from = toSqlDate(fromDate);
  const to = toSqlDate(toDate);
  if (!from || !to) return cells;
  for (let key = from; key <= to; key = addCalendarDay(key, 1)) {
    const attStatus = stmt.att?.[key] ?? '';
    const acmd = stmt.cmd?.[key] ?? '';
    const bg = String(attStatus).toLowerCase() === 'h' ? ' bgcolor="#F8BBCA" ' : '';
    cells += `<td${bg}>${escapeHtml(attStatus)}${acmd ? `<small style="font-size:8px;"><br>${escapeHtml(acmd)}</small>` : ''}</td>`;
  }
  return cells;
}

async function buildAttReportHtml(payrollMonth, categoryFilterSql, reportType, categoryLabels) {
  const printSetup = await loadPrintSetup('2');
  const orderClause = await getStaffOrderClause();
  const monthSql = escapeSql(payrollMonth);

  let stmtFrom = '';
  let stmtTo = '';
  if (reportType === 'Statement') {
    const fromRows = await prisma.$queryRawUnsafe(
      `SELECT B.p_from_date FROM staff_profile_tb AS A
       INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
       WHERE A.del = 1 AND B.del = 1 AND B.payroll_month = '${monthSql}'
         AND CAST(B.p_from_date AS CHAR) != '0000-00-00'
         ${categoryFilterSql}
       ORDER BY B.p_from_date ASC LIMIT 1`,
    );
    const toRows = await prisma.$queryRawUnsafe(
      `SELECT B.p_to_date FROM staff_profile_tb AS A
       INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
       WHERE A.del = 1 AND B.del = 1 AND B.payroll_month = '${monthSql}'
         AND CAST(B.p_to_date AS CHAR) != '0000-00-00'
         ${categoryFilterSql}
       ORDER BY B.p_to_date DESC LIMIT 1`,
    );
    stmtFrom = fromRows[0]?.p_from_date ? toSqlDate(fromRows[0].p_from_date) : '';
    stmtTo = toRows[0]?.p_to_date ? toSqlDate(toRows[0].p_to_date) : '';
    if (!stmtFrom || !stmtTo) reportType = 'Report';
  }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.id, A.staff_id, A.staff_name, A.staff_initial, A.staff_title,
            B.total_days, B.working_days, B.a_present, B.a_late, B.a_permission,
            B.a_leave, B.a_llp, B.a_absent, B.att_statement
     FROM staff_profile_tb AS A
     INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND B.del = 1 AND B.payroll_month = '${monthSql}'
       ${categoryFilterSql}
     ${orderClause}`,
  );

  const deptLabel = categoryLabels.join(', ');
  const monthLabel = formatPayrollMonthLabel(payrollMonth);
  let html = `<div class="att_report_span" id="att_report_span">
<p class="header1">${escapeHtml(printSetup.body_title || printSetup.title || 'Attendance Report')} &nbsp;</p>
<p class="header2">Department(s): ${escapeHtml(deptLabel)}</p>
<p class="header2">Month: ${escapeHtml(monthLabel)}</p>`;

  if (!rows.length) {
    html += `<p class="payroll-report-empty">No payroll records found for ${escapeHtml(deptLabel)} in ${escapeHtml(monthLabel)}. Payroll must be generated first from <strong>Payroll &rarr; Generate Payroll</strong> for this month and category, then return here to view the attendance report.</p>`;
  }

  html += `<table border="0" cellpadding="5" cellspacing="0" class="table table-bordered" id="payroll">
<thead><tr bgcolor="#CCC">
<th width="30">S.No</th><th width="100" nowrap>Staff ID</th><th width="200">Staff Name</th>`;

  if (reportType === 'Statement' && stmtFrom && stmtTo) {
    html += buildStatementHeader(stmtFrom, stmtTo);
    html += `<th width="20" class="valign_btm"><div class="att_vtext">Ava. OD</div></th>
<th width="20" class="valign_btm"><div class="att_vtext">Ava. CL</div></th>
<th width="20" class="valign_btm"><div class="att_vtext">Ava. EL</div></th>
<th width="40">T.D</th><th width="40">W.D</th><th width="40">Pr</th>
<th width="40">OD</th><th width="40">CL</th><th width="40">EL</th>
<th width="40">Ab</th><th width="40">La</th><th width="40">Pe</th>
<th width="40">LOP</th><th width="40" height="80">%</th>`;
  } else {
    html += `<th width="40">T.D</th><th width="40">W.D</th><th width="40">Pr</th>
<th width="40">Le</th><th width="40">Ab</th><th width="40">La</th>
<th width="40">Pe</th><th width="40" height="30">LOP</th>`;
  }

  html += '</tr></thead><tbody>';

  rows.forEach((row, idx) => {
    const name = staffDisplayName(row);
    html += `<tr><td height="25">${idx + 1}</td><td>${escapeHtml(row.staff_id)}</td><td nowrap>${escapeHtml(name)}</td>`;

    if (reportType === 'Statement' && stmtFrom && stmtTo) {
      const stmt = parseAttStatement(row.att_statement);
      html += buildStatementCells(stmt, stmtFrom, stmtTo);
      html += `<td>${escapeHtml(stmt.ava_od ?? '')}</td>
<td>${escapeHtml(stmt.ava_cl ?? '')}</td>
<td>${escapeHtml(stmt.ava_el ?? '')}</td>
<td class="text-right">${escapeHtml(stmt.total_days ?? '')}</td>
<td class="text-right">${escapeHtml(stmt.working_days ?? '')}</td>
<td class="text-right">${escapeHtml(stmt.present_days ?? '')}</td>
<td class="text-right">${escapeHtml(stmt.tot_od ?? '')}</td>
<td class="text-right">${escapeHtml(stmt.tot_cl ?? '')}</td>
<td class="text-right">${escapeHtml(stmt.tot_el ?? '')}</td>
<td class="text-right">${escapeHtml(stmt.absent_days ?? '')}</td>
<td class="text-right">${escapeHtml(stmt.late_days ?? '')}</td>
<td class="text-right">${escapeHtml(stmt.permission_days ?? '')}</td>
<td class="text-right">${escapeHtml(stmt.lop_days ?? '')}</td>
<td class="text-right">${escapeHtml(stmt.att_present ?? '')}</td>`;
    } else {
      html += `<td class="text-right">${row.total_days}</td>
<td class="text-right">${row.working_days}</td>
<td class="text-right">${row.a_present}</td>
<td class="text-right">${row.a_leave}</td>
<td class="text-right">${row.a_absent}</td>
<td class="text-right">${row.a_late}</td>
<td class="text-right">${row.a_permission}</td>
<td class="text-right">${row.a_llp}</td>`;
    }
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  return appendPayrollReportSignature(html, printSetup);
}

export async function loadPayrollAttReport(memberId, fields = {}, audit = {}) {
  const monthOptions = await loadGeneratedPayrollMonthOptions();
  let payrollMonth = String(fields.payroll_month || '').trim();
  if (!payrollMonth && monthOptions[0]?.value) {
    payrollMonth = monthOptions[0].value;
  }
  const searchCategory = Array.isArray(fields.search_category)
    ? fields.search_category.map(String)
    : (fields.search_category ? [String(fields.search_category)] : []);
  const reportType = String(fields.report_type || 'Statement');
  const isGenerate = fields.Submit === 'Generate';

  const categoryOptions = payrollMonth
    ? await loadCategoriesForMonth(payrollMonth)
    : [];
  const categoryFilterSql = buildCategoryFilter(searchCategory);
  const categoryLabels = categoryOptions
    .filter((c) => searchCategory.includes(c.value))
    .map((c) => c.label);

  let reportHtml = '';
  if (isGenerate && payrollMonth && categoryFilterSql) {
    reportHtml = await buildAttReportHtml(payrollMonth, categoryFilterSql, reportType, categoryLabels);
    await logPayrollPage(PAGE, 'Generate', `${payrollMonth}___${searchCategory.join(',')}`, memberId, audit);
  } else {
    await logPayrollPage(PAGE, 'View', payrollMonth, memberId, audit);
  }

  return {
    monthOptions,
    categoryOptions,
    reportTypeOptions: [
      { value: 'Statement', label: 'Statement' },
      { value: 'Report', label: 'Report' },
    ],
    selected: { payrollMonth, searchCategory, reportType },
    reportHtml,
    canPrint: Boolean(reportHtml && /<tr><td[^>]*>\s*1\s*<\/td>/i.test(reportHtml)),
    reportEmpty: Boolean(
      isGenerate && payrollMonth && categoryFilterSql && reportHtml
      && !/<tr><td[^>]*>\s*1\s*<\/td>/i.test(reportHtml),
    ),
  };
}
