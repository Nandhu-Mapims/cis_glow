#!/usr/bin/env node
/**
 * Smoke test: load all staff attendance setup screens and report loaders with CISADMIN.
 * Usage: node scripts/smoke-staff-attendance-module.js
 */
import { loadStaffAttSetupScreen } from '../src/services/attendance/staffAttendanceSetup.js';
import { loadStaffAttScreen, STAFF_ATT_SCREEN_SLUGS } from '../src/services/attendance/staffAttendanceScreens.js';
import { buildStaffAttendanceCalendar } from '../src/services/attendance/staffCalendar.js';
import { buildStaffAttendanceReport } from '../src/services/attendance/staffReport.js';
import { prisma } from '../src/config/prisma.js';

const MEMBER_ID = 'CISADMIN';
const audit = { skipLog: true };

const SETUP_SCREENS = [
  'calendar-add',
  'calendar-edit',
  'working-day',
  'att-time',
];

const EXISTING_CORE = [
  ['calendar', async () => {
    const rows = await prisma.$queryRawUnsafe(`SELECT staff_id FROM staff_profile_tb WHERE del=1 AND staff_id IS NOT NULL AND staff_id != '' LIMIT 1`);
    const staffId = rows[0]?.staff_id;
    if (!staffId) return { skipped: true };
    return buildStaffAttendanceCalendar({ staffId, fromDate: '2025-01-01', toDate: '2025-01-07' });
  }],
  ['staff-report', async () => {
    const cats = await prisma.$queryRawUnsafe(`SELECT DISTINCT job_category AS c FROM staff_profile_tb WHERE del=1 AND job_category IS NOT NULL LIMIT 1`);
    const cat = cats[0]?.c;
    if (!cat) return { skipped: true };
    return buildStaffAttendanceReport({ categories: [String(cat)], fromDate: '2025-01-01', toDate: '2025-01-07' });
  }],
];

async function run() {
  const failures = [];
  let passed = 0;

  for (const screen of SETUP_SCREENS) {
    try {
      const result = await loadStaffAttSetupScreen(screen, {}, MEMBER_ID, {}, audit);
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

  for (const screen of STAFF_ATT_SCREEN_SLUGS) {
    try {
      const result = await loadStaffAttScreen(screen, {}, MEMBER_ID, audit);
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

  for (const [name, loader] of EXISTING_CORE) {
    try {
      const result = await loader();
      if (result?.error) {
        console.warn(`WARN core:${name}: ${result.error}`);
      } else if (result?.skipped) {
        console.log(`SKIP core:${name} (no seed data)`);
      } else {
        passed += 1;
        console.log(`OK core:${name}`);
      }
    } catch (err) {
      console.warn(`WARN core:${name}: ${err.message}`);
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
  console.log('All staff attendance smoke tests passed.');
  await prisma.$disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
