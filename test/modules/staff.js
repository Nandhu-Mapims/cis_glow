import { assert, assertOk } from '../lib/assert.js';
import { setupLoadTests, STAFF_SETUP_SLUGS, STAFF_SCREEN_SLUGS } from '../lib/screens.js';
import {
  buildStaffAdmissionPayload,
  knownIds,
  resolveAdmissionFields,
} from '../mock/fixtures.js';

export const staffTests = [
  {
    id: 'staff.read.categories',
    module: 'staff',
    op: 'R',
    name: 'List staff categories',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.get('/api/staff/categories');
      assertOk(res, 'categories');
      assert(Array.isArray(res.data?.categories), 'categories array');
    },
  },
  {
    id: 'staff.read.search',
    module: 'staff',
    op: 'R',
    name: 'Search staff by name',
    screen: 'staff-search',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.get('/api/staff/search?by=name&q=a');
      assertOk(res, 'staff search');
    },
  },
  {
    id: 'staff.read.profile-options',
    module: 'staff',
    op: 'R',
    name: 'Load staff profile dropdown options',
    screen: 'staff-profile',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.get('/api/staff/profile-options');
      assertOk(res, 'profile options');
    },
  },
  {
    id: 'staff.read.admission-options',
    module: 'staff',
    op: 'R',
    name: 'Load staff admission form options',
    screen: 'staff_profile_add',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.get('/api/staff/admission/options');
      assertOk(res, 'admission options');
    },
  },
  {
    id: 'staff.read.profile',
    module: 'staff',
    op: 'R',
    name: 'Load staff profile by internal ID',
    screen: 'staff_profile_edit',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.get(`/api/staff/${knownIds.staffInternalId}`);
      assertOk(res, 'staff profile');
      assert(res.data?.staffId || res.data?.id, 'staff profile id');
    },
  },
  ...setupLoadTests({ module: 'staff', basePath: '/api/staff/setup', screens: STAFF_SETUP_SLUGS }),
  ...STAFF_SCREEN_SLUGS.map((screen) => ({
    id: `staff.read.screen.${screen}`,
    module: 'staff',
    op: 'R',
    name: `Load screen: ${screen}`,
    screen,
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.post(`/api/staff/screens/${screen}/load`, {});
      assertOk(res, `screen ${screen}`);
    },
  })),
  {
    id: 'staff.create.admission',
    module: 'staff',
    op: 'C',
    name: 'Create staff admission record',
    screen: 'staff_profile_add',
    mutation: true,
    async run(ctx) {
      await ctx.client.login();
      const { departmentId, designationId, jobCategory } = await resolveAdmissionFields(ctx.client);

      const payload = buildStaffAdmissionPayload({ departmentId, designationId, jobCategory });
      const check = await ctx.get(`/api/staff/admission/check-id?staffId=${payload.staffId}`);
      assertOk(check, 'check staff id');
      assert(check.data?.available, 'mock staff id should be available');

      const create = await ctx.post('/api/staff', payload);
      assertOk(create, 'create staff');
      assert(create.data?.id, 'created staff internal id');
      ctx.trackStaff(create.data.id);
    },
  },
  {
    id: 'staff.update.profile',
    module: 'staff',
    op: 'U',
    name: 'Update staff profile remarks',
    screen: 'staff_profile_edit',
    mutation: true,
    async run(ctx) {
      await ctx.client.login();
      const id = ctx.created.staffIds.at(-1) || knownIds.staffInternalId;
      const getRes = await ctx.get(`/api/staff/${id}`);
      assertOk(getRes, 'load for update');

      const stamp = new Date().toISOString();
      const update = await ctx.put(`/api/staff/${id}`, {
        fatherName: `CRUD test ${stamp}`,
      });
      assertOk(update, 'update staff profile');
    },
  },
];
