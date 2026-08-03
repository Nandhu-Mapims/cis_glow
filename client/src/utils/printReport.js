function escapeHtmlText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Strip full HTML document wrapper so report markup can be previewed/printed safely. */
export function extractReportBodyHtml(html) {
  const str = String(html || '').trim();
  if (!str) return '';

  const bodyMatch = str.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) return bodyMatch[1].trim();

  return str
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<head>[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .trim();
}

function splitAffidavitHtml(html) {
  const styleMatch = String(html || '').match(/^<style>[\s\S]*?<\/style>/i);
  if (!styleMatch) {
    return { headStyles: '', bodyHtml: html };
  }
  return {
    headStyles: styleMatch[0],
    bodyHtml: html.slice(styleMatch[0].length),
  };
}

function openPrintWindow(title, headHtml, bodyHtml, presetWin) {
  // Do not pass noopener — it makes window.open return null and breaks printing.
  // `presetWin`, when given, is a window already opened synchronously inside a click
  // handler (see printReportHtml's 3rd param) — needed when the HTML to print only
  // becomes available after an `await`, by which point window.open() would otherwise
  // be blocked as no longer being a direct result of the user gesture.
  const win = presetWin !== undefined ? presetWin : window.open('', '_blank');
  if (!win) return null;

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtmlText(title)}</title>
${headHtml}
</head><body>${bodyHtml}</body></html>`);
  win.document.close();

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    try {
      win.focus();
      win.print();
    } catch {
      // ignore print errors in restrictive environments
    }
  };

  if (win.document.readyState === 'complete') {
    setTimeout(triggerPrint, 150);
  } else {
    win.addEventListener('load', () => setTimeout(triggerPrint, 150), { once: true });
    setTimeout(triggerPrint, 500);
  }
  return win;
}

export function printReportHtml(html, mode = 'default', presetWin) {
  if (!html) {
    presetWin?.close();
    return;
  }

  const isAffidavit = mode === 'affidavit' || mode === true;
  if (isAffidavit) {
    const { headStyles, bodyHtml } = splitAffidavitHtml(html);
    const headHtml = `${headStyles}
<style>
  @page { size: A4; margin: 10mm; }
  body { margin: 0; padding: 0; background: #fff; }
  .affidavit-print .affidavit-page-hidden { display: none !important; }
  @media print {
    .affidavit-print #total_con.affidavit-page {
      width: 780px;
      padding: 35px;
      page-break-after: always;
      border-bottom: 0;
      margin-bottom: 0;
    }
  }
