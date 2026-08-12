import { legacyPageFor } from '../config/bridgeScreenMaps.js';
import { insertLog } from './logService.js';
import { normalizeLegacyIp } from '../utils/sqlSafe.js';

const BRIDGE_REPORT_SCREENS = {
  academic: new Set(['subject-report', 'timetable-report', 'batch-timetable-report']),
  exam: new Set([
    'term-report',
    'term-statement',
    'progress-card',
    'schedule-print',
    'invigilator-print',
    'report-analysis',
  ]),
  admin: new Set(['log-dashboard', 'log-details']),
  payroll: new Set(['dashboard', 'individual-report']),
};

function inferOperation(fields) {
  if (fields.delete === 'Confirm') return 'Delete';
  const submit = fields.Submit || fields.Submit0 || fields.Submit3;
  if (submit === 'Add') return 'Add';
  if (submit === 'Delete') return 'Delete';
  if (submit === 'Save' || submit === 'Update') return 'Update';
  return 'Update';
}

function briefDescription(fields) {
  const keys = [
    'edit_row_id', 'member_id', 'username', 'register_no', 'staff_id',
    'confirm', 'user_id_ref', 'dept_name_ref',
  ];
  for (const key of keys) {
    if (fields[key]) {
      return String(fields[key]).slice(0, 200);
    }
  }
  return '';
}

export async function logBridgeSave({
  module,
  screen,
  legacyPage,
  fields,
  success,
  memberId,
  sessionId,
  ip,
  userAgent,
}) {
  const page = legacyPage || legacyPageFor(module, screen);
  const operation = inferOperation(fields || {});
  const status = success ? 'Successful' : 'Unsuccessful';

  await insertLog(
    [
      page,
      operation,
      status,
      briefDescription(fields || {}),
      new Date(),
      ip || '',
      userAgent || '',
      memberId,
    ],
    sessionId || '',
  );
}

export function auditContextFromRequest(req) {
  return {
    sessionId: req.user?.sessionId || '',
    ip: normalizeLegacyIp(req.ip || req.headers['x-forwarded-for'] || ''),
    userAgent: req.headers['user-agent'] || '',
    accessType: req.user?.accessType || '',
  };
}

export function isBridgeReportScreen(module, screen) {
  return BRIDGE_REPORT_SCREENS[module]?.has(screen) ?? false;
}

export async function logBridgeView({
  module,
  screen,
  legacyPage,
  fields,
  memberId,
  sessionId,
  ip,
  userAgent,
  operation = 'View',
}) {
  if (!isBridgeReportScreen(module, screen)) {
    return;
  }
  const page = legacyPage || legacyPageFor(module, screen);
  await insertLog(
    [
      page,
      operation,
      'Successful',
      briefDescription(fields || {}),
      new Date(),
      ip || '',
      userAgent || '',
      memberId,
    ],
    sessionId || '',
  );
}
