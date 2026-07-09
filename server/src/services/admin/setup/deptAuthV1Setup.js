import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logAdminSetup } from './setupAudit.js';

const PAGE = 'department_authentication_v1.php';

function splitCsv(value) {
  if (!value) return [];
  return String(value).split(',').map((v) => v.trim()).filter(Boolean);
}

function normalizeMultiField(value) {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === 'object') return Object.values(value).map(String);
  if (value) return [String(value)];
  return [];
}

function selectedValues(options, selectedIds) {
  const set = new Set(selectedIds.map(String));
  return options.map((opt) => ({ ...opt, selected: set.has(String(opt.value)) }));
}

async function loadStaffUserOptions(selectedId = '') {
  const configured = await prisma.dept_auth.findMany({
    where: { del: 1 },
    select: { dept_hod: true },
  });
  const configuredSet = new Set(configured.map((r) => String(r.dept_hod)));

  const currentDt = new Date().toISOString().slice(0, 10);
  const sql = `
    SELECT id, staff_id, staff_title, staff_name, staff_initial
    FROM staff_profile_tb
    WHERE del = 1
      AND atten_auth = 1
      AND (releaving_date > '${escapeSql(currentDt)}' OR releaving_date = '0000-00-00')
    ORDER BY staff_id ASC
  `;
  const rows = await prisma.$queryRawUnsafe(sql);

  return rows.map((row) => {
    const label = `(${row.staff_id} | ${row.staff_title}. ${row.staff_name} ${row.staff_initial || ''})`.trim();
    return {
      value: String(row.id),
      label: `${label}${configuredSet.has(String(row.id)) ? '*' : ''}`,
      selected: String(row.id) === String(selectedId),
    };
  });
}

async function loadDepartmentOptions(selectedIds = []) {
  const rows = await prisma.staff_dept_master.findMany({
    where: { del: 1 },
    orderBy: { d_order: 'asc' },
    select: { id: true, name: true },
  });
  return selectedValues(
    rows.map((row) => ({ value: String(row.id), label: row.name })),
    selectedIds,
  );
}

async function loadStaffGroupedOptions(selectedStaffIds = []) {
  const currentDt = new Date().toISOString().slice(0, 10);
  const departments = await prisma.staff_dept_master.findMany({
    where: { del: 1 },
    orderBy: { d_order: 'asc' },
    select: { id: true, name: true },
  });

  const selected = new Set(selectedStaffIds.map(String));
  const groups = [];

  for (const dept of departments) {
    const sql = `
      SELECT DISTINCT(A.id), A.staff_id, A.staff_title, A.staff_name, A.staff_initial
      FROM staff_profile_tb AS A
      INNER JOIN staff_designation_tb AS B ON A.id = B.staff_id
      WHERE A.del = 1
        AND (A.releaving_date = '0000-00-00' OR A.releaving_date > '${escapeSql(currentDt)}')
        AND B.del = 1
        AND B.is_academic = 1
        AND B.department = '${escapeSql(String(dept.id))}'
        AND (B.to_date > '${escapeSql(currentDt)}' OR B.to_date = '0000-00-00')
      ORDER BY A.staff_id ASC
    `;
    const staffRows = await prisma.$queryRawUnsafe(sql);
    if (staffRows.length === 0) continue;
    groups.push({
      label: dept.name,
      options: staffRows.map((row) => ({
        value: String(row.id),
        label: `${row.staff_id} | ${row.staff_title}. ${row.staff_name} ${row.staff_initial || ''}`.trim(),
        selected: selected.has(String(row.id)),
      })),
    });
  }

  return groups;
}

async function loadMasterOptions(category, selectedIds = []) {
  const rows = await prisma.master_setup.findMany({
    where: { category, del: { not: 0 } },
    orderBy: { category_order: 'asc' },
    select: { id: true, category_name: true },
  });
  return selectedValues(
    rows.map((row) => ({ value: String(row.id), label: row.category_name })),
    selectedIds,
  );
}

