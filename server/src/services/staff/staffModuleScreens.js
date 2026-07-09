import {
  loadAppointOrderScreen,
  loadSalaryNoteScreen,
  loadIdCardScreen,
  loadPhotoEmptyScreen,
  loadPhotosScreen,
  loadDciReportScreen,
  loadTnmgrReportScreen,
  loadPublicationDciScreen,
  loadPublicationTnmgrScreen,
  loadAffidavitDciScreen,
  loadAffidavitTnmgrScreen,
  loadAttachPrintScreen,
  loadOrgStructureScreen,
} from './screens/reportScreens.js';
import {
  loadTransportScreen,
  saveTransportScreen,
  loadPhotoUploadScreen,
  savePhotoUploadScreen,
  loadCertificatesScreen,
  saveCertificatesScreen,
  uploadCertificatesFile,
  certificatesMore,
} from './screens/gridScreens.js';
import {
  loadInspectionDetailsScreen,
  saveInspectionDetailsScreen,
  loadInspectionAttnSheetScreen,
  loadInspectionAttnCertScreen,
} from './screens/inspectionScreens.js';

export const STAFF_SCREEN_SLUGS = [
  'appoint-order',
  'salary-note',
  'id-card',
  'photo-empty',
  'photo-upload',
  'org-structure',
  'transport',
  'certificates',
  'photos',
  'inspection-details',
  'inspection-attn-sheet',
  'inspection-attn-cert',
  'dci-report',
  'tnmgr-report',
  'affidavit-dci',
  'affidavit-tnmgrmu',
  'attach-print',
  'publication-dci',
  'publication-tnmgrmu',
];

const SCREEN_LOADERS = {
  'appoint-order': loadAppointOrderScreen,
  'salary-note': loadSalaryNoteScreen,
  'id-card': loadIdCardScreen,
  'photo-empty': loadPhotoEmptyScreen,
  'photo-upload': loadPhotoUploadScreen,
  'org-structure': loadOrgStructureScreen,
  transport: loadTransportScreen,
  certificates: loadCertificatesScreen,
  photos: loadPhotosScreen,
  'inspection-details': loadInspectionDetailsScreen,
  'inspection-attn-sheet': loadInspectionAttnSheetScreen,
  'inspection-attn-cert': loadInspectionAttnCertScreen,
  'dci-report': loadDciReportScreen,
  'tnmgr-report': loadTnmgrReportScreen,
  'affidavit-dci': loadAffidavitDciScreen,
  'affidavit-tnmgrmu': loadAffidavitTnmgrScreen,
  'attach-print': loadAttachPrintScreen,
  'publication-dci': loadPublicationDciScreen,
  'publication-tnmgrmu': loadPublicationTnmgrScreen,
};

const SCREEN_SAVERS = {
  transport: saveTransportScreen,
  'photo-upload': savePhotoUploadScreen,
  certificates: saveCertificatesScreen,
  'inspection-details': saveInspectionDetailsScreen,
};

const MORE_HANDLERS = {
  certificates: certificatesMore,
};

export function assertStaffScreen(screen) {
  if (!SCREEN_LOADERS[screen]) return { error: 'Unknown staff screen' };
  return null;
}

export async function loadStaffScreen(screen, fields, memberId, audit = {}) {
  const invalid = assertStaffScreen(screen);
  if (invalid) return invalid;
  return SCREEN_LOADERS[screen](memberId, fields, audit);
}

export async function saveStaffScreen(screen, fields, memberId, audit = {}) {
  const saver = SCREEN_SAVERS[screen];
  if (!saver) return { error: 'Save not supported for this screen' };
  return saver(fields, memberId, audit);
}

export async function staffScreenMore(screen, query = {}) {
  const handler = MORE_HANDLERS[screen];
  if (!handler) return { error: 'Unknown more endpoint' };
  return handler(query);
}

export { uploadCertificatesFile };
