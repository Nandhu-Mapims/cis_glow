import { logModulePage } from '../shared/moduleAudit.js';
import { loadSmsTemplates, loadStaffSmsGroups, parseMobileList, recordSmsSend } from './smsShared.js';

const PAGE = 'group_sms.php';

export async function loadGroupSms(memberId, fields = {}, audit = {}) {
  const selectedGroups = Array.isArray(fields.selectedGroups) ? fields.selectedGroups.map(Number) : [];
  const groups = await loadStaffSmsGroups();
  let mobiles = fields.mobiles || '';
  if (selectedGroups.length && !fields.mobiles) {
    const all = [];
    for (const group of groups.filter((g) => selectedGroups.includes(g.id))) {
      all.push(...parseMobileList(group.mobiles));
    }
    mobiles = [...new Set(all)].join(',');
  } else if (mobiles) {
    mobiles = parseMobileList(mobiles).join(',');
  }

  await logModulePage(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    groups,
    selectedGroups,
    mobiles,
    mobileCount: parseMobileList(mobiles).length,
    message: fields.message || '',
    templateId: fields.templateId || '',
    templates: await loadSmsTemplates(),
  };
}

export async function saveGroupSms(payload, memberId, audit = {}) {
  if (payload.action === 'preview') {
    return loadGroupSms(memberId, payload, { ...audit, skipLog: true });
  }

  const selectedGroups = Array.isArray(payload.selectedGroups) ? payload.selectedGroups : [];
  const preview = await loadGroupSms(memberId, payload, { ...audit, skipLog: true });
  const result = await recordSmsSend({
    memberId,
    audit,
    registerNo: selectedGroups.join(', '),
    mobiles: payload.mobiles || preview.mobiles,
    messageType: 'Announcement',
    message: payload.message,
    templateId: payload.templateId,
  });
  if (result.success) {
    await logModulePage(PAGE, 'Send SMS', 'Successful', String(result.sentCount), memberId, audit);
  }
  return { ...result, ...(await loadGroupSms(memberId, {}, { ...audit, skipLog: true })) };
}
