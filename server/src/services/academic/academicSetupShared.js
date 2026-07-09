import { prisma } from '../../config/prisma.js';
import { basicSetupCourseSelect, ciaExamNameSelect, ciaSetupSelect, roomsTbSelect, staffDeptMasterSelect, subjectMasterSelect } from '../../utils/legacySelects.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { convertNYear } from '../fees/feeHelpers.js';
import { loadAcademicConfig } from '../shared/ciaSetupHelpers.js';
import {
  buildCourseIdYearOptions,
  courseIdYearKey,
  parseCourseIdYearKey,
} from '../exam/setup/examSetupShared.js';

export {
  buildCourseIdYearOptions,
  courseIdYearKey,
  parseCourseIdYearKey,
};

export function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function courseIdYearOnlyKey(courseId, academicYear) {
  return `${courseId}___${academicYear}`;
}

export function parseCourseIdYearOnlyKey(key) {
  const parts = String(key || '').split('___');
  if (parts.length !== 2) return null;
  return { courseId: Number(parts[0]), academicYear: parts[1] };
}

export async function loadSubjectMasterMap(category) {
  const rows = await prisma.subject_master.findMany({
    where: { del: 1, category },
    orderBy: { category_order: 'asc' },
    select: subjectMasterSelect,
  });
  const options = rows.map((r) => ({ value: String(r.id), label: r.category_name }));
  const map = Object.fromEntries(rows.map((r) => [String(r.id), r.category_name]));
  return { options, map };
}

export async function loadDepartmentOptions() {
  const rows = await prisma.staff_dept_master.findMany({
    where: { del: 1 },
    orderBy: { d_order: 'asc' },
    select: staffDeptMasterSelect,
  });
  return rows.map((r) => ({ value: String(r.id), label: r.name }));
}

export async function loadDepartmentMap() {
  const rows = await prisma.staff_dept_master.findMany({
    where: { del: 1 },
    orderBy: { d_order: 'asc' },
    select: staffDeptMasterSelect,
  });
  return Object.fromEntries(rows.map((r) => [String(r.id), r.name]));
}

export async function loadRoomOptions() {
  const blocks = await prisma.blocks_tb.findMany({
    where: { del: 1 },
    orderBy: { block_name: 'asc' },
    select: { id: true, block_name: true, del: true },
  });
  const groups = [];
  for (const block of blocks) {
    const rooms = await prisma.rooms_tb.findMany({
      where: { del: 1, block_id: String(block.id) },
      orderBy: { room_name: 'asc' },
      select: roomsTbSelect,
    });
    if (rooms.length) {
      groups.push({
        label: block.block_name,
        options: rooms.map((r) => ({ value: String(r.id), label: r.room_name })),
      });
    }
  }
  const map = {};
  for (const g of groups) {
    for (const opt of g.options) map[opt.value] = opt.label;
  }
  return { groups, map };
}

export async function getCourseById(courseId) {
  if (!courseId) return null;
  return prisma.basic_setup_course_tb.findFirst({
    where: { del: 1, id: Number(courseId) },
    select: basicSetupCourseSelect,
  });
}

/** Course + academic year options (no regular/additional) — subject_report.php */
export async function buildCourseIdYearReportOptions() {
  const academicYearArray = await loadAcademicConfig();
  const courses = await prisma.basic_setup_course_tb.findMany({
    where: { del: 1 },
    orderBy: { c_order: 'asc' },
    select: basicSetupCourseSelect,
  });
  const options = [];

  for (const course of courses) {
    let dept = String(course.department_name || '').trim();
    if (dept && dept !== '-') dept = ` - ${dept}`;
    else dept = '';
    const ft = course.full_part_time === 'Full Time' ? 'FT' : 'PT';
    const group = `${course.course_name} | ${course.degree_name}${dept} | ${ft}`;

    let acYearBase = academicYearArray[course.course_name];
    if (course.course_name === 'U.G') {
      const reg = academicYearArray['U.G']?.regular || '';
      const add = academicYearArray['U.G']?.additional || '';
      acYearBase = (Number(String(add).slice(0, 4)) > Number(String(reg).slice(0, 4)) ? add : reg);
    } else {
      acYearBase = academicYearArray[course.course_name]?.regular || academicYearArray[course.course_name];
    }

    const startYear = Number(String(acYearBase || '').split('-')[0]) || 2000;
    const currentYear = new Date().getFullYear();
    const yearOfStart = Number(course.year_of_start) || 2000;
    const loopStart = Math.max(startYear, currentYear);
    for (let i = loopStart; i >= yearOfStart; i -= 1) {
      const yearLabel = `${i}-${i + 1}`;
      options.push({
        value: courseIdYearOnlyKey(course.id, yearLabel),
        label: `${course.degree_name}${dept} | ${yearLabel}`,
        group,
        courseId: course.id,
        courseName: course.course_name,
        academicYear: yearLabel,
        totalSemester: Number(course.total_semester) || 0,
      });
    }
  }
  return options;
}

