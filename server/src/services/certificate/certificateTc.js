import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { auditFields, logModulePage } from '../shared/moduleAudit.js';
import { fmtDateExpr } from './certificateShared.js';

const DETAILS_PAGE = 'tc_details.php';
const ADD_PAGE = 'tc_approve_add.php';
const EDIT_PAGE = 'tc_approve_edit.php';
const GENERATE_PAGE = 'tc_generate.php';
const PAGE_SIZE = 50;
const DISCONTINUED_YEAR_OPTIONS = ['1', '2', '3', '4'];

function parseCourseRef(courseRef = '') {
  const value = String(courseRef || '');
  if (!value.includes('___')) return { courseId: '', academicYear: '' };
  const [courseId, academicYear] = value.split('___');
  return { courseId, academicYear };
}

function formatDepartmentName(name) {
  const dept = String(name || '').trim();
  if (!dept || dept === '-') return '';
  return ` - ${dept}`;
}

function buildTcCourseOptions(courses, ugYear, pgYear) {
  const options = [];
  for (const course of courses) {
    const isPg = String(course.course_name || '').toUpperCase().includes('P.G');
    const activeYear = isPg ? pgYear : ugYear;
    const startYear = Number.parseInt(String(activeYear).split('-')[0], 10) || new Date().getFullYear();
    const yearOfStart = Number(course.year_of_start) || startYear;
    const dept = formatDepartmentName(course.department_name);
    const ft = String(course.full_part_time || '').toLowerCase().includes('part') ? 'PT' : 'FT';
    const group = `${course.course_name} | ${course.degree_name}${dept} | ${ft}`;

    for (let year = startYear; year >= yearOfStart; year -= 1) {
      const academicYear = `${year}-${year + 1}`;
      options.push({
        courseRef: `${course.id}___${academicYear}`,
        label: `${course.degree_name}${dept} | ${academicYear}`,
        group,
        courseId: Number(course.id),
        academicYear,
      });
    }
  }
  return options;
}

function mapTcStudent(row) {
  const reason = String(row.releaving_info || '').toLowerCase();
  const leavingReason = reason === 'discontinued' ? 'discontinued' : 'completed';
  const yearNum = Number(row.releaving_year || 0);
  return {
    id: Number(row.id),
    registerNo: row.register_no || '',
    studentName: `${row.student_name || ''} ${row.student_initial || ''}`.trim(),
    admissionNo: row.admission_no || '',
    admissionDate: row.admission_date || '',
    leavingDate: row.releaving_date || '',
    issueDate: row.tc_issue_date || '',
    leavingReason,
    discontinuedYear: leavingReason === 'discontinued' && yearNum > 0 ? String(yearNum) : '',
    criStatus: Number(row.cri_status || 0),
  };
}

export async function loadTcDetails(memberId, fields = {}, audit = {}) {
  const courseRef = fields.courseRef ? String(fields.courseRef) : '';
  const { courseId, academicYear } = parseCourseRef(courseRef);
  const page = Math.max(1, Number(fields.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [courses, academicSetup] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT id, degree_name, department_name, course_name, year_of_start, full_part_time
      FROM basic_setup_course_tb WHERE del = 1 ORDER BY c_order ASC, degree_name ASC
    `),
    prisma.$queryRawUnsafe(
      'SELECT ug_academic_year, pg_academic_year FROM basic_setup_tb WHERE del = 1 LIMIT 1',
    ),
  ]);

  const ugYear = academicSetup[0]?.ug_academic_year || '';
  const pgYear = academicSetup[0]?.pg_academic_year || '';
  const courseOptions = buildTcCourseOptions(courses, ugYear, pgYear);

  let students = [];
  let pagination = { page, pageSize: PAGE_SIZE, total: 0, from: 0, to: 0 };

  if (courseId && academicYear) {
    const where = `WHERE S.del = 1 AND S.course_id = '${escapeSql(courseId)}' AND S.academic_year = '${escapeSql(academicYear)}'`;
    const [countRows, rows] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT COUNT(*) AS total FROM student_profile_tb AS S ${where}`),
      prisma.$queryRawUnsafe(`
        SELECT S.id, S.register_no, S.student_name, S.student_initial, S.admission_no,
          ${fmtDateExpr('S.admission_date', 'admission_date')},
          ${fmtDateExpr('S.releaving_date', 'releaving_date')},
          ${fmtDateExpr('S.tc_issue_date', 'tc_issue_date')},
          S.releaving_info, S.releaving_year, S.cri_status
        FROM student_profile_tb AS S
        ${where}
        ORDER BY S.student_name ASC, S.student_initial ASC
        LIMIT ${offset}, ${PAGE_SIZE}
      `),
    ]);

    const total = Number(countRows[0]?.total || 0);
    students = rows.map(mapTcStudent);
    pagination = {
      page,
      pageSize: PAGE_SIZE,
      total,
      from: total ? offset + 1 : 0,
      to: Math.min(offset + PAGE_SIZE, total),
    };
  }

  await logModulePage(DETAILS_PAGE, 'View', 'Successful', courseRef, memberId, audit);
  return {
    success: true,
    courseOptions,
    discontinuedYearOptions: DISCONTINUED_YEAR_OPTIONS,
    courseRef,
    students,
    pagination,
    filters: { courseRef, page },
  };
}

