import { SETTINGS_SCREENS, setupLoadTests } from '../lib/screens.js';

export const settingsTests = setupLoadTests({
  module: 'settings',
  basePath: '/api/settings/setup',
  screens: SETTINGS_SCREENS,
});
