import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_ROOT = join(__dirname, '..');

const MODULE_ORDER = [
  'foundation',
  'dashboard',
  'students',
  'staff',
  'attendance',
  'fees',
  'academic',
  'exam',
  'payroll',
  'hostel',
  'library',
  'admin',
  'settings',
  'web',
  'elearning',
  'portfolio',
  'sms',
  'committee',
  'certificate',
  'circular',
  'naac',
  'adminOffice',
  'tv',
  'kiosk',
];

const OP_LABELS = {
  C: 'Create',
  R: 'Read',
  U: 'Update',
  D: 'Delete',
  'N/A': 'N/A',
};

function statusIcon(status) {
  if (status === 'pass') return '✅';
  if (status === 'fail') return '❌';
  if (status === 'skip') return '⏭️';
  return '⬜';
}

function moduleSummary(results, module) {
  const rows = results.filter((r) => r.module === module);
  const pass = rows.filter((r) => r.status === 'pass').length;
  return { total: rows.length, pass, rows };
}

/**
 * @param {{ results: import('./runner.js').TestResult[], summary: object }} payload
 */
export function writeReports(payload) {
  const { results, summary } = payload;

  const statusPath = join(TEST_ROOT, 'status.json');
  writeFileSync(statusPath, `${JSON.stringify({ summary, results }, null, 2)}\n`);

  const lines = [];
  lines.push('# CIS CRUD Test Checklist');
  lines.push('');
  lines.push(`> Last run: **${summary.ranAt}**`);
  lines.push(`> API: \`${summary.apiBase}\``);
  lines.push(`> Mutations: **${summary.mutationsEnabled ? 'enabled' : 'read-only'}** (set \`TEST_MUTATIONS=1\` to test create/update/delete)`);
  lines.push('');
  lines.push('## Overall');
  lines.push('');
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|------:|`);
  lines.push(`| Total tests | ${summary.total} |`);
  lines.push(`| Passed | ${summary.pass} |`);
  lines.push(`| Failed | ${summary.fail} |`);
  lines.push(`| Skipped | ${summary.skip} |`);
  lines.push('');
  lines.push('## Module summary');
  lines.push('');
  lines.push('| Module | Pass | Total | Status |');
  lines.push('|--------|-----:|------:|--------|');

  for (const module of MODULE_ORDER) {
    const { total, pass, rows } = moduleSummary(results, module);
    if (!total) continue;
    const fail = rows.filter((r) => r.status === 'fail').length;
    const moduleStatus = fail ? '❌ Needs attention' : pass === total ? '✅ Complete' : '🟡 Partial';
    lines.push(`| ${module} | ${pass} | ${total} | ${moduleStatus} |`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Detailed checklist');
  lines.push('');

  for (const module of MODULE_ORDER) {
    const { rows } = moduleSummary(results, module);
    if (!rows.length) continue;

    lines.push(`### ${module.charAt(0).toUpperCase()}${module.slice(1)}`);
    lines.push('');
    lines.push('| Status | Op | Test | Screen | Notes |');
    lines.push('|--------|----|------|--------|-------|');

    for (const row of rows) {
      const notes = row.error ? row.error.replace(/\|/g, '\\|').slice(0, 120) : (row.durationMs ? `${row.durationMs}ms` : '');
      const screen = row.screen || '—';
      lines.push(`| ${statusIcon(row.status)} | ${OP_LABELS[row.op] || row.op} | ${row.name} | ${screen} | ${notes} |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## How to run');
  lines.push('');
  lines.push('```bash');
  lines.push('# Read-only CRUD verification (safe for shared DB)');
  lines.push('TEST_PASSWORD=your_password node test/run.js');
  lines.push('');
  lines.push('# Include create/update/delete tests');
  lines.push('TEST_PASSWORD=your_password TEST_MUTATIONS=1 node test/run.js');
  lines.push('');
  lines.push('# Single module');
  lines.push('TEST_PASSWORD=your_password node test/run.js --module staff');
  lines.push('');
  lines.push('# Single test by id fragment');
  lines.push('TEST_PASSWORD=your_password node test/run.js --id staff.read.profile');
  lines.push('```');
  lines.push('');

  const checklistPath = join(TEST_ROOT, 'CHECKLIST.md');
  writeFileSync(checklistPath, `${lines.join('\n')}\n`);

  return { statusPath, checklistPath };
}
