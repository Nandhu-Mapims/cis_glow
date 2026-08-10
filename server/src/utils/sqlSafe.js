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

// log_tb.log_timestamp (and similar legacy DATETIME columns) store naive local
// wall-clock strings, not UTC — the app's DB session timezone matches the
// institution's local timezone. Prisma has no way to know that: it reads these
// columns back as if the digits were UTC (slaps a trailing Z on them), so any
// `new Date()`-based comparison against a Prisma-read or Prisma-bound DateTime is
// silently offset by the local UTC delta (e.g. +5:30 for Asia/Kolkata) — recent
// rows look hours old, or old rows look "recent" for hours. Comparisons against
// these columns must go through raw SQL using a wall-clock string formatted in
// the same timezone the column was written in, not a JS Date object.
export function formatLocalTimestamp(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
