#!/usr/bin/env node
/**
 * Smoke test: load all staff module setup screens and report loaders with CISADMIN.
 * Usage: node scripts/smoke-staff-module.js
 */
import { loadStaffSetupScreen, STAFF_SETUP_SLUGS } from '../src/services/staff/staffModuleSetup.js';
import { loadStaffScreen, STAFF_SCREEN_SLUGS } from '../src/services/staff/staffModuleScreens.js';

const MEMBER_ID = 'CISADMIN';
const audit = { skipLog: true };

async function run() {
  const failures = [];
  let passed = 0;

  for (const screen of STAFF_SETUP_SLUGS) {
    try {
      const result = await loadStaffSetupScreen(screen, {}, MEMBER_ID, {}, audit);
      if (result?.error) {
        failures.push({ name: `setup:${screen}`, error: result.error });
      } else {
        passed += 1;
        console.log(`OK setup:${screen}`);
      }
    } catch (err) {
      failures.push({ name: `setup:${screen}`, error: err.message });
    }
  }

  for (const screen of STAFF_SCREEN_SLUGS) {
    try {
      const result = await loadStaffScreen(screen, {}, MEMBER_ID, audit);
      if (result?.error) {
        failures.push({ name: `screen:${screen}`, error: result.error });
      } else {
        passed += 1;
        console.log(`OK screen:${screen}`);
      }
    } catch (err) {
      failures.push({ name: `screen:${screen}`, error: err.message });
    }
  }

  console.log(`\nPassed: ${passed}, Failed: ${failures.length}`);
  if (failures.length) {
    console.error('Failures:');
    for (const f of failures) console.error(`  ${f.name}: ${f.error}`);
    process.exit(1);
  }
  console.log('All staff module loaders OK');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
