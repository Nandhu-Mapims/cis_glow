/**
 * Safe SQL helpers for legacy MariaDB (zero-dates, escaping).
 */
export function escapeSql(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "''");
}

export function parseId(value, label = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid ${label}`);
  }
  return id;
}

export function parseOptionalId(value) {
  if (value === undefined || value === null || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export function normalizeLegacyDate(val) {
  if (!val) return null;
  const str = String(val);
  if (str.startsWith('0000-00-00')) return null;
  return str.slice(0, 10);
}

export function sqlDateOrNull(isoDate) {
  if (!isoDate) return '0000-00-00';
  const d = String(isoDate).slice(0, 10);
  if (d.startsWith('0000')) return '0000-00-00';
  return escapeSql(d);
}

/** Legacy tables store client IP in VARCHAR(15). */
export function normalizeLegacyIp(ip) {
  let value = String(ip || '').trim();
  if (value.startsWith('::ffff:')) value = value.slice(7);
  if (value === '::1') value = '127.0.0.1';
  return value.slice(0, 15);
}
