import {
  loadAccountAdd,
  loadAccountEdit,
  saveAccountAdd,
  saveAccountEdit,
} from './setup/accountSetup.js';
import { loadAccessRestriction, saveAccessRestriction } from './setup/accessRestriction.js';
import { loadDeptAuth, saveDeptAuth } from './setup/deptAuthSetup.js';
import { loadMenuAuth, saveMenuAuth } from './setup/menuAuthSetup.js';
import { loadDashboardAccess, saveDashboardAccess } from './setup/dashboardAccessSetup.js';
import { loadChangePasswordSetup, saveChangePasswordSetup } from './setup/changePasswordSetup.js';
import { loadOtpAccountReset, saveOtpAccountReset } from './setup/otpAccountResetSetup.js';
import { loadCommitteeAccess, saveCommitteeAccess } from './setup/committeeAccessSetup.js';
import {
  loadStaffAuthHod,
  loadStaffAuthPage,
  saveStaffAuthHod,
  saveStaffAuthPage,
} from './setup/staffAuthSetup.js';
import { loadDeptAuthV1, saveDeptAuthV1 } from './setup/deptAuthV1Setup.js';

const VALID_SCREENS = new Set([
  'account-add',
  'account-edit',
  'access-restriction',
  'dept-auth',
  'dept-auth-v1',
  'menu-auth',
  'dashboard-access',
  'change-password',
  'otp-reset',
  'committee-access',
  'staff-auth-hod',
  'staff-auth-page',
]);

const LOADERS = {
  'account-add': loadAccountAdd,
  'account-edit': loadAccountEdit,
  'access-restriction': loadAccessRestriction,
  'dept-auth': loadDeptAuth,
  'dept-auth-v1': loadDeptAuthV1,
  'menu-auth': loadMenuAuth,
  'dashboard-access': loadDashboardAccess,
  'change-password': loadChangePasswordSetup,
  'otp-reset': loadOtpAccountReset,
  'committee-access': loadCommitteeAccess,
  'staff-auth-hod': loadStaffAuthHod,
  'staff-auth-page': loadStaffAuthPage,
};

const SAVERS = {
  'account-add': (fields, memberId, _files, audit) => saveAccountAdd(fields, memberId, audit),
  'account-edit': (fields, memberId, files, audit) => saveAccountEdit(fields, memberId, files, audit),
  'access-restriction': (fields, memberId, _files, audit) => saveAccessRestriction(fields, memberId, audit),
  'dept-auth': (fields, memberId, _files, audit) => saveDeptAuth(fields, memberId, audit),
  'dept-auth-v1': (fields, memberId, _files, audit) => saveDeptAuthV1(fields, memberId, audit),
  'menu-auth': (fields, memberId, _files, audit) => saveMenuAuth(fields, memberId, audit),
  'dashboard-access': (fields, memberId, _files, audit) => saveDashboardAccess(fields, memberId, audit),
  'change-password': (fields, memberId, _files, audit) => saveChangePasswordSetup(fields, memberId, _files, audit),
  'otp-reset': (fields, memberId, _files, audit) => saveOtpAccountReset(fields, memberId, audit),
  'committee-access': (fields, memberId, _files, audit) => saveCommitteeAccess(fields, memberId, audit),
  'staff-auth-hod': (fields, memberId, _files, audit) => saveStaffAuthHod(fields, memberId, audit),
  'staff-auth-page': (fields, memberId, _files, audit) => saveStaffAuthPage(fields, memberId, audit),
};

export function assertAdminSetupScreen(screen) {
  if (!VALID_SCREENS.has(screen)) {
    return { error: 'Unknown admin screen' };
  }
  return null;
}

export async function loadAdminSetupScreen(screen, fields, memberId, query = {}, audit = {}) {
  const invalid = assertAdminSetupScreen(screen);
  if (invalid) return invalid;

  const loader = LOADERS[screen];
  if (!loader) return { error: 'Unknown admin screen' };

  if (screen === 'account-add') {
    return loader(memberId, audit);
  }
  return loader(memberId, fields || {}, query || {}, audit);
}

export async function saveAdminSetupScreen(screen, fields, memberId, files = [], audit = {}) {
  const invalid = assertAdminSetupScreen(screen);
  if (invalid) return invalid;

  const saver = SAVERS[screen];
  if (!saver) return { error: 'Unknown admin screen' };

  return saver(fields || {}, memberId, files || [], audit);
}
