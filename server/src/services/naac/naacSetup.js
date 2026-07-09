import { loadNaacQual, saveNaacQual } from './naacQual.js';
import { loadNaacQuan, saveNaacQuan } from './naacQuan.js';
import { loadNaacQuanReport } from './naacQuanReport.js';
import { loadNaacQuanDetailedReport } from './naacQuanDetailedReport.js';

const VALID_SCREENS = new Set(['qual', 'quan', 'quan-report', 'quan-detailed-report']);

export const NATIVE_SCREENS = VALID_SCREENS;

const LOADERS = {
  qual: (m, f, _q, a) => loadNaacQual(m, f, a),
  quan: (m, f, _q, a) => loadNaacQuan(m, f, a),
  'quan-report': (m, f, _q, a) => loadNaacQuanReport(m, f, a),
  'quan-detailed-report': (m, f, _q, a) => loadNaacQuanDetailedReport(m, f, a),
};

const SAVERS = {
  qual: (f, m, _files, a) => saveNaacQual(f, m, a),
  quan: (f, m, _files, a) => saveNaacQuan(f, m, a),
};

export function assertNaacScreen(screen) {
  if (!VALID_SCREENS.has(screen)) return { error: 'Unknown NAAC screen' };
  return null;
}

export async function loadNaacScreen(screen, fields, memberId, query = {}, audit = {}) {
  const invalid = assertNaacScreen(screen);
  if (invalid) return invalid;
  return LOADERS[screen](memberId, fields, query, audit);
}

export async function saveNaacScreen(screen, fields, memberId, files = [], audit = {}) {
  const invalid = assertNaacScreen(screen);
  if (invalid) return invalid;
  if (!SAVERS[screen]) return { error: 'Screen is read-only' };
  return SAVERS[screen](fields, memberId, files, audit);
}
