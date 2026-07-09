import { assertOk } from '../lib/assert.js';
import { getTests } from '../lib/screens.js';

export const dashboardTests = getTests({
  module: 'dashboard',
  paths: [
    { name: 'Load dashboard widgets', path: '/api/dashboard/widgets?w=staff_details,student_details', screen: 'dashboard' },
    { name: 'Load student dashboard shell', path: '/api/dashboard/student', screen: 'student-dashboard' },
    { name: 'Load staff pattern shell', path: '/api/dashboard/staff-pattern', screen: 'staff-pattern' },
    { name: 'Load overall strength report', path: '/api/dashboard/overall-strength', screen: 'overall-strength' },
    { name: 'Load community strength report', path: '/api/dashboard/community-strength', screen: 'community-strength' },
  ],
});
