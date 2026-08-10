const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:2003/api';
const SERVER_ORIGIN = API_URL.replace(/\/api\/?$/, '');

/** Resolves a server-relative path (e.g. `/legacy/img/member/x.jpg`) to an absolute URL. */
export function resolveMediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SERVER_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}
