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
    // Join key matches legacy dashboard_report.php's hostel_att pattern —
    // TRIM(LEADING '0' ...) because tktno / register_no may differ in leading zeros.
    let sql = `SELECT A.tktno, A.p_date, A.hh_mm, A.in_out, B.register_no, B.student_name, B.student_initial
      FROM hostel_att AS A
      LEFT JOIN student_profile_tb AS B
        ON TRIM(LEADING '0' FROM B.register_no) = TRIM(LEADING '0' FROM A.tktno) AND B.del = 1
      WHERE A.p_date >= '${escapeSql(fromDate)} 00:00:00'
      AND A.p_date < DATE_ADD('${escapeSql(toDate)}', INTERVAL 1 DAY)`;
    if (ticketNo) sql += ` AND A.tktno LIKE '%${escapeSql(ticketNo)}%'`;
    sql += ' ORDER BY A.p_date ASC LIMIT 1000';

    const result = await prisma.$queryRawUnsafe(sql);
    rows = result.map((r) => ({
      ticketNo: r.tktno,
      registerNo: r.register_no || '',
      studentName: r.student_name ? `${r.student_initial || ''} ${r.student_name}`.trim() : '',
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
