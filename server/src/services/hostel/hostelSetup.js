import { loadHostelDashboard, saveHostelDashboard } from './setup/dashboardSetup.js';
import { loadStudentHostelSetup, saveStudentHostelSetup } from './setup/studentHostelSetup.js';
import { loadAttSetupSetup, saveAttSetupSetup } from './setup/attSetupSetup.js';
import { loadAttendanceReportSetup, saveAttendanceReportSetup } from './setup/attendanceReportSetup.js';
import { loadPassApprovalSetup, savePassApprovalSetup } from './setup/passApprovalSetup.js';
import { loadPassReportSetup, savePassReportSetup } from './setup/passReportSetup.js';
import { loadStaffRentalSetup, saveStaffRentalSetup } from './setup/staffRentalSetup.js';
import { loadBlockSetupSetup, saveBlockSetupSetup } from './setup/blockSetupSetup.js';
import { loadRoomSetupAddSetup, saveRoomSetupAddSetup } from './setup/roomSetupAddSetup.js';
import { loadRoomSetupEditSetup, saveRoomSetupEditSetup } from './setup/roomSetupEditSetup.js';
import { loadRoomRentalSetupSetup, saveRoomRentalSetupSetup } from './setup/roomRentalSetupSetup.js';
import { loadTransportAddSetup, saveTransportAddSetup } from './setup/transportAddSetup.js';
import { loadTransportEditSetup, saveTransportEditSetup } from './setup/transportEditSetup.js';
import { loadTransportStoppingSetup, saveTransportStoppingSetup } from './setup/transportStoppingSetup.js';
import { loadTransportFeeConfigSetup, saveTransportFeeConfigSetup } from './setup/transportFeeConfigSetup.js';

const VALID_SCREENS = new Set([
  'dashboard',
  'block-setup',
  'room-setup-add',
  'room-setup-edit',
  'room-rental-setup',
  'transport-add',
  'transport-edit',
  'transport-stopping-setup',
  'transport-fee-config',
  'student-hostel',
  'att-setup',
  'attendance-report',
  'pass-approval',
  'pass-report',
  'staff-rental',
]);

const LOADERS = {
  dashboard: loadHostelDashboard,
  'block-setup': loadBlockSetupSetup,
  'room-setup-add': loadRoomSetupAddSetup,
  'room-setup-edit': loadRoomSetupEditSetup,
  'room-rental-setup': loadRoomRentalSetupSetup,
  'transport-add': loadTransportAddSetup,
  'transport-edit': loadTransportEditSetup,
  'transport-stopping-setup': loadTransportStoppingSetup,
  'transport-fee-config': loadTransportFeeConfigSetup,
  'student-hostel': loadStudentHostelSetup,
  'att-setup': loadAttSetupSetup,
  'attendance-report': loadAttendanceReportSetup,
  'pass-approval': loadPassApprovalSetup,
  'pass-report': loadPassReportSetup,
  'staff-rental': loadStaffRentalSetup,
};

const SAVERS = {
  dashboard: saveHostelDashboard,
  'block-setup': saveBlockSetupSetup,
  'room-setup-add': saveRoomSetupAddSetup,
  'room-setup-edit': saveRoomSetupEditSetup,
  'room-rental-setup': saveRoomRentalSetupSetup,
  'transport-add': saveTransportAddSetup,
  'transport-edit': saveTransportEditSetup,
  'transport-stopping-setup': saveTransportStoppingSetup,
  'transport-fee-config': saveTransportFeeConfigSetup,
  'student-hostel': saveStudentHostelSetup,
  'att-setup': saveAttSetupSetup,
  'attendance-report': saveAttendanceReportSetup,
  'pass-approval': savePassApprovalSetup,
  'pass-report': savePassReportSetup,
  'staff-rental': saveStaffRentalSetup,
};

export function assertHostelSetupScreen(screen) {
  if (!VALID_SCREENS.has(screen)) {
    return { error: 'Unknown hostel screen' };
  }
  return null;
}

export async function loadHostelSetupScreen(screen, fields, memberId, query = {}, audit = {}) {
  const invalid = assertHostelSetupScreen(screen);
  if (invalid) return invalid;
  return LOADERS[screen](memberId, { ...fields, ...query }, audit);
}

const FILE_UPLOAD_SCREENS = new Set(['transport-add', 'transport-edit']);

export async function saveHostelSetupScreen(screen, fields, memberId, files = [], audit = {}) {
  const invalid = assertHostelSetupScreen(screen);
  if (invalid) return invalid;
  if (FILE_UPLOAD_SCREENS.has(screen)) {
    return SAVERS[screen](fields || {}, memberId, files, audit);
  }
  return SAVERS[screen](fields || {}, memberId, audit);
}
