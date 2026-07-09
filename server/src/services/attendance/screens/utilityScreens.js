import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import {
  getAttendance,
  getLPTime,
  modifiedAttendance,
} from '../staffAttendanceCore.js';
import {
  formatDateDisplay,
  logStaffAttSetup,
  toIsoDate,
} from '../setupAudit.js';
import {
  htmlTable,
  loadStaffProfileByStaffId,
  parseDateRange,
} from '../staffAttendanceShared.js';

const PAGE = 'clear_icache.php';

function shouldGenerateReport(fields) {
  return Boolean(fields.Submit || fields.submit || fields.action === 'search' || fields.action === 'generate');
}

function dailyAttendanceTypeFilter(attType) {
  if (attType === 'NON Teaching') {
    return `AND (sub_category='Non Teaching' OR category='Administration')`;
  }
  if (attType === 'All') {
    return `AND (sub_category='Teaching' OR sub_category='Non Teaching')`;
  }
  return `AND sub_category='Teaching' AND category_name!='Administration'`;
}

async function dailyAttendanceJobCategorySql(attType) {
  const typeFilter = dailyAttendanceTypeFilter(attType);
  const catRows = await prisma.$queryRawUnsafe(
    `SELECT id FROM edu_setup_tb
     WHERE category='Category' AND del!=0 ${typeFilter}
     ORDER BY category_order ASC`,
  );
  if (!catRows.length) return ' AND 1=0';
  return ` AND (${catRows.map((row) => `A.job_category='${escapeSql(String(row.id))}'`).join(' OR ')})`;
}

async function buildDailyAttendanceRows(staffRows, currentDate) {
  const calRows = await prisma.$queryRawUnsafe(
    `SELECT academic_events, comments, academic_category FROM calendar_tb WHERE academic_date='${escapeSql(currentDate)}' AND del=1 LIMIT 1`,
  );
  const calendarRow = calRows[0] || null;

  const lpCache = new Map();
  const uniqueCategories = [...new Set(staffRows.map((s) => String(s.att_category || '1')))];
  await Promise.all(uniqueCategories.map(async (cat) => {
    lpCache.set(cat, await getLPTime(cat));
  }));

  const bodyRows = [];
  const rows = [];
  const batchSize = 8;
  for (let i = 0; i < staffRows.length; i += batchSize) {
    const batch = staffRows.slice(i, i + batchSize);
    const batchRows = await Promise.all(batch.map(async (s) => {
      const lp = lpCache.get(String(s.att_category || '1'));
      const att = await getAttendance(s.id, s.staff_id, currentDate, lp, 'actual', {
        calendarRow,
        jobCategory: s.job_category,
      });
      const flag = `${att.m || '-'}/${att.e || '-'}`;
      const row = {
        staffId: s.staff_id,
        name: `${s.staff_initial || ''} ${s.staff_name || ''}`.trim(),
        dept: s.dept_name || '',
        session: flag,
        inTime: att.frmtime || '',
        outTime: att.totime || '',
      };
      return [
        row.staffId,
        row.name,
        row.dept,
        row.session,
        row.inTime,
        row.outTime,
        row,
      ];
    }));
    for (const cells of batchRows) {
      bodyRows.push(cells.slice(0, 6));
      rows.push(cells[6]);
    }
  }
  return { bodyRows, rows };
}

export async function loadClearIcacheScreen(memberId, fields = {}, audit = {}) {
  await logStaffAttSetup(PAGE, 'View', 'Successful', fields.staff_id || '', memberId, audit);
  return {
    staff_id: fields.staff_id || '',
    message: fields.staff_id ? null : 'Enter a staff ID to refresh attendance cache.',
  };
}

export async function saveClearIcacheScreen(payload, memberId, audit = {}) {
  const staffId = String(payload.staff_id || '').trim();
  if (!staffId) return { success: false, message: 'Staff ID is required' };

  const profile = await loadStaffProfileByStaffId(staffId);
  if (!profile) return { success: false, message: 'Staff not found' };

  const payrollRows = await prisma.$queryRawUnsafe(
    `SELECT MAX(B.payroll_month) AS pm FROM staff_payroll_log AS A
     INNER JOIN staff_payroll_tb AS B ON A.payroll_month=B.payroll_month
     WHERE A.del=1 AND B.del=1 AND A.payroll_type='Salary' AND A.payroll_complete=1
       AND B.staff_id='${escapeSql(String(profile.id))}'`,
  );
  let fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 40);
  const payrollMonth = payrollRows[0]?.pm;
  if (payrollMonth && payrollMonth !== '0000-00-00') {
    const d = new Date(payrollMonth);
    d.setMonth(d.getMonth() + 1);
    fromDate = d;
  }

  const toDate = new Date();
  const latePermission = await getLPTime(profile.att_category);
  let daysRefreshed = 0;

  for (let m = fromDate.getTime(); m <= toDate.getTime(); m += 86400000) {
    const attDate = new Date(m).toISOString().slice(0, 10);
    const joined = profile.joined_date || '0000-00-00';
    const releaving = profile.releaving_date || '0000-00-00';
    if ((releaving === '' || new Date(releaving) > new Date(attDate))
      && (joined === '' || new Date(joined) <= new Date(attDate))) {
      await getAttendance(profile.id, profile.staff_id, attDate, latePermission);
      const s1 = await getAttendance(profile.id, profile.staff_id, attDate, latePermission);
      await modifiedAttendance(profile.id, profile.staff_id, attDate, latePermission, s1, 1);
      await modifiedAttendance(profile.id, profile.staff_id, attDate, latePermission, s1, 0);
      await getAttendance(profile.id, profile.staff_id, attDate, latePermission, 'actual');
      daysRefreshed += 1;
    }
  }

  await logStaffAttSetup(PAGE, 'Update', 'Successful', staffId, memberId, audit);
  return {
    success: true,
    message: `Cache refreshed for ${daysRefreshed} day(s).`,
    staff_id: staffId,
    daysRefreshed,
  };
}

