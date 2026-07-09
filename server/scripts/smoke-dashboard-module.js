#!/usr/bin/env node
/**
 * Smoke test: all dashboard widget handlers (native, no PHP bridge).
 * Usage: node scripts/smoke-dashboard-module.js
 */
import { fetchWidgets } from '../src/services/dashboard/widgetDispatcher.js';

const MEMBER_ID = 'CISADMIN';
const TODAY = new Date().toISOString().slice(0, 10);
const DATE_UNIX = Math.floor(new Date(`${TODAY}T12:00:00`).getTime() / 1000);

const ALL_WIDGETS = [
  'staff_attendance',
  'staff_attendance_incampus',
  'staff_leave_absent',
  'staff_details',
  'staff_permission',
  'staff_unit',
  'staff_current',
  'ug_attendance',
  'ug_attendance_add',
  'pg_attendance',
  'pg_attendance_dept',
  'pg_leave_absent',
  'pg_permission',
  'internship_attendance',
  'internship_attendance_batch',
  'internship_leave_absent',
  'internship_permission',
  'student_details',
  'student_add_details',
  'student_hostel',
  'gents_hostel_attendance',
  'ladies_hostel_attendance',
  'student_ghostel',
  'student_lhostel',
  'student_scholarship',
  'feedback_analyasis',
];

async function run() {
  const failures = [];
  let passed = 0;

  try {
    const result = await fetchWidgets({
      memberId: MEMBER_ID,
      widgetNames: ALL_WIDGETS,
      dateUnix: DATE_UNIX,
      academicYears: { ugr: '', uga: '', pgr: '' },
    });

    for (const widget of result.widgets || []) {
      if (!widget.html || widget.html.includes('not yet ported')) {
        failures.push({ name: widget.id, error: 'placeholder or empty HTML' });
      } else {
        passed += 1;
        console.log(`OK ${widget.id}`);
      }
    }

    const missing = ALL_WIDGETS.filter(
      (name) => !(result.widgets || []).some((w) => w.id === name),
    );
    for (const name of missing) {
      failures.push({ name, error: 'missing from response' });
    }
  } catch (err) {
    console.error('Fatal:', err.message);
    process.exit(1);
  }

  console.log(`\nPassed: ${passed}, Failed: ${failures.length}`);
  if (failures.length) {
    console.error('Failures:');
    for (const f of failures) console.error(`  ${f.name}: ${f.error}`);
    process.exit(1);
  }
  console.log('All dashboard widgets OK (24/24)');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
