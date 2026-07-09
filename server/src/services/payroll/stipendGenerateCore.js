import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { logPayrollPage } from './payrollHelpers.js';
import { auditFields } from './setup/setupAudit.js';
import { computeStudentMonthAttendance } from './stipendAttendanceCore.js';
import {
  loadStipendCategoryOptions,
  loadStipendPayrollMonthOptions,
  resolveStipendStudents,
  studentDisplayName,
} from './stipendHelpers.js';

const PAGE = 'stipend_generate_payroll.php';

const STIPEND_PAYROLL_EMPTY_DEFAULTS = {
  designation: '',
  f_llp: '',
  join_releave: '0',
  casual_leave: '',
  basic_pay: '',
  basic_margin: '',
  d_allowance: '',
  hra_allowance: '',
  m_allowance: '',
  c_allowance: '',
  total_amount: '',
  lop_amount: '',
  arrear_id: '',
  arrear_amount: '',
  gross_pay: '',
  pf_calculate: 0,
  pf_amount: '',
  esi_calculate: 0,
  esi_amount: '',
  advance_id: '',
  advance_amount: '',
  loan_id: '',
  loan_amount: '',
  other_deduction: '',
  room_id: '',
  rental_amount: '',
  m_room_id: '',
  hostel_amount: '',
  h_room_id: '',
  h_rental_amount: '',
  tds_amount: '',
  prof_tax: '',
  total_deduction: '',
  net_pay: '',
  pay_bank: '',
  pay_type: '',
};

