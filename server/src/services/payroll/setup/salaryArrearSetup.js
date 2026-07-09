import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { saveLegacyBinaryFile } from '../../web/webUpload.js';
import { auditFields, logPayrollSetup } from './setupAudit.js';
import {
  loadEduSetupByCategory,
  monthRefToSqlDate,
  sqlDateToMonthRef,
  staffDisplayName,
} from '../payrollShared.js';

const PAGE_ADD = 'salary_arrear_add.php';
const PAGE_RELEASE = 'salary_arrear_edit.php';
const SALARY_ARREAR_PREFIX = 'APAR';

function currentMonthSqlDate() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-01`;
}

function parseMonthField(value) {
  return monthRefToSqlDate(value) || currentMonthSqlDate();
}

function addMonthsSql(sqlDate, count) {
  const d = new Date(`${sqlDate}T00:00:00`);
  d.setMonth(d.getMonth() + count);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

function computeReleaseSchedule(arrearAmount, releaseAmount, releaseFromRaw) {
  const amount = Number(arrearAmount) || 0;
  const perMonth = Number(releaseAmount) || 0;
  const releaseFrom = parseMonthField(releaseFromRaw);
  let rMTotal = 1;
  if (perMonth > 0) rMTotal = Math.ceil(amount / perMonth);
  const rCloseAmount = amount - perMonth * (rMTotal - 1);
  let releaseTo = releaseFrom;
  if (rMTotal > 1) releaseTo = addMonthsSql(releaseFrom, rMTotal - 1);
  return { releaseFrom, releaseTo, rMTotal, rCloseAmount };
}

async function loadNextArrearReceipt() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT receipt_id FROM salary_arrear WHERE del = 1 ORDER BY receipt_id + 0 DESC LIMIT 1`,
  );
  const next = (Number(rows[0]?.receipt_id) || 0) + 1;
  return { nextReceiptId: next, arrearNo: `${SALARY_ARREAR_PREFIX}${next}` };
}

