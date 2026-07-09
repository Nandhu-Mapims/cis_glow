import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import {
  escapeHtml,
  formatIndianMoney,
  formatPayrollMonthLabel,
} from './payrollHelpers.js';
import { loadPfEsiRates, loadPayrollSetupLimits } from './payrollPfEsiCore.js';

const SALARY_ARREAR_PREFIX = 'APAR';
const SALARY_ADVANCE_PREFIX = 'APAD';

function staffDisplayName(row) {
  const title = row.staff_title ? `${String(row.staff_title).trim()}. ` : '';
  return `${title}${String(row.staff_name || '').trim()} ${String(row.staff_initial || '').trim()}`.trim();
}

function formatDoj(value) {
  if (!value || String(value).startsWith('0000')) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB').replace(/\//g, '-');
}

function roomMatchSql(column, roomIds) {
  if (!roomIds.length) return '';
  const parts = roomIds.map((id) => {
    const e = escapeSql(String(id));
    return `(${column}='${e}' OR ${column} LIKE '${e},%' OR ${column} LIKE '%,${e}' OR ${column} LIKE '%,${e},%')`;
  });
  return `(${parts.join(' OR ')})`;
}

function installmentNo(payrollMonth, startMonth) {
  const d1 = new Date(payrollMonth);
  const d2 = new Date(startMonth);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return 1;
  return (d1.getFullYear() - d2.getFullYear()) * 12 + (d1.getMonth() - d2.getMonth()) + 1;
}

