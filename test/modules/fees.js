import { assertOk } from '../lib/assert.js';
import { FEE_SETUP, setupLoadTests } from '../lib/screens.js';

export const feesTests = [
  {
    id: 'fees.read.filters',
    module: 'fees',
    op: 'R',
    name: 'Load fee filter options',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.get('/api/fees/filters');
      assertOk(res, 'fee filters');
    },
  },
  {
    id: 'fees.read.pending-sms',
    module: 'fees',
    op: 'R',
    name: 'Load pending SMS classes',
    screen: 'fee-pending-sms',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.get('/api/fees/pending-sms/classes');
      assertOk(res, 'pending sms classes');
    },
  },
  {
    id: 'fees.read.pending-letter',
    module: 'fees',
    op: 'R',
    name: 'Load pending letter form',
    screen: 'fee-pending-letter',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.get('/api/fees/pending-letter/form');
      assertOk(res, 'pending letter form');
    },
  },
  {
    id: 'fees.read.scholarship',
    module: 'fees',
    op: 'R',
    name: 'Load scholarship setup',
    screen: 'fee-scholarship',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.post('/api/fees/setup/scholarship/load', {});
      assertOk(res, 'scholarship setup');
    },
  },
  {
    id: 'fees.read.dme',
    module: 'fees',
    op: 'R',
    name: 'Load DME setup',
    screen: 'fee-dme',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.post('/api/fees/setup/dme/load', {});
      assertOk(res, 'dme setup');
    },
  },
  {
    id: 'fees.read.acmec-config',
    module: 'fees',
    op: 'R',
    name: 'Load ACMEC config',
    screen: 'fee-acmec-config',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.post('/api/fees/acmec-config/load', {});
      assertOk(res, 'acmec config');
    },
  },
  ...setupLoadTests({ module: 'fees', basePath: '/api/fees/setup', screens: FEE_SETUP }),
];
