import { logModulePage, auditFields as sharedAuditFields } from '../shared/moduleAudit.js';

export async function logWebSetup(memberId, audit, page, operation, status = 'success', description = '') {
  await logModulePage(page, operation, status, description, memberId, audit);
}

export function auditFields(memberId, audit = {}) {
  const ctx = sharedAuditFields(memberId, audit);
  return {
    ip: ctx.ip,
    by: memberId,
    memberId,
    create: ctx.create,
    update: ctx.update,
  };
}