async function loadArrearStaffOptions() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id, staff_name, staff_initial, staff_title
     FROM staff_profile_tb
     WHERE del = 1
       AND (releaving_date = '0000-00-00' OR releaving_date > DATE(NOW()))
     ORDER BY staff_name ASC, staff_initial ASC`,
  );
  return rows.map((row) => ({
    value: String(row.id),
    label: `${staffDisplayName(row)} | ${row.staff_id}`,
  }));
}

export async function loadSalaryArrearAddSetup(fields = {}, memberId, audit = {}) {
  const { nextReceiptId, arrearNo } = await loadNextArrearReceipt();
  const arrearTypes = await loadEduSetupByCategory('Salary Arrear');
  const staffOptions = await loadArrearStaffOptions();

  await logPayrollSetup(PAGE_ADD, 'View', 'Successful', '', memberId, audit);
  return { arrearNo, nextReceiptId, arrearTypes, staffOptions };
}

export async function saveSalaryArrearAddSetup(fields, memberId, files = [], audit = {}) {
  if (fields.Submit !== 'Update') {
    return loadSalaryArrearAddSetup(fields, memberId, audit);
  }

  const staffId = String(fields.staff_id || '');
  if (!staffId) return { success: false, message: 'Please select a staff member' };
  if (!fields.arrear_type) return { success: false, message: 'Please select arrear type' };
  if (!fields.arrear_amount) return { success: false, message: 'Amount is required' };

  const releaseChecked = String(fields.a_close || '') === '1';
  const arrearFrom = parseMonthField(fields.arrear_from);

  let releaseAmount = '';
  let releaseFrom = '';
  let releaseTo = '';
  let rMTotal = '';
  let rCloseAmount = '';
  let releaseApproved = '';
  let releaseDoc = '';
  const aStatus = releaseChecked ? '1' : '';

  if (releaseChecked && fields.release_amount && fields.release_from) {
    releaseAmount = String(fields.release_amount);
    const schedule = computeReleaseSchedule(fields.arrear_amount, releaseAmount, fields.release_from);
    releaseFrom = schedule.releaseFrom;
    releaseTo = schedule.releaseTo;
    rMTotal = schedule.rMTotal;
    rCloseAmount = schedule.rCloseAmount;
    releaseApproved = String(fields.release_approved || '');

    const file = files.find((f) => f.field?.includes('release_document'));
    if (file) {
      const saved = await saveLegacyBinaryFile({
        folder: 'salary_arrear',
        file,
        allowedExt: new Set(['jpeg', 'gif', 'jpg', 'png', 'pdf']),
      });
      if (saved.error) return { success: false, message: saved.error };
      releaseDoc = saved.filename;
    }
  }

  const { nextReceiptId } = await loadNextArrearReceipt();
  const { ip } = auditFields(memberId, audit);

  await prisma.$executeRawUnsafe(
    `INSERT INTO salary_arrear
     (receipt_id, staff_id, a_type, a_amount, a_deduct_from, a_reason, a_status,
      r_amount, r_form_month, r_to_month, r_m_total, r_close_amount, r_attach, r_approved,
      created_dt, created_ip, created_by, del)
     VALUES ('${nextReceiptId}', '${escapeSql(staffId)}', '${escapeSql(fields.arrear_type || '')}',
       '${escapeSql(fields.arrear_amount || '')}', '${escapeSql(arrearFrom)}',
       '${escapeSql(fields.arrear_reason || '')}', '${escapeSql(aStatus)}',
       '${escapeSql(releaseAmount)}', '${escapeSql(releaseFrom)}', '${escapeSql(releaseTo)}',
       '${escapeSql(String(rMTotal))}', '${escapeSql(String(rCloseAmount))}',
       '${escapeSql(releaseDoc)}', '${escapeSql(releaseApproved)}',
       NOW(), '${escapeSql(ip)}', '${escapeSql(memberId)}', 1)`,
  );

  await logPayrollSetup(PAGE_ADD, 'Add', 'Successful', String(staffId), memberId, audit);
  return {
    success: true,
    message: 'Arrear added.',
    ...(await loadSalaryArrearAddSetup({}, memberId, { ...audit, skipLog: true })),
  };
}

function formatMonthLabel(val) {
  const ref = sqlDateToMonthRef(val);
  if (!ref) return '';
  const [mm, yyyy] = ref.split('-');
  const d = new Date(Number(yyyy), Number(mm) - 1, 1);
  if (Number.isNaN(d.getTime())) return ref;
  return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
}

function buildSearchFilters(fields = {}) {
  const receiptSearch = String(fields.a_search || fields.receipt_search || '').trim();
  const staffSearch = String(fields.s_search || fields.staff_search || '').trim();
  const monthSearch = String(fields.m_search || fields.payroll_month || '').trim();
  return { receiptSearch, staffSearch, monthSearch };
}

function buildSearchWhere({ receiptSearch, staffSearch, monthSearch }) {
  let where = 'A.del = 1 AND B.del = 1';
  if (receiptSearch) {
    const receiptNum = receiptSearch.replace(/^APAR/i, '');
    where += ` AND A.receipt_id = '${escapeSql(receiptNum)}'`;
  }
  if (staffSearch) {
    where += ` AND B.staff_id = '${escapeSql(staffSearch)}'`;
  }
  if (monthSearch) {
    const payrollMonth = monthRefToSqlDate(monthSearch) || monthSearch;
    if (payrollMonth) where += ` AND A.a_deduct_from <= '${escapeSql(payrollMonth)}'`;
  }
  return where;
}

function mapArrearListRow(row) {
  return {
    id: String(row.id),
    receiptId: row.receipt_id,
    receiptNo: `${SALARY_ARREAR_PREFIX}${row.receipt_id}`,
    staffCode: row.staff_code,
    name: staffDisplayName(row),
    deductAmount: row.a_amount,
    deductMonth: formatMonthLabel(row.a_deduct_from),
    releaseAmount: row.r_amount || '',
    releaseMonth: formatMonthLabel(row.r_form_month),
  };
}

function mapArrearDetail(row, staffRow) {
  return {
    id: String(row.id),
    receiptId: row.receipt_id,
    receiptNo: `${SALARY_ARREAR_PREFIX}${row.receipt_id}`,
    staffId: String(row.staff_id),
    staffCode: staffRow?.staff_id,
    staffName: staffRow ? staffDisplayName(staffRow) : '',
    arrearType: String(row.a_type || ''),
    amount: row.a_amount,
    deductFrom: sqlDateToMonthRef(row.a_deduct_from),
    reason: row.a_reason || '',
    releaseOpen: Number(row.a_status) === 1,
    releaseAmount: row.r_amount || '',
    releaseFrom: sqlDateToMonthRef(row.r_form_month),
    releaseApproved: row.r_approved || '',
    releaseAttachment: row.r_attach || '',
  };
}

async function loadArrearList(fields = {}) {
  const search = buildSearchFilters(fields);
  const where = buildSearchWhere(search);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.id, A.receipt_id, A.a_amount,
            CAST(A.a_deduct_from AS CHAR) AS a_deduct_from,
            CAST(A.r_form_month AS CHAR) AS r_form_month,
            A.r_amount,
            B.staff_id AS staff_code, B.staff_name, B.staff_initial, B.staff_title
     FROM salary_arrear AS A
     INNER JOIN staff_profile_tb AS B ON A.staff_id = B.id
     WHERE ${where}
     ORDER BY A.receipt_id ASC LIMIT 100`,
  );
  return {
    mode: 'list',
    arrears: rows.map(mapArrearListRow),
    selected: search,
    total: rows.length,
  };
}

