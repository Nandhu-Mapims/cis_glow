import { loadElearnSetup, saveElearnSetup } from './elearnSetup.js';
import { loadElearnDashboard } from './elearnDashboard.js';
import { loadElearnReport } from './elearnReport.js';
import { loadSubjectTest, saveSubjectTest } from './subjectTest.js';
import { loadSubjectReport } from './subjectReport.js';

const VALID_SCREENS = new Set([
  'elearn-setup',
  'elearn-dashboard',
  'elearn-report',
  'subject-test',
  'subject-report',
]);

export const NATIVE_SCREENS = VALID_SCREENS;

const LOADERS = {
  'elearn-setup': (m, f, _q, a) => loadElearnSetup(m, f, a),
  'elearn-dashboard': (m, f, _q, a) => loadElearnDashboard(m, f, a),
  'elearn-report': (m, f, _q, a) => loadElearnReport(m, f, a),
  'subject-test': (m, f, _q, a) => loadSubjectTest(m, f, a),
  'subject-report': (m, f, _q, a) => loadSubjectReport(m, f, a),
};

const SAVERS = {
  'elearn-setup': (f, m, _files, a) => saveElearnSetup(f, m, a),
  'subject-test': (f, m, _files, a) => saveSubjectTest(f, m, a),
};

export function assertElearningScreen(screen) {
  if (!VALID_SCREENS.has(screen)) return { error: 'Unknown e-learning screen' };
  return null;
}

export async function loadElearningScreen(screen, fields, memberId, query = {}, audit = {}) {
  const invalid = assertElearningScreen(screen);
  if (invalid) return invalid;
  return LOADERS[screen](memberId, fields, query, audit);
}

export async function saveElearningScreen(screen, fields, memberId, files = [], audit = {}) {
  const invalid = assertElearningScreen(screen);
  if (invalid) return invalid;
  if (!SAVERS[screen]) return { error: 'Screen is read-only' };
  return SAVERS[screen](fields, memberId, files, audit);
}

export { loadElearnDashboard };