async function loadCourseOptions(selectedIds = []) {
  const rows = await prisma.basic_setup_course_tb.findMany({
    where: { del: { not: 0 } },
    orderBy: { c_order: 'asc' },
    select: { id: true, department_name: true },
  });
  return selectedValues(
    rows.map((row) => ({ value: String(row.id), label: row.department_name })),
    selectedIds,
  );
}

export async function loadDeptAuthV1(memberId, fields = {}, query = {}, audit = {}) {
  const selectedStaff = String(fields.user_name_ref || query.uid || '').trim();

  const users = await loadStaffUserOptions(selectedStaff);
  let recordId = null;
  let selections = {
    deptIds: [],
    deptStaff: [],
    deptStudent: [],
    deptInternship: [],
    deptPg: [],
    courseIds: [],
  };

  if (selectedStaff) {
    const auth = await prisma.dept_auth.findFirst({
      where: { del: 1, dept_hod: Number(selectedStaff) },
    });
    if (auth) {
      recordId = auth.id;
      selections = {
        deptIds: splitCsv(auth.dept_id),
        deptStaff: splitCsv(auth.dept_staff),
        deptStudent: splitCsv(auth.dept_student),
        deptInternship: splitCsv(auth.dept_intern),
        deptPg: splitCsv(auth.dept_pg),
        courseIds: splitCsv(auth.course_id),
      };
    }
  }

  const departments = await loadDepartmentOptions(selections.deptIds);
  const staffGroups = await loadStaffGroupedOptions(selections.deptStaff);
  const deptStudentOptions = await loadDepartmentOptions(selections.deptStudent);
  const internshipOptions = await loadMasterOptions('Internship Department', selections.deptInternship);
  const pgOptions = await loadMasterOptions('Department', selections.deptPg);
  const courseOptions = await loadCourseOptions(selections.courseIds);

  if (!audit.skipLog) {
    await logAdminSetup(PAGE, 'View', 'Successful', selectedStaff || 'form', memberId, audit);
  }

  return {
    users,
    selectedStaff,
    recordId,
    departments,
    staffGroups,
    deptStudentOptions,
    internshipOptions,
    pgOptions,
    courseOptions,
  };
}

export async function saveDeptAuthV1(fields, memberId, audit = {}) {
  const staffId = String(fields.user_name_ref || '').trim();
  if (!staffId) {
    return { success: false, message: 'Select a staff member first.' };
  }

  const payload = {
    dept_id: normalizeMultiField(fields.dept_name_ref).join(','),
    dept_staff: normalizeMultiField(fields.dept_staff).join(','),
    dept_student: normalizeMultiField(fields.dept_student).join(','),
    dept_pg: normalizeMultiField(fields.dept_pg).join(','),
    dept_intern: normalizeMultiField(fields.dept_internship).join(','),
    course_id: normalizeMultiField(fields.course_id).join(','),
  };

  const { create, update } = auditFields(memberId, audit);
  const recordId = fields.r_id ? Number(fields.r_id) : null;

  try {
    if (recordId && Number.isInteger(recordId) && recordId > 0) {
      await prisma.dept_auth.update({
        where: { id: recordId },
        data: {
          user_id: staffId,
          dept_hod: Number(staffId),
          ...payload,
          ...update,
        },
      });
    } else {
      await prisma.dept_auth.create({
        data: {
          user_id: staffId,
          dept_hod: Number(staffId),
          event_committee: '',
          ...payload,
          ...create,
        },
      });
    }

    await logAdminSetup(PAGE, 'Update', 'Successful', payload.dept_id, memberId, audit);
    const reload = await loadDeptAuthV1(
      memberId,
      { user_name_ref: staffId },
      {},
      { ...audit, skipLog: true },
    );
    return { success: true, message: 'Your details are Updated...', ...reload };
  } catch {
    await logAdminSetup(PAGE, 'Update', 'Unsuccessful', staffId, memberId, audit);
    return { success: false, message: 'Please try again...' };
  }
}
