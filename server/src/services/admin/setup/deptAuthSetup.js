import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logAdminSetup } from './setupAudit.js';

const PAGE = 'department_authentication.php';

function splitCsv(value) {
  if (!value) return [];
  return String(value).split(',').map((v) => v.trim()).filter(Boolean);
}

async function loadUserOptions(selectedId = '') {
  const configured = await prisma.dept_authentication.findMany({
    where: { del: 1 },
    select: { user_id: true },
  });
  const configuredSet = new Set(configured.map((r) => String(r.user_id)));

  const rows = await prisma.web_account_setup.findMany({
    where: { del: 1, member_id: { not: 'iGrapix' } },
    orderBy: { member_id: 'asc' },
    select: { id: true, member_id: true, member_name: true },
  });

  return rows.map((row) => ({
    value: String(row.id),
    label: `${row.member_id} (${row.member_name})${configuredSet.has(String(row.id)) ? '*' : ''}`,
    selected: String(row.id) === String(selectedId),
  }));
}

async function loadDepartmentOptions(selectedDept = '') {
  const rows = await prisma.staff_dept_master.findMany({
    where: { del: 1 },
    orderBy: { d_order: 'asc' },
    select: { id: true, name: true },
  });
  return rows.map((row) => ({
    value: String(row.id),
    label: row.name,
    selected: String(row.id) === String(selectedDept),
  }));
}

async function loadStaffByDepartment(deptId) {
  const currentDt = new Date().toISOString().slice(0, 10);
  const sql = `
    SELECT DISTINCT(A.id), A.staff_id, A.staff_title, A.staff_name, A.staff_initial
    FROM staff_profile_tb AS A
    INNER JOIN staff_designation_tb AS B ON A.id = B.staff_id
    WHERE A.del = 1
      AND (A.releaving_date = '0000-00-00' OR A.releaving_date > '${escapeSql(currentDt)}')
      AND B.del = 1
      AND B.is_academic = 1
      AND B.department = '${escapeSql(deptId)}'
      AND (B.to_date > '${escapeSql(currentDt)}' OR B.to_date = '0000-00-00')
    ORDER BY A.staff_id ASC
  `;
  const rows = await prisma.$queryRawUnsafe(sql);
  return rows.map((row) => ({
    value: String(row.id),
    label: `${row.staff_id} | ${row.staff_title}. ${row.staff_name} ${row.staff_initial || ''}`.trim(),
  }));
}

async function loadMasterOptions(category) {
  const rows = await prisma.master_setup.findMany({
    where: { category, del: { not: 0 } },
    orderBy: { category_order: 'asc' },
    select: { id: true, category_name: true },
  });
  return rows.map((row) => ({
    value: String(row.id),
    label: row.category_name,
  }));
}

async function loadCourseOptions() {
  const rows = await prisma.basic_setup_course_tb.findMany({
    where: { del: { not: 0 } },
    orderBy: { c_order: 'asc' },
    select: { id: true, department_name: true },
  });
  return rows.map((row) => ({
    value: String(row.id),
    label: row.department_name,
  }));
}

function selectedValues(options, selectedIds) {
  const set = new Set(selectedIds.map(String));
  return options.map((opt) => ({ ...opt, selected: set.has(String(opt.value)) }));
}

async function loadDeptAuthRecord(userId) {
  return prisma.dept_authentication.findFirst({
    where: { del: 1, user_id: userId },
    select: {
      id: true,
      user_id: true,
      dept_id: true,
      dept_hod: true,
      dept_staff: true,
      dept_student: true,
      dept_intern: true,
      dept_pg: true,
      course_id: true,
    },
  });
}

