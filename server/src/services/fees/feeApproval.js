import { insertLog } from '../logService.js';
import { loadApprovalSheet } from './feeSlipApprovalLoad.js';
import { saveApprovalSlip } from './feeSlipApprovalSave.js';

export async function loadFeeSlipApproval(payload, memberId) {
  const result = await loadApprovalSheet(payload.groupId);
  if (result.error) return result;

  await insertLog(
    ['student_fee_add_new', 'View', 'Successful', payload.groupId || '', new Date(), '', '', memberId],
    '',
  );
  return result;
}

export async function approveFeeSlip(payload, memberId, meta) {
  const result = await saveApprovalSlip(payload, memberId, meta);
  if (result.success) {
    await insertLog(
      ['student_fee_add_new', 'Add', 'Successful', payload.groupId || '', new Date(), meta.ip, '', memberId],
      '',
    );
  }
  return result;
}
