import { loadApprovalSetup, saveApprovalSetup } from './setup/approvalSetup.js';
import { loadBudgetSmsSetup, saveBudgetSmsSetup } from './setup/budgetSmsSetup.js';
import { loadCollegeSmsSetup, saveCollegeSmsSetup } from './setup/collegeSmsSetup.js';
import { loadDesignationSetup, saveDesignationSetup } from './setup/designationSetup.js';
import { loadDOrderSetup, saveDOrderSetup } from './setup/dOrderSetup.js';
import { loadHospitalSmsSetup, saveHospitalSmsSetup } from './setup/hospitalSmsSetup.js';
import { loadLessonPlanSetup, saveLessonPlanSetup } from './setup/lessonPlanSetup.js';
import { loadPayrollEmailerSetup, savePayrollEmailerSetup } from './setup/payrollEmailerSetup.js';
import { loadPrintSetupSetup, savePrintSetupSetup } from './setup/printSetupSetup.js';
import { loadPrintStyleSetup, savePrintStyleSetup } from './setup/printStyleSetup.js';
import { loadSignatureSetup, saveSignatureSetup } from './setup/signatureSetup.js';
import { loadSmsCronSetup, saveSmsCronSetup } from './setup/smsCronSetup.js';
import { loadStaffEduMasterSetup, saveStaffEduMasterSetup } from './setup/staffEduMasterSetup.js';
import { loadStaffMasterSetup, saveStaffMasterSetup } from './setup/staffMasterSetup.js';

const VALID_SCREENS = new Set([
  'designation',
  'd-order',
  'staff-master',
  'staff-edu-master',
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
]);

const NATIVE_SCREENS = VALID_SCREENS;

const LOADERS = {
  designation: (memberId, fields, _query, audit) => loadDesignationSetup(memberId, fields, audit),
  'd-order': (memberId, fields, _query, audit) => loadDOrderSetup(memberId, fields, audit),
  'staff-master': (memberId, fields, _query, audit) => loadStaffMasterSetup(memberId, fields, audit),
  'staff-edu-master': (memberId, fields, _query, audit) => loadStaffEduMasterSetup(memberId, fields, audit),
  approval: (memberId, fields, _query, audit) => loadApprovalSetup(memberId, fields, audit),
  college: (memberId, fields, _query, audit) => loadCollegeSmsSetup(memberId, fields, audit),
  hospital: (memberId, fields, _query, audit) => loadHospitalSmsSetup(memberId, fields, audit),
  budget: (memberId, fields, _query, audit) => loadBudgetSmsSetup(memberId, fields, audit),
  'print-setup': (memberId, fields, _query, audit) => loadPrintSetupSetup(memberId, fields, audit),
  'print-style': (memberId, fields, _query, audit) => loadPrintStyleSetup(memberId, fields, audit),
  'lesson-plan': (memberId, fields, _query, audit) => loadLessonPlanSetup(memberId, fields, audit),
  signature: (memberId, fields, _query, audit) => loadSignatureSetup(memberId, fields, audit),
  'payroll-emailer': (memberId, fields, _query, audit) => loadPayrollEmailerSetup(memberId, fields, audit),
  'sms-cron': (memberId, fields, _query, audit) => loadSmsCronSetup(memberId, fields, audit),
};

const SAVERS = {
  designation: (fields, memberId, _files, audit) => saveDesignationSetup(fields, memberId, audit),
  'd-order': (fields, memberId, _files, audit) => saveDOrderSetup(fields, memberId, audit),
  'staff-master': (fields, memberId, _files, audit) => saveStaffMasterSetup(fields, memberId, audit),
  'staff-edu-master': (fields, memberId, _files, audit) => saveStaffEduMasterSetup(fields, memberId, audit),
  approval: (fields, memberId, _files, audit) => saveApprovalSetup(fields, memberId, audit),
  college: (fields, memberId, _files, audit) => saveCollegeSmsSetup(fields, memberId, audit),
  hospital: (fields, memberId, _files, audit) => saveHospitalSmsSetup(fields, memberId, audit),
  budget: (fields, memberId, _files, audit) => saveBudgetSmsSetup(fields, memberId, audit),
  'print-setup': (fields, memberId, _files, audit) => savePrintSetupSetup(fields, memberId, audit),
  'print-style': (fields, memberId, _files, audit) => savePrintStyleSetup(fields, memberId, audit),
  'lesson-plan': (fields, memberId, _files, audit) => saveLessonPlanSetup(fields, memberId, audit),
  signature: (fields, memberId, _files, audit) => saveSignatureSetup(fields, memberId, audit),
  'payroll-emailer': (fields, memberId, _files, audit) => savePayrollEmailerSetup(fields, memberId, audit),
  'sms-cron': (fields, memberId, _files, audit) => saveSmsCronSetup(fields, memberId, audit),
};

export function assertSettingsSetupScreen(screen) {
  if (!VALID_SCREENS.has(screen)) {
    return { error: 'Unknown settings setup screen' };
  }
  return null;
}

export async function loadSettingsSetupScreen(screen, fields, memberId, query = {}, audit = {}) {
  const invalid = assertSettingsSetupScreen(screen);
  if (invalid) return invalid;

  if (NATIVE_SCREENS.has(screen)) {
    const loader = LOADERS[screen];
    return loader(memberId, fields || {}, query || {}, audit);
  }

  return { error: 'Screen not implemented' };
}

export async function saveSettingsSetupScreen(screen, fields, memberId, files = [], audit = {}) {
  const invalid = assertSettingsSetupScreen(screen);
  if (invalid) return invalid;

  if (NATIVE_SCREENS.has(screen)) {
    const saver = SAVERS[screen];
    return saver(fields || {}, memberId, files || [], audit);
  }

  return { error: 'Screen not implemented' };
}
