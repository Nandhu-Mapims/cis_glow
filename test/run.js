#!/usr/bin/env node
/**
 * CIS module CRUD verification runner.
 *
 * Usage:
 *   TEST_PASSWORD=secret node test/run.js
 *   TEST_PASSWORD=secret node test/run.js --module staff
 *   TEST_PASSWORD=secret TEST_MUTATIONS=1 node test/run.js --module exam
 *   node test/run.js --list
 */
import { config } from './config.js';
import { ApiClient } from './lib/client.js';
import { runTests } from './lib/runner.js';
import { writeReports } from './lib/report.js';
import { allTests, modules } from './modules/index.js';

function parseArgs(argv) {
  const opts = { onlyModule: null, onlyId: null, list: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--module' && argv[i + 1]) {
      opts.onlyModule = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--id' && argv[i + 1]) {
      opts.onlyId = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--list') {
      opts.list = true;
    }
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));

if (opts.list) {
  console.log('Modules:', modules.join(', '));
  console.log(`Total tests: ${allTests.length}`);
  for (const mod of modules) {
    const count = allTests.filter((t) => t.module === mod).length;
    const mutations = allTests.filter((t) => t.module === mod && t.mutation).length;
    console.log(`  ${mod}: ${count} tests (${mutations} mutation)`);
  }
  process.exit(0);
}

console.log('CIS CRUD test runner');
console.log(`API: ${config.apiBase}`);
console.log(`User: ${config.username}`);
console.log(`Mutations: ${config.mutations ? 'ON' : 'OFF (read-only)'}`);
if (config.password) {
  console.log('Auth: HTTP login (TEST_PASSWORD)');
} else {
  console.log('Auth: JWT bootstrap from database (set TEST_PASSWORD to use login instead)');
}
if (opts.onlyModule) console.log(`Module filter: ${opts.onlyModule}`);
if (opts.onlyId) console.log(`Id filter: ${opts.onlyId}`);
console.log('');

const client = new ApiClient();

try {
  const payload = await runTests(allTests, client, {
    onlyModule: opts.onlyModule,
    onlyId: opts.onlyId,
  });

  const { statusPath, checklistPath } = writeReports(payload);

  console.log('');
  console.log(`Done: ${payload.summary.pass} passed, ${payload.summary.fail} failed, ${payload.summary.skip} skipped`);
  console.log(`Checklist: ${checklistPath}`);
  console.log(`Status JSON: ${statusPath}`);

  process.exit(payload.summary.fail > 0 ? 1 : 0);
} catch (error) {
  console.error('Runner failed:', error.message);
  process.exit(1);
}
