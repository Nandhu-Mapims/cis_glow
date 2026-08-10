import { insertLog } from '../logService.js';

export async function logLibrarySetup(page, operation, status, description, memberId, audit = {}) {
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
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function formatDateDisplay(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(isoDate, days) {
  const base = isoDate ? new Date(`${isoDate}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return todayIso();
  base.setDate(base.getDate() + (Number(days) || 0));
  return base.toISOString().slice(0, 10);
}