export async function loadDailyAttendanceScreen(memberId, fields = {}, audit = {}) {
  const currentDate = toIsoDate(fields.current_date) || new Date().toISOString().slice(0, 10);
  const attType = fields.att_type || 'Teaching';
  let title = 'Teaching';
  if (attType === 'NON Teaching') title = 'Non Teaching';
  else if (attType === 'All') title = 'All';

  let bodyRows = [];
  let rows = [];
  if (shouldGenerateReport(fields)) {
    const jobCategorySql = await dailyAttendanceJobCategorySql(attType);
    const staffRows = await prisma.$queryRawUnsafe(
      `SELECT A.id, A.staff_id, A.staff_name, A.staff_initial, A.att_category, A.job_category,
              B.category_name, C.name AS dept_name
       FROM staff_profile_tb AS A
       INNER JOIN edu_setup_tb AS B ON A.job_category=B.id
       LEFT JOIN staff_designation_tb AS D ON D.staff_id=A.id AND D.del=1
       LEFT JOIN staff_dept_master AS C ON C.id=D.department
       WHERE A.del=1
         AND (CAST(A.releaving_date AS CHAR) > '${escapeSql(currentDate)}'
           OR A.releaving_date='0000-00-00'
           OR CAST(A.releaving_date AS CHAR)='')
         ${jobCategorySql}
       ORDER BY C.d_order ASC, A.staff_id ASC LIMIT ${audit.skipLog ? 10 : 500}`,
    );
    const built = await buildDailyAttendanceRows(staffRows, currentDate);
    bodyRows = built.bodyRows;
    rows = built.rows;
  }

  await logStaffAttSetup('staff_daily_attendance.php', fields.Submit ? 'Generate' : 'View', 'Successful', currentDate, memberId, audit);
  return {
    current_date: formatDateDisplay(currentDate),
    current_date_iso: currentDate,
    att_type: attType,
    rows,
    reportHtml: bodyRows.length
      ? htmlTable(['Staff ID', 'Name', 'Dept', 'FN/AN', 'In', 'Out'], bodyRows)
      : '',
    infoMessage: shouldGenerateReport(fields)
      ? (bodyRows.length ? null : 'No staff found for the selected filters.')
      : 'Select date and staff type, then click Generate.',
    title: bodyRows.length ? `${title} Staff Attendance — ${formatDateDisplay(currentDate)}` : '',
    rowCount: bodyRows.length,
    generating: false,
  };
}

export async function loadBiometricReportScreen(memberId, fields = {}, audit = {}) {
  const staffId = String(fields.roll_no || fields.staff_id || '').trim();
  const fromDate = toIsoDate(fields.from_date) || new Date().toISOString().slice(0, 10);
  const toDate = toIsoDate(fields.to_date) || fromDate;
  const machineId = fields.machine_id || '';

  if (!staffId) {
    await logStaffAttSetup('biomertic_att.php', 'View', 'Successful', '', memberId, audit);
    return { staff_id: '', from_date: formatDateDisplay(fromDate), to_date: formatDateDisplay(toDate), rows: [], reportHtml: '' };
  }

  const year = new Date(fromDate).getFullYear();
  const quarter = Math.ceil((new Date(fromDate).getMonth() + 1) / 4);
  const tbl = `punchtimedetails_${year}${quarter}`;
  const sid = escapeSql(staffId);
  const sid0 = escapeSql(`0${staffId}`);
  let flagFilter = '';
  if (machineId) flagFilter = ` AND flag='${escapeSql(String(machineId))}'`;

  const rows = await prisma.$queryRawUnsafe(
    `SELECT tktno, CAST(p_date AS CHAR) AS p_date, flag, hh_mm
     FROM ${tbl}
     WHERE DATE(p_date) BETWEEN '${escapeSql(fromDate)}' AND '${escapeSql(toDate)}'
       AND (tktno='${sid}' OR tktno='${sid0}')${flagFilter}
     ORDER BY p_date ASC LIMIT 2000`,
  ).catch(() => []);

  const bodyRows = rows.map((r) => [r.tktno, r.p_date, r.hh_mm || '', r.flag || '']);
  await logStaffAttSetup('biomertic_att.php', fields.Submit ? 'Generate' : 'View', 'Successful', staffId, memberId, audit);
  return {
    staff_id: staffId,
    from_date: formatDateDisplay(fromDate),
    to_date: formatDateDisplay(toDate),
    machine_id: machineId,
    rows,
    reportHtml: htmlTable(['Ticket', 'Date/Time', 'Time', 'Machine'], bodyRows),
  };
}