/** subject_schedule.php — course + academic year + study year in one dropdown. */
export function subjectScheduleCourseKey(courseId, academicYear, semester, typeSuffix = null) {
  const base = `${courseId}___${academicYear}___${semester}`;
  return typeSuffix ? `${base}___${typeSuffix}` : base;
}

export function parseSubjectScheduleCourseKey(key) {
  const parts = String(key || '').split('___');
  if (parts.length === 3) {
    const semester = Number(parts[2]);
    if (!parts[0] || !parts[1] || !semester) return null;
    return {
      courseId: Number(parts[0]),
      academicYear: parts[1],
      semester,
      academicType: 'regular',
    };
  }
  if (parts.length === 4) {
    const semester = Number(parts[2]);
    if (!parts[0] || !parts[1] || !semester) return null;
    const type = String(parts[3]).toLowerCase();
    return {
      courseId: Number(parts[0]),
      academicYear: parts[1],
      semester,
      academicType: type === 'additional' ? 'additional' : 'regular',
    };
  }
  return null;
}

export async function buildSubjectScheduleCourseOptions() {
  const academicYearArray = await loadAcademicConfig();
  const courses = await prisma.basic_setup_course_tb.findMany({
    where: { del: 1 },
    orderBy: { c_order: 'asc' },
    select: basicSetupCourseSelect,
  });
  const options = [];

  const ugRegular = academicYearArray['U.G']?.regular || '';
  const ugParts = String(ugRegular).split('-');
  const planningYear = ugParts.length === 2
    ? `${Number(ugParts[0]) + 1}-${Number(ugParts[1]) + 1}`
    : '';

  for (const course of courses) {
    let dept = String(course.department_name || '').trim();
    if (dept && dept !== '-') dept = ` - ${dept}`;
    else dept = '';

    const degreeLabel = `${course.degree_name}${dept}`;
    let duration = Number(course.course_duration) || Number(course.total_semester) || 0;
    if (course.course_name === 'U.G') duration -= 1;

    const courseYears = academicYearArray[course.course_name];
    const regularYear = courseYears?.regular || courseYears;
    const additionalYear = courseYears?.additional || '';

    const pushSemesters = (academicYear, groupSuffix, typeSuffix, academicType) => {
      if (!academicYear || !duration) return;
      const group = `${degreeLabel} | ${academicYear} | ${groupSuffix}`;
      for (let cyear = 1; cyear <= duration; cyear += 1) {
        options.push({
          value: subjectScheduleCourseKey(course.id, academicYear, cyear, typeSuffix),
          label: `${convertNYear(cyear, course.course_name)} Year`,
          group,
          courseId: course.id,
          courseName: course.course_name,
          academicYear,
          semester: cyear,
          academicType,
        });
      }
    };

    pushSemesters(regularYear, 'Regular', null, 'regular');
    pushSemesters(planningYear, 'Regular', 'regular', 'regular');
    pushSemesters(additionalYear, 'Additional', 'additional', 'additional');
  }

  return options;
}

const INTERNSHIP_ATT_EOS = 2016;

