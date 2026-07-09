import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { logAdminOfficeSetup, toIsoDate } from '../setupAudit.js';
import { loadDepartmentMap } from '../shared.js';

const PAGE = 'courier_report.php';

export async function loadCourierReportSetup(memberId, fields = {}, audit = {}) {
  const fromDate = toIsoDate(fields.fromDate) || new Date().toISOString().slice(0, 10);
  const toDate = toIsoDate(fields.toDate) || fromDate;
  const search = String(fields.search || '').trim();

  let sql = `
    SELECT id,
           CAST(courier_date AS CHAR) AS courier_date,
           courier_inout, category, courier_from, courier_to, c_type,
           courier_no, courier_company, h_name, h_designation,
           item_name, quantity, courier_receiver
    FROM courier_tb
    WHERE del=1 AND DATE(courier_date) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'`;
  if (search) {
    sql += ` AND (courier_inout LIKE '%${escapeSql(search)}%' OR courier_from LIKE '%${escapeSql(search)}%' OR courier_to LIKE '%${escapeSql(search)}%')`;
  }
  sql += ' ORDER BY courier_date DESC LIMIT 500';

  const rows = await prisma.$queryRawUnsafe(sql);
  const deptMap = await loadDepartmentMap();

  await logAdminOfficeSetup(PAGE, 'View', 'Successful', `${fromDate}-${toDate}`, memberId, audit);
  return {
    fromDate,
    toDate,
    search,
    rows: rows.map((r) => ({
      id: r.id,
      date: String(r.courier_date || '').slice(0, 16).replace('T', ' '),
      inout: r.courier_inout,
      department: deptMap[String(r.category)] || r.category,
      fromName: r.courier_from,
      toName: r.courier_to,
      type: r.c_type,
      courierNo: r.courier_no,
      courierCompany: r.courier_company,
      hName: r.h_name,
      hDesignation: r.h_designation,
      itemName: r.item_name,
      quantity: r.quantity,
      receiver: r.courier_receiver,
    })),
  };
}

export async function saveCourierReportSetup(payload, memberId, audit = {}) {
  return loadCourierReportSetup(memberId, payload, audit);
}
