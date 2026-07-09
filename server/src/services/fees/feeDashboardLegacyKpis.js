import { runLegacyBridge } from '../legacy/phpBridge.js';

const kpiCache = new Map();
const CACHE_TTL_MS = 300_000;

export async function loadLegacyDashboardKpis(attendanceDate) {
  const cacheKey = attendanceDate || 'today';
  const cached = kpiCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const raw = await runLegacyBridge('fee_dashboard_kpis.php', {
    memberId: 'CISADMIN',
    attendanceDate,
  });

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Unable to parse legacy fee dashboard KPI response');
  }

  if (parsed.error) {
    throw new Error(parsed.error);
  }

  kpiCache.set(cacheKey, { at: Date.now(), data: parsed });
  return parsed;
}
