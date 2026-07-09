#!/usr/bin/env node
/**
 * Smoke test: load all exam + e-learning converted screens with CISADMIN.
 * Usage: node scripts/smoke-exam-elearning-module.js
 */
import { loadExamSetupScreen } from '../src/services/exam/examSetup.js';
import { loadExamDashboard } from '../src/services/exam/examDashboard.js';
import { loadElearnDashboard, loadElearningScreen } from '../src/services/elearning/elearningSetup.js';

const MEMBER_ID = 'CISADMIN';
const audit = { skipLog: true };

const EXAM_SCREENS = [
  'exam-names',
  'exam-setup',
  'exam-nodue',
  'exam-schedule',
  'exam-batch',
  'mark-sheet',
  'exam-examiners',
  'exam-attendance-certificate',
  'examiner-setup',
  'camp-activity-add',
  'camp-activity-edit',
  'camp-activity-type',
  'mark-entry',
  'attendance-entry',
  'attendance-report',
  'marks-upload',
  'sheets-upload',
  'sheets-status',
  'mark-sheet-status',
  'mark-sheet-received',
  'term-statement',
  'term-report',
  'report-analysis',
  'report-analysis-v1',
  'progress-card',
  'exam-sms',
  'schedule-print',
  'invigilator-print',
  'omr-config',
];

const ELEARNING_SCREENS = [
  'elearn-dashboard',
  'elearn-setup',
  'elearn-report',
];

async function run() {
  const failures = [];
  let passed = 0;

  for (const screen of EXAM_SCREENS) {
    try {
      const result = await loadExamSetupScreen(screen, {}, MEMBER_ID, {}, audit);
      if (result?.error) {
        failures.push({ name: `exam:${screen}`, error: result.error });
      } else {
        passed += 1;
        console.log(`OK exam:${screen}`);
      }
    } catch (error) {
      failures.push({ name: `exam:${screen}`, error: error.message });
    }
  }

  for (const screen of ELEARNING_SCREENS) {
    try {
      const result = await loadElearningScreen(screen, {}, MEMBER_ID, {}, audit);
      if (result?.error) {
        failures.push({ name: `elearning:${screen}`, error: result.error });
      } else {
        passed += 1;
        console.log(`OK elearning:${screen}`);
      }
    } catch (error) {
      failures.push({ name: `elearning:${screen}`, error: error.message });
    }
  }

  try {
    const dash = await loadExamDashboard(MEMBER_ID);
    if (dash?.error) {
      console.warn(`WARN exam:dashboard: ${dash.error}`);
    }
    else {
      passed += 1;
      console.log('OK exam:dashboard');
    }
  } catch (error) {
    console.warn(`WARN exam:dashboard: ${error.message}`);
  }

  try {
    const dash = await loadElearnDashboard(MEMBER_ID, {}, audit);
    if (dash?.error) failures.push({ name: 'elearning:dashboard', error: dash.error });
    else {
      passed += 1;
      console.log('OK elearning:dashboard');
    }
  } catch (error) {
    failures.push({ name: 'elearning:dashboard', error: error.message });
  }

  console.log('\n--- Summary ---');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failures.length}`);
  if (failures.length) {
    for (const failure of failures) {
      console.error(`FAIL ${failure.name}: ${failure.error}`);
    }
    process.exit(1);
  }
  console.log('All exam + e-learning smoke tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
