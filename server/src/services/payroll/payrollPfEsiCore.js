import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';

export async function loadPfEsiRates(payrollMonth) {
  const monthSql = escapeSql(payrollMonth);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT epf_er, eps, adm_charge, edli, adli_add, esi_er
     FROM basic_pfesi_setup
     WHERE del = 1 AND from_month <= '${monthSql}' AND to_month >= '${monthSql}'
     ORDER BY from_month DESC LIMIT 1`,
  );
  const r = rows[0] || {};
  return {
    epfEr: Number(r.epf_er) || 0,
    eps: Number(r.eps) || 0,
    admCharge: Number(r.adm_charge) || 0,
    edli: Number(r.edli) || 0,
    adliAdd: Number(r.adli_add) || 0,
    esiEr: Number(r.esi_er) || 0,
  };
}

export async function loadPayrollSetupLimits() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, salary_limit FROM basic_setup_payroll_tb WHERE del = 1 ORDER BY payroll_type ASC`,
  );
  const map = {};
  for (const row of rows) {
    map[row.id] = Number(row.salary_limit) || 0;
  }
  return map;
}

export async function computePfTotals(payrollMonth, categoryFilterSql = '') {
  const monthSql = escapeSql(payrollMonth);
  const rates = await loadPfEsiRates(payrollMonth);
  const limits = await loadPayrollSetupLimits();

  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.att_category, B.gross_pay, B.pf_amount
     FROM staff_profile_tb AS A
     INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND B.del = 1 AND B.pf_amount > 0
       AND B.payroll_month = '${monthSql}'
       ${categoryFilterSql}`,
  );

  let employee = 0;
  let employerWages = 0;
  let employerEpf = 0;
  let employerEps = 0;

  for (const row of rows) {
    const pfAmount = Number(row.pf_amount) || 0;
    let wages = Number(row.gross_pay) || 0;
    const limit = limits[row.att_category] || 0;
    if (limit > 0 && wages > limit) wages = limit;

    employee += pfAmount;
    employerWages += wages;
    employerEpf += Math.round((wages * rates.epfEr) / 100);
    employerEps += Math.round((wages * rates.eps) / 100);
  }

  const admCharge = Math.round((employerWages * rates.admCharge) / 100);
  const edli = Math.round((employerWages * rates.edli) / 100);
  const adliAdd = Math.round((employerWages * rates.adliAdd) / 100);
  const employer = employerEpf + employerEps + admCharge + edli + adliAdd;

  return { employee, employer };
}

export async function computeEsiTotals(payrollMonth, categoryFilterSql = '') {
  const monthSql = escapeSql(payrollMonth);
  const rates = await loadPfEsiRates(payrollMonth);

  const rows = await prisma.$queryRawUnsafe(
    `SELECT B.gross_pay, B.esi_amount, B.esi_calculate
     FROM staff_profile_tb AS A
     INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND B.del = 1 AND B.esi_calculate > 0
       AND B.payroll_month = '${monthSql}'
       ${categoryFilterSql}`,
  );

  let employee = 0;
  let employer = 0;

  for (const row of rows) {
    if (Number(row.esi_calculate) !== 1) continue;
    const gross = Number(row.gross_pay) || 0;
    const esiAmount = Number(row.esi_amount) || 0;
    employee += esiAmount;
    employer += Math.round((gross * rates.esiEr) / 100);
  }

  return { employee, employer };
}