export async function buildPfReportHtml(ctx) {
  const [rates, limits] = await Promise.all([
    loadPfEsiRates(ctx.payrollMonth),
    loadPayrollSetupLimits(),
  ]);

  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT(A.id), A.staff_id, A.staff_title, A.staff_name, A.staff_initial,
            A.att_category, A.pf_uan, A.joined_date, B.designation, B.gross_pay, B.pf_amount, A.pf_ac_no
     FROM staff_profile_tb AS A
     INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND B.del = 1
       AND (A.releaving_date = '0000-00-00' OR A.releaving_date > '${ctx.monthSql}')
       ${ctx.categoryFilterSql}
       AND B.payroll_month = '${ctx.monthSql}'
       AND B.pf_amount > 0
     ORDER BY SUBSTRING(A.pf_ac_no FROM 5) ASC, A.pf_ac_no ASC, A.pf_uan ASC`,
  );

  if (!rows.length) return '';

  const header = `<p class="header1">${escapeHtml(ctx.printSetup.body_title || 'E.P.F Report')} &nbsp;</p>
<table class="table-bordered" cellpadding="3" cellspacing="0">
<thead><tr bgcolor="#e7e7e7">
<th>#</th><th>S.ID</th><th>Name</th><th>Designation</th><th>DOJ</th><th>UAN</th><th>PF.A.No.</th>
<th>Wages<br>(Rs)</th><th>EPF 12%<br>(Rs)</th><th>EPF ${rates.epfEr}%<br>(Rs)</th><th>EPS ${rates.eps}%<br>(Rs)</th>
</tr></thead><tbody>`;

  const totals = { wages: 0, pf: 0, epf: 0, eps: 0 };
  const body = rows.map((row, idx) => {
    let wages = Number(row.gross_pay) || 0;
    const pfAmount = Number(row.pf_amount) || 0;
    const limit = limits[row.att_category] || 0;
    if (limit > 0 && wages > limit) wages = limit;
    const epfPay = Math.round((wages * rates.epfEr) / 100);
    const epsPay = Math.round((wages * rates.eps) / 100);
    totals.wages += wages;
    totals.pf += pfAmount;
    totals.epf += epfPay;
    totals.eps += epsPay;
    return `<tr>
<td height="25">${idx + 1}</td>
<td nowrap>${escapeHtml(row.staff_id)}</td>
<td nowrap>${escapeHtml(staffDisplayName(row))}</td>
<td nowrap>${escapeHtml(ctx.designationMap[row.designation] || '')}</td>
<td nowrap>${escapeHtml(formatDoj(row.joined_date))}</td>
<td nowrap>${escapeHtml(row.pf_uan)}</td>
<td nowrap>${escapeHtml(row.pf_ac_no)}</td>
<td class="text-right" bgcolor="#F4F4F4">${formatIndianMoney(wages)}</td>
<td class="text-right">${formatIndianMoney(pfAmount)}</td>
<td class="text-right">${formatIndianMoney(epfPay)}</td>
<td class="text-right">${formatIndianMoney(epsPay)}</td>
</tr>`;
  }).join('');

  return `${header}${body}</tbody><tfoot><tr>
<th class="text-right" colspan="7">Grand Total</th>
<th class="text-right" bgcolor="#F4F4F4">${formatIndianMoney(totals.wages)}</th>
<th class="text-right">${formatIndianMoney(totals.pf)}</th>
<th class="text-right">${formatIndianMoney(totals.epf)}</th>
<th class="text-right">${formatIndianMoney(totals.eps)}</th>
</tr></tfoot></table>`;
}

export async function buildEsiReportHtml(ctx) {
  const rates = await loadPfEsiRates(ctx.payrollMonth);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT(A.id), A.staff_id, A.staff_title, A.staff_name, A.staff_initial,
            B.designation, B.gross_pay, B.esi_amount, B.total_days, B.a_llp, B.esi_calculate, A.esi_no
     FROM staff_profile_tb AS A
     INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND B.del = 1
       ${ctx.categoryFilterSql}
       AND B.payroll_month = '${ctx.monthSql}'
       AND B.esi_calculate > 0
     ${ctx.orderClause}`,
  );

  if (!rows.length) return '';

  const header = `<p class="header1">${escapeHtml(ctx.printSetup.body_title || 'ESI Report')} &nbsp;</p>
<table class="table-bordered" cellpadding="3" cellspacing="0">
<thead><tr bgcolor="#e7e7e7">
<th>#</th><th>S.ID</th><th>Name</th><th>Designation</th><th>ESI No.</th><th>Present<br>Days</th>
<th>Gross Pay<br>(Rs)</th><th>Employee Cont. 1.75%<br>(Rs)</th><th>Employer Cont. ${rates.esiEr}%<br>(Rs)</th><th>Total<br>(Rs)</th>
</tr></thead><tbody>`;

  const totals = { gross: 0, employee: 0, employer: 0, total: 0 };
  const body = rows.map((row, idx) => {
    const gross = Number(row.gross_pay) || 0;
    const esiAmount = Number(row.esi_calculate) === 1 ? (Number(row.esi_amount) || 0) : 0;
    const employer = Number(row.esi_calculate) === 1 ? Math.round((gross * rates.esiEr) / 100) : 0;
    const rowTotal = esiAmount + employer;
    const presentDays = (Number(row.total_days) || 0) - (Number(row.a_llp) || 0);
    totals.gross += gross;
    totals.employee += esiAmount;
    totals.employer += employer;
    totals.total += rowTotal;
    return `<tr>
<td height="25">${idx + 1}</td>
<td nowrap>${escapeHtml(row.staff_id)}</td>
<td nowrap>${escapeHtml(staffDisplayName(row))}</td>
<td nowrap>${escapeHtml(ctx.designationMap[row.designation] || '')}</td>
<td nowrap>${escapeHtml(row.esi_no)}</td>
<td class="text-right">${presentDays}</td>
<td class="text-right" bgcolor="#F4F4F4">${formatIndianMoney(gross)}</td>
<td class="text-right">${formatIndianMoney(esiAmount)}</td>
<td class="text-right">${formatIndianMoney(employer)}</td>
<td class="text-right">${formatIndianMoney(rowTotal)}</td>
</tr>`;
  }).join('');

  return `${header}${body}</tbody><tfoot><tr>
<th class="text-right" colspan="6">Grand Total</th>
<th class="text-right" bgcolor="#F4F4F4">${formatIndianMoney(totals.gross)}</th>
<th class="text-right">${formatIndianMoney(totals.employee)}</th>
<th class="text-right">${formatIndianMoney(totals.employer)}</th>
<th class="text-right">${formatIndianMoney(totals.total)}</th>
</tr></tfoot></table>`;
}

