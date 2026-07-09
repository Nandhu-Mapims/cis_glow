import { logModulePage } from '../shared/moduleAudit.js';
import {
  loadSmsTemplates,
  loadStaffCategorySmsGroups,
  parseMobileList,
  recordSmsSend,
  resolveStaffCategoryMobiles,
} from './smsShared.js';

const PAGE = 'staff_sms.php';

export async function loadStaffSms(memberId, fields = {}, audit = {}) {
  const selectedGroups = Array.isArray(fields.selectedGroups) ? fields.selectedGroups.map(Number) : [];
  const groups = await loadStaffCategorySmsGroups();
  let mobiles = fields.mobiles || '';
  let mobileCount = 0;
  let mobileDetails = [];

  if (selectedGroups.length && !fields.mobiles) {
    const resolved = await resolveStaffCategoryMobiles(selectedGroups, { includeDetails: true });
    mobiles = resolved.mobiles;
    mobileCount = resolved.mobileCount;
    mobileDetails = resolved.mobileDetails;
  } else if (mobiles) {
    const list = parseMobileList(mobiles);
    mobiles = list.join(',');
    mobileCount = list.length;
    mobileDetails = list;
  }

  await logModulePage(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    groups,
    selectedGroups,
    mobiles,
    mobileCount,
    mobileDetails,
    message: fields.message || '',
    templateId: fields.templateId || '',
    templates: await loadSmsTemplates(),
  };
}

export async function saveStaffSms(payload, memberId, audit = {}) {
  if (payload.action === 'preview') {
    return loadStaffSms(memberId, payload, { ...audit, skipLog: true });
  }

  const selectedGroups = Array.isArray(payload.selectedGroups) ? payload.selectedGroups : [];
  const preview = await loadStaffSms(memberId, payload, { ...audit, skipLog: true });
  const result = await recordSmsSend({
    memberId,
    audit,
    registerNo: selectedGroups.join(', '),
    mobiles: payload.mobiles || preview.mobiles,
    messageType: 'Staff Announcement',
    message: payload.message,
    templateId: payload.templateId,
  });
  if (result.success) {
    await logModulePage(PAGE, 'Send SMS', 'Successful', String(result.sentCount), memberId, audit);
  }
  return { ...result, ...(await loadStaffSms(memberId, {}, { ...audit, skipLog: true })) };
}
