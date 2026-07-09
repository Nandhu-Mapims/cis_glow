import { insertLog } from '../logService.js';

export async function logStaffAttSetup(page, operation, status, description, memberId, audit = {}) {
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
  if (/^\d{2}-\d{2}-\d{4}$/.test(String(value))) {
    const [dd, mm, yyyy] = String(value).split('-');
    return `${yyyy}-${mm}-${dd}`;
  }
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

export function zeroDateSql(col) {
  return `IF(${col}='0000-00-00' OR ${col} IS NULL, '', CAST(${col} AS CHAR))`;
}
