import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import { PDFDocument } from '@cantoo/pdf-lib';
import { config } from '../../config/index.js';
import { loadStipendReport } from './stipendReportsCore.js';

// Native rewrite of legacy-bridge/stipend_individual_report_pdf_bridge.php, which called
// into stipend_payroll_pdf_widget.php's generatePayroll() (3013 lines: payroll calculation
// + mPDF HTML-to-PDF rendering). Reuses the EXISTING, already-proven native calculation +
// HTML-rendering pipeline (loadStipendReport('stipend-individual-report', ...), which
// already powers the on-screen/print StipendIndividualReport.jsx screen) rather than
// re-deriving the payroll math - only the PDF file generation + password protection is new.

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Mirrors client/src/utils/attendanceReportPrint.js buildAttendanceReportPrintHtml. */
function buildPrintBodyHtml({
  title, subtitleLine1, dateRange, bannerUrl, tablesHtml,
}) {
  const logo = bannerUrl ? `<img src="${escapeHtml(bannerUrl)}" alt="" />` : '';
  return `<div id="printingHeader">
<div id="printHeaderpanel" class="first-page">
<table class="header_table" border="0" cellpadding="0" cellspacing="0" width="100%"><tbody>
<tr><td align="center" height="5" colspan="2"><small>omsakthi</small></td></tr>
<tr>
<td height="70" valign="middle" width="30%">${logo}</td>
<td nowrap align="right" valign="top" width="70%"><div class="promote_card">
<p class="pc_title title">${escapeHtml(title)}</p>
<p class="pc_sub-title sub-title">${escapeHtml(subtitleLine1)}</p>
</div></td>
</tr>
</tbody></table>
<div class="pc_sub-title-1 sub-title-1">${escapeHtml(dateRange)}</div>
</div>
</div>
<div id="att_report_span" class="att_report_span">${tablesHtml || ''}</div>`;
}

/** Mirrors the 'stipend-attendance-report' print mode in client/src/utils/printReport.js. */
async function buildFullHtmlDocument(bodyHtml) {
  let salaryCss = '';
  let printCss = '';
  try {
    salaryCss = await fs.readFile(path.resolve('/home/mapims/cis/legacy-cis-modernized/client/public/legacy/css/salary.css'), 'utf8');
  } catch { /* best-effort */ }
  try {
    printCss = await fs.readFile(path.resolve('/home/mapims/cis/legacy-cis-modernized/client/public/legacy/css/style_print.css'), 'utf8');
  } catch { /* best-effort */ }

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>${salaryCss}</style>
<style>${printCss}</style>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
  body { margin: 0 40px 0 60px; padding: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; }
  #printingHeader { display: block !important; }
  #printHeaderpanel.first-page { display: block; }
  .att_report_span { overflow: visible; width: 100%; }
  .att_report_span table { background: #FFF; width: 100%; }
  .table-bordered { border-collapse: collapse; }
  .table-bordered > thead > tr > th, .table-bordered > tbody > tr > th {
    border: 1px solid #333; vertical-align: bottom; font-size: 10px; font-weight: bold; padding: 2px 3px;
  }
  .table-bordered > thead > tr > td, .table-bordered > tbody > tr > td {
    border: 1px solid #333; vertical-align: middle; font-size: 10px; padding: 2px 3px;
  }
  td[align="right"], th[align="right"] { text-align: right !important; }
  td[align="center"], th[align="center"] { text-align: center !important; }
  td[nowrap], th[nowrap] { white-space: nowrap; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .signature_table, .signature_table_small { margin-top: 80px; border-top: 3px solid #17a2b8; }
  .signature_table td, .signature_table_small td { border: 0; }
</style>
</head><body>${bodyHtml}</body></html>`;
}

/** Legacy password format: lowercase 3-letter month + 4-digit year, e.g. "jul2026". */
function buildPassword(payrollMonthSql) {
  // payrollMonthSql is already a full date (e.g. '2025-09-01'), not month-only.
  const date = new Date(`${payrollMonthSql}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  const month = date.toLocaleString('en-US', { month: 'short' }).toLowerCase();
  return `${month}${date.getFullYear()}`;
}

export async function generateStipendIndividualPdf(memberId, fields = {}, audit = {}) {
  const payrollMonthRaw = String(fields.payroll_month || '').trim();
  if (!payrollMonthRaw) {
    return { error: 'payroll_month required' };
  }

  const report = await loadStipendReport('stipend-individual-report', memberId, {
    ...fields,
    Submit: 'Generate',
  }, audit);

  if (!report.reportHtml || report.reportEmpty) {
    return { error: report.reportMessage || 'No stipend payroll records for the selected month.' };
  }

  const bannerUrl = report.bannerUrl
    ? `http://localhost:${config.port}${report.bannerUrl.startsWith('/') ? '' : '/'}${report.bannerUrl}`
    : '';

  const bodyHtml = buildPrintBodyHtml({
    title: report.printMeta?.title || 'Stipend Individual Report',
    subtitleLine1: report.printMeta?.subtitleLine1 || '',
    dateRange: report.printMeta?.dateRange || '',
    bannerUrl,
    tablesHtml: report.reportHtml,
  });
  const fullHtml = await buildFullHtmlDocument(bodyHtml);

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  let pdfBytes;
  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 30000 });
    pdfBytes = await page.pdf({
      format: 'A4', landscape: true, printBackground: true,
      margin: {
        top: '8mm', bottom: '8mm', left: '8mm', right: '8mm',
      },
    });
  } finally {
    await browser.close();
  }

  const password = buildPassword(report.selected.payrollMonthSql);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  if (password) {
    await pdfDoc.encrypt({ userPassword: password, ownerPassword: password });
  }
  const encryptedBytes = await pdfDoc.save();

  const reportsDir = path.join(config.legacyFilesPath, 'payroll_reports');
  await fs.mkdir(reportsDir, { recursive: true });
  const filename = `stipend_payroll_${Date.now()}.pdf`;
  await fs.writeFile(path.join(reportsDir, filename), encryptedBytes);

  return {
    filename,
    downloadUrl: `/legacy/files/payroll_reports/${encodeURIComponent(filename)}`,
    passwordHint: password,
  };
}
