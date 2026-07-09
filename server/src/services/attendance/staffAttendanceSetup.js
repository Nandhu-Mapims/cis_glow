import {
  loadAttTimeSetup,
  loadCalendarAddSetup,
  loadCalendarEditSetup,
  loadWorkingDaySetup,
  saveAttTimeSetup,
  saveCalendarAddSetup,
  saveCalendarEditSetup,
  saveWorkingDaySetup,
  calendarMoreSetup,
} from './setup/calendarSetup.js';

const VALID_SCREENS = new Set([
  'calendar-add',
  'calendar-edit',
  'working-day',
  'att-time',
]);

const LOADERS = {
  'calendar-add': loadCalendarAddSetup,
  'calendar-edit': loadCalendarEditSetup,
  'working-day': loadWorkingDaySetup,
  'att-time': loadAttTimeSetup,
};

const SAVERS = {
  'calendar-add': saveCalendarAddSetup,
  'calendar-edit': saveCalendarEditSetup,
  'working-day': saveWorkingDaySetup,
  'att-time': saveAttTimeSetup,
};

export function assertStaffAttSetupScreen(screen) {
  if (!VALID_SCREENS.has(screen)) {
    return { error: 'Unknown staff attendance setup screen' };
  }
  return null;
}

export async function loadStaffAttSetupScreen(screen, fields, memberId, query = {}, audit = {}) {
  const invalid = assertStaffAttSetupScreen(screen);
  if (invalid) return invalid;
  return LOADERS[screen](memberId, fields, audit, query);
}

export async function saveStaffAttSetupScreen(screen, fields, memberId, audit = {}) {
  const invalid = assertStaffAttSetupScreen(screen);
  if (invalid) return invalid;
  const saver = SAVERS[screen];
  if (!saver) return { error: 'Save not supported for this screen' };
  return saver(fields, memberId, audit);
}

export async function staffAttSetupMore(screen, query = {}) {
  if (screen === 'calendar-add' || screen === 'calendar-edit') {
    return calendarMoreSetup(query);
  }
  return { error: 'Unknown more endpoint' };
}
