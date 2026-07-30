import {
  loadIdCardScreen,
  loadPhotoEmptyScreen,
  loadAddressLabelScreen,
  loadAttachmentsReportScreen,
  loadTempAffidavitScreen,
  loadAlumniRegistrationScreen,
  loadAlumniReportScreen,
  loadAlumniIdCardScreen,
  loadCollageGenerateScreen,
  loadAttachmentsViewScreen,
  loadAttachmentsUploadScreen,
  loadPhotoUploadScreen,
  savePhotoUploadScreen,
} from './screens/reportScreens.js';
import {
  loadPromoteScreen,
  savePromoteScreen,
  loadPromotePreviewScreen,
  loadAcademicPromotionScreen,
  saveAcademicPromotionScreen,
  loadTempAdmissionAddScreen,
  saveTempAdmissionAddScreen,
  loadTempAdmissionEditScreen,
  saveTempAdmissionEditScreen,
  loadAlumniEditScreen,
  saveAlumniEditScreen,
  loadCollageImageScreen,
  saveCollageImageScreen,
} from './screens/actionScreens.js';
import { getStudentAttachmentCatalog, saveStudentAttachments } from './studentAttachments.js';
import { searchStudents } from './studentSearch.js';

export const STUDENT_SCREEN_SLUGS = [
  'temp-admission-add',
  'temp-admission-edit',
  'temp-affidavit',
  'academic-promotion',
  'attachments-upload',
  'attachments-view',
  'attachments-report',
  'id-card',
  'photo-empty',
  'photo-upload',
  'promote',
  'address-label',
  'alumni-registration',
  'alumni-edit',
  'alumni-report',
  'alumni-id-card',
  'collage-generate',
  'collage-image',
];

const SCREEN_LOADERS = {
  'temp-admission-add': loadTempAdmissionAddScreen,
  'temp-admission-edit': loadTempAdmissionEditScreen,
  'temp-affidavit': loadTempAffidavitScreen,
  'academic-promotion': loadAcademicPromotionScreen,
  'attachments-upload': loadAttachmentsUploadScreen,
  'attachments-view': loadAttachmentsViewScreen,
  'attachments-report': loadAttachmentsReportScreen,
  'id-card': loadIdCardScreen,
  'photo-empty': loadPhotoEmptyScreen,
  'photo-upload': loadPhotoUploadScreen,
  promote: loadPromoteScreen,
  'address-label': loadAddressLabelScreen,
  'alumni-registration': loadAlumniRegistrationScreen,
  'alumni-edit': loadAlumniEditScreen,
  'alumni-report': loadAlumniReportScreen,
  'alumni-id-card': loadAlumniIdCardScreen,
  'collage-generate': loadCollageGenerateScreen,
  'collage-image': loadCollageImageScreen,
};

const SCREEN_SAVERS = {
  'temp-admission-add': saveTempAdmissionAddScreen,
  'temp-admission-edit': saveTempAdmissionEditScreen,
  'academic-promotion': saveAcademicPromotionScreen,
  'photo-upload': savePhotoUploadScreen,
  promote: savePromoteScreen,
  'alumni-edit': saveAlumniEditScreen,
  'collage-image': saveCollageImageScreen,
};

const MORE_HANDLERS = {
  promote: loadPromotePreviewScreen,
  'attachments-upload': async (query) => {
    if (!query.studentId) return searchStudents({ by: query.by || 'roll', q: query.q || '' });
    return getStudentAttachmentCatalog(query.studentId);
  },
  'attachments-view': async (query) => {
    if (!query.studentId) return searchStudents({ by: query.by || 'roll', q: query.q || '' });
    return getStudentAttachmentCatalog(query.studentId);
  },
  'photo-upload': async (query) => searchStudents({ by: query.by || 'roll', q: query.q || '', partial: true }),
};

export function assertStudentScreen(screen) {
  if (!SCREEN_LOADERS[screen]) return { error: 'Unknown student screen' };
  return null;
}

export async function loadStudentScreen(screen, fields, memberId, audit = {}) {
  const invalid = assertStudentScreen(screen);
  if (invalid) return invalid;
  if (screen === 'promote' && fields.action === 'preview') {
    return loadPromotePreviewScreen(memberId, fields, audit);
  }
  return SCREEN_LOADERS[screen](memberId, fields, audit);
}

export async function saveStudentScreen(screen, fields, memberId, audit = {}) {
  if (screen === 'attachments-upload' || screen === 'attachments-view') {
    const sid = fields.studentId;
    if (!sid) return { error: 'studentId is required' };
    const result = await saveStudentAttachments(sid, fields.items || [], {
      ip: audit.ip,
      username: memberId,
    });
    if (result.error) return result;
    return { success: true, message: 'Attachments saved', catalog: result.catalog };
  }
  const saver = SCREEN_SAVERS[screen];
  if (!saver) return { error: 'Save not supported for this screen' };
  return saver(fields, memberId, audit);
}

export async function studentScreenMore(screen, query = {}) {
  const handler = MORE_HANDLERS[screen];
  if (!handler) return { error: 'Unknown more endpoint' };
  return handler(query);
}
