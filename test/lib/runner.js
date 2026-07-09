import { config } from '../config.js';

/**
 * @typedef {'C'|'R'|'U'|'D'|'N/A'} CrudOp
 * @typedef {'pass'|'fail'|'skip'|'pending'} TestStatus
 *
 * @typedef {object} TestCase
 * @property {string} id
 * @property {string} module
 * @property {CrudOp} op
 * @property {string} name
 * @property {string} [screen] - legacy screen slug when applicable
 * @property {boolean} [mutation] - requires TEST_MUTATIONS=1
 * @property {(ctx: TestContext) => Promise<void>} run
 *
 * @typedef {object} TestResult
 * @property {string} id
 * @property {string} module
 * @property {CrudOp} op
 * @property {string} name
 * @property {string} [screen]
 * @property {TestStatus} status
 * @property {number} [durationMs]
 * @property {string} [error]
 * @property {boolean} [mutation]
 */

export class TestContext {
  constructor(client, options = {}) {
    this.client = client;
    this.options = options;
    this.created = { staffIds: [], studentIds: [] };
  }

  get(path) {
    return this.client.get(path);
  }

  post(path, body) {
    return this.client.post(path, body);
  }

  put(path, body) {
    return this.client.put(path, body);
  }

  patch(path, body) {
    return this.client.patch(path, body);
  }

  trackStaff(id) {
    if (id) this.created.staffIds.push(String(id));
  }

  trackStudent(id) {
    if (id) this.created.studentIds.push(String(id));
  }
}

/**
 * @param {TestCase[]} tests
 * @param {import('../lib/client.js').ApiClient} client
 * @param {{ onlyModule?: string, onlyId?: string }} options
 * @returns {Promise<{ results: TestResult[], summary: object }>}
 */
export async function runTests(tests, client, options = {}) {
  const ctx = new TestContext(client, options);
  const results = [];

  let filtered = tests;
  if (options.onlyModule) {
    filtered = filtered.filter((t) => t.module === options.onlyModule);
  }
  if (options.onlyId) {
    filtered = filtered.filter((t) => t.id === options.onlyId || t.id.includes(options.onlyId));
  }

  for (const test of filtered) {
    const started = Date.now();
    /** @type {TestResult} */
    const result = {
      id: test.id,
      module: test.module,
      op: test.op,
      name: test.name,
      screen: test.screen,
      mutation: Boolean(test.mutation),
      status: 'pending',
    };

    if (test.mutation && !config.mutations) {
      result.status = 'skip';
      result.error = 'Set TEST_MUTATIONS=1 to run create/update/delete tests';
      results.push(result);
      continue;
    }

    try {
      await test.run(ctx);
      result.status = 'pass';
      result.durationMs = Date.now() - started;
    } catch (error) {
      result.status = 'fail';
      result.durationMs = Date.now() - started;
      result.error = error instanceof Error ? error.message : String(error);
    }

    results.push(result);
    const icon = result.status === 'pass' ? '✓' : result.status === 'skip' ? '○' : '✗';
    const suffix = result.error ? ` — ${result.error}` : '';
    console.log(`  ${icon} [${test.op}] ${test.name}${suffix}`);
  }

  const summary = {
    total: results.length,
    pass: results.filter((r) => r.status === 'pass').length,
    fail: results.filter((r) => r.status === 'fail').length,
    skip: results.filter((r) => r.status === 'skip').length,
    mutationsEnabled: config.mutations,
    apiBase: config.apiBase,
    ranAt: new Date().toISOString(),
  };

  return { results, summary };
}
