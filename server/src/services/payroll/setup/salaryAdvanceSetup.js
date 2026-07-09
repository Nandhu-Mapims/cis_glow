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

const PAGE_ADD = 'salary_advance_add.php';
const PAGE_CLOSE = 'salary_advance_edit.php';
const SALARY_ADVANCE_PREFIX = 'APAD';

function currentMonthSqlDate() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-01`;
}

function parseMonthField(value) {
  const parsed = monthRefToSqlDate(value);
  return parsed || currentMonthSqlDate();
}

function computeInstallments(amount, months) {
  const amt = Number(amount) || 0;
  const n = Number(months) || 0;
  if (n > 0) {
    const deduct = Math.ceil(amt / n);
    const closeAmount = amt - deduct * (n - 1);
    return { deduct, closeAmount };
  }
  return { deduct: amt, closeAmount: amt };
}

function computeDetectionRange(detectionFromRaw, noOfMonth, holdMonthCount = 0) {
  const detectionFrom = parseMonthField(detectionFromRaw);
  let detectionTo = detectionFrom;
  const months = Number(noOfMonth) || 0;
  if (months > 1) {
    const d = new Date(`${detectionFrom}T00:00:00`);
    d.setMonth(d.getMonth() + (months + holdMonthCount - 1));
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    detectionTo = `${yyyy}-${mm}-01`;
  }
  return { detectionFrom, detectionTo };
}

async function loadNextReceiptId() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT receipt_id FROM salary_advance WHERE del = 1 ORDER BY receipt_id + 0 DESC LIMIT 1`,
  );
  const next = (Number(rows[0]?.receipt_id) || 0) + 1;
  return { nextReceiptId: next, advanceNo: `${SALARY_ADVANCE_PREFIX}${next}` };
}

