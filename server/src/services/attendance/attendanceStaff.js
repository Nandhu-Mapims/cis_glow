import { insertLog } from '../logService.js';
import { buildStaffAttendanceCalendar } from './staffCalendar.js';
import { punchStaffLiveAttendance as nativePunch } from './staffLivePunch.js';
import { buildStaffAttendanceReport } from './staffReport.js';

function formatBridgeDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toISOString().slice(0, 10);
}

export async function getStaffAttendanceCalendar(payload, memberId) {
  void memberId;
  const result = await buildStaffAttendanceCalendar({
    ...payload,
    fromDate: formatBridgeDate(payload.fromDate),
    toDate: formatBridgeDate(payload.toDate),
  });
  if (result.error) return { error: result.error };
  if (!result.html || result.html.length < 20) {
    return { error: 'No calendar data returned for this staff member' };
  }
  return result;
}

export async function generateStaffAttendanceReport(payload, memberId) {
  void memberId;
  const result = await buildStaffAttendanceReport(payload);
  if (result.error) return { error: result.error };
  if (!result.html || result.html.length < 20) {
    return { error: 'Report generation returned no data' };
  }
  return result;
}

export async function punchStaffLiveAttendance(payload, memberId, meta) {
  const result = await nativePunch(payload, memberId, meta);
  if (result.error) {
    return { error: result.error };
  }

  await insertLog(
    ['staff_live_attendance', 'Punch', 'Successful', String(payload.staffId || ''), new Date(), meta.ip, '', memberId],
    '',
  );

  return result;
}
