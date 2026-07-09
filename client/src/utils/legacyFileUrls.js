/**
 * Legacy DB values sometimes store URL-encoded filenames (e.g. spaces as %20).
 * Decode before building browser URLs so we don't double-encode.
 */
export function normalizeLegacyFilename(filename) {
  const raw = String(filename || '').trim();
  if (!raw) return '';

  let decoded = raw;
  for (let i = 0; i < 2; i += 1) {
    if (!/%[0-9A-Fa-f]{2}/.test(decoded)) break;
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

export function legacyPublicFileUrl(folder, filename) {
  const name = normalizeLegacyFilename(filename);
  if (!name) return null;
  const encoded = name.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `/legacy/files/${folder}/${encoded}`;
}

export function legacySecureFileUrl(folder, filename) {
  const name = normalizeLegacyFilename(filename);
  if (!name) return null;
  const encoded = name.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `/api/files/${folder}/${encoded}`;
}
