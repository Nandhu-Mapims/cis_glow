import { ACADEMIC_SETUP, CURRICULUM_SCREEN_SLUGS, setupLoadTests } from '../lib/screens.js';

const academicScreens = [...ACADEMIC_SETUP, ...CURRICULUM_SCREEN_SLUGS];

export const academicTests = setupLoadTests({
  module: 'academic',
  basePath: '/api/academic/setup',
  screens: academicScreens,
});