async function loadBlockStaffRows(ctx, blockType, employeeRoomField, amountField, employerAmountField) {
  const blocks = await prisma.$queryRawUnsafe(
    `SELECT ${blockType === 'Quarters' ? 'block_id' : 'block_name'} AS block_label,
            GROUP_CONCAT(id SEPARATOR ',') AS block_ids
     FROM hostel_blocks_tb
     WHERE del = 1 AND block_type = '${escapeSql(blockType)}'
     GROUP BY ${blockType === 'Quarters' ? 'block_id' : 'block_name'}
     ORDER BY block_label ASC`,
  );

  let html = '';
  const grand = { employee: 0, employer: 0, total: 0 };

  for (const block of blocks) {
    const blockIds = String(block.block_ids || '').split(',').filter(Boolean);
    if (!blockIds.length) continue;

    const blockIdFilter = blockIds.map((id) => `block_id='${escapeSql(id)}'`).join(' OR ');
    const rooms = await prisma.$queryRawUnsafe(
      `SELECT id, room_name FROM hostel_rooms_tb WHERE del = 1 AND (${blockIdFilter}) ORDER BY id ASC`,
    );
    if (!rooms.length) continue;

    const roomIds = rooms.map((r) => String(r.id));
    const roomLabels = Object.fromEntries(rooms.map((r) => [String(r.id), r.room_name]));
    const employeeMatch = roomMatchSql(`B.${employeeRoomField}`, roomIds);
    const employerMatch = roomMatchSql('B.h_room_id', roomIds);
    const roomFilter = ` AND ((${employeeMatch}) OR (${employerMatch}))`;

    const rows = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT(A.id), A.staff_id, A.staff_title, A.staff_name, A.staff_initial,
              B.designation, B.${employeeRoomField} AS room_id, B.h_room_id,
              B.${amountField} AS employee_amount, B.${employerAmountField} AS employer_amount
       FROM staff_profile_tb AS A
       INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
       WHERE A.del = 1 AND B.del = 1
         ${ctx.categoryFilterSql}
         AND B.payroll_month = '${ctx.monthSql}'
         ${roomFilter}
       ${ctx.orderClause}`,
    );

    if (!rows.length) continue;

    const sub = { employee: 0, employer: 0, total: 0 };
    html += `<tr><td height="30" colspan="8"><strong>${escapeHtml(block.block_label)}</strong></td></tr>`;

    rows.forEach((row, idx) => {
      const employee = Number(row.employee_amount) || 0;
      const employer = Number(row.employer_amount) || 0;
      const total = employee + employer;
      sub.employee += employee;
      sub.employer += employer;
      sub.total += total;

      const roomNos = [];
      for (const field of [row.room_id, row.h_room_id]) {
        String(field || '').split(',').forEach((rmid) => {
          const label = roomLabels[String(rmid).trim()];
          if (label) roomNos.push(label);
        });
      }

      html += `<tr>
<td height="25">${idx + 1}</td>
<td nowrap>${escapeHtml(row.staff_id)}</td>
<td nowrap>${escapeHtml(staffDisplayName(row))}</td>
<td nowrap>${escapeHtml(ctx.designationMap[row.designation] || '')}</td>
<td nowrap>${escapeHtml(roomNos.join(','))}</td>
<td class="text-right">${formatIndianMoney(employee)}</td>
<td class="text-right">${formatIndianMoney(employer)}</td>
<td class="text-right" bgcolor="#F4F4F4">${formatIndianMoney(total)}</td>
</tr>`;
    });

    if (sub.total > 0 && blocks.length > 1) {
      html += `<tr>
<th class="text-right" colspan="5">Sub Total</th>
<th class="text-right">${formatIndianMoney(sub.employee)}</th>
<th class="text-right">${formatIndianMoney(sub.employer)}</th>
<th class="text-right" bgcolor="#F4F4F4">${formatIndianMoney(sub.total)}</th>
</tr>`;
    }

    grand.employee += sub.employee;
    grand.employer += sub.employer;
    grand.total += sub.total;
  }

  if (!html) return '';
  const title = ctx.printSetup.body_title || (blockType === 'Quarters' ? 'Rent Report' : 'Mess Report');
  return `<p class="header1">${escapeHtml(title)} &nbsp;</p>
<table class="table-bordered" cellpadding="3" cellspacing="0">
<thead><tr bgcolor="#e7e7e7">
<th>#</th><th>S.ID</th><th>Name</th><th>Designation</th><th>${blockType === 'Quarters' ? 'QTRS. NO.' : 'Room. No.'}</th>
<th>Employee<br>(Rs)</th><th>Employer<br>(Rs)</th><th>Total<br>(Rs)</th>
</tr></thead><tbody>${html}</tbody><tfoot><tr>
<th class="text-right" colspan="5">Grand Total</th>
<th class="text-right">${formatIndianMoney(grand.employee)}</th>
<th class="text-right">${formatIndianMoney(grand.employer)}</th>
<th class="text-right" bgcolor="#F4F4F4">${formatIndianMoney(grand.total)}</th>
</tr></tfoot></table>`;
}

export async function buildRentalReportHtml(ctx) {
  return loadBlockStaffRows(ctx, 'Quarters', 'room_id', 'rental_amount', 'h_rental_amount');
}

export async function buildMessReportHtml(ctx) {
  return loadBlockStaffRows(ctx, 'Hostel', 'm_room_id', 'hostel_amount', 'h_rental_amount');
}

export async function buildLopReportHtml(ctx) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT(A.id), A.staff_id, A.staff_title, A.staff_name, A.staff_initial,
            B.designation, B.lop_amount, B.join_releave, B.a_llp
     FROM staff_profile_tb AS A
     INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND B.del = 1 AND B.lop_amount > 0
       AND B.payroll_month = '${ctx.monthSql}'
       ${ctx.categoryFilterSql}
     ${ctx.orderClause}`,
  );
  if (!rows.length) return '';

  let total = 0;
  const body = rows.map((row, idx) => {
    const amount = Number(row.lop_amount) || 0;
    total += amount;
    const reasons = [];
    const lateJoin = Number(row.join_releave) || 0;
    const lopDays = Number(row.a_llp) || 0;
    if (lateJoin > 0) reasons.push(`Late Join: <strong>${lateJoin}</strong> day${lateJoin > 1 ? 's' : ''}`);
    if (lopDays > 0) reasons.push(`LOP: <strong>${lopDays}</strong> day${lopDays > 1 ? 's' : ''}`);
    return `<tr>
<td height="25">${idx + 1}</td>
<td nowrap>${escapeHtml(row.staff_id)}</td>
<td nowrap>${escapeHtml(staffDisplayName(row))}</td>
<td nowrap>${escapeHtml(ctx.designationMap[row.designation] || '')}</td>
<td class="text-right" bgcolor="#f4f4f4">${formatIndianMoney(amount)}</td>
<td valign="top">${reasons.join(', ')}</td>
</tr>`;
  }).join('');

  return `<p class="header1">${escapeHtml(ctx.printSetup.body_title || 'LOP Report')} &nbsp;</p>
<table class="table-bordered" cellpadding="3" cellspacing="0">
<thead><tr bgcolor="#e7e7e7">
<th>#</th><th>S.ID</th><th>Name</th><th>Designation</th><th>Amount<br>(Rs)</th><th>Reason</th>
</tr></thead><tbody>${body}</tbody><tfoot><tr>
<th class="text-right" colspan="4">Grand Total</th>
<th class="text-right" bgcolor="#f4f4f4">${formatIndianMoney(total)}</th>
<th></th>
</tr></tfoot></table>`;
}

