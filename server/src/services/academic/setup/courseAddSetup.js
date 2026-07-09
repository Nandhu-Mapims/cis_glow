import { prisma } from '../../../config/prisma.js';
import { auditFields, logAcademicSetup } from './setupAudit.js';

const PAGE = 'course_add.php';

const COURSE_NAME_OPTIONS = [
  { value: 'U.G', label: 'U.G' },
  { value: 'P.G', label: 'P.G' },
  { value: 'Ph.D', label: 'Ph.D' },
];

async function loadDepartments() {
  const rows = await prisma.master_setup.findMany({
    where: { category: 'Department', del: { not: 0 } },
    orderBy: { category_order: 'asc' },
    select: { id: true, category_name: true },
  });
  return rows.map((row) => ({
    value: String(row.id),
    label: row.category_name,
  }));
}

export async function loadCourseAdd(memberId, _fields = {}, audit = {}) {
  const departmentOptions = await loadDepartments();
  await logAcademicSetup(PAGE, 'View', 'Successful', '', memberId, audit);
  return {
    courseNameOptions: COURSE_NAME_OPTIONS,
    departmentOptions,
    defaults: {
      courseTime: 'Full Time',
      courseName: 'U.G',
      courseDuration: '',
      totalSemester: '',
      semesterPerYear: '',
      displayOrder: '',
    },
  };
}

export async function saveCourseAdd(payload, memberId, audit = {}) {
  const courseTime = String(payload.courseTime || 'Full Time').trim();
  const courseName = String(payload.courseName || '').trim();
  const degreeName = String(payload.degreeName || '').trim();
  const degreeShortName = String(payload.degreeShortName || '').trim();
  const departmentName = String(payload.departmentName || '').trim();
  const departmentShortName = String(payload.departmentShortName || '').trim();
  const departmentRef = String(payload.departmentRef || '').trim();
  const yearOfStart = String(payload.yearOfStart || '').trim();
  const courseDuration = String(payload.courseDuration || '').trim();
  const totalSemester = String(payload.totalSemester || '').trim();
  const semesterPerYear = String(payload.semesterPerYear || '').trim();
  const displayOrder = String(payload.displayOrder || '').trim();

  if (!courseName || !degreeName || !departmentName || !departmentShortName
    || !yearOfStart || !courseDuration || !totalSemester || !semesterPerYear || !displayOrder) {
    return { success: false, message: 'Please fill all required fields' };
  }

  const { create } = auditFields(memberId, audit);

  try {
    await prisma.basic_setup_course_tb.create({
      data: {
        full_part_time: courseTime,
        course_name: courseName,
        degree_name: degreeName,
        degree_short_name: degreeShortName,
        course_department: departmentRef,
        department_name: departmentName,
        department_short_name: departmentShortName,
        year_of_start: yearOfStart,
        course_duration: courseDuration,
        total_semester: totalSemester,
        semester_per_year: semesterPerYear,
        c_order: displayOrder,
        ...create,
      },
    });
    await logAcademicSetup(PAGE, 'Add', 'Successful', '', memberId, audit);
    return {
      success: true,
      message: 'Your details are added...',
      ...(await loadCourseAdd(memberId, {}, { ...audit, skipLog: true })),
    };
  } catch {
    await logAcademicSetup(PAGE, 'Add', 'Unsuccessful', '', memberId, audit);
    return { success: false, message: 'Please try again...' };
  }
}
