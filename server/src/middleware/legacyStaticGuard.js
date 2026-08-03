// Guards the `/legacy` static mount, which serves LEGACY_CIS_PATH (the whole legacy
// PHP application root) as static files so the modernized app can reuse legacy print
// CSS/images/photos/attachments. Express never executes .php files it serves this
// way — it returns the raw source, including files like config.php that embed live
// DB credentials. This middleware closes that off by only allowing the specific
// top-level directories the app actually links to (see FILE_STORAGE_MAP for the
// files/<folder> list), and by blocking source/config file extensions everywhere,
// as defense in depth in case a new folder needs allow-listing later.
const ALLOWED_TOP_LEVEL_DIRS = new Set(['css', 'img', 'js', 'assets', 'tv', 'naac', 'alumni']);

const BLOCKED_EXTENSIONS = new Set([
  '.php', '.php3', '.php4', '.php5', '.phtml', '.phar',
  '.inc', '.env', '.sql', '.log', '.bak', '.swp', '.ini', '.conf', '.sh',
]);

export function legacyStaticGuard(req, res, next) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(req.path);
  } catch {
    return res.status(400).json({ message: 'Bad request' });
  }

  const segments = decodedPath.split('/').filter(Boolean);
  if (!segments.length || segments.some((seg) => seg === '.' || seg === '..' || seg.startsWith('.'))) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const lastSegment = segments[segments.length - 1];
  const dotIndex = lastSegment.lastIndexOf('.');
  const ext = dotIndex >= 0 ? lastSegment.slice(dotIndex).toLowerCase() : '';
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const [first, second] = segments;
  const allowed = ALLOWED_TOP_LEVEL_DIRS.has(first) || (first === 'files' && Boolean(second));
  if (!allowed) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  return next();
}
