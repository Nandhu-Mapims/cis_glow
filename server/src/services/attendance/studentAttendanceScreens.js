import { loadPeriodAttendance, savePeriodAttendance } from './studentPeriodAtt.js';
import {
  loadSmrLeaveScreen,
  saveSmrLeaveScreen,
  loadSmrDeptLeaveScreen,
  saveSmrDeptLeaveScreen,
  loadSmrPermissionScreen,
  saveSmrPermissionScreen,
  loadSmrDefaulterScreen,
  saveSmrDefaulterScreen,
  loadSmrLpdReportScreen,
} from './screens/studentApprovalScreens.js';
import {
  loadBiometricReportScreen,
  loadHolidayReportScreen,
  loadUgAttReportScreen,
  loadPgReportsAttScreen,
  loadInternReportsAttScreen,
  loadInternAttStatementScreen,
  loadPgPunchScreen,
  loadPgPunchEntryScreen,
} from './screens/studentReportScreens.js';
import {
  loadSmrSetupScreen,
  saveSmrSetupScreen,
  loadPgAttSetupScreen,
  savePgAttSetupScreen,
  loadInternAttSetupScreen,
  saveInternAttSetupScreen,
  loadYearInchargeScreen,
  saveYearInchargeScreen,
} from './screens/studentSetupScreens.js';
import {
  loadPgHolidayRosterScreen,
  savePgHolidayRosterScreen,
  loadInternHolidayRosterScreen,
  saveInternHolidayRosterScreen,
} from './screens/studentGridScreens.js';

export const STUDENT_ATT_SCREEN_SLUGS = [
  'biometric-report',
  'holiday-report',
  'smr-leave-request',
  'smr-dept-leave',
  'smr-permission',
  'smr-defaulter',
  'smr-lpd-report',
  'smr-setup',
  'pg-att-setup',
  'pg-holiday-roster-add',
  'pg-holiday-roster-edit',
  'pg-manual-att',
  'pg-reports-att',
  'pg-punch-entry',
  'pg-punch',
  'year-incharge',
  'ug-att-report',
  'intern-att-setup',
  'intern-holiday-roster-add',
  'intern-holiday-roster-edit',
  'intern-manual-att',
  'intern-reports-att',
  'intern-att-statement',
];

const SCREEN_LOADERS = {
  'biometric-report': loadBiometricReportScreen,
  'holiday-report': loadHolidayReportScreen,
  'smr-leave-request': loadSmrLeaveScreen,
  'smr-dept-leave': loadSmrDeptLeaveScreen,
  'smr-permission': loadSmrPermissionScreen,
  'smr-defaulter': loadSmrDefaulterScreen,
  'smr-lpd-report': loadSmrLpdReportScreen,
  'smr-setup': loadSmrSetupScreen,
  'pg-att-setup': loadPgAttSetupScreen,
  'pg-holiday-roster-add': (m, f, a) => loadPgHolidayRosterScreen(m, f, a, 'add'),
  'pg-holiday-roster-edit': (m, f, a) => loadPgHolidayRosterScreen(m, f, a, 'edit'),
  'pg-manual-att': (m, f, a) => loadPeriodAttendance('pg', f, m, a, 'pg_mattendance.php'),
  'pg-reports-att': loadPgReportsAttScreen,
  'pg-punch-entry': loadPgPunchEntryScreen,
  'pg-punch': loadPgPunchScreen,
  'year-incharge': loadYearInchargeScreen,
  'ug-att-report': loadUgAttReportScreen,
  'intern-att-setup': loadInternAttSetupScreen,
  'intern-holiday-roster-add': (m, f, a) => loadInternHolidayRosterScreen(m, f, a, 'add'),
  'intern-holiday-roster-edit': (m, f, a) => loadInternHolidayRosterScreen(m, f, a, 'edit'),
  'intern-manual-att': (m, f, a) => loadPeriodAttendance('intern', f, m, a, 'intern_mattendance.php'),
  'intern-reports-att': loadInternReportsAttScreen,
  'intern-att-statement': loadInternAttStatementScreen,
};

const SCREEN_SAVERS = {
  'smr-leave-request': saveSmrLeaveScreen,
  'smr-dept-leave': saveSmrDeptLeaveScreen,
  'smr-permission': saveSmrPermissionScreen,
  'smr-defaulter': saveSmrDefaulterScreen,
  'smr-setup': saveSmrSetupScreen,
  'pg-att-setup': savePgAttSetupScreen,
  'pg-holiday-roster-add': (p, m, a) => savePgHolidayRosterScreen(p, m, a, 'add'),
  'pg-holiday-roster-edit': (p, m, a) => savePgHolidayRosterScreen(p, m, a, 'edit'),
  'pg-manual-att': (p, m, a) => savePeriodAttendance('pg', p, m, a, 'pg_mattendance.php'),
  'year-incharge': saveYearInchargeScreen,
  'intern-att-setup': saveInternAttSetupScreen,
  'intern-holiday-roster-add': (p, m, a) => saveInternHolidayRosterScreen(p, m, a, 'add'),
  'intern-holiday-roster-edit': (p, m, a) => saveInternHolidayRosterScreen(p, m, a, 'edit'),
  'intern-manual-att': (p, m, a) => savePeriodAttendance('intern', p, m, a, 'intern_mattendance.php'),
};

export function assertStudentAttScreen(screen) {
  if (!SCREEN_LOADERS[screen]) return { error: 'Unknown student attendance screen' };
  return null;
}

export async function loadStudentAttScreen(screen, fields, memberId, audit = {}) {
  const invalid = assertStudentAttScreen(screen);
  if (invalid) return invalid;
  return SCREEN_LOADERS[screen](memberId, fields, audit);
}

export async function saveStudentAttScreen(screen, fields, memberId, audit = {}) {
  const saver = SCREEN_SAVERS[screen];
  if (!saver) return { error: 'Save not supported for this screen' };
  return saver(fields, memberId, audit);
}
