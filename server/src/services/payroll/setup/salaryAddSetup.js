import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { staffPhotoDisplayUrl } from '../../staff/staffShared.js';
import { auditFields, logPayrollSetup } from './setupAudit.js';
import {
  loadBankOptions,
  loadJobCategoryOptions,
  loadStaffSalaryRows,
  mapPayrollPolicyFlags,
  monthRefToSqlDate,
  staffDisplayName,
} from '../payrollShared.js';

const PAGE = 'staff_salary_setup.php';
const ACTIVE_WHERE = `del = 1 AND (releaving_date = '0000-00-00' OR releaving_date > DATE(NOW()))`;

const STAFF_LIST_SELECT = `A.id, A.staff_id, A.staff_name, A.staff_initial, A.staff_title,
  CASE WHEN EXISTS (
    SELECT 1 FROM salary_tb S
    WHERE S.del = 1 AND S.staff_id = A.id
      AND (S.to_date >= DATE(NOW()) OR CAST(S.to_date AS CHAR) = '0000-00-00')
  ) THEN 1 ELSE 0 END AS has_current_salary`;

function mapStaffListRow(row, selectedId = '') {
  return {
    id: String(row.id),
    staffId: row.staff_id,
    name: staffDisplayName(row),
    hasCurrentSalary: Number(row.has_current_salary) === 1,
    selected: String(row.id) === String(selectedId),
  };
}

async function queryStaffList(extraWhere, orderBy, limit = null) {
  const limitSql = limit ? ` LIMIT ${Number(limit)}` : '';
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ${STAFF_LIST_SELECT}
     FROM staff_profile_tb A
     WHERE ${ACTIVE_WHERE} ${extraWhere}
     ORDER BY ${orderBy}${limitSql}`,
  );
  return rows;
}

async function loadInitialStaffList(selectedId = '') {
  const rows = await queryStaffList('', 'A.staff_name ASC, A.staff_initial ASC', 50);
  return rows.map((row) => mapStaffListRow(row, selectedId));
}

async function searchStaffList(searchBy, searchInput, searchCategory, selectedId = '') {
  const term = escapeSql(String(searchInput || '').trim());
  if (searchBy === 'staff_id' && term) {
    const ids = String(searchInput).split(',').map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return [];
    const clauses = ids.map((id) => `A.staff_id = '${escapeSql(id)}'`).join(' OR ');
    const rows = await queryStaffList(`AND (${clauses})`, 'A.staff_id ASC, A.staff_name ASC');
    return rows.map((row) => mapStaffListRow(row, selectedId));
  }
  if (searchBy === 'name' && term) {
    const rows = await queryStaffList(
      `AND (A.staff_name LIKE '%${term}%' OR A.staff_initial LIKE '%${term}%' OR A.staff_id LIKE '%${term}%')`,
      'A.staff_name ASC, A.staff_initial ASC',
    );
    return rows.map((row) => mapStaffListRow(row, selectedId));
  }
  if (searchBy === 'category' && searchCategory) {
    const cat = escapeSql(String(searchCategory));
    const rows = await queryStaffList(
      `AND A.job_category LIKE '%${cat}%'`,
      'A.staff_name ASC, A.staff_initial ASC',
    );
    return rows.map((row) => mapStaffListRow(row, selectedId));
  }
  return [];
}

async function loadPayrollPolicy(attCategory) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT basic_pay, basic_margin, hra_allowance, d_allowance, m_allowance, c_allowance,
            pf_calculation, esi_calculation
     FROM basic_setup_payroll_tb
     WHERE del = 1 AND id = '${escapeSql(String(attCategory))}' LIMIT 1`,
  );
  return rows[0] || {};
}

function normalizeIndexedField(fields, key, index, fallback = '0') {
  const val = fields[key];
  if (Array.isArray(val)) return String(val[index] ?? fallback);
  if (val && typeof val === 'object') return String(val[index] ?? val[String(index)] ?? fallback);
  if (val !== undefined && val !== null && val !== '') return String(val);
  return fallback;
}

