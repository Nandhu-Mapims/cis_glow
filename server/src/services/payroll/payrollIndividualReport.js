import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config/index.js';
import { legacyPublicFileUrl } from '../../utils/fileUrls.js';
import {
  buildCategoryFilter,
  loadPayrollMonthOptions,
  loadSalarySummaryCategoryOptions,
  logPayrollPage,
} from './payrollHelpers.js';
import {
  buildIndividualReportHtml,
  loadReportTypeOptions,
  normalizeReportFor,
  parseBankTransferRef,
} from './payrollReportCore.js';

const PAGE = 'payroll_individual_report.php';

function csvCell(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function loadPayrollIndividualReport(memberId, fields = {}, audit = {}) {
  const payrollMonth = String(fields.payroll_month || '').trim();
  const searchCategory = Array.isArray(fields.search_category)
    ? fields.search_category.map(String)
    : (fields.search_category ? [String(fields.search_category)] : []);
  const rowPerPage = Number(fields.row_per_page) || 27;
  const reportForRaw = String(fields.report_for || '').trim();
  const reportFor = normalizeReportFor(reportForRaw);
  const copyType = String(fields.copy_type || 'Original Copy').trim();
  const isGenerate = fields.Submit === 'Generate';

  const [monthOptions, categoryOptions, reportTypeOptions] = await Promise.all([
    loadPayrollMonthOptions(),
    payrollMonth ? loadSalarySummaryCategoryOptions(payrollMonth) : Promise.resolve([]),
    payrollMonth ? loadReportTypeOptions(payrollMonth) : Promise.resolve([]),
  ]);

  const categoryFilterSql = buildCategoryFilter(searchCategory);
  const selectedMonth = monthOptions.find((m) => m.value === payrollMonth) || null;
  let reportHtml = '';
  let exportMeta = null;

  if (isGenerate && payrollMonth && categoryFilterSql && reportForRaw) {
    reportHtml = await buildIndividualReportHtml({
      payrollMonth,
      categoryFilterSql,
      reportFor,
      rowPerPage,
      copyType,
      transferRef: parseBankTransferRef(reportForRaw),
      generatedBy: selectedMonth
        ? { user: selectedMonth.generatedBy, date: selectedMonth.generatedOn }
        : null,
    });

    exportMeta = {
      payroll_month: payrollMonth,
      title: reportFor,
      transfer_ref: parseBankTransferRef(reportForRaw),
      search_category: searchCategory.join(','),
    };

    await logPayrollPage(
      PAGE,
      'Generate',
      `${payrollMonth}___${searchCategory.join(',')}___${reportFor}`,
      memberId,
      audit,
    );
  } else {
    await logPayrollPage(PAGE, 'View', payrollMonth, memberId, audit);
  }

  return {
    monthOptions,
    categoryOptions,
    reportTypeOptions,
    selected: {
      payrollMonth,
      searchCategory,
      rowPerPage,
      reportFor: reportForRaw,
      copyType,
    },
    reportHtml,
    exportMeta,
  };
}

export async function exportPayrollIndividualExcel(memberId, query = {}, audit = {}) {
  const flag = Number(query.flag) || 1;
  const payrollMonth = String(query.payroll_month || '').trim();
  const searchCategory = String(query.search_category || '').split(',').filter(Boolean);
  const categoryFilterSql = buildCategoryFilter(searchCategory);
  const transferRef = String(query.transfer_ref || '').trim();

  if (!payrollMonth || !categoryFilterSql) {
    return { error: 'payroll_month and search_category are required' };
  }

  const reportFor = flag === 2 ? 'pf' : (flag === 3 ? 'esi' : 'bank');

  // CSV export from bank/PF/ESI payroll SQL
  const monthSql = payrollMonth;
  let sqlRows = [];
  if (reportFor === 'bank') {
    const bankFilter = transferRef === 'cheque'
      ? " AND B.pay_type = 'Cheque'"
      : (transferRef ? ` AND B.pay_type != 'Cheque' AND B.pay_bank = '${transferRef.replace(/'/g, "''")}'` : '');
    const { prisma } = await import('../../config/prisma.js');
    sqlRows = await prisma.$queryRawUnsafe(
      `SELECT A.staff_id, A.staff_name, A.staff_initial, B.net_pay, A.b_ac_no, A.b_ifsc, A.email_id
       FROM staff_profile_tb AS A
       INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
       WHERE A.del = 1 AND B.del = 1 AND B.net_pay > 0
         AND B.payroll_month = '${monthSql.replace(/'/g, "''")}'
         ${categoryFilterSql}
         ${bankFilter}`,
    );
  } else {
    const column = reportFor === 'pf' ? 'pf_amount' : 'esi_amount';
    const { prisma } = await import('../../config/prisma.js');
    sqlRows = await prisma.$queryRawUnsafe(
      `SELECT A.staff_id, A.staff_name, A.staff_initial, B.${column} AS amount, A.pfa_no, A.esi_no
       FROM staff_profile_tb AS A
       INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
       WHERE A.del = 1 AND B.del = 1 AND B.${column} > 0
         AND B.payroll_month = '${monthSql.replace(/'/g, "''")}'
         ${categoryFilterSql}`,
    );
  }

  const headers = reportFor === 'bank'
    ? ['Staff ID', 'Name', 'Amount', 'Account No', 'IFSC', 'Email']
    : ['Staff ID', 'Name', 'Amount', reportFor === 'pf' ? 'PF No' : 'ESI No'];

  const lines = [headers.map(csvCell).join(',')];
  for (const row of sqlRows) {
    if (reportFor === 'bank') {
      lines.push([
        row.staff_id,
        `${row.staff_name || ''} ${row.staff_initial || ''}`.trim(),
        row.net_pay,
        row.b_ac_no,
        row.b_ifsc,
        row.email_id,
      ].map(csvCell).join(','));
    } else {
      lines.push([
        row.staff_id,
        `${row.staff_name || ''} ${row.staff_initial || ''}`.trim(),
        row.amount,
        reportFor === 'pf' ? row.pfa_no : row.esi_no,
      ].map(csvCell).join(','));
    }
  }

  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const filename = `payroll_${reportFor}_report_${timestamp}.csv`;
  const excelDir = path.join(config.legacyFilesPath, 'excel');
  await fs.mkdir(excelDir, { recursive: true });
  await fs.writeFile(path.join(excelDir, filename), `\uFEFF${lines.join('\n')}`, 'utf8');

  await logPayrollPage(PAGE, 'Export', `${payrollMonth}___${flag}`, memberId, audit);

  return {
    downloadUrl: legacyPublicFileUrl(`excel/${filename}`),
    filename,
    format: 'csv',
  };
}
