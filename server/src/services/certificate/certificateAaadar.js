import { logModulePage } from '../shared/moduleAudit.js';
import {
  loadAaadarCertificateScreen,
} from './aaadarCertificateCore.js';

const IMPLANT_PAGE = 'aaadar_implant.php';
const LASER_PAGE = 'aaadar_laser.php';

export async function loadImplantCert(memberId, fields = {}, audit = {}) {
  const result = await loadAaadarCertificateScreen(memberId, fields, audit, 'implant');
  await logModulePage(IMPLANT_PAGE, 'View', 'Successful', result.searchInput || String(result.selectedStudentId || ''), memberId, audit);
  return result;
}

export async function saveImplantCert(payload, memberId, audit = {}) {
  return loadImplantCert(memberId, payload, audit);
}

export async function loadLaserCert(memberId, fields = {}, audit = {}) {
  const result = await loadAaadarCertificateScreen(memberId, fields, audit, 'laser');
  await logModulePage(LASER_PAGE, 'View', 'Successful', result.searchInput || String(result.selectedStudentId || ''), memberId, audit);
  return result;
}

export async function saveLaserCert(payload, memberId, audit = {}) {
  return loadLaserCert(memberId, payload, audit);
}
