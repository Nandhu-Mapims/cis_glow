import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { escapeHtml, loadPrintSetup } from './payrollHelpers.js';
import { buildStipendDbHtml } from './stipendDbCore.js';
import { appendStipendReportSignature, buildStipendStatementHtml } from './stipendReportsCore.js';

const PAGE_BREAK = '<div style="width:100%; height:10px; clear:both; page-break-after:always;"></div>';
const STIPEND_DASHBOARD_PRINT_ID = '197';
const STIPEND_STATEMENT_PRINT_ID = '196';

export async function loadStipendPayrollRowsForMonth(payrollMonthSql) {
  const monthSql = escapeSql(payrollMonthSql);
  if (!monthSql || monthSql.startsWith('0000')) return [];

  return prisma.$queryRawUnsafe(
    `SELECT DISTINCT C.*, A.register_no, B.student_title, B.student_name, B.student_initial
     FROM student_profile_tb AS B
     INNER JOIN stipend_payroll_tb AS C ON B.id = C.staff_id AND C.del = 1
     INNER JOIN student_academic_tb AS A ON A.register_no = B.register_no AND A.del = 1
     WHERE B.del = 1
       AND C.payroll_month = '${monthSql}'
       AND C.total_amount > 0
     ORDER BY A.register_no ASC`,
  );
}

export async function buildStipendIndividualBundleHtml(options) {
  const { payrollMonth } = options;
  const rows = await loadStipendPayrollRowsForMonth(payrollMonth);

  const [dashboardSetup, statementSetup, dashboardHtml] = await Promise.all([
    loadPrintSetup(STIPEND_DASHBOARD_PRINT_ID),
    loadPrintSetup(STIPEND_STATEMENT_PRINT_ID),
    buildStipendDbHtml(payrollMonth),
  ]);

  const statementHtml = await appendStipendReportSignature(
    buildStipendStatementHtml(rows, { bodyTitle: statementSetup.body_title || '' }),
    'stipend-statement',
  );

  const sections = [];
  if (dashboardHtml) {
    sections.push(`<h3>${escapeHtml(dashboardSetup.title || 'Payroll Dashboard')}</h3>${dashboardHtml}${PAGE_BREAK}`);
  }
  if (statementHtml) {
    sections.push(`<h3>${escapeHtml(statementSetup.title || 'Stipend Salary Statement')}</h3>${statementHtml}${PAGE_BREAK}`);
  }

  return sections.join('').replace(new RegExp(`${PAGE_BREAK}$`), '');
}
