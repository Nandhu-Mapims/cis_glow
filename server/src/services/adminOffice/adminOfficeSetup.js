import { loadActivitiesAddSetup, loadActivitiesEditSetup, lookupActivityParticipants, saveActivitiesAddSetup, saveActivitiesEditSetup } from './setup/activitiesSetup.js';
import { loadCourierAddSetup, saveCourierAddSetup } from './setup/courierAddSetup.js';
import { loadCourierEditSetup, saveCourierEditSetup } from './setup/courierEditSetup.js';
import { loadCourierReportSetup, saveCourierReportSetup } from './setup/courierReportSetup.js';
import { loadEventsGroupSetup, saveEventsGroupSetup } from './setup/eventsGroupSetup.js';
import { loadIncidentAddSetup, saveIncidentAddSetup } from './setup/incidentAddSetup.js';
import { loadIncidentEditSetup, saveIncidentEditSetup } from './setup/incidentEditSetup.js';
import { loadIncidentReportSetup, saveIncidentReportSetup } from './setup/incidentReportSetup.js';

const VALID_SCREENS = new Set([
  'student-activities-add',
  'student-activities-edit',
  'staff-activities-add',
  'staff-activities-edit',
  'courier-add',
  'courier-edit',
  'courier-report',
  'incident-add',
  'incident-edit',
  'incident-report',
  'events-group-add',
]);

const LOADERS = {
  'student-activities-add': (m, f, _q, a) => loadActivitiesAddSetup(m, 'student', f, a),
  'student-activities-edit': (m, f, _q, a) => loadActivitiesEditSetup(m, 'student', f, a),
  'staff-activities-add': (m, f, _q, a) => loadActivitiesAddSetup(m, 'staff', f, a),
  'staff-activities-edit': (m, f, _q, a) => loadActivitiesEditSetup(m, 'staff', f, a),
  'courier-add': loadCourierAddSetup,
  'courier-edit': loadCourierEditSetup,
  'courier-report': loadCourierReportSetup,
  'incident-add': loadIncidentAddSetup,
  'incident-edit': loadIncidentEditSetup,
  'incident-report': loadIncidentReportSetup,
  'events-group-add': loadEventsGroupSetup,
};

const SAVERS = {
  'student-activities-add': (f, m, _files, a) => saveActivitiesAddSetup(f, 'student', m, a),
  'student-activities-edit': (f, m, _files, a) => saveActivitiesEditSetup(f, 'student', m, a),
  'staff-activities-add': (f, m, _files, a) => saveActivitiesAddSetup(f, 'staff', m, a),
  'staff-activities-edit': (f, m, _files, a) => saveActivitiesEditSetup(f, 'staff', m, a),
  'courier-add': saveCourierAddSetup,
  'courier-edit': saveCourierEditSetup,
  'courier-report': saveCourierReportSetup,
  'incident-add': saveIncidentAddSetup,
  'incident-edit': saveIncidentEditSetup,
  'incident-report': saveIncidentReportSetup,
  'events-group-add': saveEventsGroupSetup,
};

export function assertAdminOfficeSetupScreen(screen) {
  if (!VALID_SCREENS.has(screen)) {
    return { error: 'Unknown admin office screen' };
  }
  return null;
}

export async function loadAdminOfficeSetupScreen(screen, fields, memberId, query = {}, audit = {}) {
  const invalid = assertAdminOfficeSetupScreen(screen);
  if (invalid) return invalid;
  return LOADERS[screen](memberId, { ...fields, ...query }, audit);
}

export async function saveAdminOfficeSetupScreen(screen, fields, memberId, files = [], audit = {}) {
  const invalid = assertAdminOfficeSetupScreen(screen);
  if (invalid) return invalid;
  return SAVERS[screen](fields || {}, memberId, files || [], audit);
}

export { lookupActivityParticipants };