async function loadSuretyOptionsForEdit(excludeAdvanceId = '') {
  const excludeSql = excludeAdvanceId
    ? `AND SA.id != '${escapeSql(excludeAdvanceId)}'`
    : '';
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.id, A.staff_id, A.staff_name, A.staff_initial, A.staff_title,
      (
        SELECT COUNT(*) FROM salary_advance SA
        WHERE SA.del = 1 ${excludeSql}
          AND SA.a_close_month >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          AND (
            SA.surity = CAST(A.id AS CHAR)
            OR SA.surity LIKE CONCAT(CAST(A.id AS CHAR), ',%')
            OR SA.surity LIKE CONCAT('%,', CAST(A.id AS CHAR))
            OR SA.surity LIKE CONCAT('%,', CAST(A.id AS CHAR), ',%')
          )
      ) AS surety_count
     FROM staff_profile_tb A
     WHERE A.del = 1
       AND (A.releaving_date = '0000-00-00' OR A.releaving_date > DATE(NOW()))
     ORDER BY A.staff_name ASC, A.staff_initial ASC`,
  );
  return rows.map((row) => {
    const option = {
      value: String(row.id),
      label: `${staffDisplayName(row)} | ${row.staff_id}`,
      disabled: Number(row.surety_count) >= 2,
      note: Number(row.surety_count) >= 2 ? '**' : '',
    };
    return option;
  });
}

function formatMonthLabel(val) {
  const ref = sqlDateToMonthRef(val);
  if (!ref) return '';
  const [mm, yyyy] = ref.split('-');
  const d = new Date(Number(yyyy), Number(mm) - 1, 1);
  if (Number.isNaN(d.getTime())) return ref;
  return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
}

function parseSqlDateField(val) {
  const raw = String(val ?? '').trim();
  if (!raw || raw.startsWith('0000')) return '';
  return raw.slice(0, 10);
}

function mapAdvanceListRow(row) {
  return {
    id: String(row.id),
    receiptId: row.receipt_id,
    receiptNo: `${SALARY_ADVANCE_PREFIX}${row.receipt_id}`,
    staffCode: row.staff_code,
    name: staffDisplayName(row),
    amount: row.a_amount,
    issuedMonth: formatMonthLabel(row.a_issue_month),
    deductFrom: formatMonthLabel(row.a_open_month),
    deductMonths: row.a_deduct_month,
    closed: Number(row.status) === 1,
  };
}

function mapAdvanceDetail(row, staffRow) {
  const holdMonths = String(row.hold_month || '').split(',').filter(Boolean);
  const surety = String(row.surity || '').split(',').filter(Boolean);
  return {
    id: String(row.id),
    receiptId: row.receipt_id,
    receiptNo: `${SALARY_ADVANCE_PREFIX}${row.receipt_id}`,
    staffId: String(row.staff_id),
    staffCode: staffRow?.staff_id,
    staffName: staffRow ? staffDisplayName(staffRow) : '',
    advanceType: String(row.a_type || ''),
    issuedMonth: sqlDateToMonthRef(row.a_issue_month),
    amount: row.a_amount,
    detectionFrom: sqlDateToMonthRef(row.a_open_month),
    noOfMonths: String(row.a_deduct_month ?? ''),
    holdMonths,
    surety,
    attachment: row.attachment || '',
    approvedBy: row.open_approve_by || '',
    closed: Number(row.status) === 1,
    closeMonth: sqlDateToMonthRef(row.a_close_month),
    closeAmount: row.close_amount || '',
    closeApprovedBy: row.close_approve_by || '',
    fromSalary: Number(row.from_salary) === 1,
    salaryMonth: sqlDateToMonthRef(row.salary_month),
    salaryAmount: row.salary_amount || '',
    fromBank: Number(row.from_bank) === 1,
    depositDate: parseSqlDateField(row.dep_date),
    depositAmount: row.dep_amount || '',
    bankName: row.bank_name || '',
  };
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
    const receiptNum = receiptSearch.replace(/^APAD/i, '');
    where += ` AND A.receipt_id = '${escapeSql(receiptNum)}'`;
  }
  if (staffSearch) {
    where += ` AND B.staff_id = '${escapeSql(staffSearch)}'`;
  }
  if (monthSearch) {
    const payrollMonth = monthRefToSqlDate(monthSearch) || monthSearch;
    if (payrollMonth) {
      where += ` AND A.a_open_month <= '${escapeSql(payrollMonth)}' AND A.a_close_month >= '${escapeSql(payrollMonth)}'`;
    }
  }
  return where;
}

async function loadAdvanceList(fields = {}) {
  const search = buildSearchFilters(fields);
  const where = buildSearchWhere(search);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.id, A.receipt_id, A.a_amount, A.a_issue_month, A.a_open_month, A.a_deduct_month, A.status,
            B.staff_id AS staff_code, B.staff_name, B.staff_initial, B.staff_title
     FROM salary_advance AS A
     INNER JOIN staff_profile_tb AS B ON A.staff_id = B.id
     WHERE ${where}
     ORDER BY A.receipt_id DESC LIMIT 100`,
  );
  return {
    mode: 'list',
    advances: rows.map(mapAdvanceListRow),
    selected: search,
    total: rows.length,
  };
}

async function loadAdvanceEdit(editId, fields = {}) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, receipt_id, staff_id, a_type, a_amount, a_deduct_amount, a_deduct_month,
            hold_month, surity, attachment, open_approve_by, close_amount, close_approve_by,
            status, from_salary, salary_amount, from_bank, dep_amount, bank_name,
            CAST(a_issue_month AS CHAR) AS a_issue_month,
            CAST(a_open_month AS CHAR) AS a_open_month,
            CAST(a_close_month AS CHAR) AS a_close_month,
            CAST(salary_month AS CHAR) AS salary_month,
            CAST(dep_date AS CHAR) AS dep_date
     FROM salary_advance WHERE del = 1 AND id = '${escapeSql(editId)}' LIMIT 1`,
  );
  const row = rows[0];
  if (!row) return { mode: 'list', ...(await loadAdvanceList(fields)), error: 'Advance not found' };

  const staffRows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id, staff_name, staff_initial, staff_title
     FROM staff_profile_tb WHERE del = 1 AND id = '${escapeSql(String(row.staff_id))}' LIMIT 1`,
  );
  const staffRow = staffRows[0];
  const advanceTypes = await loadEduSetupByCategory('Salary Advance');
  const suretyOptions = await loadSuretyOptionsForEdit(editId);

  return {
    mode: 'edit',
    selectedAdvance: mapAdvanceDetail(row, staffRow),
    advanceTypes,
    suretyOptions,
    maxSurety: 2,
    selected: buildSearchFilters(fields),
    staffOptions: staffRow ? [{
      value: String(staffRow.id),
      label: `${staffDisplayName(staffRow)} | ${staffRow.staff_id}`,
    }] : [],
  };
}

