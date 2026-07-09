#!/usr/bin/env node
/**
 * Smoke test: Dashboard submenu screen loaders.
 * Usage: node scripts/smoke-dashboard-screens.js
 */
import { loadStudentDashboardShell, loadStaffPatternShell } from '../src/services/dashboard/dashboardScreens.js';
import { loadOverallStrengthReport } from '../src/services/dashboard/studentStrengthOverall.js';
import { loadCommunityStrengthReport } from '../src/services/dashboard/studentCommunityStrength.js';
import { renderStaffUnit1, renderStaffUnit2 } from '../src/services/dashboard/widgets/staffUnitRoster.js';
import { prisma } from '../src/config/prisma.js';

const MEMBER_ID = 'CISADMIN';
const TODAY = new Date().toISOString().slice(0, 10);

async function run() {
  const failures = [];
  let passed = 0;

  const user = await prisma.web_account_setup.findFirst({
    where: { member_id: MEMBER_ID, del: 1 },
  });
  if (!user) {
    console.error('CISADMIN user not found');
    process.exit(1);
  }

  const tests = [
    ['student-dashboard-shell', () => loadStudentDashboardShell(user, {})],
    ['staff-pattern-shell', () => loadStaffPatternShell(user, {})],
    ['overall-strength', () => loadOverallStrengthReport(MEMBER_ID)],
    ['community-strength', () => loadCommunityStrengthReport(MEMBER_ID)],
    ['staff-unit-1', () => renderStaffUnit1({ academicDate: TODAY })],
    ['staff-unit-2', () => renderStaffUnit2({ academicDate: TODAY })],
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
  console.log('All dashboard submenu loaders OK');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