/** internship_schedule.php — U.G courses, historical years + forward planning years. */
export async function buildInternshipCourseOptions() {
  const academicYearArray = await loadAcademicConfig();
  const courses = await prisma.basic_setup_course_tb.findMany({
    where: { del: 1, course_name: 'U.G' },
    orderBy: { c_order: 'asc' },
    select: basicSetupCourseSelect,
  });
  const options = [];
  const seen = new Set();

  const pushYear = (course, dept, ft, acYear, atype, alabel) => {
    if (!acYear) return;
    const value = courseIdYearKey(course.id, acYear, atype);
    if (seen.has(value)) return;
    seen.add(value);
    const group = `U.G | ${course.degree_name}${dept} | ${ft} | ${alabel}`;
    options.push({
      value,
      label: `${course.degree_name}${dept} | ${acYear}`,
      group,
      courseId: course.id,
      courseName: course.course_name,
      academicYear: acYear,
      academicType: atype,
      currentYear: String(course.course_duration || ''),
    });
  };

  const collectInternshipYears = (configYear, yearOfStart, includeForward = false) => {
    const years = [];
    const startYear = Number(String(configYear || '').split('-')[0]) || 0;
    if (!startYear) return years;

    if (includeForward) {
      const calYear = new Date().getFullYear();
      years.push(`${calYear}-${calYear + 1}`);

      const endYear = Number(String(configYear || '').split('-')[1]);
      if (endYear) years.push(`${endYear}-${endYear + 1}`);
    }

    for (let i = startYear; i >= yearOfStart; i -= 1) {
      years.push(`${i}-${i + 1}`);
    }

    return [...new Set(years)];
  };

  for (const course of courses) {
    let dept = String(course.department_name || '').trim();
    if (dept && dept !== '-') dept = ` - ${dept}`;
    else dept = '';
    const ft = course.full_part_time === 'Full Time' ? 'FT' : 'PT';
    let yearOfStart = Number(course.year_of_start) || 2000;
    if (yearOfStart < INTERNSHIP_ATT_EOS) yearOfStart = INTERNSHIP_ATT_EOS;

    const regularConfig = academicYearArray['U.G']?.regular || academicYearArray['U.G'];
    const additionalConfig = academicYearArray['U.G']?.additional || '';

    for (const acYear of collectInternshipYears(regularConfig, yearOfStart, true)) {
      pushYear(course, dept, ft, acYear, 'regular', 'Regular');
    }
    for (const acYear of collectInternshipYears(additionalConfig, yearOfStart, true)) {
      pushYear(course, dept, ft, acYear, 'additional', 'Additional');
    }
  }

  return options;
}

const SUBJECT_TIMING_ATT_EOS = 2016;

/** subject_timing.php — grouped Regular/Additional course years per degree. */
export async function buildSubjectTimingCourseOptions() {
  const academicYearArray = await loadAcademicConfig();
  const courses = await prisma.basic_setup_course_tb.findMany({
    where: { del: 1 },
    orderBy: { c_order: 'asc' },
    select: basicSetupCourseSelect,
  });
  const options = [];

  for (const course of courses) {
    let dept = String(course.department_name || '').trim();
    if (dept && dept !== '-') dept = ` - ${dept}`;
    else dept = '';
    const ft = course.full_part_time === 'Full Time' ? 'FT' : 'PT';
    let yearOfStart = Number(course.year_of_start) || 2000;
    if (yearOfStart < SUBJECT_TIMING_ATT_EOS) yearOfStart = SUBJECT_TIMING_ATT_EOS;

    const degreeLabel = `${course.degree_name}${dept}`;
    const courseYears = academicYearArray[course.course_name];
    const regularConfig = courseYears?.regular || courseYears;
    const additionalConfig = courseYears?.additional || '';

    if (regularConfig) {
      const startYear = Number(String(regularConfig).split('-')[0]);
      if (startYear) {
        const group = `${course.course_name} | ${degreeLabel} | ${ft} | Regular`;
        for (let i = startYear; i >= yearOfStart; i -= 1) {
          const acYear = `${i + 1}-${i + 2}`;
          options.push({
            value: courseIdYearKey(course.id, acYear, 'regular'),
            label: `${degreeLabel} | ${acYear}`,
            group,
            courseId: course.id,
            courseName: course.course_name,
            academicYear: acYear,
            academicType: 'regular',
            totalSemester: Number(course.total_semester) || Number(course.course_duration) || 0,
          });
        }
      }
    }

    if (additionalConfig) {
      const startYear = Number(String(additionalConfig).split('-')[0]);
      if (startYear) {
        const group = `${course.course_name} | ${degreeLabel} | ${ft} | Additional`;
        for (let i = startYear; i >= yearOfStart; i -= 1) {
          const acYear = `${i}-${i + 1}`;
          options.push({
            value: courseIdYearKey(course.id, acYear, 'additional'),
            label: `${degreeLabel} | ${acYear}`,
            group,
            courseId: course.id,
            courseName: course.course_name,
            academicYear: acYear,
            academicType: 'additional',
            totalSemester: Number(course.total_semester) || Number(course.course_duration) || 0,
          });
        }
      }
    }
  }

  return options;
}

