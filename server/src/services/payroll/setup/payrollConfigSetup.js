import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logPayrollSetup } from './setupAudit.js';

const PAGE = 'staff_payroll_setup.php';

const SELECT_SQL = `SELECT id, staff_id, payroll_type, live_attendance, live_att_photo, academic_start, payroll_start,
            day_type, day_count, yearly_leave, minimum_leave, max_leave, max_od, yearly_el, max_el, min_el,
            od_type, leave_apply_days, cl_apply_days, el_apply_days, od_apply_days, defaulter_apply,
            cl_defaulter_days, el_defaulter_days, od_defaulter_days, minimum_late, minimum_permission,
            p_lop, l_lop, p_lop_type, l_lop_type, late_deduct,
            CAST(late_time AS CHAR) AS late_time, CAST(permission_time AS CHAR) AS permission_time,
            allow_leave, allow_off, inc_leave_holiday, inc_od_holiday, inc_el_holiday, inc_off_holiday, inc_lr_holiday,
            basic_pay, basic_margin, hra_allowance, d_allowance, m_allowance, c_allowance, tds_limit,
            pf_calculation, pf_percentage, salary_limit, pf_amount, esi_calculation, esi_limit, esi_amount`;

function timeToSql(val) {
  const s = String(val ?? '').trim();
  if (!s) return '00:00:00';
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 8);
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(':');
    return `${h.padStart(2, '0')}:${m}:00`;
  }
  return s.slice(0, 8);
}

function pickField(fields, formKey, existingValue, fallback = '') {
  if (fields[formKey] !== undefined && fields[formKey] !== '') {
    return String(fields[formKey]);
  }
  if (existingValue !== undefined && existingValue !== null && existingValue !== '') {
    return String(existingValue);
  }
  return fallback;
}

function rawRowToData(row) {
  if (!row) return null;
  return {
    staff_id: String(row.staff_id ?? '1'),
    payroll_type: String(row.payroll_type ?? ''),
    yearly_leave: String(row.yearly_leave ?? ''),
    minimum_leave: String(row.minimum_leave ?? ''),
    minimum_permission: String(row.minimum_permission ?? ''),
    permission_time: timeToSql(row.permission_time),
    p_lop: String(row.p_lop ?? ''),
    minimum_late: String(row.minimum_late ?? ''),
    late_time: timeToSql(row.late_time),
    l_lop: String(row.l_lop ?? ''),
    pf_calculation: String(row.pf_calculation ?? ''),
    pf_percentage: String(row.pf_percentage ?? ''),
    salary_limit: String(row.salary_limit ?? ''),
    pf_amount: String(row.pf_amount ?? ''),
    live_attendance: String(row.live_attendance ?? ''),
    live_att_photo: String(row.live_att_photo ?? ''),
    p_lop_type: String(row.p_lop_type ?? ''),
    l_lop_type: String(row.l_lop_type ?? ''),
    late_deduct: String(row.late_deduct ?? ''),
    max_od: String(row.max_od ?? ''),
    yearly_el: String(row.yearly_el ?? ''),
    max_el: String(row.max_el ?? ''),
    min_el: String(row.min_el ?? ''),
    od_type: String(row.od_type ?? ''),
    leave_apply_days: String(row.leave_apply_days ?? ''),
    cl_apply_days: String(row.cl_apply_days ?? ''),
    el_apply_days: String(row.el_apply_days ?? ''),
    od_apply_days: String(row.od_apply_days ?? ''),
    max_leave: String(row.max_leave ?? ''),
    defaulter_apply: String(row.defaulter_apply ?? ''),
    cl_defaulter_days: String(row.cl_defaulter_days ?? ''),
    el_defaulter_days: String(row.el_defaulter_days ?? ''),
    od_defaulter_days: String(row.od_defaulter_days ?? ''),
    academic_start: String(row.academic_start ?? ''),
    payroll_start: String(row.payroll_start ?? ''),
    allow_leave: String(row.allow_leave ?? ''),
    allow_off: String(row.allow_off ?? ''),
    inc_leave_holiday: String(row.inc_leave_holiday ?? ''),
    inc_od_holiday: String(row.inc_od_holiday ?? ''),
    inc_el_holiday: String(row.inc_el_holiday ?? ''),
    inc_off_holiday: String(row.inc_off_holiday ?? ''),
    inc_lr_holiday: String(row.inc_lr_holiday ?? ''),
    basic_pay: String(row.basic_pay ?? ''),
    basic_margin: String(row.basic_margin ?? ''),
    hra_allowance: String(row.hra_allowance ?? ''),
    d_allowance: String(row.d_allowance ?? ''),
    m_allowance: String(row.m_allowance ?? ''),
    c_allowance: String(row.c_allowance ?? ''),
    tds_limit: String(row.tds_limit ?? ''),
    esi_calculation: String(row.esi_calculation ?? ''),
    esi_limit: String(row.esi_limit ?? ''),
    esi_amount: String(row.esi_amount ?? ''),
    day_type: String(row.day_type ?? ''),
    day_count: String(row.day_count ?? ''),
  };
}

