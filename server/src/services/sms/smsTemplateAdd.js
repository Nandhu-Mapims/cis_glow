import { logModulePage } from '../shared/moduleAudit.js';
import { saveSmsTemplate } from './smsTemplate.js';

const PAGE = 'sms_template_add.php';

export async function loadSmsTemplateAdd(memberId, _fields = {}, audit = {}) {
  await logModulePage(PAGE, 'View', 'Successful', '', memberId, audit);
  return { form: { templateId: '', content: '', sample: '' } };
}

export async function saveSmsTemplateAdd(payload, memberId, audit = {}) {
  const result = await saveSmsTemplate(payload, memberId, audit);
  if (result.success) {
    await logModulePage(PAGE, 'Add', 'Successful', payload.templateId || '', memberId, audit);
  }
  return result;
}