/** tt_config.php / tt_config_v3.php — historical years with (Regular) and (Additional). */
export async function buildTtConfigCourseYearOptions() {
  const academicYearArray = await loadAcademicConfig();
  const courses = await prisma.basic_setup_course_tb.findMany({
    where: { del: 1 },
    orderBy: { c_order: 'asc' },
    select: basicSetupCourseSelect,
  });
  const options = [];

  for (const course of courses) {
    let dept = String(course.department_name || '').trim();
    if (dept && dept !== '-') dept = ` - ${dept}`;
    else dept = '';
    const ft = course.full_part_time === 'Full Time' ? 'FT' : 'PT';
    const group = `${course.course_name} | ${course.degree_name}${dept} | ${ft}`;

    const courseYears = academicYearArray[course.course_name];
    const regularConfig = courseYears?.regular || courseYears;
    const additionalYear = courseYears?.additional || '';
    const loopStart = Number(String(regularConfig || '').split('-')[0]) || 0;
    const yearOfStart = Number(course.year_of_start) || 2000;
    if (!loopStart) continue;

    const courseOptionStart = options.length;

    for (let i = loopStart; i >= yearOfStart; i -= 1) {
      const acYear = `${i + 1}-${i + 2}`;
      options.push({
        value: courseIdYearKey(course.id, acYear, 'regular'),
        label: `${course.degree_name}${dept} | ${acYear} (Regular)`,
        group,
        courseId: course.id,
        courseName: course.course_name,
        academicYear: acYear,
        academicType: 'regular',
        totalSemester: Number(course.total_semester) || Number(course.course_duration) || 0,
      });

      if (additionalYear) {
        options.push({
          value: courseIdYearKey(course.id, additionalYear, 'additional'),
          label: `${course.degree_name}${dept} | ${additionalYear} (Additional)`,
          group,
          courseId: course.id,
          courseName: course.course_name,
          academicYear: additionalYear,
          academicType: 'additional',
          totalSemester: Number(course.total_semester) || Number(course.course_duration) || 0,
        });
      }
    }

    const calYear = new Date().getFullYear();
    const planningYear = `${calYear}-${calYear + 1}`;
    const planningValue = courseIdYearKey(course.id, planningYear, 'regular');
    if (!options.slice(courseOptionStart).some((o) => o.value === planningValue)) {
      options.splice(courseOptionStart, 0, {
        value: planningValue,
        label: `${course.degree_name}${dept} | ${planningYear} (Regular)`,
        group,
        courseId: course.id,
        courseName: course.course_name,
        academicYear: planningYear,
        academicType: 'regular',
        totalSemester: Number(course.total_semester) || Number(course.course_duration) || 0,
      });
    }
  }

  return options;
}

function formatPeriodTime(val) {
  if (!val || String(val) === '00:00:00') return '00:00';
  const d = new Date(`1970-01-01T${val}`);
  if (Number.isNaN(d.getTime())) return String(val).slice(0, 5);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
}

