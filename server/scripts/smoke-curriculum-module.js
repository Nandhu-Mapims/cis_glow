#!/usr/bin/env node
/**
 * Smoke test: all Curriculum / Academic module screen loaders.
 * Usage: node scripts/smoke-curriculum-module.js
 */
import { loadAcademicSetupScreen } from '../src/services/academic/academicSetup.js';
import { CURRICULUM_SCREEN_SLUGS } from '../src/services/academic/curriculumScreenRegistry.js';

const MEMBER_ID = 'CISADMIN';
const audit = { skipLog: true };

const BASE_SCREENS = [
  'subject-master', 'academic-years', 'master-setup', 'subject-setup',
  'subject-batch', 'subject-unit', 'subject-schedule', 'tt-config',
  'subject-report', 'timetable-report', 'batch-timetable-report',
];

async function run() {
  const failures = [];
  let passed = 0;
  const screens = [...BASE_SCREENS, ...CURRICULUM_SCREEN_SLUGS];

  for (const screen of screens) {
    try {
      const result = await loadAcademicSetupScreen(screen, {}, MEMBER_ID, {}, audit);
      if (result?.error) failures.push({ name: screen, error: result.error });
      else {
        passed += 1;
        console.log(`OK ${screen}`);
      }
    } catch (err) {
      failures.push({ name: screen, error: err.message });
    }
  }

  console.log(`\nPassed: ${passed}, Failed: ${failures.length}`);
  if (failures.length) {
    console.error('Failures:');
    for (const f of failures) console.error(`  ${f.name}: ${f.error}`);
    process.exit(1);
  }
  console.log('All curriculum module loaders OK');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
