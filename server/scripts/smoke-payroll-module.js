#!/usr/bin/env node
/**
 * Smoke test: load all payroll setup screens and report loaders with CISADMIN.
 * Usage: node scripts/smoke-payroll-module.js
 */
import { loadPayrollSetupScreen } from '../src/services/payroll/payrollSetup.js';
import { loadGeneratePayroll } from '../src/services/payroll/generatePayrollCore.js';
import { loadPayrollAttReport } from '../src/services/payroll/payrollAttReportCore.js';
import { loadPayrollMonthlyReport } from '../src/services/payroll/payrollMonthlyReportCore.js';
import { loadPayrollTaxReport } from '../src/services/payroll/payrollTaxReportCore.js';

const MEMBER_ID = 'CISADMIN';
const audit = { skipLog: true };

const SETUP_SCREENS = [
  'individual-setup',
  'cron-setup',
  'payroll-config',
  'pf-esi-setup',
  'salary-add',
  'salary-report',
  'salary-advance-add',
  'salary-advance-close',
  'salary-arrear-add',
  'salary-arrear-release',
  'other-deduction',
  'lop-deduction',
  'tds-add',
  'cheque-payment',
  'security-deposit-add',
  'security-deposit-close',
  'payroll-close',
];

const REPORT_LOADERS = [
  ['generate-payroll', () => loadGeneratePayroll(MEMBER_ID, {}, audit)],
  ['att-report', () => loadPayrollAttReport(MEMBER_ID, {}, audit)],
  ['monthly-report', () => loadPayrollMonthlyReport(MEMBER_ID, {}, audit)],
  ['tax-report', () => loadPayrollTaxReport(MEMBER_ID, {}, audit)],
];

async function run() {
  const failures = [];
  let passed = 0;

  for (const screen of SETUP_SCREENS) {
    try {
      const result = await loadPayrollSetupScreen(screen, {}, MEMBER_ID, audit);
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

  for (const [name, loader] of REPORT_LOADERS) {
    try {
      const result = await loader();
      if (result?.error) {
        failures.push({ name: `report:${name}`, error: result.error });
      } else {
        passed += 1;
        console.log(`OK report:${name}`);
      }
    } catch (err) {
      failures.push({ name: `report:${name}`, error: err.message });
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failures.length}`);
  if (failures.length) {
    for (const f of failures) {
      console.error(`FAIL ${f.name}: ${f.error}`);
    }
    process.exit(1);
  }
  console.log('All payroll smoke tests passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
