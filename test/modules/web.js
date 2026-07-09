import { setupLoadTests, WEB_SCREENS } from '../lib/screens.js';

export const webTests = setupLoadTests({
  module: 'web',
  basePath: '/api/web/setup',
  screens: [...WEB_SCREENS],
});
