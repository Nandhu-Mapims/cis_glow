import { prisma } from '../../config/prisma.js';

export async function listCourses({ search = '', page = 1, limit = 20 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (safePage - 1) * safeLimit;

  const where = { del: 1 };
  if (search && String(search).trim()) {
    const term = String(search).trim();
    where.OR = [
      { course_name: { contains: term } },
      { degree_name: { contains: term } },
      { department_name: { contains: term } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.basic_setup_course_tb.count({ where }),
    prisma.basic_setup_course_tb.findMany({
      where,
      orderBy: [{ course_name: 'asc' }, { c_order: 'asc' }],
      skip,
      take: safeLimit,
      select: {
        id: true,
        full_part_time: true,
        course_name: true,
        degree_name: true,
        department_name: true,
        course_duration: true,
        c_order: true,
      },
    }),
  ]);

  return {
    total,
    page: safePage,
    limit: safeLimit,
    courses: rows.map((row) => ({
      id: row.id,
      fullPartTime: row.full_part_time,
      courseName: row.course_name,
      degreeName: row.degree_name,
      departmentName: row.department_name,
      courseDuration: row.course_duration,
      order: row.c_order,
      label: `${row.course_name} | ${row.degree_name} - ${row.department_name} | ${row.full_part_time} (${row.course_duration} Years)`,
    })),
  };
}
