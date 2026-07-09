import { ADMIN_SCREENS, setupLoadTests } from '../lib/screens.js';

export const adminTests = setupLoadTests({
  module: 'admin',
  basePath: '/api/admin/setup',
  screens: ADMIN_SCREENS,
});