</style>`;
    if (!openPrintWindow('Affidavit', headHtml, bodyHtml)) {
      window.alert('Unable to open the print window. Please allow popups for this site.');
    }
    return;
  }

  if (mode === 'inspection') {
    const headHtml = `<style>
  @page { size: A4; margin: 0; }
  body { margin: 0; padding: 0; background: #fff; }
  .inspection-certificates { margin: 0; padding: 0; }
  .inspection-cert-set { page-break-after: always; }
  .inspection-cert-sheet {
    box-sizing: border-box;
    width: 780px;
    min-height: 1010px;
    padding: 210px 25px 0 35px;
    page-break-after: always;
    font-family: "Book Antiqua", "Times New Roman", serif;
    color: #000;
  }
  .inspection-cert-text { font-size: 18px; line-height: 1.4; margin: 0; }
  .inspection-cert-title {
    font-size: 22px;
    font-weight: 700;
    text-align: center;
    text-decoration: underline;
    padding: 25px 25px 25px 55px;
  }
  .inspection-cert-body {
    font-size: 18px;
    line-height: 45px;
    text-align: justify;
    text-indent: 50px;
    margin: 0;
  }
  .inspection-cert-sign {
    text-align: right;
    padding-right: 90px;
    font-size: 18px;
    margin-top: 2rem;
  }
  .inspection-envelope-sheet {
    box-sizing: border-box;
    width: 500px;
    min-height: 500px;
    padding: 162px 0 0 250px;
    page-break-after: always;
  }
  .inspection-envelope-label {
    font-family: "Book Antiqua", "Times New Roman", serif;
    font-size: 20px;
    line-height: 30px;
    transform: rotate(270deg);
    transform-origin: top left;
  }
  .inspection-envelope-label::before { display: none; }
  .text-end { text-align: right; }
</style>`;
    if (!openPrintWindow('Attendance Certificate', headHtml, html)) {
      window.alert('Unable to open the print window. Please allow popups for this site.');
    }
    return;
  }

  if (mode === 'appointment-order') {
    const { headStyles, bodyHtml } = splitAffidavitHtml(html);
    const headHtml = `${headStyles}
<style>
  @page { size: A4; margin: 10mm; }
  body { margin: 0; padding: 0; background: #fff; }
  .appoint-order-print #total_con { page-break-after: always; }
</style>`;
    if (!openPrintWindow('Appointment Order', headHtml, bodyHtml)) {
      window.alert('Unable to open the print window. Please allow popups for this site.');
    }
    return;
  }

  if (mode === 'payroll-consolidated') {
    const headHtml = `<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #fff; }
  .payroll-report-table-scroll { overflow: visible; border: 0; }
  table { border-collapse: collapse; width: 100%; }
  .payroll-consolidated-table { width: 100% !important; min-width: 0; white-space: normal; }
  td, th { border: 1px solid #ccc; padding: 4px 6px; font-size: 11px; vertical-align: middle; text-align: center; }
  .payroll-consolidated-table td[style*="text-align: right"],
  .payroll-consolidated-table th[style*="text-align: right"] { text-align: right !important; }
  .header1 { font-weight: 700; font-size: 16px; margin: 0 0 4px; }
  .header2 { font-size: 13px; margin: 0 0 4px; }
  .text-muted.small { font-size: 11px; color: #666; margin: 0 0 12px; }
  .signature_table, .signature_table_small {
    margin-top: 48px;
    border-top: 3px solid #17a2b8;
    padding-top: 12px;
    border-collapse: collapse;
    width: 100%;
  }
  .signature_table td, .signature_table_small td { border: 0; }
  .footer_sign_name, .footer_sign_name_small {
    margin: 0;
    font-size: 12px;
    font-weight: bold;
    text-align: center;
  }
  .footer_sign_desig, .footer_sign_desig_small {
    margin: 0;
    font-size: 12px;
    text-align: center;
  }
</style>`;
    if (!openPrintWindow('Payroll Consolidated Report', headHtml, html)) {
      window.alert('Unable to open the print window. Please allow popups for this site.');
    }
    return;
  }

  if (mode === 'academic-class-timetable') {
    const panelStart = String(html || '').indexOf('<div id="form_details_panel">');
    const headerHtml = panelStart > 0
      ? String(html).slice(0, panelStart).replace(/style="display:\s*none;?"/gi, '')
      : '';
    const panelHtml = panelStart >= 0
      ? String(html).slice(panelStart).replace(/^<div id="form_details_panel">/, '').replace(/<\/div>\s*$/, '')
      : html;
    const bodyHtml = `${headerHtml}<div id="printingBody">${panelHtml}</div>`;
    const headHtml = `<link href="/legacy/css/timetable.css?v=3" rel="stylesheet" />
<style>
  body { margin: 0; padding: 0; background: #fff; }
  #printingHeader { display: block !important; }
  #printingBody { display: block; }
  #form_details_panel { display: block !important; }
</style>`;
    if (!openPrintWindow('Class Timetable', headHtml, bodyHtml)) {
      window.alert('Unable to open the print window. Please allow popups for this site.');
    }
    return;
  }

  if (mode === 'academic-subject-schedule') {
    const str = String(html || '');
    const panelStart = str.indexOf('<div id="form_details_panel">');
    const footerStart = str.indexOf('<div id="printingFooter"');
    const headerHtml = panelStart > 0
      ? str.slice(0, panelStart).replace(/style="display:\s*none;?"/gi, '')
      : '';
    const panelHtml = panelStart >= 0 && footerStart > panelStart
      ? str.slice(panelStart, footerStart)
      : (panelStart >= 0 ? str.slice(panelStart) : str);
    const footerHtml = footerStart >= 0
      ? str.slice(footerStart).replace(/style="display:\s*none;?"/gi, '')
      : '';
    const bodyHtml = `${headerHtml}<div id="printingBody">${panelHtml}</div>${footerHtml}`;
    const headHtml = `<link href="/legacy/css/style_print.css" rel="stylesheet" />
<style>
  body {
    margin: 0 40px 0 60px;
    padding: 0;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
  }
  #printingHeader { display: block !important; }
  #printingBody { display: block !important; width: 100%; }
  #form_details_panel { display: block !important; width: 100%; }
  .subject-schedule-meta-table td { font-size: 13px; border: 0; padding: 2px 0; }
  .subject-schedule-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }
  .subject-schedule-table th,
  .subject-schedule-table td {
    border: 1px solid #333;
    font-size: 12px;
    line-height: 1.3;
    vertical-align: top;
    padding: 4px 5px;
  }
  .subject-schedule-table thead th {
    background: #fff;
    font-weight: bold;
    text-align: center;
  }
  #printingFooter {
    display: block !important;
    position: fixed;
    top: 140px;
    right: 8px;
    width: 18px;
    height: 0;
    overflow: visible;
    z-index: 2;
    pointer-events: none;
  }
  #printingFooter .right_container { float: none; position: static; width: 18px; }
  #printingFooter .vertical_container {
    margin: 0 !important;
    padding: 0 !important;
    width: auto;
    float: none;
    position: static;
    font-size: 14px;
  }
</style>`;
    if (!openPrintWindow('Subject Schedule', headHtml, bodyHtml)) {
      window.alert('Unable to open the print window. Please allow popups for this site.');
    }
    return;
  }

  if (mode === 'academic-timetable-class-report') {
    const str = String(html || '');
    const panelStart = str.indexOf('<div id="form_details_panel">');
    const footerStart = str.indexOf('<div id="printingFooter"');
    const headerHtml = panelStart > 0
      ? str.slice(0, panelStart).replace(/style="display:\s*none;?"/gi, '')
      : '';
    const panelHtml = panelStart >= 0 && footerStart > panelStart
      ? str.slice(panelStart, footerStart)
      : (panelStart >= 0 ? str.slice(panelStart) : str);
    const footerHtml = footerStart >= 0
      ? str.slice(footerStart).replace(/style="display:\s*none;?"/gi, '')
      : '';
    const bodyHtml = `${headerHtml}<div id="printingBody">${panelHtml}</div>${footerHtml}`;
    const headHtml = `<link href="/legacy/css/style_print.css" rel="stylesheet" />
<style>
  body {
    margin: 0 40px 0 60px;
    padding: 0;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
  }
  #printingHeader { display: block !important; }
  #printingBody { display: block !important; width: 100%; }
  #form_details_panel { display: block !important; width: 100%; }
  .timetable-class-report-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
  }
  .timetable-class-report-table th,
  .timetable-class-report-table td {
    border: 1px solid #333;
    font-size: 12px;
    line-height: 1.3;
    vertical-align: top;
    padding: 4px 5px;
  }
  .timetable-class-report-table thead th {
    background: #fff;
    font-weight: bold;
    text-align: center;
  }
  #printingFooter {
    display: block !important;
    position: fixed;
    top: 140px;
    right: 8px;
    width: 18px;
    height: 0;
    overflow: visible;
    z-index: 2;
    pointer-events: none;
  }
  #printingFooter .right_container {
    float: none;
    position: static;
    width: 18px;
  }
  #printingFooter .vertical_container {
    margin: 0 !important;
    padding: 0 !important;
    width: auto;
    float: none;
    position: static;
    font-size: 14px;
  }
  #generated_by {
    font-size: 11px;
    margin: 0;
  }
