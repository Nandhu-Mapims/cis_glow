function pickHidden(html, name, index) {
  const re = new RegExp(`name="${name}\\[${index}\\]"[^>]*value="([^"]*)"`, 'i');
  const m = html.match(re);
  return m ? m[1] : '';
}

function pickAmount(html, index) {
  const re = new RegExp(`name="fee_amount\\[${index}\\]"[^>]*value="([^"]*)"`, 'i');
  const m = html.match(re);
  return m ? m[1] : '';
}

function pickLabel(html, index) {
  const rowRe = new RegExp(`name="fee_paid\\[${index}\\]"[\\s\\S]*?<\\/tr>`, 'i');
  const row = html.match(rowRe)?.[0] || '';
  const label = row.match(/class="academic_fee_type"[^>]*>[\s\S]*?<label[^>]*>([\s\S]*?)<\/label>/i);
  if (label) {
    return label[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return '';
}

function rowIsChecked(row) {
  return /name="fee_paid\[\d+\]"[^>]*checked/i.test(row);
}

export function parseFeeSlipHtml(html, options = {}) {
  const mode = options.mode || 'collection';
  if (!html) {
    return { meta: {}, entries: [], feeTypes: [] };
  }

  const meta = {
    registerNo: pickHidden(html, 'a_no', 0) || (html.match(/name="a_no"[^>]*value="([^"]*)"/i)?.[1] || ''),
    courseId: html.match(/name="course_id"[^>]*value="([^"]*)"/i)?.[1] || '',
    admissionYear: html.match(/name="admission_year"[^>]*value="([^"]*)"/i)?.[1] || '',
    feeCounter: Number(html.match(/name="fee_counter"[^>]*value="([^"]*)"/i)?.[1] || 0),
    slipGroup: html.match(/name="slip_group"[^>]*value="([^"]*)"/i)?.[1] || '',
  };

  const feeTypes = [];
  const feeTypeRegex = /name="fee_type\[(\d+)\]"[^>]*value="(\d+)"/gi;
  let ft;
  const typeSet = new Set();
  while ((ft = feeTypeRegex.exec(html)) !== null) {
    typeSet.add(ft[2]);
  }
  typeSet.forEach((id) => feeTypes.push(id));

  const entries = [];
  for (let i = 0; i < meta.feeCounter; i += 1) {
    const rowRe = new RegExp(`name="fee_paid\\[${i}\\]"[\\s\\S]*?<\\/tr>`, 'i');
    const row = html.match(rowRe)?.[0] || '';
    if (!row || row.includes('disabled="disabled"')) continue;
    if (mode === 'approval' && !rowIsChecked(row)) continue;
    if (mode === 'collection' && row.includes('style="display:none;"') && rowIsChecked(row)) continue;

    const feeId = pickHidden(html, 'fee_id', i);
    if (!feeId) continue;

    entries.push({
      index: i,
      label: pickLabel(html, i),
      feeType: pickHidden(html, 'fee_type', i),
      feeId,
      feeName: pickHidden(html, 'fee_name', i),
      feeBank: pickHidden(html, 'fee_bank', i),
      classYear: pickHidden(html, 'fee_class_year', i),
      academicYear: pickHidden(html, 'fee_academic_year', i),
      academicBatch: pickHidden(html, 'fee_academic_batch', i),
      paymentNo: pickHidden(html, 'payment_no', i),
      slipId: pickHidden(html, 'slip_id', i),
      tfeeAmount: pickHidden(html, 'tfee_amount', i),
      balanceAmount: pickHidden(html, 'balance_amount', i),
      feeFine: pickHidden(html, 'fee_fine', i),
      feeAmount: pickAmount(html, i),
      selected: mode === 'approval',
    });
  }

  return { meta, entries, feeTypes };
}
