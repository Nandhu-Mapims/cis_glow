export function normalizeMarkInput(value) {
  let cur = String(value || '').replace(/[^\dA-Za-z]/g, '');
  if ((cur.includes('N') || cur.includes('n')) && (cur.includes('A') || cur.includes('a'))) return 'NA';
  if (cur.includes('A') || cur.includes('a')) return 'A';
  return cur;
}

export function calculateMarkTotal(iMark, vMark, eMark, limits) {
  const { iMax = 0, vMax = 0, eMax = 0, passMin = 0 } = limits;
  let totMarks = 0;
  let calFlag = 0;

  const applyPart = (raw, max) => {
    const val = String(raw || '').trim();
    if (val.toLowerCase() === 'a') { calFlag += 1; return { part: 'A', done: true }; }
    if (val.toLowerCase() === 'na') { calFlag += 1; return { part: 'NA', done: true }; }
    if (val !== '' && !Number.isNaN(Number(val))) {
      const num = Number(val);
      if (num > max) return { part: '', invalid: true };
      calFlag += 1;
      return { part: num, done: true };
    }
    return { part: '', done: false };
  };

  const i = applyPart(iMark, iMax);
  const v = applyPart(vMark, vMax);
  const eVal = String(eMark || '').trim();
  if (eVal.toLowerCase() === 'a') { totMarks = 'A'; calFlag += 1; }
  else if (eVal.toLowerCase() === 'na') { totMarks = 'NA'; calFlag += 1; }
  else if (eVal !== '' && !Number.isNaN(Number(eVal))) {
    const num = Number(eVal);
    if (num > eMax) return { iMark: i.invalid ? '' : iMark, vMark: v.invalid ? '' : vMark, eMark: '', tMark: '', result: '' };
    totMarks = (typeof totMarks === 'number' ? totMarks : 0) + num;
    calFlag += 1;
  }

  if (i.done && i.part !== 'A' && i.part !== 'NA' && typeof i.part === 'number') {
    totMarks = (typeof totMarks === 'number' ? totMarks : 0) + i.part;
  }
  if (v.done && v.part !== 'A' && v.part !== 'NA' && typeof v.part === 'number') {
    totMarks = (typeof totMarks === 'number' ? totMarks : 0) + v.part;
  }
  if (i.part === 'A' || v.part === 'A') totMarks = 'A';
  if (i.part === 'NA' || v.part === 'NA') totMarks = 'NA';

  let result = '';
  if (calFlag === 3) {
    if (totMarks === 'A') result = 'AB';
    else if (totMarks === 'NA') result = 'NA';
    else if (Number(totMarks) < passMin) result = 'FAIL';
    else result = 'PASS';
  } else {
    totMarks = '';
  }

  return {
    iMark: i.invalid ? '' : iMark,
    vMark: v.invalid ? '' : vMark,
    eMark,
    tMark: totMarks,
    result,
  };
}