/** Legacy timetable.php getTimeTable */
export async function getTimeTable(courseName, courseYear, academicType) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const rows = await prisma.$queryRawUnsafe(
    `SELECT period_no, CAST(from_time AS CHAR) AS from_time, CAST(to_time AS CHAR) AS to_time,
            p_days, p_order
     FROM period_set_up
     WHERE del != 0 AND course_name = '${escapeSql(String(courseName))}'
       AND academic_year = '${escapeSql(String(courseYear))}'
       AND academic_type = '${escapeSql(String(academicType))}'
       AND from_time != '00:00:00' AND to_time != '00:00:00'
     ORDER BY p_days ASC, p_order ASC`,
  );

  const tempPeriodArray = {};
  let maxPeriod = 0;
  const breakPeriodCheck = { period: {}, day: {} };

  for (const row of rows) {
    const periodNo = row.period_no;
    const fromTime = formatPeriodTime(row.from_time);
    const toTime = formatPeriodTime(row.to_time);
    const prdDays = String(row.p_days || '').split(',').filter(Boolean);

    for (const pDay of prdDays) {
      if (!tempPeriodArray[pDay]) {
        tempPeriodArray[pDay] = { comp: '', split: {} };
      }
      tempPeriodArray[pDay][row.p_order] = { period: periodNo, ftime: fromTime, ttime: toTime };
      if (maxPeriod < row.p_order) maxPeriod = row.p_order;
      if (String(periodNo).toLowerCase() === 'break') {
        breakPeriodCheck.period[row.p_order] = row.p_order;
        if (!breakPeriodCheck.day[pDay]) breakPeriodCheck.day[pDay] = {};
        breakPeriodCheck.day[pDay][row.p_order] = { time: `${fromTime}${toTime}` };
      }
      tempPeriodArray[pDay].comp += `${row.p_order}-${fromTime}-${toTime}`;
      tempPeriodArray[pDay].split[row.p_order] = `${row.p_order}-${fromTime}-${toTime}`;
    }
  }

  const finalPeriodArray = {};
  let firstDay = '';
  for (const day of days) {
    const dayDetails = tempPeriodArray[day];
    if (!dayDetails || Object.keys(dayDetails).length <= 2) continue;
    if (!firstDay) firstDay = day;
    const sorted = { ...dayDetails };
    const keys = Object.keys(sorted).filter((k) => !['comp', 'split'].includes(k)).map(Number).sort((a, b) => a - b);
    const ordered = { comp: sorted.comp, split: sorted.split };
    for (const k of keys) ordered[k] = sorted[k];
    finalPeriodArray[day] = ordered;
  }

  let tempPrevDay = '';
  for (const day of Object.keys(finalPeriodArray)) {
    finalPeriodArray[day].row = 1;
    if (!tempPrevDay) {
      tempPrevDay = day;
    } else if (finalPeriodArray[day].comp !== finalPeriodArray[tempPrevDay].comp) {
      finalPeriodArray[day].row = 2;
      tempPrevDay = day;
    }
    const dayPeriod = finalPeriodArray[day];
    for (let porder = 1; porder <= maxPeriod; porder += 1) {
      const ptimes = dayPeriod[porder];
      if (!ptimes) continue;
      const cfrom = ptimes.ftime;
      const cto = ptimes.ttime;
      let cord = porder + 1;
      let colspan = 0;
      for (let i = cord; i <= maxPeriod; i += 1) {
        if (dayPeriod[i] && cfrom === dayPeriod[i].ftime && cto === dayPeriod[i].ttime) colspan += 1;
        cord += 1;
      }
      if (colspan > 0) finalPeriodArray[day][porder].col = colspan;
    }
  }

  for (const porder of Object.values(breakPeriodCheck.period)) {
    let samePeriod = 0;
    let pPtime = '';
    let pSday = '';
    for (const day of Object.keys(finalPeriodArray)) {
      const cPtime = breakPeriodCheck.day[day]?.[porder]?.time || '';
      if (!pPtime) {
        pPtime = cPtime;
        samePeriod = finalPeriodArray[day].row;
        pSday = day;
      } else if (pPtime !== cPtime) {
        if (finalPeriodArray[pSday]?.[porder]) finalPeriodArray[pSday][porder].row = samePeriod;
        pPtime = cPtime;
        samePeriod = finalPeriodArray[day].row;
        pSday = day;
      } else {
        samePeriod += finalPeriodArray[day].row;
        if (finalPeriodArray[day]?.[porder]) finalPeriodArray[day][porder].row = -1;
      }
    }
    if (finalPeriodArray[pSday]?.[porder]) finalPeriodArray[pSday][porder].row = samePeriod;
  }

  return { max: maxPeriod, first: firstDay, time: finalPeriodArray };
}