function buildSaveData(fields, existingRow) {
  const existing = rawRowToData(existingRow);
  const payrollTitle = String(fields.payroll_title || fields.dept_name || existing?.payroll_type || '').trim();
  const acMonth = fields.academic_start_month ?? (existing?.academic_start?.split('-')[0] ?? '');
  const acDay = fields.academic_start_day ?? (existing?.academic_start?.split('-')[1] ?? '');
  const academicStart = acMonth || acDay ? `${acMonth}-${acDay}` : (existing?.academic_start || '');

  return {
    staff_id: pickField(fields, 'staff_id', existing?.staff_id, '1'),
    payroll_type: payrollTitle,
    yearly_leave: pickField(fields, 'yearly_leave', existing?.yearly_leave),
    minimum_leave: pickField(fields, 'minimum_leave', existing?.minimum_leave),
    minimum_permission: pickField(fields, 'minimum_permission', existing?.minimum_permission),
    permission_time: fields.p_time ? timeToSql(fields.p_time) : (existing?.permission_time || '00:00:00'),
    p_lop: pickField(fields, 'p_lop', existing?.p_lop),
    minimum_late: pickField(fields, 'minimum_late', existing?.minimum_late),
    late_time: fields.l_time ? timeToSql(fields.l_time) : (existing?.late_time || '00:00:00'),
    l_lop: pickField(fields, 'l_lop', existing?.l_lop),
    pf_calculation: pickField(fields, 'paryroll_calculation', existing?.pf_calculation)
      || pickField(fields, 'pf_calculation', existing?.pf_calculation),
    pf_percentage: pickField(fields, 'pf_percentage', existing?.pf_percentage),
    salary_limit: pickField(fields, 'salary_limit', existing?.salary_limit),
    pf_amount: pickField(fields, 'pf_amount', existing?.pf_amount),
    live_attendance: pickField(fields, 'live_attendance', existing?.live_attendance),
    live_att_photo: pickField(fields, 'live_att_photo', existing?.live_att_photo),
    p_lop_type: pickField(fields, 'p_lop_type', existing?.p_lop_type),
    l_lop_type: pickField(fields, 'l_lop_type', existing?.l_lop_type),
    late_deduct: pickField(fields, 'late_deduct', existing?.late_deduct),
    max_od: pickField(fields, 'yearly_od', existing?.max_od),
    yearly_el: pickField(fields, 'yearly_el', existing?.yearly_el),
    max_el: pickField(fields, 'max_el', existing?.max_el),
    min_el: pickField(fields, 'min_el', existing?.min_el),
    od_type: pickField(fields, 'od_type', existing?.od_type),
    leave_apply_days: pickField(fields, 'leave_apply', existing?.leave_apply_days),
    cl_apply_days: pickField(fields, 'cl_apply', existing?.cl_apply_days),
    el_apply_days: pickField(fields, 'el_apply', existing?.el_apply_days),
    od_apply_days: pickField(fields, 'od_apply', existing?.od_apply_days),
    max_leave: pickField(fields, 'max_leave', existing?.max_leave),
    defaulter_apply: pickField(fields, 'defaulter_apply', existing?.defaulter_apply),
    cl_defaulter_days: pickField(fields, 'd_cl_apply', existing?.cl_defaulter_days),
    el_defaulter_days: pickField(fields, 'd_el_apply', existing?.el_defaulter_days),
    od_defaulter_days: pickField(fields, 'd_od_apply', existing?.od_defaulter_days),
    academic_start: academicStart,
    payroll_start: pickField(fields, 'payroll_start', existing?.payroll_start),
    allow_leave: pickField(fields, 'allow_leave', existing?.allow_leave),
    allow_off: pickField(fields, 'allow_off', existing?.allow_off),
    inc_leave_holiday: pickField(fields, 'inc_leave_holiday', existing?.inc_leave_holiday),
    inc_od_holiday: pickField(fields, 'inc_od_holiday', existing?.inc_od_holiday),
    inc_el_holiday: pickField(fields, 'inc_el_holiday', existing?.inc_el_holiday),
    inc_off_holiday: pickField(fields, 'inc_off_holiday', existing?.inc_off_holiday),
    inc_lr_holiday: pickField(fields, 'inc_lr_holiday', existing?.inc_lr_holiday),
    basic_pay: pickField(fields, 'basic_pay', existing?.basic_pay),
    basic_margin: pickField(fields, 'basic_margin', existing?.basic_margin),
    hra_allowance: pickField(fields, 'hra_allowance', existing?.hra_allowance),
    d_allowance: pickField(fields, 'd_allowance', existing?.d_allowance),
    m_allowance: pickField(fields, 'm_allowance', existing?.m_allowance),
    c_allowance: pickField(fields, 'c_allowance', existing?.c_allowance),
    tds_limit: pickField(fields, 'tds_limit', existing?.tds_limit),
    esi_calculation: pickField(fields, 'esi_calculation', existing?.esi_calculation),
    esi_limit: pickField(fields, 'esi_limit', existing?.esi_limit),
    esi_amount: pickField(fields, 'esi_amount', existing?.esi_amount),
    day_type: pickField(fields, 'day_type', existing?.day_type),
    day_count: pickField(fields, 'day_count', existing?.day_count),
  };
}

