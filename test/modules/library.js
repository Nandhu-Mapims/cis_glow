import { LIBRARY_SCREENS, setupLoadTests } from '../lib/screens.js';

export const libraryTests = setupLoadTests({
  module: 'library',
  basePath: '/api/library/setup',
  screens: LIBRARY_SCREENS,
});
