import { loadCircularAddSetup, saveCircularAddSetup } from './setup/addSetup.js';
import { loadCircularApproveSetup, saveCircularApproveSetup } from './setup/approveSetup.js';
import { loadCircularDashboard, saveCircularDashboard } from './setup/dashboardSetup.js';
import { loadCircularEditSetup, saveCircularEditSetup } from './setup/editSetup.js';
import {
  loadPrintDepartmentSetup,
  loadPrintStaffSetup,
  loadPrintStudentSetup,
  savePrintDepartmentSetup,
  savePrintStaffSetup,
  savePrintStudentSetup,
} from './setup/printSetup.js';
import { loadCircularReportSetup, saveCircularReportSetup } from './setup/reportSetup.js';
import { loadCircularSetupSetup, saveCircularSetupSetup } from './setup/setupSetup.js';

const VALID_SCREENS = new Set([
  'dashboard',
  'add',
  'edit',
  'approve',
  'report',
  'print-student',
  'print-staff',
  'print-department',
  'setup',
]);

const LOADERS = {
  dashboard: loadCircularDashboard,
  add: loadCircularAddSetup,
  edit: loadCircularEditSetup,
  approve: loadCircularApproveSetup,
  report: loadCircularReportSetup,
  'print-student': loadPrintStudentSetup,
  'print-staff': loadPrintStaffSetup,
  'print-department': loadPrintDepartmentSetup,
  setup: loadCircularSetupSetup,
};

const SAVERS = {
  dashboard: saveCircularDashboard,
  add: saveCircularAddSetup,
  edit: saveCircularEditSetup,
  approve: saveCircularApproveSetup,
  report: saveCircularReportSetup,
  'print-student': savePrintStudentSetup,
  'print-staff': savePrintStaffSetup,
  'print-department': savePrintDepartmentSetup,
  setup: saveCircularSetupSetup,
};

export function assertCircularSetupScreen(screen) {
  if (!VALID_SCREENS.has(screen)) {
    return { error: 'Unknown circular screen' };
  }
  return null;
}

export async function loadCircularSetupScreen(screen, fields, memberId, query = {}, audit = {}) {
  const invalid = assertCircularSetupScreen(screen);
  if (invalid) return invalid;
  return LOADERS[screen](memberId, { ...fields, ...query }, audit);
}

export async function saveCircularSetupScreen(screen, fields, memberId, files = [], audit = {}) {
  const invalid = assertCircularSetupScreen(screen);
  if (invalid) return invalid;
  return SAVERS[screen](fields || {}, memberId, files, audit);
}
