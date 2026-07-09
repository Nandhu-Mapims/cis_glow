import { loadStudentSms, saveStudentSms } from './studentSms.js';
import { loadStaffSms, saveStaffSms } from './staffSms.js';
import { loadGroupSms, saveGroupSms } from './groupSms.js';
import { loadSmsTemplate, saveSmsTemplate } from './smsTemplate.js';
import { loadParentMeetingSms, saveParentMeetingSms } from './parentMeetingSms.js';
import { loadSmsHistory, saveSmsHistory } from './smsHistory.js';
import { loadSmsTemplateAdd, saveSmsTemplateAdd } from './smsTemplateAdd.js';
import { loadSmsTemplateEdit, saveSmsTemplateEdit } from './smsTemplateEdit.js';
import { loadSmsGroupAdd, saveSmsGroupAdd } from './smsGroupAdd.js';
import { loadSmsGroupEdit, saveSmsGroupEdit } from './smsGroupEdit.js';

const VALID_SCREENS = new Set([
  'student-sms',
  'staff-sms',
  'group-sms',
  'parent-meeting-sms',
  'sms-history',
  'sms-template',
  'sms-template-add',
  'sms-template-edit',
  'group-add',
  'group-edit',
]);

export const NATIVE_SCREENS = VALID_SCREENS;

const LOADERS = {
  'student-sms': (memberId, fields, _query, audit) => loadStudentSms(memberId, fields, audit),
  'staff-sms': (memberId, fields, _query, audit) => loadStaffSms(memberId, fields, audit),
  'group-sms': (memberId, fields, _query, audit) => loadGroupSms(memberId, fields, audit),
  'parent-meeting-sms': (memberId, fields, _query, audit) => loadParentMeetingSms(memberId, fields, audit),
  'sms-history': (memberId, fields, _query, audit) => loadSmsHistory(memberId, fields, audit),
  'sms-template': (memberId, fields, _query, audit) => loadSmsTemplate(memberId, fields, audit),
  'sms-template-add': (memberId, fields, _query, audit) => loadSmsTemplateAdd(memberId, fields, audit),
  'sms-template-edit': (memberId, fields, _query, audit) => loadSmsTemplateEdit(memberId, fields, audit),
  'group-add': (memberId, fields, _query, audit) => loadSmsGroupAdd(memberId, fields, audit),
  'group-edit': (memberId, fields, _query, audit) => loadSmsGroupEdit(memberId, fields, audit),
};

const SAVERS = {
  'student-sms': (fields, memberId, _files, audit) => saveStudentSms(fields, memberId, audit),
  'staff-sms': (fields, memberId, _files, audit) => saveStaffSms(fields, memberId, audit),
  'group-sms': (fields, memberId, _files, audit) => saveGroupSms(fields, memberId, audit),
  'parent-meeting-sms': (fields, memberId, _files, audit) => saveParentMeetingSms(fields, memberId, audit),
  'sms-history': (fields, memberId, _files, audit) => saveSmsHistory(fields, memberId, audit),
  'sms-template': (fields, memberId, _files, audit) => saveSmsTemplate(fields, memberId, audit),
  'sms-template-add': (fields, memberId, _files, audit) => saveSmsTemplateAdd(fields, memberId, audit),
  'sms-template-edit': (fields, memberId, _files, audit) => saveSmsTemplateEdit(fields, memberId, audit),
  'group-add': (fields, memberId, _files, audit) => saveSmsGroupAdd(fields, memberId, audit),
  'group-edit': (fields, memberId, _files, audit) => saveSmsGroupEdit(fields, memberId, audit),
};

export function assertSmsScreen(screen) {
  if (!VALID_SCREENS.has(screen)) {
    return { error: 'Unknown SMS screen' };
  }
  return null;
}

export async function loadSmsScreen(screen, fields, memberId, query = {}, audit = {}) {
  const invalid = assertSmsScreen(screen);
  if (invalid) return invalid;
  return LOADERS[screen](memberId, fields, query, audit);
}

export async function saveSmsScreen(screen, fields, memberId, files = [], audit = {}) {
  const invalid = assertSmsScreen(screen);
  if (invalid) return invalid;
  return SAVERS[screen](fields, memberId, files, audit);
}
