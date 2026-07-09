const YEAR_LABELS = ['', 'I', 'II', 'III', 'IV', 'Int.', 'VI', 'VII', 'VIII', 'IX', 'X'];

const NUMBER_WORDS = {
  0: '', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five',
  6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
  11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen',
  16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty',
  30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty', 70: 'seventy',
  80: 'eighty', 90: 'ninety',
};

export function parseDisplayDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const parts = str.split('-');
  if (parts.length !== 3) return new Date().toISOString().slice(0, 10);
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function formatDisplayDate(isoDate) {
  if (!isoDate || String(isoDate).startsWith('0000')) return '';
  const [y, m, d] = String(isoDate).slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}

export function formatIndianMoney(number) {
  const num = Number(number) || 0;
  const decimal = String(num - Math.floor(num));
  let money = String(Math.floor(num));
  const length = money.length;
  money = money.split('').reverse().join('');
  let delimiter = '';
  for (let i = 0; i < length; i += 1) {
    if ((i === 3 || (i > 3 && (i - 1) % 2 === 0)) && i !== length) {
      delimiter += ',';
    }
    delimiter += money[i];
  }
  let result = delimiter.split('').reverse().join('');
  let dec = decimal.replace(/0\./i, '.');
  dec = dec.slice(0, 3);
  if (dec !== '0') result += dec;
  return result;
}

export function convertNumberToWords(number) {
  const num = Math.floor(Number(number) || 0);
  const numberStr = String(num);
  const numberLength = numberStr.length;
  if (numberLength > 9) return '';
  const numberArray = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const received = numberStr.split('');
  for (let i = 0, j = 0; i < 9; i += 1, j += 1) {
    if (i >= 9 - numberLength) numberArray[i] = Number(received[j]);
  }
  for (let i = 0, j = 1; i < 9; i += 1, j += 1) {
    if (i === 0 || i === 2 || i === 4 || i === 7) {
      if (numberArray[i] === 1) {
        numberArray[j] = 10 + numberArray[j];
        numberArray[i] = 0;
      }
    }
  }
  let words = '';
  for (let i = 0; i < 9; i += 1) {
    let value = 0;
    if (i === 0 || i === 2 || i === 4 || i === 7) value = numberArray[i] * 10;
    else value = numberArray[i];
    if (value !== 0) words += `${NUMBER_WORDS[value]} `;
    if ((i === 1 && value !== 0) || (i === 0 && value !== 0 && numberArray[i + 1] === 0)) words += 'Crore ';
    if ((i === 3 && value !== 0) || (i === 2 && value !== 0 && numberArray[i + 1] === 0)) words += 'Lakh ';
    if ((i === 5 && value !== 0) || (i === 4 && value !== 0 && numberArray[i + 1] === 0)) words += 'Thousand ';
    if ((i === 6 && value !== 0) && (numberArray[i + 1] !== 0 && numberArray[i + 2] !== 0)) words += 'Hundred and ';
    else if (i === 6 && value !== 0) words += 'Hundred ';
  }
  if (words.endsWith(' and ')) words = words.slice(0, -5);
  const title = words.trim()
    ? words.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : 'Zero';
  return `${title} Only`;
}

export function convertNYear(year, courseName = '1') {
  const idx = Number(year) || 0;
  return YEAR_LABELS[idx] || String(year);
}

export function titleCaseName(first, initial) {
  const name = String(first || '').trim();
  const init = String(initial || '').trim().toUpperCase();
  const titled = name.split(/\s+/).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
  return `${titled}${init ? ` ${init}` : ''}`.trim();
}

export function buildCasteScholarshipFilter(casteScholarship, prefix = '') {
  const c = String(casteScholarship || '').trim();
  if (!c) return '';
  const p = prefix ? `${prefix}.` : '';
  return ` AND (${p}fee_caste='' OR 
    (${p}fee_include!='except' AND ( ${p}fee_caste='${c}' OR ${p}fee_caste LIKE '${c},%' OR ${p}fee_caste LIKE '%,${c}' OR ${p}fee_caste LIKE '%,${c},%' ) ) OR 
    (${p}fee_include='except' AND ${p}fee_caste!='${c}' AND ${p}fee_caste NOT LIKE '${c},%' AND ${p}fee_caste NOT LIKE '%,${c}' AND ${p}fee_caste NOT LIKE '%,${c},%' ) 
    )`;
}

export function buildNoScholarshipFilter(prefix = '') {
  const p = prefix ? `${prefix}.` : '';
  return ` AND (${p}fee_caste='' OR (${p}fee_include='except' AND ${p}fee_caste!='' ) )`;
}

export function roomFeeString(roomType) {
  const r = String(roomType || '');
  if (r === '55') return " AND (fee_name NOT IN ('8','24','25'))";
  if (r === '56') return " AND (fee_name NOT IN ('23','24','25'))";
  if (r === '57') return " AND (fee_name NOT IN ('8','24','23'))";
  if (r === '58') return " AND (fee_name NOT IN ('8','23','25'))";
  return '';
}

export function hostelFeeMatch(feeLabel, roomId) {
  const lower = String(feeLabel || '').toLowerCase();
  const isHostel = lower.includes('hostel');
  if (isHostel && roomId) return true;
  if (!isHostel && !roomId) return true;
  if (!isHostel) return true;
  return false;
}

export async function loadFeeLabelMap(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT id, fee_name, is_scholar FROM fee_label_master WHERE del = 1 ORDER BY fee_order ASC',
  );
  const labels = {};
  const scholarIds = [];
  rows.forEach((row) => {
    labels[row.id] = row.fee_name;
    if (Number(row.is_scholar) === 1) scholarIds.push(String(row.id));
  });
  return { labels, scholarIds };
}

export async function loadAcademicYearSetup(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT ug_academic_year, uga_academic_year, pg_academic_year FROM basic_setup_tb WHERE del = 1 AND id = 1 LIMIT 1',
  );
  const row = rows[0] || {};
  return {
    'U.G': { regular: row.ug_academic_year || '', additional: row.uga_academic_year || '' },
    'P.G': { regular: row.pg_academic_year || '', additional: '' },
  };
}

export function ugAcYearString(courseName, admissionYear, academicYears) {
  const regular = academicYears[courseName]?.regular || '';
  const additional = academicYears[courseName]?.additional || '';
  if (courseName !== 'U.G') {
    return ` AND academic_year='${regular}' AND academic_batch='regular' `;
  }
  if (admissionYear !== '2024-2025' && admissionYear !== '2023-2024') {
    return ` AND ((academic_year='${regular}' AND academic_batch='regular') OR (academic_year='${additional}' AND academic_batch='additional'))`;
  }
  if (admissionYear === '2024-2025' || admissionYear === '2023-2024') {
    return ` AND ((academic_year='2024-2025' AND academic_batch='regular') OR (academic_year='${additional}' AND academic_batch='additional'))`;
  }
  return ` AND academic_year='${regular}' AND academic_batch='regular' `;
}