export async function loadDeptAuth(memberId, fields = {}, query = {}, audit = {}) {
  const selectedUser = String(fields.user_name_ref || query.uid || '').trim();
  const selectedDept = String(fields.dept_name_ref || '').trim();

  const users = await loadUserOptions(selectedUser);
  const departments = await loadDepartmentOptions(selectedDept);

  let recordId = null;
  let selections = {
    deptHod: [],
    deptStaff: [],
    deptStudent: [],
    deptInternship: [],
    deptPg: [],
    courseIds: [],
  };

  if (selectedUser) {
    const auth = await loadDeptAuthRecord(selectedUser);
    if (auth) {
      recordId = auth.id;
      if (!selectedDept) {
        selections = {
          deptHod: splitCsv(auth.dept_hod),
          deptStaff: splitCsv(auth.dept_staff),
          deptStudent: splitCsv(auth.dept_student),
          deptInternship: splitCsv(auth.dept_intern),
          deptPg: splitCsv(auth.dept_pg),
          courseIds: splitCsv(auth.course_id),
        };
      }
    }
  }

  let staffOptions = [];
  let hodOptions = [];
  if (selectedDept) {
    staffOptions = await loadStaffByDepartment(selectedDept);
    hodOptions = staffOptions;
    if (selectedUser) {
      const auth = await loadDeptAuthRecord(selectedUser);
      if (auth) {
        recordId = auth.id;
        selections = {
          deptHod: splitCsv(auth.dept_hod),
          deptStaff: splitCsv(auth.dept_staff),
          deptStudent: splitCsv(auth.dept_student),
          deptInternship: splitCsv(auth.dept_intern),
          deptPg: splitCsv(auth.dept_pg),
          courseIds: splitCsv(auth.course_id),
        };
      }
    }
  }

  const internshipOptions = selectedValues(
    await loadMasterOptions('Internship Department'),
    selections.deptInternship,
  );
  const pgOptions = selectedValues(
    await loadMasterOptions('Department'),
    selections.deptPg,
  );
  const courseOptions = selectedValues(
    await loadCourseOptions(),
    selections.courseIds,
  );
  const deptStudentOptions = selectedValues(departments, selections.deptStudent);

  if (!audit.skipLog) {
    await logAdminSetup(PAGE, 'View', 'Successful', selectedDept || selectedUser || 'form', memberId, audit);
  }
  return {
    users,
    departments,
    selectedUser,
    selectedDept,
    recordId,
    staffOptions: selectedValues(staffOptions, selections.deptStaff),
    hodOptions: selectedValues(hodOptions, selections.deptHod),
    deptStudentOptions,
    internshipOptions,
    pgOptions,
    courseOptions,
  };
}

function normalizeMultiField(value) {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === 'object') return Object.values(value).map(String);
  if (value) return [String(value)];
  return [];
}

export async function saveDeptAuth(fields, memberId, audit = {}) {
  const userId = String(fields.user_name_ref || '').trim();
  const deptId = String(fields.dept_name_ref || '').trim();
  if (!userId || !deptId) {
    return { success: false, message: 'User and department are required.' };
  }

  const deptHodCsv = normalizeMultiField(fields.dept_hod).join(',');
  const payload = {
    dept_staff: normalizeMultiField(fields.dept_staff).join(','),
    dept_student: normalizeMultiField(fields.dept_student).join(','),
    dept_pg: normalizeMultiField(fields.dept_pg).join(','),
    dept_intern: normalizeMultiField(fields.dept_internship).join(','),
    course_id: normalizeMultiField(fields.course_id).join(','),
  };

  const { create, update } = auditFields(memberId, audit);
  const recordId = fields.r_id ? Number(fields.r_id) : null;
  const deptHod = Number(deptHodCsv.split(',')[0]) || 0;

  try {
    if (recordId && Number.isInteger(recordId) && recordId > 0) {
      await prisma.dept_authentication.update({
        where: { id: recordId },
        data: {
          dept_id: deptId,
          user_id: userId,
          dept_hod: deptHod,
          ...payload,
          ...update,
        },
      });
    } else {
      await prisma.dept_authentication.create({
        data: {
          dept_id: deptId,
          user_id: userId,
          dept_hod: deptHod,
          event_committee: '',
          ...payload,
          ...create,
        },
      });
    }

    await logAdminSetup(PAGE, 'Update', 'Successful', deptId, memberId, audit);
    const reload = await loadDeptAuth(
      memberId,
      { user_name_ref: userId, dept_name_ref: deptId },
      {},
      { ...audit, skipLog: true },
    );
    return { success: true, message: 'Your details are Updated...', ...reload };
  } catch {
    await logAdminSetup(PAGE, 'Update', 'Unsuccessful', deptId, memberId, audit);
    return { success: false, message: 'Please try again...' };
  }
}