</style>`;
    if (!openPrintWindow('Class Timetable Report', headHtml, bodyHtml)) {
      window.alert('Unable to open the print window. Please allow popups for this site.');
    }
    return;
  }

  if (mode === 'academic-feedback-dashboard') {
    const str = String(html || '');
    const panelStart = str.indexOf('<div id="form_details_panel">');
    const footerStart = str.indexOf('<div id="printingFooter"');
    const headerHtml = panelStart > 0
      ? str.slice(0, panelStart).replace(/style="display:\s*none;?"/gi, '')
      : '';
    const panelHtml = panelStart >= 0 && footerStart > panelStart
      ? str.slice(panelStart, footerStart)
      : (panelStart >= 0 ? str.slice(panelStart) : str);
    const footerHtml = footerStart >= 0
      ? str.slice(footerStart).replace(/style="display:\s*none;?"/gi, '')
      : '';
    const bodyHtml = `${headerHtml}<div id="printingBody">${panelHtml}</div>${footerHtml}`;
    const headHtml = `<link href="/legacy/css/style_print.css" rel="stylesheet" />
<style>
  body {
    margin: 0 40px 0 60px;
    padding: 0;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
  }
  #printingHeader { display: block !important; }
  #printingBody { display: block !important; width: 100%; }
  #form_details_panel { display: block !important; width: 100%; }
  #printHeaderpanel .sub-title-1 {
    margin: 0 10px -10px 0;
  }
  .feedback-dashboard-report-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
  }
  .feedback-dashboard-report-table th,
  .feedback-dashboard-report-table td {
    border: 1px solid #333;
    font-size: 12px;
    line-height: 1.3;
    vertical-align: top;
    padding: 4px 5px;
  }
  .feedback-dashboard-report-table thead th {
    background: #fff;
    font-weight: bold;
  }
  #printingFooter {
    display: block !important;
    position: fixed;
    top: 140px;
    right: 8px;
    width: 18px;
    height: 0;
    overflow: visible;
    z-index: 2;
    pointer-events: none;
  }
  #generated_by {
    font-size: 11px;
    margin: 0;
  }
</style>`;
    if (!openPrintWindow('Feedback Status', headHtml, bodyHtml)) {
      window.alert('Unable to open the print window. Please allow popups for this site.');
    }
    return;
  }

  if (mode === 'academic-subject-timing') {
    const str = String(html || '');
    const panelStart = str.indexOf('<div id="form_details_panel">');
    const headerHtml = panelStart > 0
      ? str.slice(0, panelStart).replace(/style="display:\s*none;?"/gi, '')
      : '';
    const panelHtml = panelStart >= 0 ? str.slice(panelStart) : str;
    const bodyHtml = `${headerHtml}<div id="printingBody">${panelHtml}</div>`;
    const headHtml = `<link href="/legacy/css/style_print.css" rel="stylesheet" />
<style>
  body {
    margin: 0 40px 0 60px;
    padding: 0;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
  }
  #printingHeader { display: block !important; }
  #printingBody { display: block !important; width: 100%; }
  #form_details_panel { display: block !important; width: 100%; }
  .subject-timing-meta-table { width: 100%; margin: 0 0 8px; border-collapse: collapse; }
  .subject-timing-meta-table td { font-size: 13px; padding: 2px 4px; border: 0; }
  .subject-timing-report-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
  }
  .subject-timing-report-table th,
  .subject-timing-report-table td {
    border: 1px solid #333;
    font-size: 12px;
    line-height: 1.3;
    vertical-align: top;
    padding: 4px 5px;
  }
  .subject-timing-report-table thead th {
    font-weight: bold;
    text-align: center;
  }
  .subject-timing-generated-by,
  #generated_by {
    display: block;
    font-size: 11px;
    margin: 12px 0 0;
    text-align: left;
    white-space: normal;
  }