async function loadArrearDetails(staffId, arrearIds, payrollMonth) {
  const ids = String(arrearIds || '').split(',').map((v) => v.trim()).filter(Boolean);
  if (!ids.length) return null;

  const details = { rid: [], month: [], total: [], balance: [], info: [] };
  for (const arrearId of ids) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT receipt_id, a_amount, r_form_month, r_to_month, r_amount, a_reason, a_deduct_from
       FROM salary_arrear WHERE del = 1 AND staff_id = ${Number(staffId)} AND id = '${escapeSql(arrearId)}' LIMIT 1`,
    );
    const row = rows[0];
    if (!row) continue;
    const monthNo = installmentNo(payrollMonth, row.r_form_month);
    const remain = row.r_to_month === payrollMonth
      ? 0
      : (Number(row.a_amount) || 0) - ((Number(row.r_amount) || 0) * monthNo);
    details.rid.push(`${SALARY_ARREAR_PREFIX}${row.receipt_id}`);
    details.month.push(String(monthNo));
    details.total.push(formatIndianMoney(row.a_amount));
    details.balance.push(formatIndianMoney(remain));
    const deductFrom = row.a_deduct_from ? new Date(row.a_deduct_from).toLocaleString('en-IN', { month: 'short', year: 'numeric' }) : '';
    details.info.push(`${deductFrom}: ${String(row.a_reason || '').trim()}`);
  }
  return details;
}

async function loadLoanDetails(staffId, loanIds, payrollMonth) {
  const ids = String(loanIds || '').split(',').map((v) => v.trim()).filter(Boolean);
  if (!ids.length) return null;

  const details = { rid: [], month: [], total: [], balance: [], tenor: [], emi: [], emonth: [] };
  for (const loanId of ids) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT receipt_id, a_amount, a_open_month, a_close_month, a_deduct_amount, a_deduct_month
       FROM salary_advance WHERE del = 1 AND staff_id = ${Number(staffId)} AND id = '${escapeSql(loanId)}' LIMIT 1`,
    );
    const row = rows[0];
    if (!row) continue;
    const monthNo = installmentNo(payrollMonth, row.a_open_month);
    const remain = row.a_close_month === payrollMonth
      ? 0
      : (Number(row.a_amount) || 0) - ((Number(row.a_deduct_amount) || 0) * monthNo);
    details.rid.push(`${SALARY_ADVANCE_PREFIX}${row.receipt_id}`);
    details.month.push(String(monthNo));
    details.total.push(formatIndianMoney(row.a_amount));
    details.balance.push(formatIndianMoney(remain));
    details.tenor.push(String(row.a_deduct_month || ''));
    details.emi.push(formatIndianMoney(row.a_deduct_amount));
    details.emonth.push(row.a_close_month
      ? new Date(row.a_close_month).toLocaleString('en-IN', { month: 'short', year: '2-digit' }).replace(' ', '-')
      : '');
  }
  return details;
}

