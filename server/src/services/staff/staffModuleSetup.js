import { loadAttachmentCategorySetup, saveAttachmentCategorySetup } from './setup/attachmentCategorySetup.js';
import { loadAttachmentScategorySetup, saveAttachmentScategorySetup } from './setup/attachmentScategorySetup.js';
import { loadAttachmentSetupSetup, saveAttachmentSetupSetup } from './setup/attachmentSetupSetup.js';
import { loadOrgChartConfigSetup, saveOrgChartConfigSetup } from './setup/orgChartConfigSetup.js';
import { loadInspectionConfigSetup, saveInspectionConfigSetup } from './setup/inspectionConfigSetup.js';
import { loadInspectionNameSetup, saveInspectionNameSetup } from './setup/inspectionNameSetup.js';
import { loadTransportSetupSetup, saveTransportSetupSetup, transportSetupMore } from './setup/transportSetupSetup.js';
import { loadDesignationEditSetup, saveDesignationEditSetup, designationEditMore } from './setup/designationEditSetup.js';
import { loadLoginHelpSetup, saveLoginHelpSetup } from './setup/loginHelpSetup.js';

export const STAFF_SETUP_SLUGS = [
  'designation-edit',
  'attachment-category',
  'attachment-scategory',
  'attachment-setup',
  'org-chart-config',
  'inspection-config',
  'inspection-name',
  'transport-setup',
  'login-help',
];

const LOADERS = {
  'designation-edit': loadDesignationEditSetup,
  'attachment-category': loadAttachmentCategorySetup,
  'attachment-scategory': loadAttachmentScategorySetup,
  'attachment-setup': loadAttachmentSetupSetup,
  'org-chart-config': loadOrgChartConfigSetup,
  'inspection-config': loadInspectionConfigSetup,
  'inspection-name': loadInspectionNameSetup,
  'transport-setup': loadTransportSetupSetup,
  'login-help': loadLoginHelpSetup,
};

const SAVERS = {
  'designation-edit': saveDesignationEditSetup,
  'attachment-category': saveAttachmentCategorySetup,
  'attachment-scategory': saveAttachmentScategorySetup,
  'attachment-setup': saveAttachmentSetupSetup,
  'org-chart-config': saveOrgChartConfigSetup,
  'inspection-config': saveInspectionConfigSetup,
  'inspection-name': saveInspectionNameSetup,
  'transport-setup': saveTransportSetupSetup,
  'login-help': saveLoginHelpSetup,
};

const MORE_HANDLERS = {
  'designation-edit': designationEditMore,
  'transport-setup': transportSetupMore,
};

export function assertStaffSetupScreen(screen) {
  if (!LOADERS[screen]) return { error: 'Unknown staff setup screen' };
  return null;
}

export async function loadStaffSetupScreen(screen, fields, memberId, query = {}, audit = {}) {
  const invalid = assertStaffSetupScreen(screen);
  if (invalid) return invalid;
  return LOADERS[screen](memberId, { ...fields, ...query }, audit);
}

export async function saveStaffSetupScreen(screen, fields, memberId, audit = {}) {
  const invalid = assertStaffSetupScreen(screen);
  if (invalid) return invalid;
  const saver = SAVERS[screen];
  if (!saver) return { error: 'Save not supported for this screen' };
  return saver(fields, memberId, audit);
}

export async function staffSetupMore(screen, query = {}) {
  const handler = MORE_HANDLERS[screen];
  if (!handler) return { error: 'Unknown more endpoint' };
  return handler(query);
}
