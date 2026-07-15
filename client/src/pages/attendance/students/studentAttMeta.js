import { cleanLegacyKey } from '../../../utils/legacyRoutes';

export const STUDENT_ATT_CORE_LINKS = [
  { to: '/attendance/students/daily', title: 'U.G Manual Attendance', desc: 'Daily UG attendance entry', icon: 'fa fa-check-square-o', legacy: 'student_mattendance.php' },
  { to: '/attendance/students/report', title: 'U.G Reports Att', desc: 'Subject-wise attendance report', icon: 'fa fa-bar-chart', legacy: 'attendance_report.php' },
  { to: '/attendance/students/report/quarterly', title: 'UG Quarterly Report', desc: 'Quarterly attendance summary', icon: 'fa fa-calendar-check-o', legacy: 'attendance_report_quartely_v1.php' },
  { to: '/academic/setup/academic-calendar', title: 'Working Day Config', desc: 'Academic calendar / holidays', icon: 'fa fa-calendar-o', legacy: 'academic_calendar.php' },
];

export const STUDENT_ATT_SCREEN_META = {
  'biometric-report': { title: 'Biometric Reports', legacy: 'student_bio_att.php', type: 'date-roll-report' },
  'holiday-report': { title: 'Holiday Report', legacy: 'holiday_report.php', type: 'date-category-report' },
  'smr-leave-request': {
    title: 'SMR — Leave Request',
    legacy: 'stu_leave_approval.php',
    type: 'approval',
    approvalFilter: { label: 'Staff', placeholder: 'Student ID' },
  },
  'smr-dept-leave': {
    title: 'SMR — Dept. Leave Request',
    legacy: 'student_leave_approval.php',
    type: 'approval',
    approvalFilter: { label: 'Staff', placeholder: 'Staff ID' },
  },
  'smr-permission': {
    title: 'SMR — Permission',
    legacy: 'stu_permission_approval.php',
    type: 'approval',
    approvalFilter: { label: 'Student', placeholder: 'Roll No' },
  },
  'smr-defaulter': {
    title: 'SMR — Defaulter',
    legacy: 'stu_defaulter_approval.php',
    type: 'approval',
    approvalFilter: { label: 'Staff', placeholder: 'Student ID' },
  },
  'smr-lpd-report': { title: 'SMR — L/P/D Report', legacy: 'student_lpd_report.php', type: 'lpd-report' },
  'smr-setup': { title: 'SMR — Setup', legacy: 'stu_leave_approval_setup.php', type: 'smr-setup' },
  'pg-att-setup': { title: 'PG Att. Setup', legacy: 'pg_attendance_setup.php', type: 'pg-setup' },
  'pg-holiday-roster-add': { title: 'PG Holiday Roster — Add', legacy: 'pg_holiday_roster_add.php', type: 'roster' },
  'pg-holiday-roster-edit': { title: 'PG Holiday Roster — Edit', legacy: 'pg_holiday_roster_edit.php', type: 'roster' },
  'pg-manual-att': { title: 'PG Manual Attendance', legacy: 'pg_mattendance.php', type: 'period-att' },
  'pg-reports-att': { title: 'PG Reports Att', legacy: 'pg_attendance_report.php', type: 'pg-att-report' },
  'pg-punch-entry': { title: 'PG Punch Entry', legacy: 'pg_attendance_punch_add.php', type: 'pg-punch-entry' },
  'pg-punch': { title: 'PG Attendance Punch', legacy: 'pg_attendance_punch.php', type: 'pg-punch' },
  'year-incharge': { title: 'UG/PG Year Incharge', legacy: 'staff_incharge_setup.php', type: 'incharge-grid' },
  'ug-att-report': { title: 'UG Attendance Report', legacy: 'attendance_ug_report.php', type: 'student-id-report' },
  'intern-att-setup': { title: 'Internship Att. Setup', legacy: 'intern_att_setup.php', type: 'intern-setup' },
  'intern-holiday-roster-add': { title: 'Intern Holiday Roster — Add', legacy: 'intern_holiday_roster_add.php', type: 'roster' },
  'intern-holiday-roster-edit': { title: 'Intern Holiday Roster — Edit', legacy: 'intern_holiday_roster_edit.php', type: 'roster' },
  'intern-manual-att': { title: 'Internship Manual Att.', legacy: 'intern_mattendance.php', type: 'period-att' },
  'intern-reports-att': { title: 'Internship Reports Att', legacy: 'istudent_att_report.php', type: 'date-report' },
  'intern-att-statement': { title: 'Intern Att. Statement', legacy: 'istudent_att_card.php', type: 'intern-att-statement' },
};

export const STUDENT_ATT_SCREEN_LINKS = Object.entries(STUDENT_ATT_SCREEN_META).map(([slug, meta]) => ({
  to: `/attendance/students/${slug}`,
  title: meta.title,
  icon: 'fa fa-circle-o',
  legacy: meta.legacy,
}));

export const STUDENT_ATT_HUB_LINKS = [
  ...STUDENT_ATT_CORE_LINKS,
  ...STUDENT_ATT_SCREEN_LINKS,
];

export function isPgPunchScreenType(type) {
  return type === 'pg-punch' || type === 'pg-punch-entry';
}

/** Resolve slug from pathname and optional ?view= query (sidebar / shared routes). */
export function resolveStudentAttScreenSlug(pathname, viewQuery = '') {
  const pathSlug = String(pathname || '')
    .replace(/^\/attendance\/students\//, '')
    .replace(/\/$/, '')
    .split('?')[0];
  if (STUDENT_ATT_SCREEN_META[pathSlug]) return pathSlug;

  const view = String(viewQuery || '').replace(/^\//, '').split('?')[0];
  if (!view) return null;
  const match = Object.entries(STUDENT_ATT_SCREEN_META).find(([, meta]) => cleanLegacyKey(meta.legacy) === view);
  return match ? match[0] : null;
}
