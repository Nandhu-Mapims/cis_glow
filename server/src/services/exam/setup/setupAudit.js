import { insertLog } from '../../logService.js';

export async function logExamSetup(page, operation, status, description, memberId, audit = {}) {
  if (audit.skipLog) return;
  await insertLog(
    [
      page,
      operation,
      status,
      String(description || '').slice(0, 500),
      new Date(),
      audit.ip || '',
      audit.userAgent || '',
      memberId,
    ],
    audit.sessionId || '',
  );
}

export function auditFields(memberId, audit = {}) {
  const now = new Date();
  const ip = String(audit.ip || '').slice(0, 15);
  return {
    now,
    ip,
    memberId,
    create: {
      created_dt: now,
      created_ip: ip,
      created_by: memberId,
      updated_dt: now,
      updated_ip: ip,
      updated_by: memberId,
      del: 1,
    },
    update: {
      updated_dt: now,
      updated_ip: ip,
      updated_by: memberId,
    },
  };
}