export async function buildArrearReportHtml(ctx) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT(A.id), A.staff_id, A.staff_title, A.staff_name, A.staff_initial,
            B.designation, B.arrear_amount, B.arrear_id
     FROM staff_profile_tb AS A
     INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND B.del = 1 AND B.arrear_amount > 0
       AND B.payroll_month = '${ctx.monthSql}'
       ${ctx.categoryFilterSql}
     ${ctx.orderClause}`,
  );
  if (!rows.length) return '';

  let total = 0;
  const bodyParts = [];
  for (let idx = 0; idx < rows.length; idx += 1) {
    const row = rows[idx];
    const amount = Number(row.arrear_amount) || 0;
    total += amount;
    const details = await loadArrearDetails(row.id, row.arrear_id, ctx.payrollMonth);
    bodyParts.push(`<tr>
<td height="25">${idx + 1}</td>
<td nowrap>${escapeHtml(row.staff_id)}</td>
<td nowrap>${escapeHtml(staffDisplayName(row))}</td>
<td nowrap>${escapeHtml(ctx.designationMap[row.designation] || '')}</td>
<td class="text-right">${details ? details.month.join('<br>') : ''}</td>
<td class="text-right" bgcolor="#f4f4f4">${formatIndianMoney(amount)}</td>
<td>${details ? details.rid.join('<br>') : ''}</td>
<td class="text-right">${details ? details.total.join('<br>') : ''}</td>
<td class="text-right">${details ? details.balance.join('<br>') : ''}</td>
<td>${details ? details.info.join('<br>') : ''}</td>
</tr>`);
  }

  return `<p class="header1">${escapeHtml(ctx.printSetup.body_title || 'Arrear Report')} &nbsp;</p>
