/** Screen slug registries — sourced from server services so tests stay in sync. */
export { STAFF_SETUP_SLUGS } from '../../server/src/services/staff/staffModuleSetup.js';
export { STAFF_SCREEN_SLUGS } from '../../server/src/services/staff/staffModuleScreens.js';
export { STUDENT_SCREEN_SLUGS } from '../../server/src/services/students/studentModuleScreens.js';
export { STAFF_ATT_SCREEN_SLUGS } from '../../server/src/services/attendance/staffAttendanceScreens.js';
export { STUDENT_ATT_SCREEN_SLUGS } from '../../server/src/services/attendance/studentAttendanceScreens.js';
export { CURRICULUM_SCREEN_SLUGS } from '../../server/src/services/academic/curriculumScreenRegistry.js';
export { NATIVE_SCREENS as WEB_SCREENS } from '../../server/src/services/web/webSetup.js';

export const ACADEMIC_SETUP = [
  'subject-master',
  'academic-years',
  'master-setup',
  'subject-setup',
  'subject-batch',
  'subject-unit',
  'subject-schedule',
  'tt-config',
  'subject-report',
  'timetable-report',
  'batch-timetable-report',
];

export const FEE_SETUP = ['label', 'type', 'bank', 'fine', 'name'];

export const EXAM_SETUP = [
  'exam-names',
  'exam-setup',
  'exam-nodue',
  'exam-schedule',
  'exam-batch',
  'mark-sheet',
  'exam-examiners',
  'exam-attendance-certificate',
  'examiner-setup',
  'mark-entry',
  'attendance-entry',
  'attendance-report',
  'marks-upload',
  'sheets-upload',
  'sheets-status',
  'mark-sheet-status',
  'mark-sheet-received',
  'term-statement',
  'term-report',
  'report-analysis',
  'progress-card',
  'exam-sms',
  'schedule-print',
  'invigilator-print',
  'omr-config',
];

export const PAYROLL_SETUP = [
  'individual-setup',
  'cron-setup',
  'stipend-amount-setup',
  'payroll-config',
  'pf-esi-setup',
  'salary-add',
  'salary-report',
  'payroll-close',
];

export const HOSTEL_SCREENS = [
  'dashboard',
  'block-setup',
  'room-setup-add',
  'room-rental-setup',
  'transport-add',
  'student-hostel',
  'att-setup',
  'attendance-report',
  'pass-approval',
  'pass-report',
  'staff-rental',
];

export const LIBRARY_SCREENS = [
  'dashboard',
  'book-category',
  'book-add',
  'book-report',
  'transaction-issue',
  'transaction-return',
  'transaction-setup',
  'transaction-report',
  'entry-report',
  'attendance',
  'supplier-add',
  'resources-report',
];

export const ADMIN_SCREENS = [
  'account-add',
  'account-edit',
  'access-restriction',
  'dept-auth',
  'menu-auth',
  'dashboard-access',
  'change-password',
  'committee-access',
  'staff-auth-hod',
];

export const SETTINGS_SCREENS = [
  'designation',
  'staff-master',
  'approval',
  'college',
  'hospital',
  'budget',
  'print-setup',
  'print-style',
  'lesson-plan',
  'signature',
  'payroll-emailer',
  'sms-cron',
];

export const STAFF_ATT_SETUP = ['calendar-add', 'calendar-edit', 'working-day', 'att-time'];

export const ELEARNING_SCREENS = ['elearn-dashboard', 'elearn-setup', 'elearn-report'];

export const SMS_SCREENS = [
  'student-sms',
  'staff-sms',
  'group-sms',
  'sms-history',
  'sms-template',
];

export const COMMITTEE_SCREENS = [
  'dashboard',
  'committee-report',
  'committee-add',
  'task-dashboard',
];

export const CERTIFICATE_SCREENS = ['setup', 'approve', 'generate', 'cert-request', 'tc-details'];

export const CIRCULAR_SCREENS = ['dashboard', 'add', 'edit', 'approve', 'report', 'setup'];

export const NAAC_SCREENS = ['qual', 'quan', 'quan-report', 'quan-detailed-report'];

export const ADMIN_OFFICE_SCREENS = [
  'student-activities-add',
  'staff-activities-add',
  'courier-add',
  'incident-add',
  'events-group-add',
];

export const TV_SCREENS = ['slider-widget', 'dashboard-access', 'photo-gallery'];

export const KIOSK_SCREENS = ['machine-access', 'student-password', 'staff-password', 'announcement-add'];

import { assertOk } from './assert.js';

/** Build read tests for POST .../load endpoints. */
export function setupLoadTests({ module, basePath, screens, op = 'R' }) {
  return screens.map((screen) => ({
    id: `${module}.read.setup.${screen}`,
    module,
    op,
    name: `Load setup: ${screen}`,
    screen,
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.post(`${basePath}/${screen}/load`, {});
      assertOk(res, screen);
    },
  }));
}

/** Build read tests for GET endpoints. */
export function getTests({ module, paths, op = 'R' }) {
  return paths.map(({ id, path, name, screen }) => ({
    id: id || `${module}.read.${path.replace(/\//g, '.')}`,
    module,
    op,
    name,
    screen,
    async run(ctx) {
      await ctx.client.login();
      const res = await ctx.get(path);
      assertOk(res, name);
    },
  }));
}
