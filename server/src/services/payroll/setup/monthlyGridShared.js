import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logPayrollSetup } from './setupAudit.js';
import {
  loadActiveStaffGrid,
  loadJobCategoryOptions,
  loadOpenPayrollMonthOptions,
  parsePayrollMonthRef,
} from '../payrollShared.js';

export function createMonthlyGridSetup(config) {
  const {
    page,
    tableName,
    amountField,
    reasonField = null,
    idField = 'tds_id',
    extraSelect = '',
    extraSaveFields = null,
    tdsFilter = false,
    chequeMode = false,
  } = config;

  async function loadExistingRows(payrollMonthSql, staffIds) {
    if (!staffIds.length) return {};
    const map = {};
    const idList = staffIds.map((id) => `'${escapeSql(id)}'`).join(',');
    const reasonCol = reasonField ? `, ${reasonField}` : '';
    const extraCols = extraSelect ? `, ${extraSelect}` : '';
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, staff_id, ${amountField}${reasonCol}${extraCols}
       FROM ${tableName}
       WHERE del = 1 AND salary_month = '${escapeSql(payrollMonthSql)}'
         AND staff_id IN (${idList})`,
    );
    for (const row of rows) {
      map[String(row.staff_id)] = row;
    }
    return map;
  }

  async function load(fields = {}, memberId, audit = {}) {
    const monthOptions = await loadOpenPayrollMonthOptions(false);
    const defaultPayrollMonth = monthOptions[0]?.value || '';
    const payrollMonthRaw = String(fields.payroll_month || '').trim();
    const payrollMonthSql = parsePayrollMonthRef(payrollMonthRaw)
      || monthOptions.find((m) => m.value === payrollMonthRaw)?.monthSql
      || String(fields.salary_month || '').trim()
      || monthOptions[0]?.monthSql
      || '';

    const searchCategory = String(
      Array.isArray(fields.search_category)
        ? fields.search_category[0]
        : (fields.search_category || ''),
    ).trim();

    const categoryOptions = await loadJobCategoryOptions(payrollMonthSql, searchCategory);
    let rows = [];
    const isGenerate = fields.Submit === 'Generate';

    if (isGenerate && payrollMonthSql && searchCategory) {
      const staff = await loadActiveStaffGrid(payrollMonthSql, searchCategory, { tdsFilter });
      const existing = await loadExistingRows(payrollMonthSql, staff.map((s) => s.id));
      rows = staff.map((s, idx) => {
        const ex = existing[s.id] || {};
        const base = {
          index: idx + 1,
          staffId: s.id,
          staffCode: s.staffId,
          name: s.name,
          rowId: ex.id ? String(ex.id) : '',
          amount: ex[amountField] ?? '',
        };
        if (reasonField) base.reason = ex[reasonField] ?? '';
        if (chequeMode) {
          base.payCheque = Number(ex.pay_cheque) === 1;
          base.reason = ex.reason ?? '';
        }
        return base;
      });
    }

    await logPayrollSetup(
      page,
      isGenerate ? 'Generate' : 'View',
      'Successful',
      `${searchCategory}__${payrollMonthSql}`,
      memberId,
      audit,
    );

    return {
      monthOptions,
      categoryOptions,
      selected: {
        payrollMonth: payrollMonthRaw,
        payrollMonthSql,
        searchCategory,
        defaultPayrollMonth,
      },
      rows,
      canSubmit: rows.length > 0,
    };
  }

  async function save(fields, memberId, audit = {}) {
    if (fields.Submit !== 'Submit') {
      return load(fields, memberId, audit);
    }

    const payrollMonth = String(fields.salary_month || fields.payroll_month || '').trim();
    const payrollMonthSql = parsePayrollMonthRef(payrollMonth) || payrollMonth;
    const staffIds = Array.isArray(fields.staff_id) ? fields.staff_id : [];
    const amounts = Array.isArray(fields[amountField.endsWith('[]') ? amountField : `${amountField.replace(/_amount$/, '')}_amount`])
      ? fields[amountField.endsWith('[]') ? amountField : `${amountField.replace(/_amount$/, '')}_amount`]
      : (Array.isArray(fields.d_amount) ? fields.d_amount : (Array.isArray(fields.tds_amount) ? fields.tds_amount : []));
    const rowIds = Array.isArray(fields[idField]) ? fields[idField] : [];
    const reasons = reasonField && Array.isArray(fields.d_reason) ? fields.d_reason : [];
    const payCheques = chequeMode && Array.isArray(fields.pay_cheque) ? fields.pay_cheque : [];
    const { create, update } = auditFields(memberId, audit);

    const amountKey = Array.isArray(fields.tds_amount) ? 'tds_amount' : 'd_amount';

    for (let i = 0; i < staffIds.length; i++) {
      const staffId = String(staffIds[i] || '').trim();
      const amount = String(
        (Array.isArray(fields[amountKey]) ? fields[amountKey][i] : amounts[i]) || '',
      ).trim();
      const rowId = rowIds[i];

      if (chequeMode) {
        const checked = payCheques.includes(String(i)) || payCheques.includes(String(staffId));
        const reason = String(reasons[i] || '').trim();
        if (!rowId && !checked && !reason) continue;
        const data = {
          salary_month: new Date(payrollMonthSql),
          staff_id: staffId,
          pay_cheque: checked ? '1' : '0',
          reason,
          del: 1,
          ...update,
        };
        if (!rowId) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO ${tableName} (salary_month, staff_id, pay_cheque, reason, created_dt, created_ip, created_by, del)
             VALUES ('${escapeSql(payrollMonthSql)}', '${escapeSql(staffId)}', '${data.pay_cheque}',
               '${escapeSql(reason)}', NOW(), '${escapeSql(create.created_ip || '')}', '${escapeSql(memberId)}', 1)`,
          );
        } else {
          await prisma.$executeRawUnsafe(
            `UPDATE ${tableName} SET salary_month='${escapeSql(payrollMonthSql)}',
             staff_id='${escapeSql(staffId)}', pay_cheque='${data.pay_cheque}',
             reason='${escapeSql(reason)}', del=1,
             updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip || '')}'
             WHERE id='${escapeSql(String(rowId))}'`,
          );
        }
        continue;
      }

      if (!amount) continue;
      const reason = reasonField ? String(reasons[i] || '').trim() : '';

      if (!rowId) {
        const cols = ['salary_month', 'staff_id', amountField];
        const vals = [`'${escapeSql(payrollMonthSql)}'`, `'${escapeSql(staffId)}'`, `'${escapeSql(amount)}'`];
        if (reasonField) {
          cols.push(reasonField);
          vals.push(`'${escapeSql(reason)}'`);
        }
        await prisma.$executeRawUnsafe(
          `INSERT INTO ${tableName} (${cols.join(', ')}, created_dt, created_ip, created_by, del)
           VALUES (${vals.join(', ')}, NOW(), '${escapeSql(create.created_ip || '')}', '${escapeSql(memberId)}', 1)`,
        );
      } else {
        let setClause = `salary_month='${escapeSql(payrollMonthSql)}', staff_id='${escapeSql(staffId)}',
          ${amountField}='${escapeSql(amount)}', del=1,
          updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(update.updated_ip || '')}'`;
        if (reasonField) setClause += `, ${reasonField}='${escapeSql(reason)}'`;
        await prisma.$executeRawUnsafe(
          `UPDATE ${tableName} SET ${setClause} WHERE id='${escapeSql(String(rowId))}'`,
        );
      }
    }

    if (typeof extraSaveFields === 'function') {
      await extraSaveFields(fields, memberId, audit);
    }

    await logPayrollSetup(page, 'Update', 'Successful', payrollMonthSql, memberId, audit);
    return {
      success: true,
      message: 'Your details are updated...',
      ...(await load(fields, memberId, { ...audit, skipLog: true })),
    };
  }

  return { load, save };
}