function parsePayrollMonthRef(value) {
  const raw = String(value || '').trim();
  if (/^\d{2}-\d{4}$/.test(raw)) {
    const [mm, yyyy] = raw.split('-');
    return `${yyyy}-${mm}-01`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return '';
}

export async function loadStipendGeneratePayroll(memberId, fields = {}, audit = {}) {
  const monthOptions = await loadStipendPayrollMonthOptions(true);
  const payrollMonthRaw = String(fields.payroll_month || '').trim();
  const payrollMonthSql = parsePayrollMonthRef(payrollMonthRaw)
    || monthOptions.find((m) => m.value === payrollMonthRaw)?.monthSql
    || '';

  const searchCategory = Array.isArray(fields.search_category)
    ? fields.search_category.map(String)
    : (fields.search_category ? [String(fields.search_category)] : []);

  const categoryOptions = await loadStipendCategoryOptions(searchCategory);
  const isGenerate = fields.Submit === 'Generate';

  let students = [];
  if (isGenerate && payrollMonthSql && searchCategory.length) {
    students = await resolveStipendStudents(
      searchCategory,
      payrollMonthSql,
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
    categoryOptions,
    selected: {
      payrollMonth: payrollMonthRaw,
      payrollMonthSql,
      searchCategory,
      gStaffList: String(fields.g_staff_list || ''),
    },
    students,
    canGenerate: Boolean(payrollMonthSql && searchCategory.length),
  };
}

function buildAttendanceRow(counter, registerNo, name, stats) {
  return `<tr>
<td>${counter}</td>
<td>${registerNo}</td>
<td nowrap>${name}</td>
<td align="right">${stats.totalDays}</td>
<td align="right">${stats.workingDays}</td>
<td align="right">${stats.present}</td>
<td align="right">${stats.absent}</td>
<td align="right">${stats.late}</td>
<td align="right">${stats.permission}</td>
<td align="right">${stats.leave}</td>
<td align="right">${stats.lop}</td>
<td align="right">${stats.percent}</td>
</tr>`;
}

export async function runStipendGeneratePayrollMore(memberId, query = {}, audit = {}) {
  const flag = Number(query.flag) || 0;

  if (flag === 2) {
    const pmonth = Number(query.pmonth);
    const categories = String(query.s_cate || '').split(',').filter(Boolean);
    if (!pmonth || !categories.length) return { error: 'pmonth and s_cate required' };

    const payrollMonthRef = new Date(pmonth * 1000).toISOString().slice(0, 10);
    const { create } = auditFields(memberId, audit);
    for (const payrollType of categories) {
      const typeSql = escapeSql(payrollType.trim());
      const existing = await prisma.$queryRawUnsafe(
        `SELECT id FROM stipend_payroll_log
         WHERE del = 1 AND payroll_month = '${escapeSql(payrollMonthRef)}'
           AND payroll_type = '${typeSql}' LIMIT 1`,
      );
      if (!existing[0]?.id) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO stipend_payroll_log
           (payroll_type, payroll_month, payroll_complete, generated_by, generated_on, generated_ip,
            updated_dt, updated_ip, updated_by, del)
           VALUES ('${typeSql}', '${escapeSql(payrollMonthRef)}', 0, '${escapeSql(memberId)}', NOW(),
            '${escapeSql(create.created_ip)}', NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1)`,
        );
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE stipend_payroll_log SET
           generated_by='${escapeSql(memberId)}', generated_on=NOW(),
           updated_dt=NOW(), updated_by='${escapeSql(memberId)}'
           WHERE id='${existing[0].id}'`,
        );
      }
    }
    return { body: JSON.stringify([1]) };
  }

  if (flag !== 1) return { error: 'Invalid flag' };

  const registerNo = String(query.s_staff || '').trim();
  const pmonth = Number(query.pmonth);
  const tmonth = Number(query.tmonth) || pmonth;
  const counter = Number(query.id) + 1;
  const acYear = String(query.ac_year || '');

  if (!registerNo || !pmonth) return { error: 's_staff and pmonth required' };

  const payrollMonthRef = new Date(pmonth * 1000).toISOString().slice(0, 10);
  const toDateRef = new Date(tmonth * 1000).toISOString().slice(0, 10);

  const profileRows = await prisma.$queryRawUnsafe(
    `SELECT id, student_title, student_name, student_initial
     FROM student_profile_tb WHERE del = 1 AND register_no = '${escapeSql(registerNo)}' LIMIT 1`,
  );
  const profile = profileRows[0];
  if (!profile) return { body: JSON.stringify(['']) };

  const name = studentDisplayName(profile);

  let stats = await computeStudentMonthAttendance(registerNo, payrollMonthRef, toDateRef, acYear);

  const existing = await prisma.$queryRawUnsafe(
    `SELECT id FROM stipend_payroll_tb WHERE del = 1 AND staff_id = '${escapeSql(String(profile.id))}'
       AND payroll_month = '${escapeSql(payrollMonthRef)}' LIMIT 1`,
  );

  const attJson = JSON.stringify(stats.attStatement).replace(/'/g, "''");
  const sid = String(profile.id);
  const defaults = STIPEND_PAYROLL_EMPTY_DEFAULTS;
  const { create } = auditFields(memberId, audit);

  if (!existing[0]?.id) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO stipend_payroll_tb
       (staff_id, designation, payroll_month, total_days, scheduled_days, working_days, a_present, a_late,
        a_permission, a_leave, a_absent, a_llp, f_llp, join_releave, casual_leave, basic_pay, basic_margin,
        d_allowance, hra_allowance, m_allowance, c_allowance, total_amount, lop_amount, arrear_id, arrear_amount,
        gross_pay, pf_calculate, pf_amount, esi_calculate, esi_amount, advance_id, advance_amount, loan_id,
        loan_amount, other_deduction, room_id, rental_amount, m_room_id, hostel_amount, h_room_id, h_rental_amount,
        tds_amount, prof_tax, total_deduction, net_pay, pay_bank, pay_type, p_from_date, p_to_date, att_statement,
        created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del)
       VALUES ('${escapeSql(sid)}', '${escapeSql(defaults.designation)}', '${escapeSql(payrollMonthRef)}',
         '${stats.totalDays}', '${stats.totalDays}', '${stats.workingDays}',
         '${stats.present}', '${stats.late}', '${stats.permission}', '${stats.leave}',
         '${stats.absent}', '${stats.lop}', '${escapeSql(defaults.f_llp)}', '${escapeSql(defaults.join_releave)}',
         '${escapeSql(defaults.casual_leave)}', '${escapeSql(defaults.basic_pay)}', '${escapeSql(defaults.basic_margin)}',
         '${escapeSql(defaults.d_allowance)}', '${escapeSql(defaults.hra_allowance)}', '${escapeSql(defaults.m_allowance)}',
         '${escapeSql(defaults.c_allowance)}', '${escapeSql(defaults.total_amount)}', '${escapeSql(defaults.lop_amount)}',
         '${escapeSql(defaults.arrear_id)}', '${escapeSql(defaults.arrear_amount)}', '${escapeSql(defaults.gross_pay)}',
         ${defaults.pf_calculate}, '${escapeSql(defaults.pf_amount)}', ${defaults.esi_calculate}, '${escapeSql(defaults.esi_amount)}',
         '${escapeSql(defaults.advance_id)}', '${escapeSql(defaults.advance_amount)}', '${escapeSql(defaults.loan_id)}',
         '${escapeSql(defaults.loan_amount)}', '${escapeSql(defaults.other_deduction)}', '${escapeSql(defaults.room_id)}',
         '${escapeSql(defaults.rental_amount)}', '${escapeSql(defaults.m_room_id)}', '${escapeSql(defaults.hostel_amount)}',
         '${escapeSql(defaults.h_room_id)}', '${escapeSql(defaults.h_rental_amount)}', '${escapeSql(defaults.tds_amount)}',
         '${escapeSql(defaults.prof_tax)}', '${escapeSql(defaults.total_deduction)}', '${escapeSql(defaults.net_pay)}',
         '${escapeSql(defaults.pay_bank)}', '${escapeSql(defaults.pay_type)}',
         '${escapeSql(payrollMonthRef)}', '${escapeSql(toDateRef)}', '${attJson}',
         NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(memberId)}',
         NOW(), '${escapeSql(create.updated_ip)}', '${escapeSql(memberId)}', 1)`,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE stipend_payroll_tb SET
       total_days='${stats.totalDays}', scheduled_days='${stats.totalDays}',
       working_days='${stats.workingDays}', a_present='${stats.present}',
       a_late='${stats.late}', a_permission='${stats.permission}',
       a_leave='${stats.leave}', a_absent='${stats.absent}', a_llp='${stats.lop}',
       p_from_date='${escapeSql(payrollMonthRef)}', p_to_date='${escapeSql(toDateRef)}',
       att_statement='${attJson}', updated_dt=NOW(), updated_ip='${escapeSql(create.updated_ip)}',
       updated_by='${escapeSql(memberId)}'
       WHERE id='${existing[0].id}'`,
    );
  }

  const rowHtml = buildAttendanceRow(counter, registerNo, name, stats);
  return { body: JSON.stringify([rowHtml]) };
}
