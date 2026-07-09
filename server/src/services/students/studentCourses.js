import { prisma } from '../../config/prisma.js';

function yearRange(startYear, endYear) {
  const years = [];
  for (let y = endYear; y >= startYear; y -= 1) {
    years.push(`${y}-${y + 1}`);
  }
  return years;
}

/**
 * Course/batch options for student batch search (legacy student_profile_edit.php).
 */
export async function getStudentCourseOptions() {
  const [courseRows, setup] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT id, course_name, degree_name, department_name, full_part_time, year_of_start
       FROM basic_setup_course_tb WHERE del = 1 ORDER BY c_order ASC`,
    ),
    prisma.basic_setup_tb.findFirst({ where: { del: 1 } }),
  ]);
  const courses = courseRows;

  const academicByCourse = {
    'U.G': setup?.ug_academic_year || '',
    'P.G': setup?.pg_academic_year || '',
  };

  return courses.map((course) => {
    const dept = course.department_name && course.department_name !== '-'
      ? ` - ${course.department_name}`
      : '';
    const ft = course.full_part_time === 'Full Time' ? 'FT' : 'PT';
    const refYear = academicByCourse[course.course_name] || '';
    const startYear = refYear ? Number(refYear.split('-')[0]) : new Date().getFullYear();
    const years = yearRange(course.year_of_start, startYear);

    return {
      id: course.id,
      courseName: course.course_name,
      degreeName: course.degree_name,
      departmentName: course.department_name,
      label: `${course.degree_name}${dept} | ${ft}`,
      batchOptions: years.map((y) => ({
        value: `${course.id}___${y}`,
        label: `${course.degree_name}${dept} | ${y}`,
      })),
    };
  });
}