async function buildProfile(staffId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id, staff_name, staff_initial, staff_title, att_category, job_category,
            b_ac_no, b_ac_name, b_name, b_branch, b_ifsc, pan_no, pf_ac_no, pf_uan, esi_no
     FROM staff_profile_tb WHERE del = 1 AND id = '${escapeSql(staffId)}' LIMIT 1`,
  );
  const profile = rows[0];
  if (!profile) return { profile: null, salaryRows: [], policyFlags: mapPayrollPolicyFlags() };

  const policyRow = await loadPayrollPolicy(profile.att_category);
  const policyFlags = mapPayrollPolicyFlags(policyRow);
  const salaryRows = await loadStaffSalaryRows(profile.id, policyFlags);
  const photoUrl = await staffPhotoDisplayUrl(profile.staff_id, 'idcard');

  return {
    profile: {
      id: String(profile.id),
      staffId: profile.staff_id,
      name: staffDisplayName(profile),
      attCategory: String(profile.att_category),
      jobCategory: String(profile.job_category),
      photoUrl,
      bank: {
        acNo: profile.b_ac_no,
        acName: profile.b_ac_name,
        bankName: String(profile.b_name ?? ''),
        branch: profile.b_branch,
        ifsc: profile.b_ifsc,
        panNo: profile.pan_no,
        pfAcNo: profile.pf_ac_no,
        pfUan: profile.pf_uan,
        esiNo: profile.esi_no,
      },
    },
    salaryRows,
    policyFlags,
  };
}

export async function loadSalaryAddSetup(fields = {}, memberId, audit = {}) {
  const searchBy = String(fields.search_by || (fields.search ? 'name' : 'name'));
  const searchInput = String(fields.search_input ?? fields.search ?? fields.staff_search ?? '').trim();
  const searchCategory = String(fields.search_category || '').trim();
  const staffId = String(fields.staff_id || fields.s_id || fields.st_id || '').trim();
  const searched = Boolean(
    fields.search_by
    || fields.search
    || fields.search_input
    || fields.search_category,
  );

  let staffList = [];
  if (searched) {
    staffList = await searchStaffList(searchBy, searchInput, searchCategory, staffId);
    if (!staffList.length && !staffId) {
      staffList = [];
    } else if (!staffList.length) {
      staffList = await loadInitialStaffList(staffId);
    }
  } else {
    staffList = await loadInitialStaffList(staffId);
  }

  let profile = null;
  let salaryRows = [];
  let policyFlags = mapPayrollPolicyFlags();
  if (staffId) {
    const loaded = await buildProfile(staffId);
    profile = loaded.profile;
    salaryRows = loaded.salaryRows;
    policyFlags = loaded.policyFlags;
    if (staffList.length) {
      staffList = staffList.map((row) => ({
        ...row,
        selected: row.id === staffId,
      }));
    }
  }

  await logPayrollSetup(PAGE, 'View', 'Successful', staffId || searchInput || searchCategory, memberId, audit);

  return {
    searchBy,
    searchInput,
    searchCategory,
    searched,
    staffList,
    profile,
    salaryRows,
    policyFlags,
    bankOptions: await loadBankOptions(),
    categoryOptions: await loadJobCategoryOptions(),
    // Backward compatibility for older client/tests
    searchQuery: searchInput || null,
    searchResults: staffList,
    policy: policyFlags,
  };
}

export async function saveSalaryAddSetup(fields, memberId, audit = {}) {
  if (fields.delete === 'Confirm') {
    const rowId = String(fields.confirm || fields.g_id || fields.salary_row_id || '');
    const staffId = String(fields.staff_id || fields.st_id || '');
    if (rowId && staffId) {
      await prisma.$executeRawUnsafe(
        `UPDATE salary_tb SET del = 0, updated_dt = NOW(), updated_by = '${escapeSql(memberId)}'
         WHERE id = '${escapeSql(rowId)}' AND staff_id = '${escapeSql(staffId)}'`,
      );
    }
    return {
      success: true,
      message: 'Salary row deleted.',
      ...(await loadSalaryAddSetup({ staff_id: staffId }, memberId, { ...audit, skipLog: true })),
    };
  }

  if (fields.Submit !== 'Update') {
    return loadSalaryAddSetup(fields, memberId, audit);
  }

  const staffId = String(fields.staff_id || fields.st_id || '');
  if (!staffId) return { success: false, message: 'Please select a staff member' };

  const { ip } = auditFields(memberId, audit);
  const pfAcNo = fields.pf_ac_no ?? fields.pfa_no ?? '';
  await prisma.$executeRawUnsafe(
    `UPDATE staff_profile_tb SET
     b_ac_no='${escapeSql(fields.b_ac_no || '')}',
     b_ac_name='${escapeSql(fields.b_ac_name || '')}',
     b_name='${escapeSql(fields.b_name || '')}',
     b_branch='${escapeSql(fields.b_branch || '')}',
     b_ifsc='${escapeSql(fields.b_ifsc || '')}',
     pan_no='${escapeSql(fields.pan_no || '')}',
     pf_ac_no='${escapeSql(pfAcNo)}',
     pf_uan='${escapeSql(fields.pf_uan || '')}',
     esi_no='${escapeSql(fields.esi_no || '')}',
     updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(ip)}'
     WHERE id='${escapeSql(staffId)}'`,
  );

  const gIds = Array.isArray(fields.g_id) ? fields.g_id : (fields.g_id ? [fields.g_id] : []);
  const fromDates = Array.isArray(fields.from_date) ? fields.from_date : [];
  const toDates = Array.isArray(fields.to_date) ? fields.to_date : [];
  const basicPays = Array.isArray(fields.basic_pay) ? fields.basic_pay : [];
  const basicMargins = Array.isArray(fields.basic_margin) ? fields.basic_margin : [];
  const dAllowances = Array.isArray(fields.d_allowance) ? fields.d_allowance : [];
  const hraAllowances = Array.isArray(fields.hra_allowance) ? fields.hra_allowance : [];
  const mAllowances = Array.isArray(fields.m_allowance) ? fields.m_allowance : [];
  const cAllowances = Array.isArray(fields.c_allowance) ? fields.c_allowance : [];
  const totalAmounts = Array.isArray(fields.total_amount) ? fields.total_amount : [];

  for (let i = 0; i < fromDates.length; i++) {
    const rowId = String(gIds[i] || '').trim();
    const fromDateRaw = String(fromDates[i] || '').trim();
    if (!fromDateRaw) continue;
    const fromDate = monthRefToSqlDate(fromDateRaw);
    const toDateRaw = String(toDates[i] || '').trim();
    const toDate = toDateRaw ? monthRefToSqlDate(toDateRaw) : '0000-00-00';
    const rowData = {
      from_date: fromDate,
      to_date: toDate,
      basic_pay: String(basicPays[i] || ''),
      basic_margin: String(basicMargins[i] || ''),
      d_allowance: String(dAllowances[i] || ''),
      hra_allowance: String(hraAllowances[i] || ''),
      m_allowance: String(mAllowances[i] || ''),
      c_allowance: String(cAllowances[i] || ''),
      total_amount: String(totalAmounts[i] || ''),
      pf_calculation: normalizeIndexedField(fields, 'pf_calculation', i, '0'),
      esi_calculation: normalizeIndexedField(fields, 'esi_calculation', i, '0'),
    };

    if (!rowId) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO salary_tb (staff_id, from_date, to_date, basic_pay, basic_margin, d_allowance,
          hra_allowance, m_allowance, c_allowance, total_amount, pf_calculation, esi_calculation,
          created_dt, created_ip, created_by, del)
         VALUES ('${escapeSql(staffId)}', '${escapeSql(rowData.from_date)}', '${escapeSql(rowData.to_date)}',
          '${escapeSql(rowData.basic_pay)}', '${escapeSql(rowData.basic_margin)}', '${escapeSql(rowData.d_allowance)}',
          '${escapeSql(rowData.hra_allowance)}', '${escapeSql(rowData.m_allowance)}', '${escapeSql(rowData.c_allowance)}',
          '${escapeSql(rowData.total_amount)}', '${escapeSql(rowData.pf_calculation)}', '${escapeSql(rowData.esi_calculation)}',
          NOW(), '${escapeSql(ip)}', '${escapeSql(memberId)}', 1)`,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE salary_tb SET
         from_date='${escapeSql(rowData.from_date)}', to_date='${escapeSql(rowData.to_date)}',
         basic_pay='${escapeSql(rowData.basic_pay)}', basic_margin='${escapeSql(rowData.basic_margin)}',
         d_allowance='${escapeSql(rowData.d_allowance)}', hra_allowance='${escapeSql(rowData.hra_allowance)}',
         m_allowance='${escapeSql(rowData.m_allowance)}', c_allowance='${escapeSql(rowData.c_allowance)}',
         total_amount='${escapeSql(rowData.total_amount)}', pf_calculation='${escapeSql(rowData.pf_calculation)}',
         esi_calculation='${escapeSql(rowData.esi_calculation)}', del=1,
         updated_dt=NOW(), updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(ip)}'
         WHERE id='${escapeSql(rowId)}' AND staff_id='${escapeSql(staffId)}'`,
      );
    }
  }

  await logPayrollSetup(PAGE, 'Update', 'Successful', staffId, memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadSalaryAddSetup({ staff_id: staffId }, memberId, { ...audit, skipLog: true })),
  };
}

export async function loadSalaryReportSetup(fields = {}, memberId, audit = {}) {
  const searchCategory = String(fields.search_category || 'All');
  let categoryFilter = '';
  if (searchCategory && searchCategory !== 'All') {
    categoryFilter = ` AND A.job_category = '${escapeSql(searchCategory)}'`;
  }

  const staffRows = await prisma.$queryRawUnsafe(
    `SELECT A.id, A.staff_id, A.staff_name, A.staff_initial, A.staff_title, A.job_category
     FROM staff_profile_tb AS A
     WHERE A.del = 1 ${categoryFilter}
     ORDER BY A.staff_id ASC`,
  );

  const report = [];
  for (const staff of staffRows) {
    const salaries = await loadStaffSalaryRows(staff.id);
    report.push({
      staffId: staff.staff_id,
      name: staffDisplayName(staff),
      salaries,
    });
  }

  await logPayrollSetup('staff_salary_report.php', fields.Submit === 'Generate' ? 'Generate' : 'View', 'Successful', searchCategory, memberId, audit);

  return {
    categoryOptions: [{ value: 'All', label: 'All' }, ...(await loadJobCategoryOptions())],
    selected: { searchCategory },
    report,
    canPrint: report.length > 0,
  };
}