</style>`;
    if (!openPrintWindow('Subject List', headHtml, bodyHtml)) {
      window.alert('Unable to open the print window. Please allow popups for this site.');
    }
    return;
  }

  if (mode === 'holiday-report') {
    const bodyHtml = extractReportBodyHtml(html);
    const headHtml = `<link href="/legacy/css/style_print.css" rel="stylesheet" />
<style>
  @page { size: A4; margin: 15mm; }
  body {
    margin: 0 40px 0 60px;
    padding: 0;
    background: #fff;
    font-family: "Bookman Old Style", "Book Antiqua", serif;
    color: #000;
  }
  #form_details_panel {
    display: block !important;
    width: 100%;
  }
  .sal_note_table-bordered {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
  }
  .sal_note_table-bordered th,
  .sal_note_table-bordered td {
    border: 1px solid #333;
    vertical-align: middle;
    font-size: 16px;
    text-align: center;
    padding: 8px;
  }
  .sal_note_table-bordered thead tr {
    background: #ccc;
  }
  .holiday-report-print p {
    margin: 0 0 0.5rem;
  }
  .holiday-report-print table + table td p {
    font-size: 15px;
    text-align: center;
    margin: 0;
  }
  .holiday-report-print table + table td small {
    font-size: 13px;
  }
</style>`;
    if (!openPrintWindow('Holiday Report', headHtml, bodyHtml)) {
      window.alert('Unable to open the print window. Please allow popups for this site.');
    }
    return;
  }

  if (mode === 'academic-staff-period-completed') {
    const str = String(html || '');
    const panelStart = str.indexOf('<div id="form_details_panel">');
    const headerHtml = panelStart > 0
      ? str.slice(0, panelStart).replace(/style="display:\s*none;?"/gi, '')
      : '';
    const panelHtml = panelStart >= 0 ? str.slice(panelStart) : str;
    const bodyHtml = `${headerHtml}<div id="printingBody">${panelHtml}</div>`;
    const headHtml = `<link href="/legacy/css/style_print.css" rel="stylesheet" />
<style>
  body {
    margin: 0 40px 0 60px;
    padding: 0;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
  }
  #printingHeader { display: block !important; }
  #printingBody { display: block !important; width: 100%; }
  #form_details_panel { display: block !important; width: 100%; }
  .staff-period-report-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
  }
  .staff-period-report-table th,
  .staff-period-report-table td {
    border: 1px solid #333;
    font-size: 12px;
    line-height: 1.3;
    vertical-align: top;
    padding: 4px 5px;
  }
  .staff-period-report-table thead th {
    font-weight: bold;
  }
  .staff-period-report-table tfoot th {
    font-weight: bold;
  }
  .staff-period-generated-by,
  #generated_by {
    display: block;
    font-size: 11px;
    margin: 12px 0 0;
    text-align: left;
    white-space: normal;
  }
</style>`;
    if (!openPrintWindow('Staff Period Completed', headHtml, bodyHtml)) {
      window.alert('Unable to open the print window. Please allow popups for this site.');
    }
    return;
  }

  if (mode === 'academic-subject-report') {
    const panelStart = String(html || '').indexOf('<div id="form_details_panel">');
    const headerHtml = panelStart > 0
      ? String(html).slice(0, panelStart).replace('style="display:none;"', '')
      : '';
    const panelHtml = panelStart >= 0
      ? String(html).slice(panelStart).replace(/^<div id="form_details_panel">/, '').replace(/<\/div>\s*$/, '')
      : html;
    const bodyHtml = `${headerHtml}<div id="printingBody">${panelHtml}</div>`;
    const headHtml = `<link href="/legacy/css/style_print.css" rel="stylesheet" />
