import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { logCircularSetup, toIsoDate } from '../setupAudit.js';

function printLoader(page, audienceFor) {
  return async (memberId, fields = {}, audit = {}) => {
    const fromDate = toIsoDate(fields.fromDate) || new Date().toISOString().slice(0, 10);
    const toDate = toIsoDate(fields.toDate) || fromDate;

    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, title, s_title, c_date, description, c_attach, c_from, c_venue, a_for
       FROM circular_tb WHERE del = 1 AND c_status = 1 AND a_for = '${escapeSql(audienceFor)}'
       AND DATE(c_date) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'
       ORDER BY c_date DESC LIMIT 200`,
    );

    await logCircularSetup(page, 'View', 'Successful', `${fromDate}-${toDate}`, memberId, audit);
    return {
      fromDate,
      toDate,
      audienceFor,
      rows: rows.map((r) => ({
        id: r.id,
        title: r.title,
        subTitle: r.s_title,
        date: toIsoDate(r.c_date),
        description: r.description,
        attach: r.c_attach,
        circularFrom: r.c_from,
        venue: r.c_venue,
      })),
    };
  };
}

export const loadPrintStudentSetup = printLoader('circular_print_student.php', 'Student');
export const loadPrintStaffSetup = printLoader('circular_print_staff.php', 'Staff');
export const loadPrintDepartmentSetup = printLoader('circular_print_department.php', 'Department');

export async function savePrintStudentSetup(payload, memberId, audit = {}) {
  return loadPrintStudentSetup(memberId, payload, audit);
}
export async function savePrintStaffSetup(payload, memberId, audit = {}) {
  return loadPrintStaffSetup(memberId, payload, audit);
}
export async function savePrintDepartmentSetup(payload, memberId, audit = {}) {
  return loadPrintDepartmentSetup(memberId, payload, audit);
}
