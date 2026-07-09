import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { logHostelSetup, toIsoDate } from '../setupAudit.js';

const PAGE = 'hostel_attendance_report.php';

function defaultReportFromDate() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function defaultReportToDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function loadAttendanceReportSetup(memberId, fields = {}, audit = {}) {
  const fromDate = toIsoDate(fields.fromDate) || defaultReportFromDate();
  const toDate = toIsoDate(fields.toDate) || defaultReportToDate();
  const ticketNo = String(fields.ticketNo || '').trim();
  const search = fields.search === true || fields.search === 'true';

  let rows = [];
  if (search) {
    let sql = `SELECT tktno, p_date, hh_mm, in_out FROM hostel_att
      WHERE p_date >= '${escapeSql(fromDate)} 00:00:00'
      AND p_date < DATE_ADD('${escapeSql(toDate)}', INTERVAL 1 DAY)`;
    if (ticketNo) sql += ` AND tktno LIKE '%${escapeSql(ticketNo)}%'`;
    sql += ' ORDER BY p_date ASC LIMIT 1000';

    const result = await prisma.$queryRawUnsafe(sql);
    rows = result.map((r) => ({
      ticketNo: r.tktno,
      date: new Date(r.p_date).toISOString().slice(0, 10),
      time: r.hh_mm,
      inOut: r.in_out,
    }));
  }

  logHostelSetup(PAGE, search ? 'Generate' : 'View', 'Successful', `${fromDate}-${toDate}`, memberId, audit);
  return {
    fromDate,
    toDate,
    ticketNo,
    rows,
  };
}

export async function saveAttendanceReportSetup(payload, memberId, audit = {}) {
  return loadAttendanceReportSetup(memberId, { ...payload, search: true }, audit);
}
