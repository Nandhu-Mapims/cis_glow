import { prisma } from '../../../config/prisma.js';
import { basicSetupCourseSelect } from '../../../utils/legacySelects.js';
import { parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logAcademicSetup } from './setupAudit.js';

const PAGE = 'course_edit.php';

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

function mapCourseListItem(row) {
  return {
    id: row.id,
    label: `${row.course_name} | ${row.degree_name} - ${row.department_name} | ${row.full_part_time} (${row.course_duration} Years)`,
  };
}

function mapCourseForm(row) {
  return {
    id: row.id,
    courseTime: row.full_part_time,
    courseName: row.course_name,
    degreeName: row.degree_name,
    degreeShortName: row.degree_short_name,
    departmentName: row.department_name,
    departmentShortName: row.department_short_name,
    departmentRef: String(row.course_department || ''),
    yearOfStart: String(row.year_of_start ?? ''),
    courseDuration: String(row.course_duration ?? ''),
    totalSemester: String(row.total_semester ?? ''),
    semesterPerYear: String(row.semester_per_year ?? ''),
    displayOrder: String(row.c_order ?? ''),
  };
}

async function loadCourseList(search, page) {
  const safePage = Math.max(1, Number(page) || 1);
  const limit = 20;
  const skip = (safePage - 1) * limit;
  const term = String(search || '').trim();

  const where = { del: 1 };
  if (term) {
    where.OR = [
      { course_name: { contains: term } },
      { degree_name: { contains: term } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.basic_setup_course_tb.count({ where }),
    prisma.basic_setup_course_tb.findMany({
      where,
      orderBy: [{ course_name: 'asc' }, { c_order: 'asc' }],
      skip,
      take: limit,
      select: {
        id: true,
        full_part_time: true,
        course_name: true,
        degree_name: true,
        degree_short_name: true,
        course_department: true,
        department_name: true,
        department_short_name: true,
        year_of_start: true,
        course_duration: true,
        total_semester: true,
        semester_per_year: true,
        c_order: true,
      },
    }),
  ]);

  return {
    mode: 'list',
    search: term,
    page: safePage,
    limit,
    total,
    courses: rows.map(mapCourseListItem),
  };
}

export async function loadCourseEdit(memberId, fields = {}, audit = {}) {
  const rawCourseId = Number(fields.courseId);
  const courseId = Number.isInteger(rawCourseId) && rawCourseId > 0 ? rawCourseId : 0;
  const departmentOptions = await loadDepartments();

  if (courseId) {
    const row = await prisma.basic_setup_course_tb.findFirst({
      where: { id: courseId, del: 1 },
      select: basicSetupCourseSelect,
    });
    if (!row) {
      return { success: false, message: 'Course not found' };
    }
    await logAcademicSetup(PAGE, 'View', 'Successful', String(courseId), memberId, audit);
    return {
      mode: 'edit',
      courseNameOptions: COURSE_NAME_OPTIONS,
      departmentOptions,
      course: mapCourseForm(row),
      listContext: {
        search: String(fields.search || ''),
        page: Number(fields.page) || 1,
      },
    };
  }

  const list = await loadCourseList(fields.search, fields.page);
  await logAcademicSetup(PAGE, 'View', 'Successful', list.search || '', memberId, audit);
  return {
    ...list,
    courseNameOptions: COURSE_NAME_OPTIONS,
    departmentOptions,
  };
}

export async function saveCourseEdit(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      await prisma.basic_setup_course_tb.update({
        where: { id },
        data: { del: 0, ...update },
      });
      await logAcademicSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return {
        success: true,
        message: 'Your details are deleted...',
        ...(await loadCourseEdit(memberId, {
          search: payload.search,
          page: payload.page,
        }, { ...audit, skipLog: true })),
      };
    } catch {
      await logAcademicSetup(PAGE, 'Delete', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  const id = parseId(payload.id);
  if (!id) {
    return { success: false, message: 'Course id is required' };
  }

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

  const { update } = auditFields(memberId, audit);

  try {
    await prisma.basic_setup_course_tb.update({
      where: { id },
      data: {
        full_part_time: courseTime,
        course_name: courseName,
        degree_name: degreeName,
        degree_short_name: degreeShortName,
        course_department: departmentRef,
        department_name: departmentName,
        department_short_name: departmentShortName,
        year_of_start: Number(yearOfStart),
        course_duration: Number(courseDuration),
        total_semester: Number(totalSemester),
        semester_per_year: Number(semesterPerYear),
        c_order: Number(displayOrder),
        ...update,
      },
    });
    await logAcademicSetup(PAGE, 'Update', 'Successful', String(id), memberId, audit);
    return {
      success: true,
      message: 'Your details are updated...',
      ...(await loadCourseEdit(memberId, {
        courseId: id,
        search: payload.search,
        page: payload.page,
      }, { ...audit, skipLog: true })),
    };
  } catch {
    await logAcademicSetup(PAGE, 'Update', 'Unsuccessful', String(id), memberId, audit);
    return { success: false, message: 'Please try again...' };
  }
}
