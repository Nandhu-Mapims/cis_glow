import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { logModulePage } from '../shared/moduleAudit.js';
import { getStudentCourseOptions } from '../students/studentCourses.js';
import { studentIdCardPhotoUrl } from '../students/studentShared.js';

const PAGE = 'student_portfolia_individual_report.php';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function searchPortfolioStudents({ by, q, studentId }) {
  let sql = '';

  if (by === 'roll' && q) {
    const rolls = q.split(',').map((s) => s.trim()).filter(Boolean);
    if (!rolls.length) return [];
    const clauses = rolls.map((r) => `register_no='${escapeSql(r)}'`).join(' OR ');
    sql = `SELECT id, admission_no, academic_year, register_no, student_name, student_initial, course_id
      FROM student_profile_tb WHERE del=1 AND course_id!=1 AND (${clauses})
      ORDER BY student_name ASC, student_initial ASC`;
  } else if (by === 'batch' && q) {
    const [courseId, admissionYear] = q.split('___');
    if (!courseId || !admissionYear) return [];
    sql = `SELECT id, admission_no, academic_year, register_no, student_name, student_initial, course_id
      FROM student_profile_tb WHERE del=1 AND course_id='${escapeSql(courseId)}'
      AND academic_year='${escapeSql(admissionYear)}'
      ORDER BY student_name ASC, student_initial ASC`;
  } else {
    return [];
  }

  const rows = await prisma.$queryRawUnsafe(sql);
  const selectedId = studentId ? Number(studentId) : null;

  return rows.map((row, index) => ({
    id: Number(row.id),
    admissionNo: row.admission_no,
    academicYear: row.academic_year,
    registerNo: row.register_no,
    name: `${row.student_name || ''} ${row.student_initial || ''}`.trim(),
    courseId: row.course_id,
    selected: (index === 0 && !selectedId) || selectedId === Number(row.id),
  }));
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1900) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function courseLabel(course) {
  const dept = course.department_name && course.department_name !== '-'
    ? ` - ${course.department_name}`
    : '';
  return `${course.degree_name || ''}${dept}`.trim();
}

async function loadStudentDetail(studentId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, admission_no, academic_year, register_no, student_name, student_initial, course_id
     FROM student_profile_tb WHERE del = 1 AND id = ${Number(studentId)} LIMIT 1`,
  );
  if (!rows.length) return null;

  const student = rows[0];
  const courseRows = await prisma.$queryRawUnsafe(
    `SELECT degree_name, department_name, course_duration
     FROM basic_setup_course_tb WHERE del = 1 AND id = '${String(student.course_id).replace(/'/g, "''")}' LIMIT 1`,
  );
  const course = courseRows[0] || {};
  const photoUrl = await studentIdCardPhotoUrl(student.register_no);

  const seminars = await prisma.$queryRawUnsafe(
    `SELECT category, ntype, attend_conduct, s_name, s_location, s_from_date, s_to_date,
            p_download_link, p_download_link_1, p_download_link_2
     FROM student_seminar_tb
     WHERE del = 1 AND student_id = '${String(studentId).replace(/'/g, "''")}'
     ORDER BY s_from_date ASC`,
  );

  const publications = await prisma.$queryRawUnsafe(
    `SELECT p_title_name, p_author_name, p_journal, p_journal_name, p_location, p_month, p_year,
            p_volume, p_main, p_points, p_abstract, p_download_link, p_download_link_1,
            p_download_link_2, p_page, p_attachment, p_category, p_authorship
     FROM student_publication_tb
     WHERE del = 1 AND student_id = '${String(studentId).replace(/'/g, "''")}'
     ORDER BY p_year ASC, p_month ASC`,
  );

  return {
    student: {
      id: Number(student.id),
      name: `${student.student_name || ''} ${student.student_initial || ''}`.trim(),
      registerNo: student.register_no,
      academicYear: student.academic_year,
      courseName: courseLabel(course),
      photoUrl,
    },
    seminars: seminars.map((row) => ({
      particular: `${row.ntype || ''} ${row.category || ''}`.trim(),
      type: row.s_name || '',
      location: row.s_location || '',
      fromDate: formatDate(row.s_from_date),
      toDate: formatDate(row.s_to_date),
      links: [row.p_download_link, row.p_download_link_1, row.p_download_link_2].filter(Boolean),
    })),
    publications: publications.map((row) => ({
      journal: row.p_journal || '',
      publicationName: row.p_journal_name || '',
      title: row.p_title_name || '',
      author: row.p_author_name || '',
      location: row.p_location || '',
      monthYear: `${MONTHS[Number(row.p_month)] || ''}-${row.p_year || ''}`.replace(/^-/, ''),
      volumePage: `${row.p_volume || ''}-${row.p_page || row.p_main || ''}`.replace(/^-/, ''),
      points: row.p_points || '',
      category: row.p_category || '',
      authorship: row.p_authorship || '',
      abstract: row.p_abstract || '',
      links: [row.p_download_link, row.p_download_link_1, row.p_download_link_2].filter(Boolean),
      attachment: row.p_attachment
        ? `/legacy/files/publication_docs/${row.p_attachment}`
        : null,
    })),
  };
}

export async function loadPortfolioIndividualReport(memberId, fields = {}, audit = {}) {
  const searchBy = fields.searchBy || fields.search_by || 'roll_no';
  const searchInput = String(fields.searchInput || fields.search_input || '').trim();
  const searchCourse = String(fields.searchCourse || fields.search_course || '').trim();
  const studentId = fields.studentId || fields.student_id || null;

  const courseOptions = (await getStudentCourseOptions()).filter((c) => c.id !== 1);

  let students = [];
  let detail = null;

  if (searchBy === 'batch' && searchCourse) {
    students = await searchPortfolioStudents({ by: 'batch', q: searchCourse, studentId });
  } else if (searchBy === 'roll_no' && searchInput) {
    students = await searchPortfolioStudents({ by: 'roll', q: searchInput, studentId });
  }

  const activeId = studentId || students.find((s) => s.selected)?.id || students[0]?.id || null;
  if (activeId) {
    detail = await loadStudentDetail(activeId);
    students = students.map((s) => ({ ...s, selected: s.id === Number(activeId) }));
  }

  await logModulePage(PAGE, 'View', 'Successful', searchBy, memberId, audit);

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

export async function loadPortfolioStudentDetail(memberId, studentId, audit = {}) {
  const detail = await loadStudentDetail(studentId);
  if (!detail) return { error: 'Student not found' };
  await logModulePage(PAGE, 'View', 'Successful', String(studentId), memberId, audit);
  return { detail };
}