<style>
  body { margin: 0; padding: 0; background: #fff; }
  #printingHeader { display: block !important; }
  #printingBody { display: block; }
  .subject-report-table td, .subject-report-table th { font-size: 11px; }
  .subject-report-meta-table td { font-size: 12px; }
</style>`;
    if (!openPrintWindow('Subject Report', headHtml, bodyHtml)) {
      window.alert('Unable to open the print window. Please allow popups for this site.');
    }
    return;
  }

  if (mode === 'academic-subject-batch') {
    const str = String(html || '');
    const panelStart = str.indexOf('<div id="form_details_panel">');
    const footerStart = str.indexOf('<div id="printingFooter"');
    const headerHtml = panelStart > 0
      ? str.slice(0, panelStart).replace(/style="display:\s*none;?"/gi, '')
      : '';
    const panelHtml = panelStart >= 0 && footerStart > panelStart
      ? str.slice(panelStart, footerStart)
      : (panelStart >= 0 ? str.slice(panelStart) : str);
    const footerHtml = footerStart >= 0
      ? str.slice(footerStart).replace(/style="display:\s*none;?"/gi, '')
      : '';
    const bodyHtml = `${headerHtml}<div id="printingBody">${panelHtml}</div>${footerHtml}`;
    const headHtml = `<link href="/legacy/css/style_print.css" rel="stylesheet" />
<style>
  body {
    margin: 0 40px 0 60px;
    padding: 0;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
  }
  #printingHeader { display: block !important; }
  #printingBody {
    display: block !important;
    width: 100%;
    position: relative;
    z-index: 1;
  }
  #form_details_panel { width: 100%; display: block !important; }
  #form_details_panel .row,
  #form_details_panel section {
    width: 100%;
    margin: 0;
    padding: 0;
    display: block !important;
  }
  .subject-batch-grid {
    width: 100%;
    margin: 8px 0 0;
    overflow: hidden;
  }
  .subject-batch-grid::after {
    content: "";
    display: table;
    clear: both;
  }
  .subject-batch-card {
    float: left;
    width: 31%;
    margin: 0 3.5% 14px 0;
    box-sizing: border-box;
  }
  .subject-batch-card:nth-child(3n) {
    margin-right: 0;
  }
  .subject-batch-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    display: table !important;
  }
  .subject-batch-table thead { display: table-header-group !important; }
  .subject-batch-table tbody { display: table-row-group !important; }
  .subject-batch-table tr { display: table-row !important; }
  .subject-batch-table th,
  .subject-batch-table td {
    display: table-cell !important;
    border: 1px solid #333;
    font-size: 11px;
    line-height: 1.25;
    vertical-align: top;
    padding: 2px 4px;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .subject-batch-table .batch-title {
    background: #fff;
    font-size: 16px;
    font-weight: bold;
    text-align: center;
    padding: 4px;
  }
  .subject-batch-table thead tr:nth-child(2) th {
    background: #ddd;
    font-weight: bold;
  }
  .subject-batch-table .col-num {
    width: 12%;
    text-align: center;
  }
  .subject-batch-table .col-roll {
    width: 30%;
    text-align: center;
  }
  .subject-batch-table .col-name {
    width: 58%;
    text-align: left;
  }
  .subject-batch-table tbody td.col-num,
  .subject-batch-table tbody td.col-roll {
    text-align: center;
  }
  .subject-batch-footer {
    font-family: "Book Antiqua", "Times New Roman", serif;
    margin-top: 24px;
    clear: both;
    display: table !important;
  }
  .subject-batch-total {
    font-size: 15px;
    text-align: left;
    padding: 0 0 50px 80px;
    margin: 0;
  }
  .subject-batch-principal {
    font-size: 15px;
    text-align: right;
    padding: 0 80px 50px 0;
    margin: 0;
  }
  #printingFooter {
    display: block !important;
    position: fixed;
    top: 140px;
    right: 8px;
    width: 18px;
    height: 0;
    overflow: visible;
    z-index: 2;
    pointer-events: none;
  }
  #printingFooter .right_container {
    float: none;
    position: static;
    width: 18px;
  }
  #printingFooter .vertical_container {
    margin: 0 !important;
    padding: 0 !important;
    width: auto;
    float: none;
    position: static;
    font-size: 14px;
  }