async function loadArrearEdit(editId, fields = {}) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, receipt_id, staff_id, a_type, a_amount, a_reason, a_status,
            r_amount, r_approved, r_attach,
            CAST(a_deduct_from AS CHAR) AS a_deduct_from,
            CAST(r_form_month AS CHAR) AS r_form_month
     FROM salary_arrear WHERE del = 1 AND id = '${escapeSql(editId)}' LIMIT 1`,
  );
  const row = rows[0];
  if (!row) {
    return { mode: 'list', ...(await loadArrearList(fields)), error: 'Arrear not found' };
  }

  const staffRows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id, staff_name, staff_initial, staff_title
     FROM staff_profile_tb WHERE del = 1 AND id = '${escapeSql(String(row.staff_id))}' LIMIT 1`,
  );
  const staffRow = staffRows[0];
  const arrearTypes = await loadEduSetupByCategory('Salary Arrear');

  return {
    mode: 'edit',
    selectedArrear: mapArrearDetail(row, staffRow),
    arrearTypes,
    selected: buildSearchFilters(fields),
    staffOptions: staffRow ? [{
      value: String(staffRow.id),
      label: `${staffDisplayName(staffRow)} | ${staffRow.staff_id}`,
    }] : [],
  };
}

export async function loadSalaryArrearReleaseSetup(fields = {}, memberId, audit = {}) {
  const editId = String(fields.edit_id || fields.edit_row_id || '').trim();
  const updateField = fields.update;
  let resolvedEditId = editId;
  if (!resolvedEditId && updateField) {
    if (Array.isArray(updateField)) resolvedEditId = String(updateField[0] || '');
    else if (typeof updateField === 'object') resolvedEditId = String(Object.values(updateField)[0] || '');
    else resolvedEditId = String(updateField);
  }

  const payload = resolvedEditId
    ? await loadArrearEdit(resolvedEditId, fields)
    : await loadArrearList(fields);

  await logPayrollSetup(PAGE_RELEASE, 'View', 'Successful', resolvedEditId || buildSearchFilters(fields).receiptSearch, memberId, audit);
  return payload;
}