async function loadAdvanceStaffOptions() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.id, A.staff_id, A.staff_name, A.staff_initial, A.staff_title,
      CASE WHEN EXISTS (
        SELECT 1 FROM salary_advance SA
        WHERE SA.del = 1 AND SA.staff_id = A.id
          AND SA.a_close_month >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
      ) THEN 1 ELSE 0 END AS has_open_advance,
      (
        SELECT COUNT(*) FROM salary_advance SA
        WHERE SA.del = 1 AND SA.a_close_month >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          AND (
            SA.surity = CAST(A.id AS CHAR)
            OR SA.surity LIKE CONCAT(CAST(A.id AS CHAR), ',%')
            OR SA.surity LIKE CONCAT('%,', CAST(A.id AS CHAR))
            OR SA.surity LIKE CONCAT('%,', CAST(A.id AS CHAR), ',%')
          )
      ) AS surety_count
     FROM staff_profile_tb A
     WHERE A.del = 1
       AND (A.releaving_date = '0000-00-00' OR A.releaving_date > DATE(NOW()))
     ORDER BY A.staff_name ASC, A.staff_initial ASC`,
  );

  const staffOptions = [];
  const suretyOptions = [];
  for (const row of rows) {
    const option = {
      value: String(row.id),
      label: `${staffDisplayName(row)} | ${row.staff_id}`,
      disabled: false,
    };
    if (Number(row.has_open_advance) === 1) {
      staffOptions.push({ ...option, disabled: true, note: '**' });
    } else {
      staffOptions.push(option);
    }
    if (Number(row.surety_count) >= 2) {
      suretyOptions.push({ ...option, disabled: true, note: '**' });
    } else {
      suretyOptions.push({ ...option, disabled: false });
    }
  }
  return { staffOptions, suretyOptions };
}

export async function loadSalaryAdvanceAddSetup(fields = {}, memberId, audit = {}) {
  const { nextReceiptId, advanceNo } = await loadNextReceiptId();
  const { staffOptions, suretyOptions } = await loadAdvanceStaffOptions();
  const advanceTypes = await loadEduSetupByCategory('Salary Advance');

  await logPayrollSetup(PAGE_ADD, 'View', 'Successful', '', memberId, audit);

  return {
    advanceNo,
    nextReceiptId,
    advanceTypes,
    staffOptions,
    suretyOptions,
    maxSurety: 2,
  };
}

export async function saveSalaryAdvanceAddSetup(fields, memberId, files = [], audit = {}) {
  if (fields.Submit !== 'Update') {
    return loadSalaryAdvanceAddSetup(fields, memberId, audit);
  }

  const staffId = String(fields.staff_id || '');
  if (!staffId) return { success: false, message: 'Please select a staff member' };
  if (!fields.advance_type) return { success: false, message: 'Please select advance type' };
  if (!fields.approved_by) return { success: false, message: 'Approved by is required' };

  let attachment = '';
  const file = files.find((f) => f.field?.includes('advance_document'));
  if (file) {
    const saved = await saveLegacyBinaryFile({
      folder: 'salary_advance',
      file,
      allowedExt: new Set(['jpeg', 'gif', 'jpg', 'png', 'pdf']),
    });
    if (saved.error) return { success: false, message: saved.error };
    attachment = saved.filename;
  }

  const issuedMonth = parseMonthField(fields.issued_month);
  const noOfMonth = Number(fields.no_of_month) || 0;
  const holdMonths = Array.isArray(fields.hmonth_list) ? fields.hmonth_list : [];
  const holdMonthCount = holdMonths.length;
  const { detectionFrom, detectionTo } = computeDetectionRange(fields.detection_from, noOfMonth, holdMonthCount);
  const amount = String(fields.advance_amount || '');
  const { deduct, closeAmount } = computeInstallments(amount, noOfMonth);
  const surety = (Array.isArray(fields.surity_list) ? fields.surity_list : []).slice(0, 2).join(',');
  const { ip } = auditFields(memberId, audit);

  const lastReceipt = await prisma.$queryRawUnsafe(
    `SELECT receipt_id FROM salary_advance WHERE del = 1 ORDER BY receipt_id + 0 DESC LIMIT 1`,
  );
  const receiptId = (Number(lastReceipt[0]?.receipt_id) || 0) + 1;

  await prisma.$executeRawUnsafe(
    `INSERT INTO salary_advance
     (receipt_id, staff_id, a_issue_month, a_type, a_amount, a_deduct_amount, a_open_month,
      a_deduct_month, hold_month, surity, attachment, open_approve_by, a_close_month, close_amount,
      close_approve_by, status, from_salary, salary_month, salary_amount, from_bank,
      dep_date, dep_amount, bank_name, updated_ip, updated_by,
      created_dt, created_ip, created_by, del)
     VALUES ('${receiptId}', '${escapeSql(staffId)}', '${escapeSql(issuedMonth)}',
       '${escapeSql(fields.advance_type || '')}', '${escapeSql(amount)}', '${deduct}',
       '${escapeSql(detectionFrom)}', '${noOfMonth}', '${escapeSql(holdMonths.join(','))}',
       '${escapeSql(surety)}', '${escapeSql(attachment)}', '${escapeSql(fields.approved_by || '')}',
       '${escapeSql(detectionTo)}', '${closeAmount}',
       '', 0, 0, '0000-00-00', '', 0, '0000-00-00', '', '', '', '',
       NOW(), '${escapeSql(ip)}', '${escapeSql(memberId)}', 1)`,
  );

  await logPayrollSetup(PAGE_ADD, 'Add', 'Successful', String(receiptId), memberId, audit);
  return {
    success: true,
    message: 'Your details are added...',
    ...(await loadSalaryAdvanceAddSetup({}, memberId, { ...audit, skipLog: true })),
  };
}

export async function loadSalaryAdvanceCloseSetup(fields = {}, memberId, audit = {}) {
  const editId = String(fields.edit_id || fields.edit_row_id || '').trim();
  const payload = editId
    ? await loadAdvanceEdit(editId, fields)
    : await loadAdvanceList(fields);

  await logPayrollSetup(
    PAGE_CLOSE,
    'View',
    'Successful',
    editId || buildSearchFilters(fields).receiptSearch || buildSearchFilters(fields).staffSearch,
    memberId,
    audit,
  );

  return payload;
}

function parseDepositDate(val) {
  const raw = String(val ?? '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split('-');
    return `${yyyy}-${mm}-${dd}`;
  }
  return raw;
}

export async function saveSalaryAdvanceCloseSetup(fields, memberId, files = [], audit = {}) {
  const searchFields = {
    a_search: fields.a_search,
    s_search: fields.s_search,
    m_search: fields.m_search,
  };

  if (fields.delete === 'Confirm') {
    const rowId = String(fields.confirm || fields.id || '');
    if (rowId) {
      await prisma.$executeRawUnsafe(
        `UPDATE salary_advance SET del = 0, updated_dt = NOW(), updated_by = '${escapeSql(memberId)}' WHERE id = '${escapeSql(rowId)}'`,
      );
    }
    return {
      success: true,
      message: 'Your details are deleted...',
      ...(await loadSalaryAdvanceCloseSetup(searchFields, memberId, { ...audit, skipLog: true })),
    };
  }

  const submit = String(fields.Submit || '');
  if (submit !== 'Save' && submit !== 'Update') {
    return loadSalaryAdvanceCloseSetup(fields, memberId, audit);
  }

  const editRowId = String(fields.edit_row_id || fields.id || '');
  if (!editRowId) return { success: false, message: 'Advance record not found' };

  let attachment = String(fields.hd_advance_document || '');
  const file = files.find((f) => f.field?.includes('advance_document'));
  if (file) {
    const saved = await saveLegacyBinaryFile({
      folder: 'salary_advance',
      file,
      allowedExt: new Set(['jpeg', 'gif', 'jpg', 'png', 'pdf']),
    });
    if (saved.error) return { success: false, message: saved.error };
    attachment = saved.filename;
  }

  const issuedMonth = parseMonthField(fields.issued_month);
  const noOfMonth = Number(fields.no_of_month) || 0;
  const holdMonths = Array.isArray(fields.hmonth_list) ? fields.hmonth_list : [];
  const holdMonthCount = holdMonths.length;
  const amount = String(fields.advance_amount || '');
  const surety = (Array.isArray(fields.surity_list) ? fields.surity_list : []).slice(0, 2).join(',');
  const isClosed = fields.a_close === '1' || fields.a_close === 1 || fields.a_close === true;
  const { ip } = auditFields(memberId, audit);

  let detectionFrom = parseMonthField(fields.detection_from);
  let detectionTo = detectionFrom;
  let deductAmount;
  let closeAmount;
  let closeApprovedBy = '';
  let status = 0;
  let fromSalary = 0;
  let salaryMonth = '';
  let salaryAmount = '';
  let fromBank = 0;
  let depDate = '0000-00-00';
  let depAmount = '';
  let bankName = '';

  if (isClosed) {
    status = 1;
    detectionTo = parseMonthField(fields.close_month);
    closeAmount = String(fields.close_amount || '');
    deductAmount = closeAmount;
    closeApprovedBy = String(fields.close_approved || '');
    fromSalary = fields.from_salary ? 1 : 0;
    fromBank = fields.from_bank ? 1 : 0;
    if (fromSalary) {
      salaryMonth = parseMonthField(fields.salary_month);
      salaryAmount = String(fields.salary_amount || '');
    }
    if (fromBank) {
      depDate = parseDepositDate(fields.d_date) || '0000-00-00';
      depAmount = String(fields.d_amount || '');
      bankName = String(fields.bank_name || '');
    }
  } else {
    const range = computeDetectionRange(fields.detection_from, noOfMonth, holdMonthCount);
    detectionFrom = range.detectionFrom;
    detectionTo = range.detectionTo;
    const installments = computeInstallments(amount, noOfMonth);
    deductAmount = String(installments.deduct);
    closeAmount = String(installments.closeAmount);
  }

  await prisma.$executeRawUnsafe(
    `UPDATE salary_advance SET
     a_type='${escapeSql(fields.advance_type || '')}',
     a_issue_month='${escapeSql(issuedMonth)}',
     a_amount='${escapeSql(amount)}',
     a_deduct_amount='${escapeSql(deductAmount)}',
     a_open_month='${escapeSql(detectionFrom)}',
     a_deduct_month='${noOfMonth}',
     hold_month='${escapeSql(holdMonths.join(','))}',
     surity='${escapeSql(surety)}',
     attachment='${escapeSql(attachment)}',
     open_approve_by='${escapeSql(fields.approved_by || '')}',
     a_close_month='${escapeSql(detectionTo)}',
     close_amount='${escapeSql(closeAmount)}',
     close_approve_by='${escapeSql(closeApprovedBy)}',
     status='${status}',
     from_salary='${fromSalary}',
     salary_month='${escapeSql(salaryMonth || '0000-00-00')}',
     salary_amount='${escapeSql(salaryAmount)}',
     from_bank='${fromBank}',
     dep_date='${escapeSql(depDate)}',
     dep_amount='${escapeSql(depAmount)}',
     bank_name='${escapeSql(bankName)}',
     updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(ip)}'
     WHERE id='${escapeSql(editRowId)}'`,
  );

  await logPayrollSetup(PAGE_CLOSE, 'Update', 'Successful', editRowId, memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadSalaryAdvanceCloseSetup({ ...searchFields, edit_id: editRowId }, memberId, { ...audit, skipLog: true })),
  };
}
