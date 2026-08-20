import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import { config } from '../../config/index.js';
import { buildConsolidatedReportHtml, buildConsolidatedMonthRangeLabel } from './payrollConsolidatedCore.js';

// Native PDF export for payroll_consolidated_report.php, following the same
// Puppeteer HTML-to-PDF pattern as stipendPdfNative.js — reuses the existing,
// already-proven buildConsolidatedReportHtml() rather than re-deriving the report.

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
  body { margin: 0 20px; padding: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; }
  .payroll-consolidated-table { border-collapse: collapse; width: 100%; }
  .payroll-consolidated-table th, .payroll-consolidated-table td {
    border: 1px solid #333; vertical-align: middle; font-size: 10px; padding: 3px 4px;
  }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .signature_table, .signature_table_small { margin-top: 60px; border-top: 3px solid #17a2b8; }
  .signature_table td, .signature_table_small td { border: 0; }
</style>
</head><body>${bodyHtml}</body></html>`;
}

export async function generateConsolidatedReportPdf(memberId, fields = {}) {
  const raw = fields.payroll_month;
  const months = (Array.isArray(raw) ? raw : [raw]).map((m) => String(m || '').trim()).filter(Boolean);
  if (!months.length) {
    return { error: 'payroll_month required' };
  }

  const bodyHtml = await buildConsolidatedReportHtml(months, { printedBy: memberId });
  const fullHtml = await buildFullHtmlDocument(bodyHtml);

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  let pdfBytes;
  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 30000 });
    pdfBytes = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: {
        top: '8mm', bottom: '8mm', left: '8mm', right: '8mm',
      },
    });
  } finally {
    await browser.close();
  }

  const reportsDir = path.join(config.legacyFilesPath, 'payroll_reports');
  await fs.mkdir(reportsDir, { recursive: true });
  const filename = `payroll_consolidated_${Date.now()}.pdf`;
  await fs.writeFile(path.join(reportsDir, filename), pdfBytes);

  return {
    filename,
    downloadUrl: `/legacy/files/payroll_reports/${encodeURIComponent(filename)}`,
    monthRangeLabel: buildConsolidatedMonthRangeLabel(months),
  };
}
