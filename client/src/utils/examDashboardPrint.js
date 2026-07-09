function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Legacy exam_dashboard.php — callPrintHeader + exam_report_span. */
export function buildExamDashboardPrintHtml({
  title = 'Exam Report',
  subtitleLine1 = '',
  dateRange = '',
  bannerUrl = '',
  tablesHtml = '',
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
${subtitleLine1 ? `<p class="pc_sub-title sub-title">${escapeHtml(subtitleLine1)}</p>` : ''}
</div></td>
</tr>
</tbody></table>
${dateRange ? `<div class="pc_sub-title-1 sub-title-1">${escapeHtml(dateRange)}</div>` : ''}
</div>
</div>
<div id="exam_report_span" class="exam_report_span att_report_span">${String(tablesHtml || '')}</div>`;
}