</style>`;
    if (!openPrintWindow('Student Batch List', headHtml, bodyHtml)) {
      window.alert('Unable to open the print window. Please allow popups for this site.');
    }
    return;
  }

  if (mode === 'pg-punch-report') {
    const bodyHtml = extractReportBodyHtml(html);
    const headHtml = `<link href="/legacy/css/style_print.css" rel="stylesheet" />
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
  body { margin: 0 40px 0 60px; padding: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; }
  #printingHeader { display: block !important; }
  .att_report_span table { background: #FFF; }
  .table-bordered { border-collapse: collapse; width: 100%; }
  .table-bordered td, .table-bordered th {
    border: 1px solid #333;
    padding: 2px 4px;
    font-size: 10px;
    vertical-align: top;
  }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .att_vtext {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    white-space: nowrap;
    font-size: 9px;
    margin: 0 auto;
  }
  .promote_card .pc_title { font-size: 18px; font-weight: bold; color: #c00; margin: 0; }
  .promote_card .pc_sub-title { font-size: 14px; margin: 0; }
  .sub-title-1 { font-size: 14px; text-align: right; margin: 4px 0 8px; }
</style>`;
    if (!openPrintWindow('PG Punch Report', headHtml, bodyHtml)) {
      window.alert('Unable to open the print window. Please allow popups for this site.');
    }
    return;
  }

  if (mode === 'student-attendance-report') {
    const bodyHtml = extractReportBodyHtml(html);
    const headHtml = `<link href="/legacy/css/style_print.css" rel="stylesheet" />
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
  body { margin: 0 40px 0 60px; padding: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; }
  #printingHeader { display: block !important; }
  .att_report_span table { background: #FFF; }
  .table-bordered { border-collapse: collapse; width: 100%; }
  .table-bordered td, .table-bordered th {
    border: 1px solid #333;
    padding: 2px 4px;
    font-size: 10px;
    vertical-align: middle;
  }
  td[align="right"], th[align="right"] { text-align: right !important; }
  td[nowrap], th[nowrap] { white-space: nowrap; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .att_vtext {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    white-space: nowrap;
    font-size: 9px;
    margin: 0 auto;
  }
</style>`;
    if (!openPrintWindow('Attendance Report', headHtml, bodyHtml)) {
      window.alert('Unable to open the print window. Please allow popups for this site.');
    }
    return;
  }

  if (mode === 'exam-dashboard') {
    const bodyHtml = extractReportBodyHtml(html);
    const headHtml = `<link href="/legacy/css/salary.css" rel="stylesheet" />
<link href="/legacy/css/style_print.css" rel="stylesheet" />
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
  body { margin: 0 40px 0 60px; padding: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 10px; }
  #printingHeader { display: block !important; }
  #printHeaderpanel.first-page { display: block; }
  #exam_report_span,
  .exam_report_span { overflow: visible; width: 100%; }
  .exam-dashboard-content { padding: 0 !important; }
  .exam-dashboard-block {
    page-break-inside: avoid;
    margin-bottom: 10px;
    padding-top: 0;
    border-top: 0;
  }
  .exam-dashboard-block__header { margin-bottom: 4px; }
  .exam-dashboard-block__title {
    font-size: 12px;
    margin: 0;
    color: #000;
  }
  .exam-dashboard-panels {
    display: flex !important;
    flex-wrap: nowrap !important;
    margin: 0 !important;
    --bs-gutter-x: 0;
    --bs-gutter-y: 0;
  }
  .exam-dashboard-panels > [class*="col-"] {
    flex: 1 1 33.33%;
    max-width: 33.33%;
    width: 33.33%;
    padding: 0 3px;
  }
  .panel,
  .exam-dashboard-panel {
    height: auto !important;
    min-height: 0 !important;
    margin-bottom: 0;
    border: 1px solid #333;
    page-break-inside: avoid;
  }
  .panel-heading {
    padding: 3px 5px;
    font-size: 10px;
    background: #e9ecef !important;
    border-bottom: 1px solid #333;
  }
  .panel-body,
  .exam-dashboard-panel__body {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    padding: 4px !important;
  }
  .exam-dashboard-table,
  .table-bordered {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
    margin-bottom: 0;
  }
  .exam-dashboard-table thead th,
  .table-bordered > thead > tr > th {
    position: static;
    background: #f1f3f5 !important;
    border: 1px solid #333;
    padding: 2px 3px;
    font-size: 8px;
    white-space: normal;
  }
  .exam-dashboard-table td,
  .exam-dashboard-table th,
  .table-bordered > tbody > tr > td,
  .table-bordered > tbody > tr > th {
    border: 1px solid #333;
    padding: 2px 3px;
    vertical-align: middle;
  }
  .text-end,
  .text-right,
  td[align="right"],
  th[align="right"] { text-align: right !important; }
  h3 { font-size: 12px; margin: 8px 0 4px; page-break-after: avoid; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
</style>`;
    if (!openPrintWindow('Exam Report', headHtml, bodyHtml)) {
      window.alert('Unable to open the print window. Please allow popups for this site.');
    }
    return;
  }

  if (mode === 'exam-schedule-print') {
    const bodyHtml = extractReportBodyHtml(html);
    const headHtml = `<link href="/legacy/css/exam.css" rel="stylesheet" />
<link href="/legacy/css/style_print.css" rel="stylesheet" />
<style>
  @page { size: auto; margin: 8mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
  body { margin: 0 40px 0 60px; padding: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; }
  #printingHeader { display: block !important; }
  #printHeaderpanel.first-page { display: block; }
  #att_report_span,
  .att_report_span { overflow: visible; width: 100%; }
  #total_con {
    height: auto !important;
    width: 100% !important;
  }
  .table-bordered > thead > tr > th,
  .table-bordered > tbody > tr > th {
    background: #ccc !important;
    border: 1px solid #333;
  }
  .table-bordered > thead > tr > td,
  .table-bordered > tbody > tr > td {
    border: 1px solid #333;
  }
  h4 { page-break-after: avoid; }
  thead { display: table-header-group; }
  /* #total_con wraps the *entire* report in a single <tr> (legacy
     single-page-container pattern) — a blanket 'tr { page-break-inside:
     avoid }' can't honor "avoid" on content taller than one page, so the
     browser shoves that whole row onto page 2, leaving page 1 with just the
     header. Only the actual per-date schedule rows should resist splitting. */
  #total_con > tbody > tr { page-break-inside: auto; }
  .table-bordered tr { page-break-inside: avoid; }
</style>`;
    if (!openPrintWindow('Exam Schedule', headHtml, bodyHtml)) {
      window.alert('Unable to open the print window. Please allow popups for this site.');
    }
    return;
  }

  if (mode === 'stipend-attendance-report') {
    const bodyHtml = extractReportBodyHtml(html);
    const headHtml = `<link href="/legacy/css/salary.css" rel="stylesheet" />
<link href="/legacy/css/style_print.css" rel="stylesheet" />
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
  body { margin: 0 40px 0 60px; padding: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; }
  #printingHeader { display: block !important; }
  #printHeaderpanel.first-page { display: block; }
  .att_report_span { overflow: visible; width: 100%; }
  .att_report_span table { background: #FFF; width: 100%; }
  .table-bordered { border-collapse: collapse; }
  .table-bordered > thead > tr > th,
  .table-bordered > tbody > tr > th {
    border: 1px solid #333;
    vertical-align: bottom;
    font-size: 10px;
    font-weight: bold;
    padding: 2px 3px;
  }
  .table-bordered > thead > tr > td,
  .table-bordered > tbody > tr > td {
    border: 1px solid #333;
    vertical-align: middle;
    font-size: 10px;
    padding: 2px 3px;
  }
  td[align="right"], th[align="right"] { text-align: right !important; }
  td[align="center"], th[align="center"] { text-align: center !important; }
  td[nowrap], th[nowrap] { white-space: nowrap; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .att_vtext {
    -webkit-transform-origin: center bottom;
    -moz-transform-origin: center bottom;
    -o-transform-origin: center bottom;
    transform-origin: center bottom;
    -webkit-transform: rotate(270deg);
    -moz-transform: rotate(270deg);
    -o-transform: rotate(270deg);
    transform: rotate(270deg);
    width: 5px;
    height: 7px;
    font-size: 10px;
    white-space: nowrap;
    margin: 0 auto;
  }
  .valign_btm { vertical-align: bottom; }
  .signature_table, .signature_table_small { margin-top: 80px; border-top: 3px solid #17a2b8; }
  .signature_table td, .signature_table_small td { border: 0; }
  .hide_abinfo { font-size: 8px !important; line-height: 9px; }
</style>`;
    if (!openPrintWindow('Attendance Statement', headHtml, bodyHtml)) {
      window.alert('Unable to open the print window. Please allow popups for this site.');
    }
    return;
  }

  if (mode === 'intern-att-statement') {
    const bodyHtml = extractReportBodyHtml(html);
    const headHtml = `<link href="/legacy/css/att_card.css" rel="stylesheet" />
<style>
  @page { size: A4; margin: 0; }
  body { margin: 0; padding: 0; background: #fff; }
  .intern-att-cards .intern-att-card.container,
  .intern-att-card.container {
    width: 794px;
    min-height: 1122px;
    height: auto;
    margin: 0 auto;
    page-break-after: always;
    box-sizing: border-box;
  }
  .intern-att-card .pbody {
    height: auto;
    min-height: 680px;
    overflow: visible;
  }
  .intern-att-card .pfooter {
    clear: both;
  }
  .intern-att-calendar {
    width: 100%;
    table-layout: fixed;
  }
  .intern-att-calendar th,
  .intern-att-calendar td {
    white-space: normal;
    word-break: break-word;
    vertical-align: top;
  }
  .calendar-day-inner {
    position: relative;
    min-height: 50px;
    text-align: center;
  }
  td .event {
    margin: -8px 0 0;
    line-height: 20px;
  }
  td .event_name {
    text-align: center;
    margin: 0;
    padding: 2px 1px 0;
    line-height: 11px;
    font-size: 10px;
  }
  td .event_name span {
    font-size: 10px !important;
    line-height: 11px;
  }
</style>`;
    if (!openPrintWindow('Intern Attendance Statement', headHtml, bodyHtml)) {
      window.alert('Unable to open the print window. Please allow popups for this site.');
    }
    return;
  }

  const headHtml = `<style>
  body { font-family: Arial, sans-serif; margin: 16px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #ccc; padding: 4px; font-size: 12px; vertical-align: top; }
  .signature_table, .signature_table_small {
    margin-top: 80px;
    border-top: 3px solid #17a2b8;
    padding-top: 12px;
    border-collapse: collapse;
  }
  .signature_table td, .signature_table_small td { border: 0; }
  .footer_sign_name, .footer_sign_name_small {
    margin: 0;
    font-size: 12px;
    font-weight: bold;
    text-align: center;
  }
  .footer_sign_desig, .footer_sign_desig_small {
    margin: 0;
    font-size: 12px;
    text-align: center;
  }
  .att_vtext {
    -webkit-transform-origin: 100% 100%;
    -webkit-transform: rotate(270deg);
    transform: rotate(270deg);
    width: 5px;
    height: 7px;
    font-size: 10px;
    white-space: nowrap;
  }
  #total_con { width: 780px; padding: 35px; }
</style>`;

  if (!openPrintWindow('Report', headHtml, html, presetWin)) {
    window.alert('Unable to open the print window. Please allow popups for this site.');
  }
}

/** Print fee pending reminder letters (fee_pending_sms_v1.php layout). */
export function printFeePendingLetter(html) {
  if (!html) return;
  const headHtml = `<link href="/legacy/css/result.css?v=1" rel="stylesheet" />
<style>
.marks { width: 50px; padding-left: 5px; padding-right: 2px; }
#total_con { height: 1072px; width: 733px; padding: 10px 25px 0 35px; }
.att_report_span table { background: #FFF; }
.promote_card {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 20px;
  background-color: #DBDBDB;
  color: #000000;
  padding: 1px;
  text-align: right;
  font-weight: bold;
  text-transform: uppercase;
}
body { margin: 0; padding: 0; }
</style>`;
  if (!openPrintWindow('Fee Pending Letters', headHtml, html)) {
    window.alert('Unable to open the print window. Please allow popups for this site.');
  }
}

/** Print fee bank slip using legacy layout CSS (student_fee_slip_new.php). */
export function printFeeSlip(html) {
  if (!html) return;
  const bodyHtml = extractReportBodyHtml(html);
  const headHtml = `<link href="/legacy/css/fee_slip.css" rel="stylesheet" />
<style>
  body { margin: 0; padding: 8px; background: #fff; }
  .page_container.fee-slip-print-page { overflow: hidden; }
  .receipt_copy_label { text-align: center; font-size: 11px; margin: 6px 0 0; }
  @page { size: landscape; margin: 6mm; }
  @media print {
    .receipt_container { page-break-inside: avoid; }
  }
</style>`;
  if (!openPrintWindow('Fee Bank Slip', headHtml, bodyHtml)) {
    window.alert('Unable to open the print window. Please allow popups for this site.');
  }
}

/** Print alumni ID card using legacy layout CSS. */
export function printAlumniIdCard(html) {
  if (!html) return;
  const bodyHtml = extractReportBodyHtml(html);
  const headHtml = `<link href="/legacy/css/alumni_id_card.css" rel="stylesheet" />
<style>
  body { margin: 0; padding: 0; background: #fff; }
  @page { size: landscape; margin: 8mm; }
  #idcard { page-break-inside: avoid; }
</style>`;
  if (!openPrintWindow('Alumni ID Card', headHtml, bodyHtml)) {
    window.alert('Unable to open the print window. Please allow popups for this site.');
  }
}

/** Print student ID card using legacy layout CSS (student_id_card.php parity). */
export function printStudentIdCard(html) {
  if (!html) return;
  const bodyHtml = extractReportBodyHtml(html);
  const headHtml = `<style>
  body { margin: 0; padding: 0; background: #fff; }
  @page { size: portrait; margin: 8mm; }
  #idcard { page-break-inside: avoid; }
</style>`;
  if (!openPrintWindow('Student ID Card', headHtml, bodyHtml)) {
    window.alert('Unable to open the print window. Please allow popups for this site.');
  }
}

/** Print AAADAR implant/laser certificate using legacy layout CSS. */
export function printAaadarCertificate(html) {
  if (!html) return;
  const headHtml = `<link href="/aaadar-certificate.css" rel="stylesheet" />
<style>body { margin: 0; padding: 12px; }</style>`;
  const bodyHtml = `<div class="aaadar-certificate-print">${html}</div>`;
  if (!openPrintWindow('AAADAR Certificate', headHtml, bodyHtml)) {
    window.alert('Unable to open the print window. Please allow popups for this site.');
  }
}

/** Print internship CRI certificate using dedicated layout CSS. */
export function printInternshipCertificate(html) {
  if (!html) return;
  const headHtml = `<link href="/internship-certificate.css" rel="stylesheet" />
<style>body { margin: 0; padding: 12px; }</style>`;
  const bodyHtml = `<div class="internship-certificate-print">${html}</div>`;
  if (!openPrintWindow('Internship Certificate', headHtml, bodyHtml)) {
    window.alert('Unable to open the print window. Please allow popups for this site.');
  }
}

/** Print task manage report section (legacy layout). */
export function printTaskManageReportSection(html, { title = 'Report', useCircularCss = false, useTaskManagePrint = false } = {}) {
  if (!html) return;
  const headHtml = useTaskManagePrint
    ? `${TASK_MANAGE_PRINT_STYLES}`
    : useCircularCss
      ? `<link href="/legacy/css/circular.css" rel="stylesheet" />
<style>body { margin: 0; padding: 0; }</style>`
      : `<style>
  body { font-family: Arial, sans-serif; margin: 16px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #ccc; padding: 4px 6px; font-size: 12px; vertical-align: top; }
  .report-header h3 { margin: 0 0 4px; }
  .text-end { text-align: right; }
  .text-muted { color: #666; }
</style>`;
  if (!openPrintWindow(title, headHtml, html)) {
    window.alert('Unable to open the print window. Please allow popups for this site.');
  }
}

const TASK_MANAGE_PRINT_STYLES = `<style>
.div_a4 { min-height: 842px; }
body { margin: 0 40px 0 60px; font-family: Arial, Helvetica, sans-serif; }
.title_1 { font-size: 36px; text-align: right; border-top: 4px solid #000; border-bottom: 8px solid #000; line-height: 80px; }
.title_2 { font-size: 18px; text-align: right; line-height: 50px; }
.table_1 { margin-left: 10px; width: 98%; }
.table_3 { width: 98%; text-align: right; margin-top: 30px; }
.pbody { width: 94% !important; border-bottom: none; font-family: Arial, Helvetica, sans-serif; line-height: 20px; min-height: 500px; font-size: 13px !important; margin-top: 30px; margin-left: 20px; }
.pbody h3 { font-size: 16px; margin: 16px 0 8px; }
.signature { font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 20px; margin-top: 100px; margin-left: 30px; }
@media print { @page { margin: 40px; } body { width: 800px !important; } }
</style>`;

/** Print a single circular in legacy letter layout (not the whole app shell). */
export function printCircularPreview({ title, subTitle, description, date }) {
  const bodyHtml = `
    <div class="container">
      <div class="pheader">
        <div class="title_div">
          <p class="top_heading">${escapeHtmlText(title)}</p>
          ${subTitle ? `<p class="top_content">${escapeHtmlText(subTitle)}</p>` : ''}
          ${date ? `<p class="top_content">${escapeHtmlText(date)}</p>` : ''}
        </div>
      </div>
      <div class="pbody">${description || ''}</div>
    </div>
  `;

  const headHtml = `<link href="/legacy/css/circular.css" rel="stylesheet" />
<style>body { margin: 0; padding: 0; }</style>`;

  if (!openPrintWindow(title || 'Circular', headHtml, bodyHtml)) {
    window.alert('Unable to open the print window. Please allow popups for this site.');
  }
}