async function loadRawRowById(id) {
  const rows = await prisma.$queryRawUnsafe(
    `${SELECT_SQL} FROM basic_setup_payroll_tb WHERE del = 1 AND id = '${escapeSql(id)}' LIMIT 1`,
  );
  return rows[0] || null;
}

function mapRow(row) {
  if (!row) return null;
  const acStart = String(row.academic_start || '');
  const [acMonth, acDay] = acStart.includes('-') ? acStart.split('-') : ['', ''];
  return {
    id: String(row.id),
    payrollType: row.payroll_type,
    staffId: row.staff_id,
    liveAttendance: row.live_attendance,
    liveAttPhoto: row.live_att_photo,
    academicStartMonth: acMonth,
    academicStartDay: acDay,
    payrollStart: row.payroll_start,
    dayType: row.day_type,
    dayCount: row.day_count,
    yearlyLeave: row.yearly_leave,
    minimumLeave: row.minimum_leave,
    maxLeave: row.max_leave,
    yearlyOd: row.max_od,
    yearlyEl: row.yearly_el,
    maxEl: row.max_el,
    minEl: row.min_el,
    odType: row.od_type,
    leaveApply: row.leave_apply_days,
    clApply: row.cl_apply_days,
    elApply: row.el_apply_days,
    odApply: row.od_apply_days,
    defaulterApply: row.defaulter_apply,
    dClApply: row.cl_defaulter_days,
    dElApply: row.el_defaulter_days,
    dOdApply: row.od_defaulter_days,
    minimumLate: row.minimum_late,
    minimumPermission: row.minimum_permission,
    pLop: row.p_lop,
    lLop: row.l_lop,
    pLopType: row.p_lop_type,
    lLopType: row.l_lop_type,
    lateDeduct: row.late_deduct,
    lateTime: row.late_time,
    permissionTime: row.permission_time,
    allowLeave: row.allow_leave,
    allowOff: row.allow_off,
    incLeaveHoliday: row.inc_leave_holiday,
    incOdHoliday: row.inc_od_holiday,
    incElHoliday: row.inc_el_holiday,
    incOffHoliday: row.inc_off_holiday,
    incLrHoliday: row.inc_lr_holiday,
    basicPay: row.basic_pay,
    basicMargin: row.basic_margin,
    hraAllowance: row.hra_allowance,
    dAllowance: row.d_allowance,
    mAllowance: row.m_allowance,
    cAllowance: row.c_allowance,
    tdsLimit: row.tds_limit,
    pfCalculation: row.pf_calculation,
    pfPercentage: row.pf_percentage,
    salaryLimit: row.salary_limit,
    pfAmount: row.pf_amount,
    esiCalculation: row.esi_calculation,
    esiLimit: row.esi_limit,
    esiAmount: row.esi_amount,
  };
}

