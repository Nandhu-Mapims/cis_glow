/** Shared test configuration — override via environment variables. */
export const config = {
  apiBase: process.env.API_URL || 'http://localhost:4000',
  username: process.env.TEST_USER || 'CISADMIN',
  password: process.env.TEST_PASSWORD || process.env.TEST_PASS || '',
  /** Run create/update/delete tests (default: read-only). */
  mutations: process.env.TEST_MUTATIONS === '1' || process.env.TEST_MUTATIONS === 'true',
  /** Known stable records for read/update tests */
  staffId: process.env.TEST_STAFF_ID || '847',
  staffDisplayId: process.env.TEST_STAFF_DISPLAY_ID || '20316',
  studentId: process.env.TEST_STUDENT_ID || '',
  timeoutMs: Number(process.env.TEST_TIMEOUT_MS || 30000),
};
