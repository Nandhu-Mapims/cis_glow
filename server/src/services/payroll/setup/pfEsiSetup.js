import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { formatPayrollMonthLabel, toSqlDate } from '../payrollHelpers.js';
import { auditFields, logPayrollSetup } from './setupAudit.js';
import { parsePayrollMonthRef } from '../payrollShared.js';

const PAGE = 'staff_pfesi_setup.php';

function sqlDateToMonthRef(val) {
  const sql = toSqlDate(val);
  if (!sql || sql.startsWith('0000')) return '';
  const [yyyy, mm] = sql.split('-');
  if (!yyyy || !mm) return '';
  return `${mm}-${yyyy}`;
}

function mapRow(row) {
  if (!row) return null;
  const fromSql = toSqlDate(row.from_month);
  const toSql = toSqlDate(row.to_month);
  return {
    id: String(row.id),
    fromMonth: sqlDateToMonthRef(row.from_month),
    toMonth: sqlDateToMonthRef(row.to_month),
    epfEr: row.epf_er,
    eps: row.eps,
    admCharge: row.adm_charge,
    edli: row.edli,
    adliAdd: row.adli_add,
    esiMin: row.esi_min,
    esiEr: row.esi_er,
    label: `${formatPayrollMonthLabel(fromSql || row.from_month)} – ${formatPayrollMonthLabel(toSql || row.to_month)}`,
  };
}

export async function loadPfEsiSetup(fields = {}, memberId, audit = {}) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, from_month, to_month, epf_er, eps, adm_charge, edli, adli_add, esi_min, esi_er
     FROM basic_pfesi_setup WHERE del = 1 ORDER BY from_month DESC`,
  );
  const selectedId = String(fields.academic_date || rows[0]?.id || '');
  const selected = mapRow(rows.find((r) => String(r.id) === selectedId) || rows[0]);

  await logPayrollSetup(PAGE, 'View', 'Successful', selectedId, memberId, audit);

  return {
    slabOptions: rows.map((r) => ({ value: String(r.id), label: mapRow(r).label })),
    selected,
  };
}

export async function savePfEsiSetup(fields, memberId, audit = {}) {
  if (fields.delete === 'Confirm') {
    const rowId = String(fields.academic_date || '');
    if (rowId && /^\d+$/.test(rowId)) {
      const { update } = auditFields(memberId, audit);
      await prisma.basic_pfesi_setup.update({
        where: { id: Number(rowId) },
        data: { del: 0, ...update },
      });
    }
    await logPayrollSetup(PAGE, 'Delete', 'Successful', rowId, memberId, audit);
    return {
      success: true,
      message: 'Your details are deleted...',
      ...(await loadPfEsiSetup({}, memberId, { ...audit, skipLog: true })),
    };
  }

  if (fields.Submit !== 'Update') {
    return loadPfEsiSetup(fields, memberId, audit);
  }

  const fromSql = parsePayrollMonthRef(fields.h_from_date);
  const toSql = parsePayrollMonthRef(fields.h_to_date);
  if (!fromSql || !toSql) {
    return { success: false, message: 'From and To month (MM-YYYY) are required' };
  }
  const slabId = String(fields.academic_date || '');
  const payload = {
    from_month: new Date(`${fromSql}T12:00:00`),
    to_month: new Date(`${toSql}T12:00:00`),
    epf_er: String(fields.epf_er || ''),
    eps: String(fields.eps || ''),
    adm_charge: String(fields.adm_charge || ''),
    edli: String(fields.edli || ''),
    adli_add: String(fields.adli_add || ''),
    esi_min: String(fields.esi_min || ''),
    esi_er: String(fields.esi_er || ''),
    del: 1,
    ...auditFields(memberId, audit).update,
  };

  if (slabId === 'Add New' || slabId === 'add-new') {
    await prisma.basic_pfesi_setup.create({
      data: { ...payload, ...auditFields(memberId, audit).create },
    });
  } else if (/^\d+$/.test(slabId)) {
    await prisma.basic_pfesi_setup.update({
      where: { id: Number(slabId) },
      data: payload,
    });
  }

  await logPayrollSetup(PAGE, 'Update', 'Successful', slabId, memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadPfEsiSetup({ academic_date: slabId }, memberId, { ...audit, skipLog: true })),
  };
}