export async function saveTcDetails(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);
  const { courseId, academicYear } = parseCourseRef(payload.courseRef || '');
  const students = Array.isArray(payload.students) ? payload.students : [];

  if (!courseId || !academicYear) {
    return { success: false, message: 'Please select a course and academic year.' };
  }

  for (const student of students) {
    if (!student.id) continue;
    const leavingReason = String(student.leavingReason || 'completed').toLowerCase() === 'discontinued'
      ? 'discontinued'
      : 'completed';
    const discontinuedYear = leavingReason === 'discontinued'
      ? Number(student.discontinuedYear) || 0
      : 0;
    const criStatus = Number(student.criStatus) || 1;

    await prisma.$executeRawUnsafe(`
      UPDATE student_profile_tb SET
        admission_no = '${escapeSql(String(student.admissionNo || ''))}',
        admission_date = ${student.admissionDate ? `'${escapeSql(student.admissionDate)}'` : `'0000-00-00'`},
        releaving_date = ${student.leavingDate ? `'${escapeSql(student.leavingDate)}'` : `'0000-00-00'`},
        tc_issue_date = ${student.issueDate ? `'${escapeSql(student.issueDate)}'` : `'0000-00-00'`},
        releaving_info = '${escapeSql(leavingReason)}',
        releaving_year = ${discontinuedYear},
        cri_status = ${criStatus},
        updated_dt = NOW(),
        updated_by = '${escapeSql(memberId)}',
        updated_ip = '${escapeSql(update.updated_ip)}'
      WHERE id = ${Number(student.id)}
        AND del = 1
        AND course_id = '${escapeSql(courseId)}'
        AND academic_year = '${escapeSql(academicYear)}'
    `);
  }

  await logModulePage(DETAILS_PAGE, 'Update', 'Successful', String(students.length), memberId, audit);
  return {
    success: true,
    message: 'TC details updated.',
    ...(await loadTcDetails(memberId, {
      courseRef: payload.courseRef || '',
      page: payload.page || 1,
    }, { ...audit, skipLog: true })),
  };
}

export async function loadTcRequestAdd(memberId, _fields = {}, audit = {}) {
  await logModulePage(ADD_PAGE, 'View', 'Successful', '', memberId, audit);
  return { success: true, form: { approveDate: new Date().toISOString().slice(0, 10), registerNo: '' } };
}

export async function saveTcRequestAdd(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  const approveDate = payload.approveDate || new Date().toISOString().slice(0, 10);
  const registerNo = String(payload.registerNo || '')
    .split(/[\n,]+/)
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean)
    .join(',');

  if (!registerNo) return { success: false, message: 'Register number required.' };

  await prisma.$executeRawUnsafe(`
    INSERT INTO tc_approve_tb (
      approve_date, register_no, created_dt, created_by, created_ip,
      updated_dt, updated_by, updated_ip, del
    ) VALUES (
      '${escapeSql(approveDate)}', '${escapeSql(registerNo)}', NOW(),
      '${escapeSql(memberId)}', '${escapeSql(create.created_ip)}',
      NOW(), '${escapeSql(memberId)}', '${escapeSql(update.updated_ip)}', 1
    )
  `);

  await logModulePage(ADD_PAGE, 'Add', 'Successful', registerNo, memberId, audit);
  return {
    success: true,
    message: 'TC request added.',
    form: { approveDate, registerNo: '' },
  };
}

