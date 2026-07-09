import { loadCertificateSetup, saveCertificateSetup } from './certificateCategorySetup.js';
import {
  loadCertificateReceiptAdd, saveCertificateReceiptAdd,
  loadCertificateReceiptEdit, saveCertificateReceiptEdit,
  loadCertificateReceiptReport, saveCertificateReceiptReport,
} from './certificateReceipt.js';
import { loadCertificateApprove, saveCertificateApprove } from './certificateApprove.js';
import { loadCertificateGenerate, saveCertificateGenerate } from './certificateGenerate.js';
import { loadCertificateRequest, saveCertificateRequest } from './certificateRequest.js';
import {
  loadTcDetails, saveTcDetails,
  loadTcRequestAdd, saveTcRequestAdd,
  loadTcRequestEdit, saveTcRequestEdit,
  loadTcGenerate, saveTcGenerate,
} from './certificateTc.js';
import {
  loadInternshipSchedule, saveInternshipSchedule,
  loadInternshipGenerate, saveInternshipGenerate,
  loadInternshipPhoto, saveInternshipPhoto,
} from './certificateInternship.js';
import { loadImplantCert, saveImplantCert, loadLaserCert, saveLaserCert } from './certificateAaadar.js';

const VALID_SCREENS = new Set([
  'setup',
  'approve',
  'generate',
  'receipt-add',
  'receipt-edit',
  'receipt-report',
  'cert-request',
  'tc-details',
  'tc-request-add',
  'tc-request-edit',
  'tc-generate',
  'internship-schedule',
  'internship-generate',
  'internship-photo',
  'implant-cert',
  'laser-cert',
]);

export const NATIVE_SCREENS = VALID_SCREENS;

const LOADERS = {
  setup: loadCertificateSetup,
  approve: loadCertificateApprove,
  generate: loadCertificateGenerate,
  'receipt-add': loadCertificateReceiptAdd,
  'receipt-edit': loadCertificateReceiptEdit,
  'receipt-report': loadCertificateReceiptReport,
  'cert-request': loadCertificateRequest,
  'tc-details': loadTcDetails,
  'tc-request-add': loadTcRequestAdd,
  'tc-request-edit': loadTcRequestEdit,
  'tc-generate': loadTcGenerate,
  'internship-schedule': loadInternshipSchedule,
  'internship-generate': loadInternshipGenerate,
  'internship-photo': loadInternshipPhoto,
  'implant-cert': loadImplantCert,
  'laser-cert': loadLaserCert,
};

const SAVERS = {
  setup: saveCertificateSetup,
  approve: saveCertificateApprove,
  generate: saveCertificateGenerate,
  'receipt-add': saveCertificateReceiptAdd,
  'receipt-edit': saveCertificateReceiptEdit,
  'receipt-report': saveCertificateReceiptReport,
  'cert-request': saveCertificateRequest,
  'tc-details': saveTcDetails,
  'tc-request-add': saveTcRequestAdd,
  'tc-request-edit': saveTcRequestEdit,
  'tc-generate': saveTcGenerate,
  'internship-schedule': saveInternshipSchedule,
  'internship-generate': saveInternshipGenerate,
  'internship-photo': saveInternshipPhoto,
  'implant-cert': saveImplantCert,
  'laser-cert': saveLaserCert,
};

export function assertCertificateScreen(screen) {
  if (!VALID_SCREENS.has(screen)) return { error: 'Unknown certificate screen' };
  return null;
}

export async function loadCertificateScreen(screen, fields, memberId, query = {}, audit = {}) {
  const invalid = assertCertificateScreen(screen);
  if (invalid) return invalid;
  return LOADERS[screen](memberId, { ...fields, ...query }, audit);
}

export async function saveCertificateScreen(screen, fields, memberId, files = [], audit = {}) {
  const invalid = assertCertificateScreen(screen);
  if (invalid) return invalid;
  if (screen === 'internship-photo') {
    return SAVERS[screen](fields, memberId, files, audit);
  }
  return SAVERS[screen](fields, memberId, audit);
}
