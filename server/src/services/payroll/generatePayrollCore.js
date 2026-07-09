import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import {
  callAttendanceFlag,
  calDefaulterPending,
  getAttendance,
  getLPTime,
  modifiedAttendance,
} from '../attendance/staffAttendanceCore.js';
import { logPayrollPage } from './payrollHelpers.js';
import {
  loadCategoryGeneratedFlags,
  loadJobCategoryOptions,
  loadOpenPayrollMonthOptions,
  parsePayrollMonthRef,
  resolveStaffForGenerate,
  staffDisplayName,
} from './payrollShared.js';

const PAGE = 'generate_payroll.php';

const GENERATE_PAYROLL_PROFILE_SELECT = `
  id, staff_id, staff_name, staff_initial, staff_title, att_category,
  CAST(joined_date AS CHAR) AS joined_date,
  CAST(releaving_date AS CHAR) AS releaving_date`;

function parseLocalYmd(ymd) {
  const [y, m, d] = String(ymd || '').slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatLocalYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function payrollMonthToEpoch(monthSql) {
  if (!monthSql) return 0;
  return Math.floor(parseLocalYmd(monthSql).getTime() / 1000);
}

function epochToPayrollMonth(sec) {
  return formatLocalYmd(new Date(Number(sec) * 1000));
}

function computePayrollPeriod(payrollMonthRef, payrollStart) {
  const ref = parseLocalYmd(payrollMonthRef);
  const startDay = Number(payrollStart || '01') || 1;
  let y = ref.getFullYear();
  let m = ref.getMonth() + 1;
  if (ref.getDate() < startDay) {
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }
  const clMonth = `${y}-${String(m).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
  const lastDay = new Date(y, m, 0);
  const toDate = formatLocalYmd(lastDay);
  const fromDateObj = parseLocalYmd(clMonth);
  const toDateObj = parseLocalYmd(toDate);
  return {
    fromDate: clMonth,
    toDate,
    fromTs: Math.floor(fromDateObj.getTime() / 1000),
    toTs: Math.floor(toDateObj.getTime() / 1000),
  };
}

async function computeStaffMonthAttendance(profile, payrollMonthRef) {
  const sId = String(profile.id);
  const staffId = profile.staff_id;
  const attCategory = profile.att_category;
  const joinedDate = String(profile.joined_date || '').slice(0, 10);
  const releavingDate = String(profile.releaving_date || '').slice(0, 10);

  const latePermission = await getLPTime(attCategory);
  const period = computePayrollPeriod(payrollMonthRef, latePermission.payroll_start);

  let lopList = { m: [], e: [] };
  if (String(latePermission.o?.day_type) !== '1') {
    lopList = await calDefaulterPending(
      sId, staffId, latePermission, period.fromDate, period.toDate, 1,
    );
  }

  let totalDays = 0;
  let workingDays = 0;
  let present = 0;
  let leave = 0;
  let absent = 0;
  let permission = 0;
  let late = 0;
  let totalCl = 0;
  let totalEl = 0;
  let totalOd = 0;

  const finalAttStatement = { att: {}, cmd: {} };
  const joinedSec = joinedDate && !joinedDate.startsWith('0000') ? Math.floor(parseLocalYmd(joinedDate).getTime() / 1000) : null;
  const relievedSec = releavingDate && !releavingDate.startsWith('0000') ? Math.floor(parseLocalYmd(releavingDate).getTime() / 1000) : null;

  for (let m = period.fromTs; m <= period.toTs; m += 86400) {
    const attCurrent = formatLocalYmd(new Date(m * 1000));
    totalDays += 1;

    const joinedOk = joinedSec === null || m >= joinedSec;
    const relievedOk = relievedSec === null || m <= relievedSec;

    if (joinedOk && relievedOk) {
      let attendanceStatus1 = await getAttendance(sId, staffId, attCurrent, latePermission);
      if (String(attendanceStatus1.s || '').toLowerCase() === 'h') {
        attendanceStatus1.m = 'h';
        attendanceStatus1.e = 'h';
      }
      const attendanceStatus = await modifiedAttendance(
        sId, staffId, attCurrent, latePermission, attendanceStatus1, 1,
      );

      const isHoliday = String(attendanceStatus1.s || '').toLowerCase() === 'h';

      let acmd = '';
      if (!isHoliday && lopList.m?.includes(m) && lopList.e?.includes(m)) acmd = 'Ab';
      else if (!isHoliday && lopList.m?.includes(m)) acmd = '<span style="FN:Ab';
      else if (!isHoliday && lopList.e?.includes(m)) acmd = 'AN:Ab';

      if (!isHoliday && lopList.m?.includes(m)) {
        attendanceStatus.m = 'a';
        absent += 0.5;
        workingDays += 0.5;
      } else {
        if (attendanceStatus.m === 'p') present += 0.5;
        if (attendanceStatus.m === 'le') { leave += 0.5; present += 0.5; }
        if (attendanceStatus.m === 'a') absent += 0.5;
        if (attendanceStatus.m === 'la') { late += 1; present += 0.5; }
        if (attendanceStatus.m === 'pe') { permission += 1; present += 0.5; }
        if (attendanceStatus.m === 'le' && attendanceStatus.attopt?.m === 'cl') totalCl += 0.5;
        else if (attendanceStatus.m === 'le' && attendanceStatus.attopt?.m === 'el') totalEl += 0.5;
        else if (attendanceStatus.m === 'p' && attendanceStatus.attopt?.m === 'od') totalOd += 0.5;
        if (String(attendanceStatus.m).toLowerCase() !== 'h') workingDays += 0.5;
      }

      if (!isHoliday && lopList.e?.includes(m)) {
        attendanceStatus.e = 'a';
        absent += 0.5;
        workingDays += 0.5;
      } else {
        if (attendanceStatus.e === 'p') present += 0.5;
        if (attendanceStatus.e === 'le') { leave += 0.5; present += 0.5; }
        if (attendanceStatus.e === 'a') absent += 0.5;
        if (attendanceStatus.e === 'la') { late += 1; present += 0.5; }
        if (attendanceStatus.e === 'pe') { permission += 1; present += 0.5; }
        if (attendanceStatus.e === 'le' && attendanceStatus.attopt?.e === 'cl') totalCl += 0.5;
        else if (attendanceStatus.e === 'le' && attendanceStatus.attopt?.e === 'el') totalEl += 0.5;
        else if (attendanceStatus.e === 'p' && attendanceStatus.attopt?.e === 'od') totalOd += 0.5;
        if (String(attendanceStatus.e).toLowerCase() !== 'h') workingDays += 0.5;
      }

      permission += Number(attendanceStatus.pe) || 0;

      let attStatus = callAttendanceFlag(attendanceStatus.m, attendanceStatus.e);
      if (attStatus === '-' && String(attendanceStatus.s || '').toLowerCase() === 'h') attStatus = 'H';
      else if (String(attStatus).toLowerCase() === 'h') attStatus = 'H';

      finalAttStatement.att[attCurrent] = attStatus;
      finalAttStatement.cmd[attCurrent] = acmd;
    }
  }

  const o = latePermission.o || {};
  let monthlyLop = absent;
  let monthlyPermission = permission;

  if (Number(o.minimum_late) !== 0 && late > Number(o.minimum_late)) {
    const totalLate = late - Number(o.minimum_late);
    let monthlyLateCount = o.l_lop_type === 'each'
      ? Math.floor(totalLate / Number(o.minimum_late))
      : totalLate;
    monthlyLateCount *= Number(o.l_lop) || 0;
    if (o.late_deduct === 'permission') monthlyPermission += monthlyLateCount;
    else monthlyLop += monthlyLateCount;
  }

  if (Number(o.minimum_permission) !== 0 && monthlyPermission > Number(o.minimum_permission)) {
    const totalPerm = monthlyPermission - Number(o.minimum_permission);
    const monthlyPermCount = o.p_lop_type === 'each'
      ? Math.floor(totalPerm / Number(o.minimum_permission))
      : totalPerm;
    monthlyLop += monthlyPermCount * (Number(o.p_lop) || 0);
  }

  const perAttend = workingDays > 0 ? Math.round((present / workingDays) * 100) : 0;
  let scheduledDays = totalDays;
  if (String(o.day_type) === '1') scheduledDays = Number(o.day_count) || totalDays;

  finalAttStatement.total_days = totalDays;
  finalAttStatement.working_days = workingDays;
  finalAttStatement.present_days = present;
  finalAttStatement.leave_days = leave;
  finalAttStatement.absent_days = absent;
  finalAttStatement.late_days = late;
  finalAttStatement.permission_days = permission;
  finalAttStatement.lop_days = monthlyLop;
  finalAttStatement.att_present = perAttend;
  finalAttStatement.tot_cl = totalCl;
  finalAttStatement.tot_el = totalEl;
  finalAttStatement.tot_od = totalOd;
  finalAttStatement.ava_cl = 0;
  finalAttStatement.ava_el = 0;
  finalAttStatement.ava_od = 0;

  return {
    totalDays,
    scheduledDays,
    workingDays,
    present,
    late,
    permission,
    leave,
    absent,
    lop: monthlyLop,
    percent: perAttend,
    attStatement: finalAttStatement,
    fromDate: period.fromDate,
    toDate: period.toDate,
    fromTs: period.fromTs,
    toTs: period.toTs,
  };
}

function buildAttendanceRow(counter, staffCode, name, stats, period) {
  const fromLabel = new Date(period.fromTs * 1000).toLocaleDateString('en-GB');
  const toLabel = new Date(period.toTs * 1000).toLocaleDateString('en-GB');
  return `<tr>
<td>${counter}</td>
<td>${staffCode}</td>
<td nowrap>${name}</td>
<td nowrap>${fromLabel} to ${toLabel}</td>
<td>${stats.totalDays}</td>
<td>${stats.workingDays}</td>
<td>${stats.present}</td>
<td>${stats.leave}</td>
<td>${stats.absent}</td>
<td>${stats.late}</td>
<td>${stats.permission}</td>
<td>${stats.lop}</td>
<td>${stats.percent}</td>
</tr>`;
}

export async function loadGeneratePayroll(memberId, fields = {}, audit = {}) {
  const monthOptions = await loadOpenPayrollMonthOptions(true);
  const payrollMonthRaw = String(fields.payroll_month || '').trim();
  const payrollMonthSql = parsePayrollMonthRef(payrollMonthRaw)
    || monthOptions.find((m) => m.value === payrollMonthRaw)?.monthSql
    || '';

  const searchCategory = Array.isArray(fields.search_category)
    ? fields.search_category.map(String)
    : (fields.search_category ? [String(fields.search_category)] : []);

  const categoryOptions = await loadJobCategoryOptions(payrollMonthSql, searchCategory);
  const generatedFlags = payrollMonthSql
    ? await loadCategoryGeneratedFlags(payrollMonthSql, categoryOptions.map((c) => c.value))
    : {};

  const isGenerate = fields.Submit === 'Generate';
  let staff = [];
  if (isGenerate && payrollMonthSql && searchCategory.length) {
    staff = await resolveStaffForGenerate(
      payrollMonthSql,
      searchCategory,
      String(fields.g_staff_list || ''),
    );
    await logPayrollPage(
      PAGE,
      'Generate',
      `${searchCategory.join(',')} __ ${payrollMonthSql}`,
      memberId,
      audit,
    );
  } else {
    await logPayrollPage(PAGE, 'View', payrollMonthSql, memberId, audit);
  }

  return {
    monthOptions,
    categoryOptions: categoryOptions.map((c) => ({
      ...c,
      generated: Boolean(generatedFlags[c.value]),
    })),
    selected: {
      payrollMonth: payrollMonthRaw,
      payrollMonthSql,
      pmonthEpoch: payrollMonthToEpoch(payrollMonthSql),
      searchCategory,
      gStaffList: String(fields.g_staff_list || ''),
    },
    staff,
    canGenerate: Boolean(payrollMonthSql && searchCategory.length),
  };
}

export async function runGeneratePayrollMore(memberId, query = {}, audit = {}) {
  const flag = Number(query.flag) || 0;

  if (flag === 2) {
    const pmonth = Number(query.pmonth);
    const categories = String(query.s_cate || '').split(',').filter(Boolean);
    if (!pmonth || !categories.length) return { error: 'pmonth and s_cate required' };

    const payrollMonthRef = epochToPayrollMonth(pmonth);
    for (const payrollType of categories) {
      const typeSql = escapeSql(payrollType.trim());
      const existing = await prisma.$queryRawUnsafe(
        `SELECT id FROM staff_payroll_log
         WHERE del = 1 AND payroll_month = '${escapeSql(payrollMonthRef)}'
           AND payroll_type = '${typeSql}' LIMIT 1`,
      );
      if (!existing[0]?.id) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO staff_payroll_log
           (payroll_type, payroll_month, payroll_complete, generated_by, generated_on, generated_ip, updated_dt, updated_ip, updated_by, del)
           VALUES ('${typeSql}', '${escapeSql(payrollMonthRef)}', 0, '${escapeSql(memberId)}', NOW(), '', NOW(), '', '${escapeSql(memberId)}', 1)`,
        );
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE staff_payroll_log SET
           generated_by='${escapeSql(memberId)}', generated_on=NOW(),
           updated_dt=NOW(), updated_by='${escapeSql(memberId)}'
           WHERE id='${existing[0].id}'`,
        );
      }
    }
    return { body: JSON.stringify([1]) };
  }

  if (flag !== 1) return { error: 'Invalid flag' };

  const staffInternalId = String(query.s_staff || '').trim();
  const pmonth = Number(query.pmonth);
  const counter = Number(query.id) + 1;
  if (!staffInternalId || !pmonth) return { error: 's_staff and pmonth required' };

  const payrollMonthRef = epochToPayrollMonth(pmonth);

  const profileRows = await prisma.$queryRawUnsafe(
    `SELECT ${GENERATE_PAYROLL_PROFILE_SELECT}
     FROM staff_profile_tb WHERE del = 1 AND id = '${escapeSql(staffInternalId)}' LIMIT 1`,
  );
  const profile = profileRows[0];
  if (!profile) return { body: JSON.stringify(['']) };

  const stats = await computeStaffMonthAttendance(profile, payrollMonthRef);
  const name = staffDisplayName(profile);
  const attJson = JSON.stringify(stats.attStatement).replace(/'/g, "''");
  const sid = String(profile.id);

  const existing = await prisma.$queryRawUnsafe(
    `SELECT id FROM staff_payroll_tb WHERE del = 1 AND staff_id = '${escapeSql(sid)}'
       AND payroll_month = '${escapeSql(payrollMonthRef)}' LIMIT 1`,
  );

  if (!existing[0]?.id) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO staff_payroll_tb
       (staff_id, payroll_month, total_days, scheduled_days, working_days,
        a_present, a_late, a_permission, a_leave, a_absent, a_llp,
        designation, f_llp, join_releave, casual_leave,
        basic_pay, basic_margin, d_allowance, hra_allowance, m_allowance, c_allowance,
        total_amount, lop_amount, arrear_id, arrear_amount, gross_pay,
        pf_calculate, pf_amount, esi_calculate, esi_amount,
        advance_id, advance_amount, loan_id, loan_amount, other_deduction,
        room_id, rental_amount, m_room_id, hostel_amount, h_room_id, h_rental_amount,
        tds_amount, prof_tax, total_deduction, net_pay,
        pay_bank, pay_type,
        p_from_date, p_to_date, att_statement,
        sdeposit_id, security_deposit, transport_deduction, sdeposit_refund,
        created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del)
       VALUES ('${escapeSql(sid)}', '${escapeSql(payrollMonthRef)}',
         '${stats.totalDays}', '${stats.scheduledDays}', '${stats.workingDays}',
         '${stats.present}', '${stats.late}', '${stats.permission}', '${stats.leave}',
         '${stats.absent}', '${stats.lop}',
         '', '', '', '',
         '', '', '', '', '', '',
         '', '', '', '', '',
         0, '', 0, '',
         '', '', '', '', '',
         '', '', '', '', '', '',
         '', '', '', '',
         '', '',
         '${escapeSql(stats.fromDate)}', '${escapeSql(stats.toDate)}',
         '${attJson}',
         '', '', '', '',
         NOW(), '', '${escapeSql(memberId)}', NOW(), '', '${escapeSql(memberId)}', 1)`,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE staff_payroll_tb SET
       total_days='${stats.totalDays}', scheduled_days='${stats.scheduledDays}',
       working_days='${stats.workingDays}', a_present='${stats.present}',
       a_late='${stats.late}', a_permission='${stats.permission}',
       a_leave='${stats.leave}', a_absent='${stats.absent}', a_llp='${stats.lop}',
       p_from_date='${escapeSql(stats.fromDate)}', p_to_date='${escapeSql(stats.toDate)}',
       att_statement='${attJson}', updated_dt=NOW(), updated_by='${escapeSql(memberId)}'
       WHERE id='${existing[0].id}'`,
    );
  }

  const period = { fromTs: stats.fromTs, toTs: stats.toTs };
  const rowHtml = buildAttendanceRow(counter, profile.staff_id, name, stats, period);
  return { body: JSON.stringify([rowHtml]) };
}
