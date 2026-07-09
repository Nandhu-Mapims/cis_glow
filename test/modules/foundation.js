import { assert, assertOk } from '../lib/assert.js';

export const foundationTests = [
  {
    id: 'foundation.auth.login',
    module: 'foundation',
    op: 'R',
    name: 'Login and receive JWT',
    async run(ctx) {
      const data = await ctx.client.login();
      assert(data.token, 'Expected token in login response');
      assert(data.user?.memberId, 'Expected user profile in login response');
    },
  },
  {
    id: 'foundation.auth.me',
    module: 'foundation',
    op: 'R',
    name: 'Get current user profile',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.get('/api/auth/me');
      assertOk(res, 'GET /api/auth/me');
      assert(res.data.user?.memberId, 'memberId present');
    },
  },
  {
    id: 'foundation.menu.load',
    module: 'foundation',
    op: 'R',
    name: 'Load navigation menu',
    screen: 'menu',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.get('/api/menu');
      assertOk(res, 'GET /api/menu');
      assert(Array.isArray(res.data?.menu), 'Menu tree returned');
    },
  },
  {
    id: 'foundation.settings.basic',
    module: 'foundation',
    op: 'R',
    name: 'Load basic institution settings',
    screen: 'basic-setup',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.get('/api/settings/basic');
      assertOk(res, 'GET /api/settings/basic');
    },
  },
];
