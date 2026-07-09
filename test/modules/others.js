import { assertOk } from '../lib/assert.js';
import {
  setupLoadTests,
  ELEARNING_SCREENS,
  SMS_SCREENS,
  COMMITTEE_SCREENS,
  CERTIFICATE_SCREENS,
  CIRCULAR_SCREENS,
  NAAC_SCREENS,
  ADMIN_OFFICE_SCREENS,
  TV_SCREENS,
  KIOSK_SCREENS,
} from '../lib/screens.js';

export const elearningTests = setupLoadTests({
  module: 'elearning',
  basePath: '/api/elearning/setup',
  screens: ELEARNING_SCREENS,
});

export const portfolioTests = [
  {
    id: 'portfolio.read.dashboard',
    module: 'portfolio',
    op: 'R',
    name: 'Load portfolio dashboard',
    screen: 'portfolio-dashboard',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.post('/api/portfolio/dashboard/load', {});
      assertOk(res, 'portfolio dashboard');
    },
  },
  {
    id: 'portfolio.read.individual',
    module: 'portfolio',
    op: 'R',
    name: 'Load portfolio individual report',
    screen: 'portfolio-individual',
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.post('/api/portfolio/individual-report/load', {});
      assertOk(res, 'portfolio individual');
    },
  },
];

export const smsTests = setupLoadTests({
  module: 'sms',
  basePath: '/api/sms/setup',
  screens: SMS_SCREENS,
});

export const committeeTests = setupLoadTests({
  module: 'committee',
  basePath: '/api/committee/setup',
  screens: COMMITTEE_SCREENS,
});

export const certificateTests = setupLoadTests({
  module: 'certificate',
  basePath: '/api/certificates/setup',
  screens: CERTIFICATE_SCREENS,
});

export const circularTests = setupLoadTests({
  module: 'circular',
  basePath: '/api/circular/setup',
  screens: CIRCULAR_SCREENS,
});

export const naacTests = setupLoadTests({
  module: 'naac',
  basePath: '/api/naac/setup',
  screens: NAAC_SCREENS,
});

export const adminOfficeTests = setupLoadTests({
  module: 'adminOffice',
  basePath: '/api/admin-office/setup',
  screens: ADMIN_OFFICE_SCREENS,
});

export const tvTests = setupLoadTests({
  module: 'tv',
  basePath: '/api/tv/setup',
  screens: TV_SCREENS,
});

export const kioskTests = setupLoadTests({
  module: 'kiosk',
  basePath: '/api/kiosk/setup',
  screens: KIOSK_SCREENS,
});
