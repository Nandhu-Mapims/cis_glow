import api from '../../../api/client';

export function batchSelectHtml(rowIndex, batchCount) {
  const count = Math.max(1, Number(batchCount) || 1);
  if (count <= 1) {
    return `<input type="hidden" name="tsub_batch_${rowIndex}[]" value="1" />`;
  }
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let html = `<select name="tsub_batch_${rowIndex}[]" class="form-select form-select-sm" multiple>`;
  for (let b = 1; b <= count; b += 1) {
    html += `<option value="${b}">${letters[b - 1] || b}</option>`;
  }
  return `${html}</select>`;
}

export async function populateAllocationRow(apiBase, rowid, subjectId, container) {
  const batchCon = container.querySelector(`#batch_con_${rowid}`);
  const deptCon = container.querySelector(`#dept_con_${rowid}`);
  const topicCon = container.querySelector(`#topic_con_${rowid}`);
  if (!batchCon || !deptCon || !topicCon) return;

  if (!subjectId) {
    batchCon.innerHTML = '';
    deptCon.innerHTML = '';
    topicCon.innerHTML = '';
    return;
  }

  const batchCount = Number(container.querySelector(`#sbtch_${subjectId}`)?.value || 1);
  batchCon.innerHTML = batchSelectHtml(rowid, batchCount);

  deptCon.innerHTML = '<span class="text-muted small">Loading…</span>';
  topicCon.innerHTML = '';
  try {
    const res = await api.get(`${apiBase}?flag=1&sid=${encodeURIComponent(subjectId)}`);
    const parsed = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    if (parsed?.[0] === 1) {
      deptCon.innerHTML = `<select name="tsub_department_${rowid}[]" class="form-select form-select-sm" multiple>${parsed[1] || ''}</select>`;
      topicCon.innerHTML = `<select name="ttopic_${rowid}[]" class="form-select form-select-sm" multiple>${parsed[2] || ''}</select>`;
    } else {
      deptCon.innerHTML = '<span class="text-danger small">Unable to load staff</span>';
      topicCon.innerHTML = '';
    }
  } catch {
    deptCon.innerHTML = '<span class="text-danger small">Unable to load staff</span>';
    topicCon.innerHTML = '';
  }
}

export function wireAllocationEditor(apiBase, container) {
  if (!container) return () => {};
  const subjectSelects = container.querySelectorAll('select[name="tsub_id[]"]');
  const cleanups = [];

  subjectSelects.forEach((select, rowid) => {
    const onChange = () => populateAllocationRow(apiBase, rowid, select.value, container);
    select.addEventListener('change', onChange);
    cleanups.push(() => select.removeEventListener('change', onChange));
    if (select.value && !container.querySelector(`#dept_con_${rowid} select`)) {
      onChange();
    }
  });

  return () => cleanups.forEach((fn) => fn());
}
