import { prisma } from '../../../config/prisma.js';
import { auditFields, logHostelSetup } from '../setupAudit.js';

const PAGE = 'hostel_att_setup.php';
const CACHE_MS = 300_000;

let attSetupCache = null;
let attSetupCacheAt = 0;

function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 5);
  return d.toTimeString().slice(0, 5);
}

function mapAttSetupRow(row) {
  return {
    outFrom: formatTime(row?.out_from),
    outTo: formatTime(row?.out_to),
    inFrom: formatTime(row?.in_from),
    inTo: formatTime(row?.in_to),
    id: row?.id || null,
  };
}

export async function loadAttSetupSetup(memberId, _fields = {}, audit = {}) {
  if (attSetupCache && Date.now() - attSetupCacheAt < CACHE_MS) {
    logHostelSetup(PAGE, 'View', 'Successful', '', memberId, audit);
    return attSetupCache;
  }

  const row = await prisma.basic_setup_hostelatt.findFirst({ where: { del: 1 } });
  const result = mapAttSetupRow(row);
  attSetupCache = result;
  attSetupCacheAt = Date.now();
  logHostelSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return result;
}

export async function saveAttSetupSetup(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  const data = {
    out_from: new Date(`1970-01-01T${payload.outFrom || '00:00'}:00`),
    out_to: new Date(`1970-01-01T${payload.outTo || '00:00'}:00`),
    in_from: new Date(`1970-01-01T${payload.inFrom || '00:00'}:00`),
    in_to: new Date(`1970-01-01T${payload.inTo || '00:00'}:00`),
  };

  const existing = await prisma.basic_setup_hostelatt.findFirst({ where: { del: 1 } });
  if (existing) {
    await prisma.basic_setup_hostelatt.update({ where: { id: existing.id }, data: { ...data, ...update } });
  } else {
    await prisma.basic_setup_hostelatt.create({ data: { ...data, ...create } });
  }

  attSetupCache = null;
  attSetupCacheAt = 0;
  logHostelSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadAttSetupSetup(memberId, {}, { ...audit, skipLog: true })),
  };
}
