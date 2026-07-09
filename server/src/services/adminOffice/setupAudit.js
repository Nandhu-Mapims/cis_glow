import { insertLog } from '../logService.js';

export async function logAdminOfficeSetup(page, operation, status, description, memberId, audit = {}) {
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

export function toIsoDate(value) {
  if (!value) return '';
  const s = String(value);
  if (s.startsWith('0000-00-00')) return '';
  const d = value instanceof Date ? value : new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function parseDateTimeInput(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(normalized.length === 16 ? `${normalized}:00` : normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}
