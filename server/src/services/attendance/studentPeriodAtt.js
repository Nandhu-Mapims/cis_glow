import { prisma } from '../../config/prisma.js';
import { escapeSql, sqlDateOrNull } from '../../utils/sqlSafe.js';
import { auditFields, toIsoDate } from './setupAudit.js';
import { isWorkingDay, loadHolidayDates, logStudentAtt, PERIOD_IN_OUT } from './studentAttendanceShared.js';

const TABLE_MAP = {
  pg: 'student_pgatt_tb',
  intern: 'student_iatt_tb',
};

export async function loadPeriodAttendance(kind, payload, memberId, audit, legacyPage) {
  const table = TABLE_MAP[kind];
  if (!table) return { error: 'Unknown attendance type' };

  const holidays = await loadHolidayDates();
  const attendanceDate = String(payload.attendance_date || payload.attendanceDate || '').trim();
  if (!attendanceDate) {
    await logStudentAtt(legacyPage, 'View', 'Successful', '', memberId, audit);
    return { holidays, entries: [], attendanceDate: '' };
  }

  const isoDate = toIsoDate(attendanceDate);
  if (!isoDate) {
    return { holidays, entries: [], attendanceDate, message: 'Invalid date' };
  }

  const today = new Date().toISOString().slice(0, 10);
  if (isoDate > today) {
    return { holidays, entries: [], attendanceDate: isoDate, message: 'Selected date is greater than current date' };
  }

  const dayCheck = await isWorkingDay(attendanceDate);
  if (!dayCheck.ok) {
    const suffix = dayCheck.comments ? ` - ${dayCheck.comments}` : '';
    const message = dayCheck.error
      || (dayCheck.event?.startsWith('Holiday')
        ? `Selected date is ${dayCheck.event}${suffix}`
        : `Selected date is not available (${dayCheck.event || 'holiday'})`);
    return { holidays, entries: [], attendanceDate: isoDate, message };
  }

  const d = sqlDateOrNull(isoDate);
  const entries = [];
  for (const { period, periodLabel } of PERIOD_IN_OUT) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT att_present, att_absent FROM ${table}
       WHERE del=1 AND academic_date='${d}' AND att_period='${escapeSql(period)}' LIMIT 1`,
    );
    entries.push({
      period,
      periodLabel,
      presentList: rows[0]?.att_present ? String(rows[0].att_present) : '',
      absentList: rows[0]?.att_absent ? String(rows[0].att_absent) : '',
      hasExistingRecord: rows.length > 0,
    });
  }

  await logStudentAtt(legacyPage, 'View', 'Successful', attendanceDate, memberId, audit);
  return { holidays, entries, attendanceDate: isoDate, event: dayCheck.event };
}

export async function savePeriodAttendance(kind, payload, memberId, meta, legacyPage) {
  const table = TABLE_MAP[kind];
  const attendanceDate = String(payload.attendance_date || payload.attendanceDate || '').trim();
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  if (!attendanceDate || !entries.length) return { error: 'attendanceDate and entries are required' };

  const d = sqlDateOrNull(toIsoDate(attendanceDate));
  const { create, update } = auditFields(memberId, meta);

  await prisma.$executeRawUnsafe(
    `UPDATE ${table} SET del=0, updated_dt=NOW(), updated_ip='${escapeSql(update.updated_ip)}',
     updated_by='${escapeSql(memberId)}' WHERE del=1 AND academic_date='${d}'`,
  );

  for (const entry of entries) {
    const period = escapeSql(entry.period || '');
    const present = escapeSql(String(entry.presentList || entry.present || '').toUpperCase());
    const absent = escapeSql(String(entry.absentList || entry.absent || '').toUpperCase());
    if (!period) continue;

    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM ${table} WHERE del=0 AND academic_date='${d}' AND att_period='${period}' ORDER BY id DESC LIMIT 1`,
    );
    const attId = existing[0]?.id;

    if (attId) {
      await prisma.$executeRawUnsafe(
        `UPDATE ${table} SET att_present='${present}', att_absent='${absent}', del=1,
         updated_dt=NOW(), updated_ip='${escapeSql(update.updated_ip)}', updated_by='${escapeSql(memberId)}'
         WHERE id=${Number(attId)}`,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO ${table} (academic_date, att_period, att_present, att_absent, del, created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by)
         VALUES ('${d}', '${period}', '${present}', '${absent}', 1, NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}', NOW(), '${escapeSql(update.updated_ip)}', '${escapeSql(memberId)}')`,
      );
    }
  }

  await logStudentAtt(legacyPage, 'Update', 'Successful', attendanceDate, memberId, meta);
  return {
    success: true,
    message: 'Attendance updated',
    ...(await loadPeriodAttendance(kind, { attendanceDate }, memberId, { ...meta, skipLog: true }, legacyPage)),
  };
}