<table class="table-bordered" cellpadding="3" cellspacing="0">
<thead><tr bgcolor="#e7e7e7">
<th>#</th><th>S.ID</th><th>Name</th><th>Designation</th><th>#Installment</th><th>Amount<br>(Rs)</th>
<th>Arrear No</th><th>Arrear Amount<br>(Rs)</th><th>Balance Amount<br>(Rs)</th><th>Info</th>
</tr></thead><tbody>${bodyParts.join('')}</tbody><tfoot><tr>
<th class="text-right" colspan="5">Grand Total</th>
<th class="text-right" bgcolor="#f4f4f4">${formatIndianMoney(total)}</th>
<th></th><th></th><th></th><th></th>
</tr></tfoot></table>`;
}

export async function buildLoanReportHtml(ctx) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT(A.id), A.staff_id, A.staff_title, A.staff_name, A.staff_initial,
            B.designation, B.loan_amount, B.loan_id
     FROM staff_profile_tb AS A
     INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND B.del = 1 AND B.loan_amount > 0
       AND B.payroll_month = '${ctx.monthSql}'
       ${ctx.categoryFilterSql}
     ${ctx.orderClause}`,
  );
  if (!rows.length) return '';

  let total = 0;
  const bodyParts = [];
  for (let idx = 0; idx < rows.length; idx += 1) {
    const row = rows[idx];
    const amount = Number(row.loan_amount) || 0;
    total += amount;
    const details = await loadLoanDetails(row.id, row.loan_id, ctx.payrollMonth);
    bodyParts.push(`<tr>
<td height="25">${idx + 1}</td>
<td nowrap>${escapeHtml(row.staff_id)}</td>
<td nowrap>${escapeHtml(staffDisplayName(row))}</td>
<td nowrap>${escapeHtml(ctx.designationMap[row.designation] || '')}</td>
<td class="text-right">${details ? details.month.join('<br>') : ''}</td>
<td class="text-right" bgcolor="#f4f4f4">${formatIndianMoney(amount)}</td>
<td>${details ? details.rid.join('<br>') : ''}</td>
<td class="text-right">${details ? details.total.join('<br>') : ''}</td>
<td class="text-right">${details ? details.balance.join('<br>') : ''}</td>
<td class="text-right">${details ? details.tenor.join('<br>') : ''}</td>
<td class="text-right">${details ? details.emi.join('<br>') : ''}</td>
<td>${details ? details.emonth.join('<br>') : ''}</td>
</tr>`);
  }

  return `<p class="header1">${escapeHtml(ctx.printSetup.body_title || 'Loan Report')} &nbsp;</p>
<table class="table-bordered" cellpadding="3" cellspacing="0">
<thead><tr bgcolor="#e7e7e7">
<th>#</th><th>S.ID</th><th>Name</th><th>Designation</th><th>#Installment</th><th>Installment Amount<br>(Rs)</th>
<th>Loan No</th><th>Loan Amount<br>(Rs)</th><th>Outstanding<br>(Rs)</th><th>Tenor</th><th>EMI<br>(Rs)</th><th>Ending Month</th>
</tr></thead><tbody>${bodyParts.join('')}</tbody><tfoot><tr>
<th class="text-right" colspan="5">Grand Total</th>
<th class="text-right" bgcolor="#f4f4f4">${formatIndianMoney(total)}</th>
<th></th><th></th><th></th><th></th><th></th><th></th>
</tr></tfoot></table>`;
}

