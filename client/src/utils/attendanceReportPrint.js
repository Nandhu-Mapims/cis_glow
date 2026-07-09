function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Legacy callPrintHeader + att_report_span layout (attendance_report*.php). */
export function buildAttendanceReportPrintHtml({
  title,
  subtitleLine1,
  dateRange,
  bannerUrl,
  tablesHtml,
  singleCourse = false,
}) {
  const logo = bannerUrl ? `<img src="${escapeHtml(bannerUrl)}" alt="" />` : '';
  let bodyHtml = String(tablesHtml || '');
  if (singleCourse) {
    bodyHtml = bodyHtml
      .replace(/<p style="margin:5px 0;"><strong>Course:<\/strong>[\s\S]*?<\/p>\s*/gi, '')
      .replace(/<p style="margin:5px 0;font-size:14px;"><strong>Subject:<\/strong>[\s\S]*?<\/p>\s*/gi, '');
  }

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
<div id="att_report_span" class="att_report_span">${bodyHtml}</div>`;
}

/** PG punch report — same legacy print header as pg_attendance_punch.php (print setup 16). */
export function buildPgPunchPrintHtml({ printMeta, bannerUrl, tablesHtml }) {
  if (!printMeta) return String(tablesHtml || '');
  return buildAttendanceReportPrintHtml({
    title: printMeta.title,
    subtitleLine1: printMeta.subtitleLine1,
    dateRange: printMeta.dateRange,
    bannerUrl,
    tablesHtml,
  });
}
