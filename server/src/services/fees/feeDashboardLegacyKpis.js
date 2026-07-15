import { computeFeeDashboardKpisNative } from './feeDashboardKpisNative.js';

const kpiCache = new Map();
const CACHE_TTL_MS = 300_000;

export async function loadLegacyDashboardKpis(attendanceDate) {
  const cacheKey = attendanceDate || 'today';
  const cached = kpiCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const parsed = await computeFeeDashboardKpisNative();

  kpiCache.set(cacheKey, { at: Date.now(), data: parsed });
  return parsed;
}
