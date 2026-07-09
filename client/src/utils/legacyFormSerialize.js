function assignPhpName(obj, name, value) {
  if (name.endsWith('[]')) {
    const key = name.slice(0, -2);
    if (!Array.isArray(obj[key])) obj[key] = [];
    obj[key].push(value);
    return;
  }

  const match = name.match(/^([^\[]+)\[([^\]]+)\]$/);
  if (match) {
    const [, key, idx] = match;
    if (!obj[key] || typeof obj[key] !== 'object' || Array.isArray(obj[key])) {
      obj[key] = {};
    }
    obj[key][idx] = value;
    return;
  }

  obj[name] = value;
}

export function serializeLegacyForm(formEl, submitter = null) {
  const data = {};
  const elements = formEl.elements;

  for (let i = 0; i < elements.length; i += 1) {
    const el = elements[i];
    if (!el.name || el.disabled) continue;
    if (el.type === 'submit' || el.type === 'button') continue;
    if (el.type === 'radio' && !el.checked) continue;
    if (el.type === 'checkbox' && !el.checked) continue;

    if (el.tagName === 'SELECT' && el.multiple) {
      const selected = [...el.selectedOptions].map((opt) => opt.value);
      selected.forEach((value) => assignPhpName(data, el.name, value));
      continue;
    }

    assignPhpName(data, el.name, el.value);
  }

  if (submitter?.type === 'submit') {
    if (submitter.name) {
      assignPhpName(data, submitter.name, submitter.value);
    } else if (submitter.value) {
      data.Submit = submitter.value;
    }
  }

  return data;
}

export function isFeeSetupSaveAction(fields) {
  return fields.Submit === 'Update' || fields.delete === 'Confirm';
}

export function isAcademicSetupSaveAction(fields) {
  if (fields.delete === 'Confirm' || fields.delete === 'Confirm1') return true;
  if (fields.Submit === 'Go' || fields.Submit === 'Search') return false;
  if (fields.Submit === 'Update' || fields.Submit === 'Save') return true;
  if (fields.Save === 'Save') return true;
  return false;
}

export function isAcademicReportScreen(screen) {
  return screen === 'subject-report'
    || screen === 'timetable-report'
    || screen === 'batch-timetable-report';
}

export function isExamSetupSaveAction(fields) {
  if (fields.delete === 'Confirm' || fields.delete === 'Confirm1') return true;
  if (fields.Submit === 'Go' || fields.Submit === 'Search') return false;
  if (fields.Submit === 'Update' || fields.Submit === 'Save' || fields.Submit === 'Upload') return true;
  if (fields.Save === 'Save') return true;
  return false;
}

export function isExamReportScreen(screen) {
  return screen === 'term-report'
    || screen === 'term-statement'
    || screen === 'progress-card'
    || screen === 'schedule-print'
    || screen === 'invigilator-print'
    || screen === 'report-analysis';
}

export function isPayrollSetupSaveAction(fields) {
  if (fields.delete === 'Confirm') return true;
  if (fields.Submit === 'Submit' || fields.Submit === 'Update') return true;
  if (fields.Submit === 'Generate' || fields.Submit === 'Go') return false;
  return false;
}

export function isAdminSetupSaveAction(fields) {
  if (fields.delete === 'Confirm') return true;
  if (fields.Submit === 'Save') return true;
  if (fields.Submit0 === 'Save' || fields.Submit3 === 'Save') return true;
  if (fields.Submit === 'Update') return true;
  if (fields.Submit === 'Go' || fields.Submit === 'Search') return false;
  return false;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

export async function collectLegacyFormFiles(formEl) {
  const files = [];
  const elements = formEl.elements;

  for (let i = 0; i < elements.length; i += 1) {
    const el = elements[i];
    if (!el.name || el.type !== 'file' || !el.files?.length) continue;

    for (let index = 0; index < el.files.length; index += 1) {
      const file = el.files[index];
      files.push({
        field: el.name,
        index,
        filename: file.name,
        type: file.type || 'application/octet-stream',
        content: await readFileAsBase64(file),
      });
    }
  }

  return files;
}
