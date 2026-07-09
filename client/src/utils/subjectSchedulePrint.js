function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Build Subject Schedule print HTML matching legacy subject_schedule.php layout. */
export function buildSubjectSchedulePrintHtml({
  title = 'Subject Schedule',
  subtitle = '',
  subjectLabel = '',
  monthLabel = '',
  bannerUrl = '',
  rows = [],
  staffOptions = [],
  topicOptions = [],
}) {
  const staffMap = Object.fromEntries(staffOptions.map((o) => [String(o.value), o.label]));
  const topicMap = Object.fromEntries(topicOptions.map((o) => [String(o.value), o.label]));
  const verticalText = [title, subtitle].filter(Boolean).join(' | ');
  const logo = bannerUrl ? `<img src="${escapeHtml(bannerUrl)}" alt="" />` : '';

  let html = `<div id="printingHeader" style="display:none;">
<div id="printHeaderpanel" class="first-page">
<table class="header_table" border="0" cellpadding="0" cellspacing="0" width="100%"><tbody>
<tr><td align="center" height="5" colspan="2"><small>omsakthi</small></td></tr>
<tr>
<td height="70" valign="middle" width="30%">${logo}</td>
<td nowrap align="right" valign="top" width="70%"><div class="promote_card">
<p class="pc_title title">${escapeHtml(title)}</p>
<p class="pc_sub-title sub-title">${escapeHtml(subtitle)}</p>
</div></td>
</tr>
</tbody></table>
</div>
</div>`;

  html += '<div id="form_details_panel"><div>';

  if (subjectLabel || monthLabel) {
    html += `<table width="100%" border="0" cellpadding="0" cellspacing="0" class="table subject-schedule-meta-table">`;
    if (subjectLabel) {
      html += `<tr><td height="30" width="12%" nowrap><strong>Subject</strong></td><td>${escapeHtml(subjectLabel)}</td></tr>`;
    }
    if (monthLabel) {
      html += `<tr><td height="30" nowrap><strong>Month</strong></td><td>${escapeHtml(monthLabel)}</td></tr>`;
    }
    html += '</table>';
  }

  html += `<table width="100%" border="0" cellpadding="5" cellspacing="0" class="table table-bordered subject-schedule-table">
<thead>
<tr>
<th width="12%" height="35" nowrap>Date</th>
<th width="12%" nowrap>Day</th>
<th width="8%" align="center">Period</th>
<th width="8%" align="center">Batch</th>
<th width="30%" align="center">Staff Name</th>
<th width="30%" align="center">Topic</th>
</tr>
</thead>
<tbody>`;

  rows.forEach((row, index) => {
    const rowBg = (index + 1) % 2 === 0 ? ' bgcolor="#f4f4f4"' : '';
    const staff = staffMap[String(row.staffId)] || '';
    const topic = topicMap[String(row.topicId)] || '';
    html += `<tr${rowBg}>
<td valign="top">${escapeHtml(row.date)}</td>
<td valign="top" style="text-transform:capitalize;">${escapeHtml(row.day)}</td>
<td align="center">${escapeHtml(String(row.period))}</td>
<td align="center">${escapeHtml(String(row.batch || ''))}</td>
<td>${escapeHtml(staff)}</td>
<td>${escapeHtml(topic)}</td>
</tr>`;
  });

  if (!rows.length) {
    html += '<tr><td colspan="6" align="center">No scheduled periods for this month.</td></tr>';
  }

  html += '</tbody></table></div></div>';

  html += `<div id="printingFooter" style="display:none;">
<div id="printFooterpanel">
<div class="right_container"><div class="vertical_container">${escapeHtml(verticalText)}</div></div>
</div>
</div>`;

  return html;
}
