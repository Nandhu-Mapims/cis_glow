import { insertLog } from '../logService.js';
import { parseDisplayDate } from './feeHelpers.js';
import { loadCollectionSheet } from './feeSlipCollectionLoad.js';
import { saveCollectionSlip } from './feeSlipCollectionSave.js';

export async function loadStudentFeeCollectionSheet(payload, memberId) {
  const registerNo = String(payload.registerNo || '').trim();
  if (!registerNo) {
    return { error: 'registerNo is required' };
  }

  const paidDate = payload.paidDate ? parseDisplayDate(payload.paidDate) : new Date().toISOString().slice(0, 10);
  const result = await loadCollectionSheet(registerNo, paidDate);
  if (result.error) return result;

  await insertLog(
    ['student_fee_slip_new', 'View', 'Successful', registerNo, new Date(), '', '', memberId],
    '',
  );
  return result;
}

export async function saveStudentFeeSlip(payload, memberId, meta) {
  const result = await saveCollectionSlip(payload, memberId, meta);
  if (result.success) {
    await insertLog(
      ['student_fee_slip_new', 'Receipt Generate', 'Successful', payload.meta?.registerNo || '', new Date(), meta.ip, '', memberId],
      '',
    );
  }
  return result;
}
