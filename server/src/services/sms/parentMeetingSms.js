import { logModulePage } from '../shared/moduleAudit.js';
import {
  loadParentCourseOptions,
  loadParentRecipients,
  recordSmsSend,
} from './smsShared.js';

const PAGE = 'parent_meeting_sms.php';
const TEMPLATE_ID = 'ptm_schedule';

function formatMeetingDate(value) {
  if (!value) return { date: '', time: '' };
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return { date: String(value), time: '' };
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()}`,
    time: dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
  };
}

export async function loadParentMeetingSms(memberId, fields = {}, audit = {}) {
  const selectedCourses = Array.isArray(fields.search_course) ? fields.search_course : [];
  const courseOptions = await loadParentCourseOptions();
  const meetingName = String(fields.meeting_name || '').trim();
  const meetingDate = String(fields.meeting_date || '').trim();
  const { date, time } = formatMeetingDate(meetingDate);

  let recipients = [];
  if (fields.action === 'preview' && selectedCourses.length) {
    recipients = await loadParentRecipients(selectedCourses);
  }

  if (!audit.skipLog) {
    await logModulePage(PAGE, 'View', 'Successful', '', memberId, audit);
  }

  return {
    courseOptions,
    selectedCourses,
    meetingName,
    meetingDate,
    meetingDateFormatted: date,
    meetingTimeFormatted: time,
    recipients,
    recipientCount: recipients.length,
    mobiles: recipients.map((r) => r.mobile).join(','),
    templateId: TEMPLATE_ID,
  };
}

export async function saveParentMeetingSms(payload, memberId, audit = {}) {
  if (payload.action === 'preview') {
    return loadParentMeetingSms(memberId, payload, { ...audit, skipLog: true });
  }

  const selectedCourses = Array.isArray(payload.search_course) ? payload.search_course : [];
  const meetingName = String(payload.meeting_name || '').trim();
  const meetingDate = String(payload.meeting_date || '').trim();
  const { date, time } = formatMeetingDate(meetingDate);

  if (!meetingName || !meetingDate) {
    return { success: false, message: 'Meeting title and date/time are required.' };
  }

  const preview = await loadParentMeetingSms(
    memberId,
    { ...payload, action: 'preview', search_course: selectedCourses },
    { ...audit, skipLog: true },
  );

  const mobiles = payload.mobiles || preview.mobiles;
  const sampleMessage = `${meetingName} | ${date} | ${time}`;

  const result = await recordSmsSend({
    memberId,
    audit,
    registerNo: selectedCourses.join(', '),
    mobiles,
    messageType: 'Parent Meeting',
    message: sampleMessage,
    templateId: TEMPLATE_ID,
  });

  if (result.success) {
    await logModulePage(PAGE, 'Send SMS', 'Successful', String(result.sentCount), memberId, audit);
  }

  return {
    ...result,
    ...(await loadParentMeetingSms(memberId, {}, { ...audit, skipLog: true })),
  };
}
