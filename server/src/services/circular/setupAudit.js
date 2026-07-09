import path from 'path';
import fs from 'fs/promises';
import { config } from '../../config/index.js';
import { insertLog } from '../logService.js';

export async function logCircularSetup(page, operation, status, description, memberId, audit = {}) {
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

export async function saveCircularAttachment(file) {
  if (!file?.dataBase64 || !file?.filename) return '';
  const ext = path.extname(file.filename).toLowerCase();
  const allowed = ['.pdf', '.jpeg', '.jpg', '.gif', '.png'];
  if (!allowed.includes(ext)) {
    return { error: 'Please upload PNG, JPEG, GIF, or PDF formats.' };
  }
  const buf = Buffer.from(file.dataBase64, 'base64');
  if (buf.length > 2 * 1024 * 1024) {
    return { error: 'Image size must be less than 2 MB.' };
  }
  const random = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const newName = `${random}${path.basename(file.filename)}`;
  const dir = path.join(config.legacyFilesPath, 'circular');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, newName), buf);
  return newName;
}
