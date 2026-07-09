import { HOSTEL_SCREENS, setupLoadTests } from '../lib/screens.js';

export const hostelTests = setupLoadTests({
  module: 'hostel',
  basePath: '/api/hostel/setup',
  screens: HOSTEL_SCREENS,
});