/** When a planning year has no subject setup yet, use the nearest prior year that does. */
export async function resolveSubjectAcademicYear(courseId, academicYear, semester) {
  const course = escapeSql(String(courseId));
  const sem = escapeSql(String(semester));

  async function subjectCount(forYear) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS c FROM basic_setup_subject_tb AS A
       INNER JOIN basic_subject_tt_tb AS B ON A.id = B.rid
       WHERE A.del = 1 AND A.academic_year = '${escapeSql(forYear)}'
         AND A.course_id = '${course}' AND A.semester_no = '${sem}' AND B.del = 1`,
    );
    return Number(rows[0]?.c) || 0;
  }

  if (await subjectCount(academicYear) > 0) return academicYear;

  const startYear = Number(String(academicYear).split('-')[0]) || 0;
  for (let y = startYear - 1; y >= startYear - 10 && y >= 2000; y -= 1) {
    const fallback = `${y}-${y + 1}`;
    if (await subjectCount(fallback) > 0) return fallback;
  }
  return academicYear;
}

export async function loadBatchCount(courseId, academicYear, currentYear, academicType) {
  const row = await prisma.$queryRawUnsafe(
    `SELECT batch_no FROM basic_subject_batch_tb
     WHERE course_id = '${escapeSql(String(courseId))}' AND academic_year = '${escapeSql(academicYear)}'
       AND current_year = '${escapeSql(String(currentYear))}'
       AND LOWER(academic_type) = LOWER('${escapeSql(academicType)}')
       AND del = 1 ORDER BY batch_no+0 DESC LIMIT 1`,
  );
  return Math.max(1, Number(row[0]?.batch_no) || 1);
}

export function batchLetters(count) {
  const labels = {};
  let letter = 'A';
  for (let i = 1; i <= count; i += 1) {
    labels[i] = letter;
    letter = String.fromCharCode(letter.charCodeAt(0) + 1);
  }
  return labels;
}

export async function loadStaffIdMap() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.id, A.staff_id FROM staff_profile_tb AS A
     INNER JOIN staff_designation_tb AS B ON A.id = B.staff_id
     WHERE A.del = 1 AND (A.releaving_date = '0000-00-00' OR A.releaving_date > CURDATE())
       AND B.del = 1 AND B.is_academic = 1 ORDER BY A.staff_id ASC`,
  );
  return Object.fromEntries(rows.map((r) => [String(r.id), r.staff_id]));
}

export async function loadExamSetupReportOptions() {
  const academicYearArray = await loadAcademicConfig();
  const examNameRows = await prisma.cia_exam_name.findMany({
    where: { del: 1 },
    orderBy: { exam_order: 'asc' },
    select: ciaExamNameSelect,
  });
  const examNameMap = Object.fromEntries(
    examNameRows.map((r) => [r.id, `${r.exam_name}${r.exam_month ? ` (${r.exam_month})` : ''}`]),
  );

  const years = [
    academicYearArray['U.G']?.regular,
    academicYearArray['U.G']?.additional,
    academicYearArray['P.G']?.regular,
    ...(academicYearArray.EXAM || []),
  ].filter(Boolean);
  const yearSql = years.length
    ? ` AND (${years.map((y) => `academic_year='${escapeSql(y)}'`).join(' OR ')})`
    : '';

  const courseRows = await prisma.$queryRawUnsafe(
    'SELECT DISTINCT course_name FROM basic_setup_course_tb WHERE del=1 ORDER BY c_order ASC',
  );
  const options = [];

  for (const { course_name: courseName } of courseRows) {
    for (const [atype, alabel] of [['regular', 'Regular'], ['additional', 'Additional']]) {
      if (atype === 'additional' && courseName !== 'U.G') continue;
      const yearRows = await prisma.$queryRawUnsafe(
        `SELECT DISTINCT academic_year FROM cia_setup
         WHERE del=1 AND course_name='${escapeSql(courseName)}' AND academic_type='${escapeSql(atype)}'${yearSql}
         ORDER BY academic_year DESC`,
      );
      for (const { academic_year: acYear } of yearRows) {
        const exams = await prisma.cia_setup.findMany({
          where: { del: 1, course_name: courseName, academic_year: acYear, academic_type: atype },
          orderBy: { id: 'asc' },
          select: ciaSetupSelect,
        });
        if (!exams.length) continue;
        const group = `${courseName} | ${acYear} (${alabel})`;
        for (const exam of exams) {
          options.push({
            value: String(exam.id),
            label: examNameMap[Number(exam.exam_name)] || `Exam ${exam.id}`,
            group,
            examId: exam.id,
            courseName,
            academicYear: acYear,
            academicType: atype,
          });
        }
      }
    }
  }
  return options;
}
