export function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

export function assertOk(response, label = 'request') {
  if (!response.ok) {
    const detail = typeof response.data === 'object'
      ? JSON.stringify(response.data)
      : String(response.data || '');
    throw new Error(`${label} failed (${response.status}): ${detail}`);
  }
}

export function assertArray(value, label = 'value') {
  assert(Array.isArray(value), `${label} should be an array`);
}

export function assertObject(value, label = 'value') {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} should be an object`);
}
