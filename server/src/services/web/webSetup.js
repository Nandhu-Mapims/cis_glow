import { loadWebPageScreen, saveWebPageScreen } from './webPageSetup.js';
import { loadWebSliderSetup, saveWebSliderSetup } from './webSliderSetup.js';
import { loadWebStaffDisplaySetup, saveWebStaffDisplaySetup } from './webStaffDisplaySetup.js';
import {
  loadWebPhotosAdd,
  saveWebPhotosAdd,
  loadWebPhotosEdit,
  saveWebPhotosEdit,
} from './webPhotosSetup.js';
import { loadWebDocUploadSetup, saveWebDocUploadSetup } from './webDocUploadSetup.js';
import {
  loadWebResearchAdd,
  saveWebResearchAdd,
  loadWebResearchEdit,
  saveWebResearchEdit,
} from './webResearchSetup.js';

import {
  loadWebEventAdd,
  saveWebEventAdd,
  loadWebEventEdit,
  saveWebEventEdit,
  loadWebEventType,
  saveWebEventType,
} from './webEventsSetup.js';

const PAGE_SCREENS = new Set([
  'about-us',
  'departments',
  'lms',
  'journal',
  'facilities',
  'aaadar',
  'research',
  'academic',
  'iqac',
  'outreach',
]);

const SETUP_HANDLERS = {
  'slider-animation': { load: loadWebSliderSetup, save: saveWebSliderSetup },
  'staff-display-order': { load: loadWebStaffDisplaySetup, save: saveWebStaffDisplaySetup },
  'photos-add': { load: loadWebPhotosAdd, save: saveWebPhotosAdd },
  'photos-edit': { load: loadWebPhotosEdit, save: saveWebPhotosEdit },
  'doc-upload': { load: loadWebDocUploadSetup, save: saveWebDocUploadSetup },
  'research-program-add': { load: loadWebResearchAdd, save: saveWebResearchAdd },
  'research-program-edit': { load: loadWebResearchEdit, save: saveWebResearchEdit },
  'event-add': { load: loadWebEventAdd, save: saveWebEventAdd },
  'event-edit': { load: loadWebEventEdit, save: saveWebEventEdit },
  'event-type': { load: loadWebEventType, save: saveWebEventType },
};

export const NATIVE_SCREENS = new Set([...PAGE_SCREENS, ...Object.keys(SETUP_HANDLERS)]);

export function assertWebScreen(screen) {
  if (!NATIVE_SCREENS.has(screen)) return { error: 'Unknown web screen' };
  return null;
}

export async function loadWebScreen(screen, fields, memberId, query = {}, audit = {}) {
  const invalid = assertWebScreen(screen);
  if (invalid) return invalid;

  if (PAGE_SCREENS.has(screen)) {
    return loadWebPageScreen(screen, memberId, fields, audit);
  }

  const handler = SETUP_HANDLERS[screen];
  return handler.load(memberId, fields, query, audit);
}

export async function saveWebScreen(screen, fields, memberId, files = [], audit = {}) {
  const invalid = assertWebScreen(screen);
  if (invalid) return invalid;

  const payload = { ...fields, files: files.length ? files : fields.files };

  if (PAGE_SCREENS.has(screen)) {
    return saveWebPageScreen(screen, payload, memberId, audit);
  }

  const handler = SETUP_HANDLERS[screen];
  return handler.save(memberId, payload, {}, audit);
}
