import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { formatDateDisplay, logLibrarySetup, toIsoDate } from '../setupAudit.js';

const PAGE = 'lib_attendance_report.php';

export async function loadAttReportSetup(memberId, fields = {}, audit = {}) {
  const fromDate = toIsoDate(fields.fromDate) || new Date().toISOString().slice(0, 10);
  const toDate = toIsoDate(fields.toDate) || fromDate;
  const source = String(fields.source || 'device');

  let rows = [];
  if (source === 'manual') {
    rows = await prisma.$queryRawUnsafe(
      `SELECT s_id, entry_date_time, entry_in_out FROM library_image_att_tb
       WHERE del = 1 AND DATE(entry_date_time) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'
       ORDER BY entry_date_time ASC LIMIT 1000`,
    );
    rows = rows.map((r) => ({
      id: r.s_id,
      date: formatDateDisplay(r.entry_date_time),
      time: new Date(r.entry_date_time).toTimeString().slice(0, 5),
      inOut: r.entry_in_out,
    }));
  } else {
    const att = await prisma.$queryRawUnsafe(
      `SELECT tktno, p_date, hh_mm, in_out FROM library_attendance
       WHERE DATE(p_date) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'
       ORDER BY p_date ASC LIMIT 1000`,
    );
    rows = att.map((r) => ({
      id: r.tktno,
      date: formatDateDisplay(r.p_date),
      time: r.hh_mm,
      inOut: r.in_out,
    }));
  }

  await logLibrarySetup(PAGE, 'View', 'Successful', `${fromDate}-${toDate}`, memberId, audit);
  return { fromDate, toDate, source, rows };
}

export async function saveAttReportSetup(payload, memberId, audit = {}) {
  return loadAttReportSetup(memberId, payload, audit);
}
