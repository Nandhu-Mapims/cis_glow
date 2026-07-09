import { loadMachineAccess, saveMachineAccess } from './machineAccess.js';
import { loadMachineRoom, saveMachineRoom } from './machineRoom.js';
import { loadMachinePassword, saveMachinePassword } from './machinePassword.js';
import { loadKioskSlider, saveKioskSlider, loadKioskSliderStyle, saveKioskSliderStyle } from './kioskSliderSetup.js';
import {
  loadKioskAttMenu,
  saveKioskAttMenu,
  loadKioskAttMenuAccess,
  saveKioskAttMenuAccess,
  loadKioskAttInstruction,
  saveKioskAttInstruction,
} from './kioskAttSetup.js';
import { loadKioskPinReset, saveKioskPinReset, loadKioskAttStatement, saveKioskAttStatement } from './kioskPinAndStatement.js';
import {
  loadKioskAnnouncementAdd,
  saveKioskAnnouncementAdd,
  loadKioskAnnouncementEdit,
  saveKioskAnnouncementEdit,
  loadKioskReceiptSetup,
  saveKioskReceiptSetup,
} from './kioskAnnouncementAndReceipt.js';

const VALID_SCREENS = new Set([
  'machine-access',
  'machine-room-add',
  'machine-room-edit',
  'student-password',
  'staff-password',
  'machine-slider',
  'slider-widget',
  'att-menu',
  'att-menu-access',
  'att-instruction',
  'staff-pin-reset',
  'student-pin-reset',
  'att-statement',
  'announcement-add',
  'announcement-edit',
  'receipt-setup',
]);

export const NATIVE_SCREENS = VALID_SCREENS;

const LOADERS = {
  'machine-access': (m, f, _q, a) => loadMachineAccess(m, f, a),
  'machine-room-add': (m, f, _q, a) => loadMachineRoom(m, f, a),
  'machine-room-edit': (m, f, _q, a) => loadMachineRoom(m, f, a),
  'student-password': (m, f, _q, a) => loadMachinePassword(m, { ...f, type: 'student' }, a),
  'staff-password': (m, f, _q, a) => loadMachinePassword(m, { ...f, type: 'staff' }, a),
  'machine-slider': (m, f, _q, a) => loadKioskSlider(m, f, a),
  'slider-widget': (m, f, _q, a) => loadKioskSliderStyle(m, f, a),
  'att-menu': (m, f, _q, a) => loadKioskAttMenu(m, f, a),
  'att-menu-access': (m, f, _q, a) => loadKioskAttMenuAccess(m, f, a),
  'att-instruction': (m, f, _q, a) => loadKioskAttInstruction(m, f, a),
  'staff-pin-reset': (m, f, _q, a) => loadKioskPinReset(m, { ...f, type: 'staff' }, a),
  'student-pin-reset': (m, f, _q, a) => loadKioskPinReset(m, { ...f, type: 'student' }, a),
  'att-statement': (m, f, _q, a) => loadKioskAttStatement(m, f, a),
  'announcement-add': (m, f, _q, a) => loadKioskAnnouncementAdd(m, f, a),
  'announcement-edit': (m, f, _q, a) => loadKioskAnnouncementEdit(m, f, a),
  'receipt-setup': (m, f, _q, a) => loadKioskReceiptSetup(m, f, a),
};

const SAVERS = {
  'machine-access': (f, m, _files, a) => saveMachineAccess(f, m, a),
  'machine-room-add': (f, m, _files, a) => saveMachineRoom(f, m, a),
  'machine-room-edit': (f, m, _files, a) => saveMachineRoom(f, m, a),
  'student-password': (f, m, _files, a) => saveMachinePassword({ ...f, type: 'student' }, m, a),
  'staff-password': (f, m, _files, a) => saveMachinePassword({ ...f, type: 'staff' }, m, a),
  'machine-slider': (f, m, _files, a) => saveKioskSlider(f, m, a),
  'slider-widget': (f, m, _files, a) => saveKioskSliderStyle(f, m, a),
  'att-menu': (f, m, _files, a) => saveKioskAttMenu(f, m, a),
  'att-menu-access': (f, m, _files, a) => saveKioskAttMenuAccess(f, m, a),
  'att-instruction': (f, m, _files, a) => saveKioskAttInstruction(f, m, a),
  'staff-pin-reset': (f, m, _files, a) => saveKioskPinReset({ ...f, type: 'staff' }, m, a),
  'student-pin-reset': (f, m, _files, a) => saveKioskPinReset({ ...f, type: 'student' }, m, a),
  'att-statement': (f, m, _files, a) => saveKioskAttStatement(f, m, a),
  'announcement-add': (f, m, _files, a) => saveKioskAnnouncementAdd(f, m, a),
  'announcement-edit': (f, m, _files, a) => saveKioskAnnouncementEdit(f, m, a),
  'receipt-setup': (f, m, _files, a) => saveKioskReceiptSetup(f, m, a),
};

export function assertKioskScreen(screen) {
  if (!VALID_SCREENS.has(screen)) return { error: 'Unknown kiosk screen' };
  return null;
}

export async function loadKioskScreen(screen, fields, memberId, query = {}, audit = {}) {
  const invalid = assertKioskScreen(screen);
  if (invalid) return invalid;
  return LOADERS[screen](memberId, fields, query, audit);
}

export async function saveKioskScreen(screen, fields, memberId, files = [], audit = {}) {
  const invalid = assertKioskScreen(screen);
  if (invalid) return invalid;
  return SAVERS[screen](fields, memberId, files, audit);
}
