import { logModulePage } from '../shared/moduleAudit.js';
import {
  loadCourseSmsOptions,
  loadSmsTemplates,
  recordSmsSend,
  resolveCourseSlotMobiles,
} from './smsShared.js';

const PAGE = 'student_sms.php';

export async function loadStudentSms(memberId, fields = {}, audit = {}) {
  const selected = Array.isArray(fields.selectedCourses) ? fields.selectedCourses : [];
  const { options: courseOptions, groups: courseGroups } = await loadCourseSmsOptions();
  let mobiles = fields.mobiles || '';
  let mobileCount = 0;
  let mobileDetails = [];
  if (selected.length) {
    const resolved = await resolveCourseSlotMobiles(selected, 'mobile_no', { includeDetails: true });
    mobiles = resolved.mobiles;
    mobileCount = resolved.mobileCount;
    mobileDetails = resolved.mobileDetails;
  } else if (mobiles) {
    mobileCount = mobiles.split(',').map((m) => m.trim()).filter(Boolean).length;
  }

  await logModulePage(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    courseOptions,
    courseGroups,
    selectedCourses: selected,
    mobiles,
    mobileCount,
    mobileDetails,
    message: fields.message || '',
    templateId: fields.templateId || '',
    templates: await loadSmsTemplates(),
  };
}

export async function saveStudentSms(payload, memberId, audit = {}) {
  if (payload.action === 'preview') {
    return loadStudentSms(memberId, payload, { ...audit, skipLog: true });
  }

  const selected = Array.isArray(payload.selectedCourses) ? payload.selectedCourses : [];
  const preview = await loadStudentSms(memberId, { ...payload, selectedCourses: selected }, { ...audit, skipLog: true });
  const mobiles = payload.mobiles || preview.mobiles;
  const result = await recordSmsSend({
    memberId,
    audit,
    registerNo: selected.join(', '),
    mobiles,
    messageType: 'Student Announcement',
    message: payload.message,
    templateId: payload.templateId,
  });
  if (result.success) {
    await logModulePage(PAGE, 'Send SMS', 'Successful', String(result.sentCount), memberId, audit);
  }
  return { ...result, ...(await loadStudentSms(memberId, {}, { ...audit, skipLog: true })) };
}
