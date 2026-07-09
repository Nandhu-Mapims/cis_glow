import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { convertNYear } from '../fees/feeHelpers.js';

/**
 * Legacy: attendance_report_filters.php / widget.php convertNYear
 * Reference: /home/mapims/cis/cis/attendance_report.php
 */
export async function loadStudentReportFilters({ academicYear, courses = [] } = {}) {
  const yearRows = await prisma.$queryRawUnsafe(
    'SELECT DISTINCT academic_year FROM basic_setup_subject_tb WHERE del = 1 ORDER BY academic_year ASC',
  );
  const setup = await prisma.basic_setup_tb.findFirst({
    where: { del: 1 },
    select: { ug_academic_year: true },
  });
  const academicYears = yearRows.map((r) => r.academic_year);
  const defaultAcademicYear = setup?.ug_academic_year || academicYears[0] || '';
  const year = academicYear || defaultAcademicYear;

  const courseRows = await prisma.$queryRawUnsafe(
    `SELECT id, degree_name, department_name, course_duration
     FROM basic_setup_course_tb
     WHERE del = 1 AND course_name = 'U.G'
     ORDER BY c_order ASC`,
  );

  const courseGroups = [];
  for (const row of courseRows) {
    let departmentName = String(row.department_name || '').trim();
    if (departmentName && departmentName !== '-') {
      departmentName = ` - ${departmentName}`;
    } else {
      departmentName = '';
    }
    const duration = Math.max(0, Number(row.course_duration) - 1);
    const groupLabel = `${row.degree_name}${departmentName} | ${year}`;
    const options = [];
    for (let i = 1; i <= duration; i += 1) {
      const cyearLabel = convertNYear(i, 'U.G');
      options.push({
        value: `${row.id}___${year}___${i}___regular`,
        label: `${cyearLabel} Year`,
      });
      options.push({
        value: `${row.id}___${year}___${i}___additional`,
        label: `${cyearLabel} Year (Additional)`,
      });
    }
    courseGroups.push({ groupLabel, options });
  }

  const subjects = [];
  const subjectKeys = new Set();
  if (Array.isArray(courses) && courses.length) {
    const deptRows = await prisma.$queryRawUnsafe(
      `SELECT id, category_name FROM subject_master
       WHERE del = 1 AND category = 'Timetable' ORDER BY category_order ASC`,
    );
    const subjectSubcat = Object.fromEntries(
      deptRows.map((d) => [String(d.id), d.category_name]),
    );

    for (const cstr of courses) {
      const tmp = String(cstr).split('___');
      if (tmp.length < 4) continue;
      const [refCourseId, refAcademicYear, refCurrentYear, refAcademicType] = tmp;

      const subRows = await prisma.$queryRawUnsafe(
        `SELECT A.subject_id, A.subject_name, B.id AS tt_id, B.subject_id AS tt_code,
                B.subject_name AS tt_name, B.subject_category, B.department
         FROM basic_setup_subject_tb AS A
         INNER JOIN basic_subject_tt_tb AS B ON A.id = B.rid
         WHERE A.del = 1 AND B.del = 1
           AND A.academic_year = '${escapeSql(refAcademicYear)}'
           AND A.course_id = '${escapeSql(refCourseId)}'
           AND A.semester_no = '${escapeSql(refCurrentYear)}'
         ORDER BY A.subject_order ASC`,
      );

      for (const row of subRows) {
        const sid = String(row.tt_id);
        const value = `${cstr}___${sid}`;
        if (subjectKeys.has(value)) continue;
        subjectKeys.add(value);
        const scode = String(row.tt_code || row.subject_id || '');
        const sname = String(row.tt_name || row.subject_name || '');
        const cat = subjectSubcat[String(row.subject_category)] || '';
        subjects.push({
          value,
          label: `${scode} | ${sname}${cat ? ` | ${cat}` : ''}`.trim(),
        });
      }
    }
  }

  return {
    academicYears,
    defaultAcademicYear,
    courses: courseGroups,
    subjects,
  };
}