export async function saveSalaryArrearReleaseSetup(fields, memberId, files = [], audit = {}) {
  const searchFields = {
    a_search: fields.a_search,
    s_search: fields.s_search,
    m_search: fields.m_search,
  };

  if (fields.delete === 'Confirm') {
    const rowId = String(fields.confirm || fields.id || '');
    if (rowId) {
      const { ip } = auditFields(memberId, audit);
      await prisma.$executeRawUnsafe(
        `UPDATE salary_arrear SET del = 0, updated_dt = NOW(), updated_by = '${escapeSql(memberId)}', updated_ip = '${escapeSql(ip)}' WHERE id = '${escapeSql(rowId)}'`,
      );
    }
    return {
      success: true,
      message: 'Your details are deleted...',
      ...(await loadSalaryArrearReleaseSetup(searchFields, memberId, { ...audit, skipLog: true })),
    };
  }

  if (String(fields.Submit || '') !== 'Save') {
    return loadSalaryArrearReleaseSetup(fields, memberId, audit);
  }

  const editRowId = String(fields.edit_row_id || fields.id || '');
  if (!editRowId) return { success: false, message: 'Arrear record not found' };

  const releaseChecked = String(fields.a_close || '') === '1';
  const arrearFrom = parseMonthField(fields.arrear_from);
  const aStatus = releaseChecked ? '1' : '';

  let releaseAmount = '';
  let releaseFrom = '';
  let releaseTo = '';
  let rMTotal = '';
  let rCloseAmount = '';
  let releaseApproved = '';
  let releaseDoc = String(fields.hd_release_document || '');

  if (releaseChecked) {
    releaseAmount = String(fields.release_amount || '');
    if (releaseAmount && fields.release_from) {
      const schedule = computeReleaseSchedule(fields.arrear_amount, releaseAmount, fields.release_from);
      releaseFrom = schedule.releaseFrom;
      releaseTo = schedule.releaseTo;
      rMTotal = schedule.rMTotal;
      rCloseAmount = schedule.rCloseAmount;
    }
    releaseApproved = String(fields.release_approved || '');

    const file = files.find((f) => f.field?.includes('release_document'));
    if (file) {
      const saved = await saveLegacyBinaryFile({
        folder: 'salary_arrear',
        file,
        allowedExt: new Set(['jpeg', 'gif', 'jpg', 'png', 'pdf']),
      });
      if (saved.error) return { success: false, message: saved.error };
      releaseDoc = saved.filename;
    }
  } else {
    releaseDoc = '';
  }

  const { ip } = auditFields(memberId, audit);
  await prisma.$executeRawUnsafe(
    `UPDATE salary_arrear SET
     a_type='${escapeSql(fields.arrear_type || '')}',
     a_amount='${escapeSql(fields.arrear_amount || '')}',
     a_deduct_from='${escapeSql(arrearFrom)}',
     a_reason='${escapeSql(fields.arrear_reason || '')}',
     a_status='${escapeSql(aStatus)}',
     r_amount='${escapeSql(releaseAmount)}',
     r_form_month='${escapeSql(releaseFrom)}',
     r_to_month='${escapeSql(releaseTo)}',
     r_m_total='${escapeSql(String(rMTotal))}',
     r_close_amount='${escapeSql(String(rCloseAmount))}',
     r_approved='${escapeSql(releaseApproved)}',
     r_attach='${escapeSql(releaseDoc)}',
     updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(ip)}'
     WHERE id='${escapeSql(editRowId)}'`,
  );

  await logPayrollSetup(PAGE_RELEASE, 'Update', 'Successful', editRowId, memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadSalaryArrearReleaseSetup({ ...searchFields, edit_id: editRowId }, memberId, { ...audit, skipLog: true })),
  };
}