export async function loadTcRequestEdit(memberId, fields = {}, audit = {}) {
  const fromDate = fields.fromDate ? String(fields.fromDate).slice(0, 10) : '';
  const toDate = fields.toDate ? String(fields.toDate).slice(0, 10) : '';

  let requests = [];
  if (fromDate || toDate) {
    let where = 'WHERE del = 1';
    if (fromDate) {
      where += ` AND approve_date >= '${escapeSql(fromDate)}' AND approve_date > '1000-01-01'`;
    }
    if (toDate) {
      where += ` AND approve_date <= '${escapeSql(toDate)}' AND approve_date > '1000-01-01'`;
    }

    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, ${fmtDateExpr('approve_date', 'approve_date')}, register_no
      FROM tc_approve_tb ${where}
      ORDER BY id ASC
    `);

    requests = rows.map((r, index) => ({
      id: Number(r.id),
      serialNo: index + 1,
      approveDate: r.approve_date || '',
      registerNo: String(r.register_no || '').replace(/,/g, ', '),
    }));
  }

  await logModulePage(EDIT_PAGE, 'View', 'Successful', `${fromDate}|${toDate}`, memberId, audit);
  return {
    success: true,
    filters: { fromDate, toDate },
    requests,
  };
}

export async function saveTcRequestEdit(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);
  if (payload.action === 'delete' && payload.id) {
    await prisma.$executeRawUnsafe(`
      UPDATE tc_approve_tb SET del = 0, updated_dt = NOW(),
        updated_by = '${escapeSql(memberId)}', updated_ip = '${escapeSql(update.updated_ip)}'
      WHERE id = ${Number(payload.id)}
    `);
    await logModulePage(EDIT_PAGE, 'Delete', 'Successful', String(payload.id), memberId, audit);
    return {
      success: true,
      message: 'TC request deleted.',
      ...(await loadTcRequestEdit(memberId, payload.filters || {}, { ...audit, skipLog: true })),
    };
  }
  return loadTcRequestEdit(memberId, payload.filters || payload, audit);
}

export async function loadTcGenerate(memberId, fields = {}, audit = {}) {
  const registerNo = fields.registerNo ? String(fields.registerNo).trim().toUpperCase() : '';
  let students = [];

  if (registerNo) {
    const approved = await prisma.$queryRawUnsafe(`
      SELECT register_no FROM tc_approve_tb WHERE del = 1 AND register_no LIKE '%${escapeSql(registerNo)}%'
    `);
    const regNos = [...new Set(approved.map((a) => String(a.register_no || '').trim()).filter(Boolean))];
    if (regNos.length) {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT S.register_no, S.student_name, S.student_initial, S.admission_no,
          ${fmtDateExpr('S.admission_date', 'admission_date')},
          ${fmtDateExpr('S.releaving_date', 'releaving_date')},
          ${fmtDateExpr('S.tc_issue_date', 'tc_issue_date')},
          S.releaving_info, C.degree_name, C.department_name
        FROM student_profile_tb AS S
        INNER JOIN basic_setup_course_tb AS C ON S.course_id = C.id
        WHERE S.del = 1 AND C.del = 1 AND S.register_no IN ('${regNos.map(escapeSql).join("','")}')
      `);
      students = rows.map((r) => ({
        registerNo: r.register_no || '',
        studentName: `${r.student_name || ''} ${r.student_initial || ''}`.trim(),
        admissionNo: r.admission_no || '',
        admissionDate: r.admission_date || '',
        leavingDate: r.releaving_date || '',
        issueDate: r.tc_issue_date || '',
        leavingReason: r.releaving_info || '',
        degreeName: r.degree_name || '',
        departmentName: r.department_name || '',
      }));
    }
  }

  await logModulePage(GENERATE_PAGE, 'View', 'Successful', registerNo, memberId, audit);
  return { success: true, registerNo, students };
}

export async function saveTcGenerate(payload, memberId, audit = {}) {
  return loadTcGenerate(memberId, payload, audit);
}
