/**
 * Build URLs for legacy file paths relative to `files/`.
 * Use publicUrl for browser links (static /legacy mount).
 * Use secureUrl when downloading via authenticated API.
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

export function legacyPublicFileUrl(relativePath) {
  const normalized = String(relativePath || '').replace(/^\/+/, '');
  if (!normalized) return null;
  if (normalized.startsWith('files/')) {
    const rest = normalized.slice('files/'.length);
    const [folder, ...parts] = rest.split('/');
    if (parts.length) {
      const filename = normalizeLegacyFilename(parts.join('/'));
      const encoded = filename.split('/').map((p) => encodeURIComponent(p)).join('/');
      return `/legacy/files/${folder}/${encoded}`;
    }
    return `/legacy/${normalized}`;
  }
  const parts = normalized.split('/');
  const folder = parts[0];
  const filename = normalizeLegacyFilename(parts.slice(1).join('/'));
  if (!filename) return `/legacy/files/${folder}`;
  const encoded = filename.split('/').map((p) => encodeURIComponent(p)).join('/');
  return `/legacy/files/${folder}/${encoded}`;
}

export function legacySecureFileUrl(relativePath) {
  const normalized = String(relativePath || '').replace(/^\/+/, '').replace(/^files\//, '');
  if (!normalized) return null;
  return `/api/files/${normalized}`;
}
