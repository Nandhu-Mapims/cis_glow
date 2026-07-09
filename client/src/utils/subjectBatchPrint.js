function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSubjectBatchPrintHtml({
  title,
  subtitle,
  bannerUrl,
  students = [],
  assignments = {},
  batchCount = 0,
  batchLetters = {},
}) {
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

  html += '<div id="form_details_panel"><div class="row"><section><div class="subject-batch-grid">';

  for (let batchNo = 1; batchNo <= batchCount; batchNo += 1) {
    const label = batchLetters[batchNo] || String.fromCharCode(64 + batchNo);
    const batchStudents = students.filter(
      (student) => Number(assignments[student.registerNo]) === batchNo,
    );

    html += `<div class="subject-batch-card">
<table cellpadding="3" cellspacing="0" class="table-bordered subject-batch-table">
<thead>
<tr><th colspan="3" class="batch-title">Batch ${escapeHtml(label)}</th></tr>
<tr>
<th class="col-num">#</th>
<th class="col-roll">Roll.No.</th>
<th class="col-name">Student Name</th>
</tr>
</thead>
<tbody>`;

    batchStudents.forEach((student, index) => {
      html += `<tr>
<td class="col-num">${index + 1}</td>
<td class="col-roll">${escapeHtml(student.registerNo)}</td>
<td class="col-name">${escapeHtml(student.name)}</td>
</tr>`;
    });

    html += '</tbody></table></div>';
  }

  html += `</div>
<table cellpadding="0" cellspacing="0" border="0" width="100%" class="subject-batch-footer">
<tr>
<td nowrap valign="bottom" width="50%">
<p class="subject-batch-total"><strong>Total Student : ${students.length}</strong></p>
</td>
<td nowrap valign="bottom" width="50%">
<p class="subject-batch-principal"><strong>Principal</strong></p>
</td>
</tr>
</table>`;

  html += '</section></div></div>';

  html += `<div id="printingFooter" style="display:none;">
<div id="printFooterpanel">
<div class="right_container"><div class="vertical_container">${escapeHtml(verticalText)}</div></div>
</div>
</div>`;

  return html;
}
