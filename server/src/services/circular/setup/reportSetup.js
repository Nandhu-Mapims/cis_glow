import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { logCircularSetup, toIsoDate } from '../setupAudit.js';

const PAGE = 'circular_report.php';

export async function loadCircularReportSetup(memberId, fields = {}, audit = {}) {
  const fromDate = toIsoDate(fields.fromDate) || new Date().toISOString().slice(0, 10);
  const toDate = toIsoDate(fields.toDate) || fromDate;
  const audience = String(fields.audienceFor || '').trim();
  const status = fields.status === '' || fields.status === undefined ? '' : String(fields.status);

  let sql = `SELECT id, title, s_title, c_date, to_date, a_for, c_status, c_from FROM circular_tb
    WHERE del = 1 AND DATE(c_date) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'`;
  if (audience) sql += ` AND a_for = '${escapeSql(audience)}'`;
  if (status !== '') sql += ` AND c_status = '${escapeSql(status)}'`;
  sql += ' ORDER BY c_date DESC LIMIT 500';

  const rows = await prisma.$queryRawUnsafe(sql);
  await logCircularSetup(PAGE, 'View', 'Successful', `${fromDate}-${toDate}`, memberId, audit);
  return {
    fromDate,
    toDate,
    audienceFor: audience,
    status,
    rows: rows.map((r) => ({
      id: r.id,
      title: r.title,
      subTitle: r.s_title,
      fromDate: toIsoDate(r.c_date),
      toDate: toIsoDate(r.to_date),
      audienceFor: r.a_for,
      status: r.c_status,
      circularFrom: r.c_from,
    })),
  };
}

export async function saveCircularReportSetup(payload, memberId, audit = {}) {
  return loadCircularReportSetup(memberId, payload, audit);
}
