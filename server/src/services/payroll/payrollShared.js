import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import {
  formatPayrollMonthLabel,
  getStaffOrderClause,
  toSqlDate,
} from './payrollHelpers.js';

const ATT_MONTH_FROM = '2018-04-01';

export function parsePayrollMonthRef(value) {
  const raw = String(value || '').trim();
  if (/^\d{2}-\d{4}$/.test(raw)) {
    const [mm, yyyy] = raw.split('-');
    return `${yyyy}-${mm}-01`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return '';
}

export function staffDisplayName(row) {
  const title = row.staff_title ? `${String(row.staff_title).trim()}. ` : '';
  return `${title}${String(row.staff_name || '').trim()} ${String(row.staff_initial || '').trim()}`.trim();
}

export function sqlDateToMonthRef(val) {
  const sql = toSqlDate(val);
  if (!sql || sql.startsWith('0000')) return '';
  const [yyyy, mm] = sql.split('-');
  if (!yyyy || !mm) return '';
  return `${mm}-${yyyy}`;
}

export function monthRefToSqlDate(val) {
  const raw = String(val ?? '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{2}-\d{4}$/.test(raw)) {
    const [mm, yyyy] = raw.split('-');
    return `${yyyy}-${mm}-01`;
  }
  if (/^\d{4}-\d{2}$/.test(raw)) {
    const [yyyy, mm] = raw.split('-');
    return `${yyyy}-${mm}-01`;
  }
  const parsed = toSqlDate(raw);
  return parsed && !parsed.startsWith('0000') ? parsed : '';
}

export function mapPayrollPolicyFlags(policy = {}) {
  return {
    basicPay: Number(policy.basic_pay) === 1,
    basicMargin: Number(policy.basic_margin) === 1,
    hraAllowance: Number(policy.hra_allowance) === 1,
    dAllowance: Number(policy.d_allowance) === 1,
    mAllowance: Number(policy.m_allowance) === 1,
    cAllowance: Number(policy.c_allowance) === 1,
    pfCalculation: Number(policy.pf_calculation) === 1,
    esiCalculation: Number(policy.esi_calculation) === 1,
  };
}

export async function loadBankOptions() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, category_name FROM edu_setup_tb
     WHERE del = 1 AND category = 'Bank'
     ORDER BY category_order ASC`,
  );
  return rows.map((row) => ({ value: String(row.id), label: row.category_name }));
}

export async function loadOpenPayrollMonthOptions(forGenerate = false) {
  const rows = [];
  const now = new Date();
  const from = new Date(`${ATT_MONTH_FROM}T00:00:00`);
  let current = new Date(now.getFullYear(), now.getMonth(), 1);

  while (current >= from) {
    const monthSql = toSqlDate(current);
    const closed = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS cnt FROM staff_payroll_log
       WHERE del = 1 AND payroll_month = '${escapeSql(monthSql)}'
         AND payroll_type = 'Salary' AND payroll_complete = 1`,
    );
    if (Number(closed[0]?.cnt) === 0) {
      const partial = await prisma.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT payroll_type) AS cnt FROM staff_payroll_log
         WHERE del = 1 AND payroll_month = '${escapeSql(monthSql)}' AND payroll_complete = 1`,
      );
      const m = current.getMonth() + 1;
      const y = current.getFullYear();
      rows.push({
        value: `${String(m).padStart(2, '0')}-${y}`,
        monthSql,
        label: formatPayrollMonthLabel(monthSql),
        generated: Number(partial[0]?.cnt) > 0,
      });
    }
    current = new Date(current.getFullYear(), current.getMonth() - 1, 1);
  }
  return rows;
}

export async function loadGeneratedPayrollMonthOptions() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT payroll_month FROM (
       SELECT payroll_month FROM staff_payroll_log
       WHERE del = 1 AND payroll_month >= '${escapeSql(ATT_MONTH_FROM)}'
       UNION
       SELECT payroll_month FROM staff_payroll_tb
       WHERE del = 1 AND payroll_month >= '${escapeSql(ATT_MONTH_FROM)}'
     ) AS months
     ORDER BY payroll_month DESC`,
  );
  return rows.map((row) => ({
    value: toSqlDate(row.payroll_month),
    label: formatPayrollMonthLabel(row.payroll_month),
  }));
}

