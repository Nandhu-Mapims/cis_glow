import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { formatDateDisplay, logLibrarySetup, toIsoDate } from '../setupAudit.js';

const PAGE = 'library_attendance.php';

export async function loadAttendanceSetup(memberId, fields = {}, audit = {}) {
  const dateIso = toIsoDate(fields.date) || new Date().toISOString().slice(0, 10);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT tktno, hh_mm, in_out, p_date FROM library_attendance
     WHERE DATE(p_date) = '${escapeSql(dateIso)}' ORDER BY p_date ASC LIMIT 1000`,
  );

  const unique = new Set(rows.map((r) => r.tktno));
  await logLibrarySetup(PAGE, 'View', 'Successful', dateIso, memberId, audit);
  return {
    date: dateIso,
    totalVisitors: unique.size,
    totalPunches: rows.length,
    rows: rows.map((r) => ({
      ticketNo: r.tktno,
      time: r.hh_mm,
      inOut: r.in_out,
      date: formatDateDisplay(r.p_date),
    })),
  };
}

export async function saveAttendanceSetup(payload, memberId, audit = {}) {
  return loadAttendanceSetup(memberId, payload, audit);
}
