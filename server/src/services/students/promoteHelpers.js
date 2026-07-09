import { convertNYear } from '../fees/feeHelpers.js';
import { loadAcademicYears, loadCourseRows } from './studentShared.js';

function courseLabel(row) {
  const dept = row.department_name && row.department_name !== '-'
    ? ` - ${row.department_name}`
    : '';
  return `${row.degree_name}${dept}`;
}

export async function getPromoteCourseOptions() {
  const courses = await loadCourseRows();
  return courses.map((course) => {
    const label = courseLabel(course);
    const batchOptions = [
      { value: `${course.id}___regular`, label: `${label} (Regular)` },
    ];
    if (course.course_name === 'U.G') {
      batchOptions.push({
        value: `${course.id}___additional`,
        label: `${label} (Additional)`,
      });
    }
    return {
      id: Number(course.id),
      courseName: course.course_name,
      courseDuration: Number(course.course_duration) || 0,
      label,
      batchOptions,
    };
  });
}

export function buildToAcademicYearOptions(fromAcademicYear, academicYears = []) {
  if (!fromAcademicYear) return academicYears;
  const options = [...academicYears];
  const tail = String(fromAcademicYear).slice(-4);
  const yr = Number(tail);
  if (!Number.isNaN(yr)) {
    const ref = `${yr}-${yr + 1}`;
    if (!options.includes(ref)) options.unshift(ref);
  }
  return options;
}

export function buildYearTypeOptions(duration, courseName) {
  const types = ['regular', 'additional', 'break'];
  const options = [];
  for (let y = 1; y <= duration; y += 1) {
    const label = `${convertNYear(y, courseName)} Year`;
    for (const type of types) {
      if (type === 'additional' && courseName !== 'U.G') continue;
      const name = type.charAt(0).toUpperCase() + type.slice(1);
      options.push({ value: `${y}___${type}`, label: `${label} (${name})` });
    }
  }
  return options;
}

export function buildPromotionMatrix(duration, courseName) {
  const yearOptions = buildYearTypeOptions(duration, courseName);
  const rows = [];
  for (let i = 1; i < duration; i += 1) {
    rows.push({
      allow: true,
      fromYear: `${i}___regular`,
      toYear: `${i + 1}___regular`,
      failList: '',
    });
  }
  return { rows, yearOptions };
}

export function toCourseOptionsForSelection(fromClass, promoteCourses) {
  if (!fromClass) return [];
  const [courseId] = String(fromClass).split('___');
  const course = promoteCourses.find((c) => String(c.id) === courseId);
  return course?.batchOptions || [];
}

export function splitYearType(value, fallback = 'regular') {
  const parts = String(value ?? '').split('___');
  if (parts.length >= 2) return { year: parts[0], type: parts[1] };
  return { year: parts[0] || '', type: fallback };
}

export async function buildPromoteScreenPayload(fields = {}) {
  const academicYears = await loadAcademicYears();
  const promoteCourses = await getPromoteCourseOptions();
  const fromYear = fields.from_a_year || '';
  const fromClass = fields.from_class || '';
  const toAcademicYears = buildToAcademicYearOptions(fromYear, academicYears);

  let promotion = null;
  if (fromClass) {
    const [courseId] = fromClass.split('___');
    const course = promoteCourses.find((c) => String(c.id) === courseId);
    if (course?.courseDuration > 1) {
      promotion = {
        ...buildPromotionMatrix(course.courseDuration, course.courseName),
        toCourseOptions: toCourseOptionsForSelection(fromClass, promoteCourses),
      };
    }
  }

  return {
    academicYears,
    promoteCourses,
    toAcademicYears,
    selected: {
      fromAYear: fromYear,
      toAYear: fields.to_a_year || '',
      fromClass,
      toClass: fields.to_class || fromClass || '',
    },
    promotion,
  };
}
