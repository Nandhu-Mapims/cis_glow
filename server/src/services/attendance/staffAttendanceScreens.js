import {
  loadClearIcacheScreen,
  loadDailyAttendanceScreen,
  loadBiometricReportScreen,
  saveClearIcacheScreen,
} from './screens/utilityScreens.js';
import {
  loadDefaulterApproveScreen,
  loadLeaveApproveScreen,
  loadLpdReportScreen,
  loadPermissionApproveScreen,
  loadSmrAcknowledgeScreen,
  saveDefaulterApproveScreen,
  saveLeaveApproveScreen,
  savePermissionApproveScreen,
} from './screens/approvalScreens.js';
import {
  loadAttChartScreen,
  loadAttTimeReportScreen,
  loadAttendanceReportScreen,
  loadAvailableLeaveScreen,
  loadTeachingMonthReportScreen,
  loadYearlyReportScreen,
  teachingMonthReportMore,
} from './screens/reportScreens.js';
import {
  compensationMore,
  holidayRosterMore,
  loadAttTransportScreen,
  loadClElScreen,
  loadCompensationScreen,
  loadHolidayRosterScreen,
  saveAttTransportScreen,
  saveClElScreen,
  saveCompensationScreen,
  saveHolidayRosterScreen,
} from './screens/gridScreens.js';

const SCREEN_LOADERS = {
  'clear-icache': loadClearIcacheScreen,
  'daily-attendance': loadDailyAttendanceScreen,
  'biometric-report': loadBiometricReportScreen,
  'smr-acknowledge': loadSmrAcknowledgeScreen,
  'smr-leave-approve': loadLeaveApproveScreen,
  'smr-permission-approve': loadPermissionApproveScreen,
  'smr-defaulter-approve': loadDefaulterApproveScreen,
  'smr-lpd-report': loadLpdReportScreen,
  'holiday-roster': loadHolidayRosterScreen,
  compensation: loadCompensationScreen,
  'attendance-report': loadAttendanceReportScreen,
  'teaching-month-report': loadTeachingMonthReportScreen,
  'yearly-report': loadYearlyReportScreen,
  'att-chart': (m, f, a) => loadAttChartScreen(m, f, 'actual', a),
  'att-chart-modified': (m, f, a) => loadAttChartScreen(m, f, 'modified', a),
  'att-chart-combined': (m, f, a) => loadAttChartScreen(m, f, 'combined', a),
  'att-time-report': loadAttTimeReportScreen,
  'available-cl': loadClElScreen,
  'att-transport': loadAttTransportScreen,
  'available-leave': loadAvailableLeaveScreen,
};

const SCREEN_SAVERS = {
  'clear-icache': saveClearIcacheScreen,
  'smr-leave-approve': saveLeaveApproveScreen,
  'smr-permission-approve': savePermissionApproveScreen,
  'smr-defaulter-approve': saveDefaulterApproveScreen,
  'holiday-roster': saveHolidayRosterScreen,
  compensation: saveCompensationScreen,
  'available-cl': saveClElScreen,
  'att-transport': saveAttTransportScreen,
};

const MORE_HANDLERS = {
  'teaching-month-report': teachingMonthReportMore,
  compensation: compensationMore,
  'holiday-roster': holidayRosterMore,
};

export function assertStaffAttScreen(screen) {
  if (!SCREEN_LOADERS[screen]) {
    return { error: 'Unknown staff attendance screen' };
  }
  return null;
}

export async function loadStaffAttScreen(screen, fields, memberId, audit = {}) {
  const invalid = assertStaffAttScreen(screen);
  if (invalid) return invalid;
  return SCREEN_LOADERS[screen](memberId, fields, audit);
}

export async function saveStaffAttScreen(screen, fields, memberId, audit = {}) {
  const saver = SCREEN_SAVERS[screen];
  if (!saver) return { error: 'Save not supported for this screen' };
  return saver(fields, memberId, audit);
}

export async function staffAttScreenMore(screen, query = {}) {
  const handler = MORE_HANDLERS[screen];
  if (!handler) return { error: 'Unknown more endpoint' };
  return handler(query);
}

export const STAFF_ATT_SCREEN_SLUGS = Object.keys(SCREEN_LOADERS);
