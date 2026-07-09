import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { logModulePage } from '../shared/moduleAudit.js';

const PAGE = 'student_sms_history.php';

function parseDateInput(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const match = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  const dt = new Date(str);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

async function loadSenderOptions() {
  const rows = await prisma.$queryRaw`
    SELECT B.member_id AS memberId, B.member_name AS memberName
    FROM web_account_setup AS B
    WHERE B.del = 1
      AND EXISTS (
        SELECT 1 FROM sms_message_tb AS A
        WHERE A.del = 1 AND A.created_by = B.member_id
        LIMIT 1
      )
    ORDER BY B.member_name ASC
    LIMIT 300
  `;
  return rows.map((row) => ({
    value: row.memberId,
    label: row.memberName || row.memberId,
  }));
}

function countMobiles(mobileField) {
  return String(mobileField || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean).length;
}

export async function loadSmsHistory(memberId, fields = {}, audit = {}) {
  const filters = {
    mobile: String(fields.roll_no || fields.mobile || '').trim(),
    userBy: String(fields.user_by || '').trim(),
    fromDate: parseDateInput(fields.from_date) || new Date().toISOString().slice(0, 10),
    toDate: parseDateInput(fields.to_date) || '',
  };

  const senders = await loadSenderOptions();
  let rows = [];

  if (fields.action === 'search' || fields.Submit === 'Search') {
    const conditions = ['del = 1', "mobile_no != ''"];
    if (filters.fromDate) {
      conditions.push(`DATE(created_dt) >= '${escapeSql(filters.fromDate)}'`);
    }
    if (filters.toDate) {
      conditions.push(`DATE(created_dt) <= '${escapeSql(filters.toDate)}'`);
    }
    if (filters.userBy) {
      conditions.push(`created_by = '${escapeSql(filters.userBy)}'`);
    }
    if (filters.mobile) {
      const parts = filters.mobile.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length) {
        const mobileClause = parts.map((p) => `mobile_no LIKE '%${escapeSql(p)}%'`).join(' OR ');
        conditions.push(`(${mobileClause})`);
      }
    }

    const sql = `
      SELECT id, message_type, mobile_no, sample_message, created_by, created_dt
      FROM sms_message_tb
      WHERE ${conditions.join(' AND ')}
      ORDER BY id ASC
    `;
    const rawRows = await prisma.$queryRawUnsafe(sql);
    const userCache = new Map(senders.map((s) => [s.value, s.label]));

    rows = rawRows.map((row, index) => ({
      sno: index + 1,
      id: row.id,
      sentAt: row.created_dt,
      messageType: row.message_type,
      mobiles: String(row.mobile_no || '').replace(/,\s*$/, ''),
      messageCount: countMobiles(row.mobile_no),
      sampleMessage: row.sample_message,
      createdBy: row.created_by,
      createdByName: userCache.get(row.created_by) || row.created_by || '—',
    }));
  }

  if (!audit.skipLog) {
    await logModulePage(PAGE, 'View', 'Successful', filters.mobile || 'form', memberId, audit);
  }

  return {
    filters,
    senders,
    rows,
  };
}

export async function saveSmsHistory(fields, memberId, audit = {}) {
  return loadSmsHistory(memberId, { ...fields, action: 'search' }, audit);
}
