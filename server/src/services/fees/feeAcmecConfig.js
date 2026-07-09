import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { getStudentCourseOptions } from '../students/studentCourses.js';
import { searchStudents } from '../students/studentSearch.js';
import { studentIdCardPhotoUrl } from '../students/studentShared.js';
import { auditFields, logFeeSetup } from './setup/setupAudit.js';

const PAGE = 'student_acmec_config.php';

function formatDateDisplay(value) {
  if (!value) return '';
  const raw = String(value).slice(0, 10);
  if (!raw || raw.startsWith('0000')) return '';
  const [y, m, d] = raw.split('-');
  return `${d}-${m}-${y}`;
}

function parseDateInput(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s;
}

async function loadStudentDetail(studentId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, register_no, student_name, student_initial, academic_year, course_id,
            first_graduate, acmec_trust, scholar_ship, caste_scholar_ship,
            CAST(tf_receipt_date AS CHAR) AS tf_receipt_date, tf_receipt_no, tf_amount,
            acmec_scholorship, acmec_amount, acmec_approved
     FROM student_profile_tb WHERE del = 1 AND id = ${Number(studentId)} LIMIT 1`,
  );
  if (!rows.length) return null;

  const row = rows[0];
  const courseRows = await prisma.$queryRawUnsafe(
    `SELECT degree_name, department_name, course_name FROM basic_setup_course_tb
     WHERE del = 1 AND id = '${escapeSql(String(row.course_id))}' LIMIT 1`,
  );
  const course = courseRows[0] || {};
  const dept = course.department_name && course.department_name !== '-' ? ` - ${course.department_name}` : '';

  return {
    student: {
      id: Number(row.id),
      registerNo: row.register_no,
      name: `${row.student_name || ''} ${row.student_initial || ''}`.trim(),
      academicYear: row.academic_year,
      courseName: `${course.degree_name || ''}${dept}`.trim(),
      photoUrl: await studentIdCardPhotoUrl(row.register_no),
    },
    form: {
      scholarShip: Number(row.scholar_ship) === 1,
      casteScholarship: row.caste_scholar_ship || '',
      firstGraduate: Number(row.first_graduate) === 1,
      acmecTrust: Number(row.acmec_trust) === 1,
      tfReceiptDate: formatDateDisplay(row.tf_receipt_date),
      tfReceiptNo: row.tf_receipt_no || '',
      tfAmount: row.tf_amount || '',
      acmecScholarship: Number(row.acmec_scholorship) === 1,
      acmecAmount: row.acmec_amount || '',
      acmecApproved: row.acmec_approved || '',
    },
  };
}

export async function loadAcmecConfig(memberId, fields = {}, audit = {}) {
  const searchBy = fields.searchBy || fields.search_by || 'roll_no';
  const searchInput = String(fields.searchInput || fields.search_input || '').trim();
  const searchCourse = String(fields.searchCourse || fields.search_course || '').trim();
  const studentId = fields.studentId || fields.student_id || null;

  const courseOptions = await getStudentCourseOptions();

  let students = [];
  if (searchBy === 'batch' && searchCourse) {
    students = await searchStudents({ by: 'batch', q: searchCourse, studentId });
  } else if (searchBy === 'roll_no' && searchInput) {
    students = await searchStudents({ by: 'roll', q: searchInput, studentId });
  }

  const activeId = studentId || students.find((s) => s.selected)?.id || students[0]?.id || null;
  let detail = null;
  if (activeId) {
    detail = await loadStudentDetail(activeId);
    students = students.map((s) => ({ ...s, selected: s.id === Number(activeId) }));
  }

  await logFeeSetup(PAGE, 'View', 'Successful', searchBy, memberId, audit);
  return {
    searchBy,
    searchInput,
    searchCourse,
    studentId: activeId,
    courseOptions,
    students,
    detail,
  };
}

export async function saveAcmecConfig(payload, memberId, audit = {}) {
  const studentId = Number(payload.studentId || payload.student_id);
  const registerNo = String(payload.registerNo || payload.roll_no || '').trim();
  if (!studentId || !registerNo) {
    return { error: 'Student is required' };
  }

  const dup = await prisma.$queryRawUnsafe(
    `SELECT id FROM student_profile_tb WHERE del = 1 AND register_no = '${escapeSql(registerNo)}'
     AND id != ${studentId} LIMIT 1`,
  );
  if (dup.length) {
    return { success: false, message: 'Roll number already exists for another student' };
  }

  const form = payload.form || payload;
  const scholarShip = form.scholarShip || form.scholar_ship ? 1 : 0;
  let cSship = String(form.casteScholarship || form.c_sship || '').trim();
  let firstGraduate = form.firstGraduate || form.first_graduate ? 1 : 0;
  let acmecTrust = form.acmecTrust || form.acmec_trust ? 1 : 0;

  if (!scholarShip) {
    cSship = '';
    acmecTrust = 0;
    firstGraduate = 0;
  }

  const tfDate = parseDateInput(form.tfReceiptDate || form.tf_receipt_date);
  const { update } = auditFields(memberId, audit);

  await prisma.$executeRawUnsafe(
    `UPDATE student_profile_tb SET
      first_graduate = ${firstGraduate},
      acmec_trust = ${acmecTrust},
      scholar_ship = ${scholarShip},
      caste_scholar_ship = '${escapeSql(cSship)}',
      tf_receipt_date = ${tfDate ? `'${escapeSql(tfDate)}'` : 'NULL'},
      tf_receipt_no = '${escapeSql(String(form.tfReceiptNo || form.tf_receipt_no || ''))}',
      tf_amount = '${escapeSql(String(form.tfAmount || form.tf_amount || ''))}',
      acmec_scholorship = ${form.acmecScholarship || form.acmec_scholorship ? 1 : 0},
      acmec_amount = '${escapeSql(String(form.acmecAmount || form.acmec_amount || ''))}',
      acmec_approved = '${escapeSql(String(form.acmecApproved || form.acmec_approved || ''))}',
      updated_dt = NOW(), updated_ip = '${escapeSql(update.updated_ip)}', updated_by = '${escapeSql(memberId)}'
     WHERE id = ${studentId}`,
  );

  await logFeeSetup(PAGE, 'Update', 'Successful', String(studentId), memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadAcmecConfig(memberId, { studentId }, { ...audit, skipLog: true })),
  };
}