export async function loadSalaryPayrollMonthOptions() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT payroll_month FROM (
       SELECT payroll_month FROM staff_payroll_log
       WHERE del = 1 AND payroll_type = 'Salary'
       UNION
       SELECT payroll_month FROM staff_payroll_tb
       WHERE del = 1 AND payroll_month >= '${escapeSql(ATT_MONTH_FROM)}'
     ) AS months
     ORDER BY payroll_month DESC`,
  );
  return rows.map((row) => ({
    value: toSqlDate(row.payroll_month),
    label: formatPayrollMonthLabel(row.payroll_month),
  }));
}

export async function loadJobCategoryOptions(payrollMonthSql = '', selected = '') {
  const monthSql = payrollMonthSql || toSqlDate(new Date());
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT B.id, B.category_name
     FROM staff_profile_tb AS A
     INNER JOIN edu_setup_tb AS B ON A.job_category = B.id
     WHERE A.del = 1
       AND (A.releaving_date > '${escapeSql(monthSql)}'
         OR CAST(A.releaving_date AS CHAR) = '0000-00-00')
       AND B.category = 'Category'
     ORDER BY B.category_order ASC`,
  );
  const selectedSet = new Set(
    (Array.isArray(selected) ? selected : [selected]).map(String).filter(Boolean),
  );
  return rows.map((row) => ({
    value: String(row.id),
    label: row.category_name,
    selected: selectedSet.has(String(row.id)),
  }));
}

export async function loadCategoryGeneratedFlags(payrollMonthSql, categoryIds) {
  const flags = {};
  for (const catId of categoryIds) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id FROM staff_payroll_log
       WHERE del = 1 AND payroll_month = '${escapeSql(payrollMonthSql)}'
         AND payroll_type = '${escapeSql(String(catId))}' LIMIT 1`,
    );
    flags[String(catId)] = Boolean(rows[0]?.id);
  }
  return flags;
}

export async function resolveStaffForGenerate(payrollMonthSql, categoryIds, staffListFilter = '') {
  if (!payrollMonthSql || !categoryIds.length) return [];

  const catFilter = categoryIds
    .map((id) => `job_category='${escapeSql(String(id).trim())}'`)
    .join(' OR ');
  let staffFilter = '';
  if (staffListFilter) {
    const ids = staffListFilter.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length) {
      staffFilter = ` AND (${ids.map((id) => `staff_id='${escapeSql(id)}'`).join(' OR ')})`;
    }
  }

  const orderClause = await getStaffOrderClause('id');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id, staff_name, staff_initial, staff_title
     FROM staff_profile_tb
     WHERE del = 1
       AND (releaving_date = '0000-00-00' OR releaving_date > '${escapeSql(payrollMonthSql)}')
       AND (${catFilter})
       ${staffFilter}
     ${orderClause}`,
  );
  return rows.map((row) => ({
    id: String(row.id),
    staffId: row.staff_id,
    name: staffDisplayName(row),
  }));
}

