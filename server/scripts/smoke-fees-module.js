#!/usr/bin/env node
/**
 * Smoke test: Fees module loaders (lightweight init paths).
 * Usage: node scripts/smoke-fees-module.js
 */
import { loadFeeSetupScreen } from '../src/services/fees/feeSetup.js';
import { getFeeFilterOptions } from '../src/services/fees/feeFilters.js';
import { listMyFeeDeleteRequests, listPendingFeeDeleteApprovals } from '../src/services/fees/feeDelete.js';
import { loadPendingSmsClasses } from '../src/services/fees/feePendingSms.js';
import { loadPendingLetterForm } from '../src/services/fees/feePendingLetter.js';
import { loadScholarshipSetup } from '../src/services/fees/feeScholarshipSetup.js';
import { loadDmeSetup } from '../src/services/fees/feeDmeSetup.js';
import { loadAcmecScholarshipSetup } from '../src/services/fees/feeAcmecScholarshipSetup.js';
import { loadAcmecConfig } from '../src/services/fees/feeAcmecConfig.js';

const MEMBER_ID = 'CISADMIN';
const audit = { skipLog: true };

const SETUP_SCREENS = ['label', 'type', 'bank', 'fine', 'name'];

async function run() {
  const failures = [];
  let passed = 0;

  const tests = [
    ['filters', () => getFeeFilterOptions()],
    ['delete-requests', () => listMyFeeDeleteRequests(MEMBER_ID)],
    ['delete-approvals', () => listPendingFeeDeleteApprovals()],
    ['pending-sms-classes', () => loadPendingSmsClasses()],
    ['pending-letter-form', () => loadPendingLetterForm()],
    ['scholarship-setup', () => loadScholarshipSetup({})],
    ['dme-setup', () => loadDmeSetup({})],
    ['acmec-scholarship-setup', () => loadAcmecScholarshipSetup({})],
    ['acmec-config', () => loadAcmecConfig(MEMBER_ID, {}, audit)],
    ...SETUP_SCREENS.map((screen) => [
      `setup-${screen}`,
      () => loadFeeSetupScreen(screen, {}, MEMBER_ID, audit),
    ]),
  ];

  for (const [name, fn] of tests) {
    try {
      const result = await fn();
      if (result?.error) failures.push({ name, error: result.error });
      else {
        passed += 1;
        console.log(`OK ${name}`);
      }
    } catch (err) {
      failures.push({ name, error: err.message });
    }
  }

  console.log(`\nPassed: ${passed}, Failed: ${failures.length}`);
  if (failures.length) {
    console.error('Failures:');
    for (const f of failures) console.error(`  ${f.name}: ${f.error}`);
    process.exit(1);
  }
  console.log('All fees module loaders OK');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
