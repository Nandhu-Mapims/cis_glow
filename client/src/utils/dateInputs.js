/**
 * Every legacy-parity date field displays as dd-mm-yyyy (or "dd-mm-yyyy
 * hh:mm" for datetime fields) but each backend's date parser (toIsoDate /
 * parseInputDate / parseLegacyDateTime, etc.) already accepts ISO strings
 * as a pass-through alongside that display format. That means native
 * `<input type="date">` / `<input type="datetime-local">` inputs — which
 * require ISO value strings — can be wired in without any backend changes:
 * convert the display value to ISO for the input's `value`, and submit
 * whatever ISO string the input emits on change directly.
 */

export function toDateInputValue(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function toDateTimeInputValue(value) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 16);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