export async function loadActiveStaffGrid(payrollMonthSql, categoryId, options = {}) {
  const orderClause = await getStaffOrderClause('id');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id, staff_name, staff_initial, staff_title, att_category
     FROM staff_profile_tb
     WHERE del = 1 AND job_category = '${escapeSql(String(categoryId))}'
       AND (releaving_date = '0000-00-00' OR releaving_date > '${escapeSql(payrollMonthSql)}')
     ${orderClause}`,
  );

  let tdsLimits = {};
  if (options.tdsFilter) {
    const policyRows = await prisma.$queryRawUnsafe(
      `SELECT id, tds_limit FROM basic_setup_payroll_tb WHERE del = 1`,
    );
    for (const p of policyRows) {
      tdsLimits[String(p.id)] = Number(p.tds_limit) || 0;
    }
  }

  const staff = [];
  for (const row of rows) {
    if (options.tdsFilter) {
      const salRows = await prisma.$queryRawUnsafe(
        `SELECT total_amount FROM salary_tb
         WHERE del = 1 AND staff_id = '${escapeSql(String(row.id))}'
           AND from_date <= '${escapeSql(payrollMonthSql)}'
           AND (to_date >= '${escapeSql(payrollMonthSql)}' OR CAST(to_date AS CHAR) = '0000-00-00')
         ORDER BY from_date DESC LIMIT 1`,
      );
      const salaryAmount = Number(salRows[0]?.total_amount) || 0;
      const tdsLimit = tdsLimits[String(row.att_category)] || 0;
      if (tdsLimit > salaryAmount) continue;
    }
    staff.push({
      id: String(row.id),
      staffId: row.staff_id,
      name: staffDisplayName(row),
      attCategory: String(row.att_category),
    });
  }
  return staff;
}

export async function loadEduSetupByCategory(categoryName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, category_name FROM edu_setup_tb
     WHERE del = 1 AND category = '${escapeSql(categoryName)}'
     ORDER BY category_order ASC`,
  );
  return rows.map((row) => ({ value: String(row.id), label: row.category_name }));
}

export async function loadStaffSearchOptions(search = '') {
  const term = escapeSql(String(search || '').trim());
  if (!term) return [];
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id, staff_name, staff_initial, staff_title
     FROM staff_profile_tb
     WHERE del = 1
       AND (releaving_date = '0000-00-00' OR releaving_date > DATE(NOW()))
       AND (staff_id LIKE '%${term}%' OR staff_name LIKE '%${term}%' OR staff_initial LIKE '%${term}%')
     ORDER BY staff_id ASC LIMIT 30`,
  );
  return rows.map((row) => ({
    id: String(row.id),
    staffId: row.staff_id,
    name: staffDisplayName(row),
  }));
}

export async function loadStaffSalaryRows(staffId, policyFlags = null) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id,
       CAST(from_date AS CHAR) AS from_date,
       CAST(to_date AS CHAR) AS to_date,
       basic_pay, basic_margin, d_allowance, hra_allowance, m_allowance, c_allowance,
       total_amount, pf_calculation, esi_calculation
     FROM salary_tb
     WHERE del = 1 AND staff_id = '${escapeSql(String(staffId))}'
     ORDER BY from_date ASC`,
  );
  return rows.map((row) => {
    const flags = policyFlags || {};
    return {
      id: String(row.id),
      fromDate: sqlDateToMonthRef(row.from_date),
      toDate: sqlDateToMonthRef(row.to_date),
      basicPay: flags.basicPay === false ? '0' : row.basic_pay,
      basicMargin: flags.basicMargin === false ? '0' : row.basic_margin,
      dAllowance: flags.dAllowance === false ? '0' : row.d_allowance,
      hraAllowance: flags.hraAllowance === false ? '0' : row.hra_allowance,
      mAllowance: flags.mAllowance === false ? '0' : row.m_allowance,
      cAllowance: flags.cAllowance === false ? '0' : row.c_allowance,
      totalAmount: row.total_amount,
      pfCalculation: flags.pfCalculation === false ? 0 : Number(row.pf_calculation) || 0,
      esiCalculation: flags.esiCalculation === false ? 0 : Number(row.esi_calculation) || 0,
    };
  });
}

export function zeroDateSql(column) {
  return `IF(CAST(${column} AS CHAR)='0000-00-00', '', CAST(${column} AS CHAR))`;
}