export async function loadPayrollConfigSetup(fields = {}, memberId, audit = {}) {
  const rows = await prisma.$queryRawUnsafe(
    `${SELECT_SQL} FROM basic_setup_payroll_tb WHERE del = 1 ORDER BY payroll_type ASC`,
  );
  const selectedId = String(fields.payroll_type || rows[0]?.id || '');
  const selected = mapRow(rows.find((r) => String(r.id) === selectedId) || rows[0]);

  await logPayrollSetup(PAGE, 'View', 'Successful', selectedId, memberId, audit);

  return {
    typeOptions: rows.map((r) => ({ value: String(r.id), label: r.payroll_type })),
    selected,
    canAddNew: true,
  };
}

export async function savePayrollConfigSetup(fields, memberId, audit = {}) {
  if (fields.Submit !== 'Update') {
    return loadPayrollConfigSetup(fields, memberId, audit);
  }

  const { ip } = auditFields(memberId, audit);
  const payrollTypeRef = String(fields.payroll_type || '');
  const isNew = payrollTypeRef === 'Add New Type' || payrollTypeRef === 'add-new';

  if (!isNew && !/^\d+$/.test(payrollTypeRef)) {
    return { success: false, message: 'Select a payroll type to update' };
  }

  const existingRow = !isNew ? await loadRawRowById(payrollTypeRef) : null;
  if (!isNew && !existingRow) {
    return { success: false, message: 'Payroll type not found' };
  }

  const data = buildSaveData(fields, existingRow);

  if (isNew) {
    if (!data.payroll_type) {
      return { success: false, message: 'Payroll title is required' };
    }
    const cols = Object.keys(data);
    const vals = cols.map((c) => `'${escapeSql(data[c])}'`);
    await prisma.$executeRawUnsafe(
      `INSERT INTO basic_setup_payroll_tb (${cols.join(', ')}, created_dt, created_ip, created_by, del)
       VALUES (${vals.join(', ')}, NOW(), '${escapeSql(ip)}', '${escapeSql(memberId)}', 1)`,
    );
  } else {
    const sets = Object.entries(data)
      .map(([k, v]) => `${k}='${escapeSql(v)}'`)
      .join(', ');
    await prisma.$executeRawUnsafe(
      `UPDATE basic_setup_payroll_tb SET ${sets},
       updated_dt=NOW(), updated_ip='${escapeSql(ip)}', updated_by='${escapeSql(memberId)}'
       WHERE id='${escapeSql(payrollTypeRef)}'`,
    );
  }

  await logPayrollSetup(PAGE, 'Update', 'Successful', payrollTypeRef, memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadPayrollConfigSetup({ payroll_type: payrollTypeRef }, memberId, { ...audit, skipLog: true })),
  };
}
