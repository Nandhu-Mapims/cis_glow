import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { loadAcademicYearSetup } from '../feeHelpers.js';

const ATT_EOS = 2016;

function courseLabelBase(course) {
  const dept = course.department_name && course.department_name !== '-'
    ? ` - ${course.department_name}`
    : '';
  return `${course.degree_name || course.course_name}${dept}`;
}

function courseDeptPart(course) {
  return course.department_name && course.department_name !== '-'
    ? ` - ${course.department_name}`
    : '';
}

function timeAbbrev(fullPartTime) {
  const value = String(fullPartTime || '').toLowerCase();
  if (value.includes('part')) return 'PT';
  return 'FT';
}

export function parseCourseKey(courseKey = '') {
  const key = String(courseKey || '').trim();
  if (!key.includes('___')) {
    return { courseKey: '', courseId: '', academicYear: '', academicBatch: 'regular' };
  }
  const [courseId, academicYear, academicBatch = 'regular'] = key.split('___');
  return {
    courseKey: key,
    courseId: String(courseId || '').trim(),
    academicYear: String(academicYear || '').trim(),
    academicBatch: String(academicBatch || 'regular').trim().toLowerCase(),
  };
}

export async function loadCourseYearGroups() {
  const ac = await loadAcademicYearSetup(prisma);
  const courses = await prisma.$queryRawUnsafe(
    `SELECT id, course_name, degree_name, department_name, full_part_time, year_of_start
     FROM basic_setup_course_tb
     WHERE del = 1
     ORDER BY c_order ASC`,
  );

  const groups = [];

  for (const course of courses) {
    const labelBase = courseLabelBase(course);
    const groupPrefix = `${course.course_name} | ${course.degree_name}${courseDeptPart(course)} | ${timeAbbrev(course.full_part_time)}`;
    const batches = ['regular'];
    if (course.course_name === 'U.G') batches.push('additional');

    for (const batch of batches) {
      const setupYear = ac[course.course_name]?.[batch] || '';
      const batchTitle = batch.charAt(0).toUpperCase() + batch.slice(1);
      const seen = new Set();
      const options = [];

      const pushYear = (year) => {
        const admissionYear = String(year || '').trim();
        if (!admissionYear || seen.has(admissionYear)) return;
        seen.add(admissionYear);
        const suffix = batch === 'regular' && admissionYear === setupYear ? ` | ${batchTitle}` : '';
        options.push({
          value: `${course.id}___${admissionYear}___${batch}`,
          label: `${labelBase} | ${admissionYear}${suffix}`,
          courseId: String(course.id),
          academicYear: admissionYear,
          academicBatch: batch,
        });
      };

      if (setupYear) pushYear(setupYear);

      const yearRows = await prisma.$queryRawUnsafe(
        `SELECT DISTINCT academic_year
         FROM student_academic_tb
         WHERE del = 1
           AND course_id = '${escapeSql(String(course.id))}'
           AND academic_batch = '${escapeSql(batch)}'
         ORDER BY academic_year DESC`,
      );
      for (const row of yearRows) {
        pushYear(row.academic_year);
      }

      if (options.length) {
        options.sort((a, b) => b.academicYear.localeCompare(a.academicYear));
        groups.push({
          label: `${groupPrefix} | ${batchTitle}`,
          batch,
          courseId: String(course.id),
          options,
        });
      }
    }
  }

  return groups;
}

function yearsFromSetupToStart(setupYear, yearOfStart) {
  const floor = Math.max(Number(yearOfStart) || 0, ATT_EOS);
  const match = String(setupYear || '').match(/^(\d{4})-(\d{4})$/);
  if (!match) return [];
  let yearNum = Number(match[1]);
  const years = [];
  while (yearNum >= floor) {
    years.push(`${yearNum}-${yearNum + 1}`);
    yearNum -= 1;
  }
  return years;
}

/** Legacy acmec_fee_scholarship.php / dme_fee_approve.php year list: setup year down to year_of_start. */
export async function loadLegacyCourseYearGroups() {
  const ac = await loadAcademicYearSetup(prisma);
  const courses = await prisma.$queryRawUnsafe(
    `SELECT id, course_name, degree_name, department_name, full_part_time, year_of_start
     FROM basic_setup_course_tb
     WHERE del = 1
     ORDER BY c_order ASC`,
  );

  const groups = [];

  for (const course of courses) {
    const labelBase = courseLabelBase(course);
    const groupPrefix = `${course.course_name} | ${course.degree_name}${courseDeptPart(course)} | ${timeAbbrev(course.full_part_time)}`;
    const yearOfStart = Math.max(Number(course.year_of_start) || 0, ATT_EOS);

    const pushBatchGroup = (batch, setupYear) => {
      if (!setupYear) return;
      const batchTitle = batch.charAt(0).toUpperCase() + batch.slice(1);
      const years = yearsFromSetupToStart(setupYear, yearOfStart);
      if (!years.length) return;
      const options = years.map((admissionYear) => {
        const suffix = admissionYear === setupYear ? ` | ${batchTitle}` : '';
        return {
          value: `${course.id}___${admissionYear}___${batch}`,
          label: `${labelBase} | ${admissionYear}${suffix}`,
          courseId: String(course.id),
          academicYear: admissionYear,
          academicBatch: batch,
        };
      });
      groups.push({
        label: `${groupPrefix} | ${batchTitle}`,
        batch,
        courseId: String(course.id),
        options,
      });
    };

    pushBatchGroup('regular', ac[course.course_name]?.regular || '');
    if (ac[course.course_name]?.additional) {
      pushBatchGroup('additional', ac[course.course_name].additional);
    }
  }

  return groups;
}
