#!/usr/bin/env node
/**
 * Smoke test: load all student attendance module screens with CISADMIN.
 * Usage: node scripts/smoke-student-att-module.js
 */
import { loadStudentAttScreen, STUDENT_ATT_SCREEN_SLUGS } from '../src/services/attendance/studentAttendanceScreens.js';

const MEMBER_ID = 'CISADMIN';
const audit = { skipLog: true };

async function run() {
  const failures = [];
  let passed = 0;

  for (const screen of STUDENT_ATT_SCREEN_SLUGS) {
    try {
      const result = await loadStudentAttScreen(screen, {}, MEMBER_ID, audit);
      if (result?.error) {
        failures.push({ name: screen, error: result.error });
      } else {
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
  console.log('All student attendance module loaders OK');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
