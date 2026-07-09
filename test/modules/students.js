import { assert, assertOk } from '../lib/assert.js';
import { sampleStudentId } from '../lib/db.js';
import { STUDENT_SCREEN_SLUGS } from '../lib/screens.js';
import { knownIds } from '../mock/fixtures.js';

export const studentTests = [
  {
    id: 'students.read.courses',
    module: 'students',
    op: 'R',
    name: 'List student courses',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.get('/api/students/courses');
      assertOk(res, 'GET /api/students/courses');
      assert(Array.isArray(res.data?.courses) || Array.isArray(res.data), 'courses array');
    },
  },
  {
    id: 'students.read.search',
    module: 'students',
    op: 'R',
    name: 'Search students by name',
    screen: 'student-search',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.get('/api/students/search?by=roll&q=1');
      assertOk(res, 'student search');
    },
  },
  {
    id: 'students.read.report-fields',
    module: 'students',
    op: 'R',
    name: 'Load student report field definitions',
    screen: 'student-report',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.get('/api/students/reports/fields');
      assertOk(res, 'report fields');
    },
  },
  ...STUDENT_SCREEN_SLUGS.map((screen) => ({
    id: `students.read.screen.${screen}`,
    module: 'students',
    op: 'R',
    name: `Load screen: ${screen}`,
    screen,
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.post(`/api/students/screens/${screen}/load`, {});
      assertOk(res, `load ${screen}`);
    },
  })),
  {
    id: 'students.read.profile',
    module: 'students',
    op: 'R',
    name: 'Load student profile by ID',
    screen: 'student-profile',
    async run(ctx) {
      await ctx.client.login();
      let id = knownIds.studentInternalId;
      if (!id) {
        const search = await ctx.get('/api/students/search?by=roll&q=1');
        assertOk(search, 'student search for profile');
        const rows = search.data?.students || [];
        id = rows[0]?.id;
      }
      if (!id) {
        id = await sampleStudentId();
      }
      if (!id) {
        throw new Error('No student found — set TEST_STUDENT_ID or ensure DB has students');
      }
      const res = await ctx.get(`/api/students/${id}`);
      assertOk(res, 'student profile');
      assert(res.data?.id || res.data?.studentId, 'profile id present');
    },
  },
];
