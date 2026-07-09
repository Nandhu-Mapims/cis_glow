#!/usr/bin/env node
/**
 * Smoke test: Hostel module loaders.
 * Usage: node scripts/smoke-hostel-module.js
 */
import { loadHostelSetupScreen } from '../src/services/hostel/hostelSetup.js';

const MEMBER_ID = 'CISADMIN';
const audit = { skipLog: true };

const SCREENS = [
  'dashboard',
  'block-setup',
  'room-setup-add',
  'room-setup-edit',
  'room-rental-setup',
  'transport-add',
  'transport-edit',
  'transport-stopping-setup',
  'transport-fee-config',
  'student-hostel',
  'att-setup',
  'attendance-report',
  'pass-approval',
  'pass-report',
  'staff-rental',
];

async function run() {
  const failures = [];
  let passed = 0;

  for (const screen of SCREENS) {
    try {
      const result = await loadHostelSetupScreen(screen, {}, MEMBER_ID, {}, audit);
      if (result?.error || result?.code === 'NOT_PORTED') {
        failures.push({ name: screen, error: result.error || result.code });
      } else {
        passed += 1;
        console.log(`OK hostel:${screen}`);
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
  console.log('All hostel module loaders OK');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
