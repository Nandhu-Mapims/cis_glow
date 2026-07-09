#!/usr/bin/env node
/**
 * Smoke test: Student Portfolia module loaders.
 * Usage: node scripts/smoke-portfolio-module.js
 */
import { loadPortfolioDashboard } from '../src/services/portfolio/portfolioDashboard.js';
import {
  loadPortfolioIndividualReport,
  loadPortfolioStudentDetail,
} from '../src/services/portfolio/portfolioIndividualReport.js';

const MEMBER_ID = 'CISADMIN';
const audit = { skipLog: true };

async function run() {
  const failures = [];
  let passed = 0;

  const tests = [
    ['dashboard', () => loadPortfolioDashboard(MEMBER_ID, {}, audit)],
    ['individual-report-init', () => loadPortfolioIndividualReport(MEMBER_ID, {}, audit)],
    ['individual-report-batch', () => loadPortfolioIndividualReport(MEMBER_ID, {
      searchBy: 'batch',
      searchCourse: '2___2020-2021',
    }, audit)],
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

  try {
    const init = await loadPortfolioIndividualReport(MEMBER_ID, {
      searchBy: 'batch',
      searchCourse: '2___2020-2021',
    }, audit);
    const studentId = init.students?.[0]?.id;
    if (studentId) {
      const detail = await loadPortfolioStudentDetail(MEMBER_ID, studentId, audit);
      if (detail?.error) failures.push({ name: 'student-detail', error: detail.error });
      else {
        passed += 1;
        console.log(`OK student-detail (${studentId})`);
      }
    } else {
      console.log('SKIP student-detail (no students in batch)');
    }
  } catch (err) {
    failures.push({ name: 'student-detail', error: err.message });
  }

  console.log(`\nPassed: ${passed}, Failed: ${failures.length}`);
  if (failures.length) {
    console.error('Failures:');
    for (const f of failures) console.error(`  ${f.name}: ${f.error}`);
    process.exit(1);
  }
  console.log('All portfolio module loaders OK');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
