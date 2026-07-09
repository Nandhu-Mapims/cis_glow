import { assertOk } from '../lib/assert.js';
import {
  setupLoadTests,
  STAFF_ATT_SETUP,
  STAFF_ATT_SCREEN_SLUGS,
  STUDENT_ATT_SCREEN_SLUGS,
} from '../lib/screens.js';

export const attendanceTests = [
  ...setupLoadTests({
    module: 'attendance',
    basePath: '/api/attendance/staff/setup',
    screens: STAFF_ATT_SETUP,
  }),
  ...STAFF_ATT_SCREEN_SLUGS.map((screen) => ({
    id: `attendance.read.staff.${screen}`,
    module: 'attendance',
    op: 'R',
    name: `Load staff attendance: ${screen}`,
    screen,
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.post(`/api/attendance/staff/${screen}`, {});
      assertOk(res, screen);
    },
  })),
  {
    id: 'attendance.read.student-filters',
    module: 'attendance',
    op: 'R',
    name: 'Load student attendance filters',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.get('/api/attendance/students/filters');
      assertOk(res, 'student att filters');
    },
  },
  ...STUDENT_ATT_SCREEN_SLUGS.map((screen) => ({
    id: `attendance.read.student.${screen}`,
    module: 'attendance',
    op: 'R',
    name: `Load student attendance: ${screen}`,
    screen,
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.post(`/api/attendance/students/${screen}/load`, {});
      assertOk(res, screen);
      if (screen === 'smr-leave-request') {
        const summary = res.data?.summary;
        if (!summary || typeof summary.total !== 'number') {
          throw new Error('smr-leave-request: missing summary totals');
        }
        const parts = Number(summary.approve) + Number(summary.pending) + Number(summary.rejected);
        if (parts !== Number(summary.total)) {
          throw new Error(`smr-leave-request: summary mismatch (${parts} vs ${summary.total})`);
        }
      }
    },
  })),
];
