#!/usr/bin/env node
/**
 * Smoke test: Library module loaders.
 * Usage: node scripts/smoke-library-module.js
 */
import { loadLibrarySetupScreen } from '../src/services/library/librarySetup.js';

const MEMBER_ID = 'CISADMIN';
const audit = { skipLog: true };

const SCREENS = [
  'dashboard',
  'book-category',
  'book-add',
  'book-edit',
  'book-report',
  'transaction-issue',
  'transaction-return',
  'transaction-setup',
  'transaction-report',
  'entry-report',
  'attendance',
  'att-entry',
  'att-report',
  'supplier-add',
  'supplier-edit',
  'resources-report',
  'resources-barcode',
  'resource-transfer',
];

async function run() {
  const failures = [];
  let passed = 0;

  for (const screen of SCREENS) {
    try {
      const result = await loadLibrarySetupScreen(screen, {}, MEMBER_ID, {}, audit);
      if (result?.error || result?.code === 'NOT_PORTED') {
        failures.push({ name: screen, error: result.error || result.code });
      } else {
        passed += 1;
        console.log(`OK library:${screen}`);
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
  console.log('All library module loaders OK');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