export async function buildTransportReportHtml(ctx) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT(A.id), A.staff_id, A.staff_title, A.staff_name, A.staff_initial,
            B.designation, B.transport_deduction
     FROM staff_profile_tb AS A
     INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND B.del = 1 AND B.transport_deduction > 0
       AND B.payroll_month = '${ctx.monthSql}'
       ${ctx.categoryFilterSql}
     ${ctx.orderClause}`,
  );
  if (!rows.length) return '';

  let total = 0;
  const bodyParts = [];
  for (let idx = 0; idx < rows.length; idx += 1) {
    const row = rows[idx];
    const amount = Number(row.transport_deduction) || 0;
    total += amount;
    const transportRows = await prisma.$queryRawUnsafe(
      `SELECT C.transport_route, B.stopping_name
       FROM staff_transport_setup_tb AS A
       INNER JOIN transport_stopping_tb AS B ON A.stoping_name = B.id
       INNER JOIN transport_tb AS C ON C.transport_number = A.bus_no
       WHERE A.del = 1 AND A.staff_id = ${Number(row.id)} AND B.del = 1 AND C.del = 1
       LIMIT 1`,
    );
    const routeInfo = transportRows[0]
      ? `${transportRows[0].transport_route} & ${transportRows[0].stopping_name}`
      : '';
    bodyParts.push(`<tr>
<td height="25">${idx + 1}</td>
<td nowrap>${escapeHtml(row.staff_id)}</td>
<td nowrap>${escapeHtml(staffDisplayName(row))}</td>
<td nowrap>${escapeHtml(ctx.designationMap[row.designation] || '')}</td>
<td valign="top">${escapeHtml(routeInfo)}</td>
<td class="text-right" bgcolor="#f4f4f4">${formatIndianMoney(amount)}</td>
</tr>`);
  }

  return `<p class="header1">${escapeHtml(ctx.printSetup.body_title || 'Transport Deduction')} &nbsp;</p>
<table class="table-bordered" cellpadding="3" cellspacing="0">
<thead><tr bgcolor="#e7e7e7">
<th>#</th><th>S.ID</th><th>Name</th><th>Designation</th><th>Route &amp; Stop Name</th><th>Amount<br>(Rs)</th>
</tr></thead><tbody>${bodyParts.join('')}</tbody><tfoot><tr>
<th class="text-right" colspan="5">Grand Total</th>
<th class="text-right" bgcolor="#f4f4f4">${formatIndianMoney(total)}</th>
</tr></tfoot></table>`;
}

export async function buildTdsReportHtml(ctx) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.staff_id, A.staff_title, A.staff_name, A.staff_initial, B.designation, B.tds_amount AS amount
     FROM staff_profile_tb AS A
     INNER JOIN staff_payroll_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND B.del = 1 AND B.tds_amount > 0
       AND B.payroll_month = '${ctx.monthSql}'
       ${ctx.categoryFilterSql}
     ${ctx.orderClause}`,
  );
  if (!rows.length) return '';

  let total = 0;
  const body = rows.map((row, idx) => {
    const amount = Number(row.amount) || 0;
    total += amount;
    return `<tr>
<td height="25">${idx + 1}</td>
<td nowrap>${escapeHtml(row.staff_id)}</td>
<td nowrap>${escapeHtml(staffDisplayName(row))}</td>
<td nowrap>${escapeHtml(ctx.designationMap[row.designation] || '')}</td>
<td class="text-right" bgcolor="#f4f4f4">${formatIndianMoney(amount)}</td>
</tr>`;
  }).join('');

  return `<p class="header1">${escapeHtml(ctx.printSetup.body_title || 'TDS Report')} &nbsp;</p>
<table class="table-bordered" cellpadding="3" cellspacing="0">
<thead><tr bgcolor="#e7e7e7">
<th>#</th><th>S.ID</th><th>Name</th><th>Designation</th><th>Amount<br>(Rs)</th>
</tr></thead><tbody>${body}</tbody><tfoot><tr>
<th class="text-right" colspan="4">Grand Total</th>
<th class="text-right" bgcolor="#f4f4f4">${formatIndianMoney(total)}</th>
</tr></tfoot></table>`;
}
