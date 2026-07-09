/**
 * Recursively coerce values that Express/JSON.stringify cannot serialize.
 */
export function toJsonSafe(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = toJsonSafe(val);
    }
    return out;
  }
  return value;
}
