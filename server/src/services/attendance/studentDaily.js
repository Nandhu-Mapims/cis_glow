import { prisma } from '../../config/prisma.js';
import { escapeSql, sqlDateOrNull } from '../../utils/sqlSafe.js';
import { auditFields } from '../fees/setup/setupAudit.js';

const YEAR_LABELS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const HOLIDAY_PREFIXES = [
  'Holiday-Weekly',
  'Holiday-Public',
  'Holiday-Local',
  'Holiday-Govt',
  'Holiday-Mgmt',
  'Holiday-Exam',
  'Holiday-Study',
];

function parseAttCourse(attCourse) {
  const [courseName, academicBatch] = String(attCourse || 'U.G___regular').split('___');
  return {
    courseName: courseName || 'U.G',
    academicBatch: academicBatch || 'regular',
  };
}

function normalizeRollList(value) {
  return String(value || '')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => r.replace(/^0+/, '') || '0');
}

function formatIsoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function loadAcademicYears() {
  const setup = await prisma.basic_setup_tb.findFirst({ where: { del: 1 } });
  return {
    'U.G': {
      regular: setup?.ug_academic_year || '',
      additional: setup?.uga_academic_year || '',
    },
    'P.G': {
      regular: setup?.pg_academic_year || '',
    },
  };
}

async function loadHolidayDates() {
  const currentDate = formatIsoDate(new Date());
  const fromDate = formatIsoDate(new Date(Date.now() - 9 * 30 * 24 * 60 * 60 * 1000));
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT academic_date FROM academic_calender_tb
     WHERE del = 1 AND academic_events LIKE 'Holiday%'
       AND academic_date >= '${escapeSql(fromDate)}' AND academic_date <= '${escapeSql(currentDate)}'
     ORDER BY academic_date ASC`,
  );
  return rows.map((r) => {
    const d = new Date(r.academic_date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  });
}

async function getPeriodsForDay(courseName, currentYear, academicBatch, attendanceDate) {
  if (courseName === 'P.G') {
    return [{ period: '1', periodLabel: 'In' }, { period: '2', periodLabel: 'Out' }];
  }

  const periodDay = new Date(attendanceDate).toLocaleDateString('en-US', { weekday: 'long' });
  const dayFilter = ` AND (p_days='${escapeSql(periodDay)}' OR p_days LIKE '${escapeSql(periodDay)},%' OR p_days LIKE '%,${escapeSql(periodDay)}' OR p_days LIKE '%,${escapeSql(periodDay)},%')`;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT period_no, p_combined FROM period_set_up
     WHERE del != 0 AND course_name='${escapeSql(courseName)}'
       AND academic_year='${escapeSql(currentYear)}' AND academic_type='${escapeSql(academicBatch)}'
       AND period_no != 'Break' AND from_time != '00:00:00' AND to_time != '00:00:00' ${dayFilter}
     ORDER BY period_no+0 ASC, period_no ASC`,
  );

  const periodArray = [];
  let previousPeriod = '';
  for (const row of rows) {
    const period = String(row.period_no);
    const pCombined = Number(row.p_combined);
    if (pCombined === 1 && previousPeriod && period !== previousPeriod) {
      periodArray[periodArray.length - 1].periodLabel = `${previousPeriod} & ${period}`;
      periodArray[periodArray.length - 1].period = previousPeriod;
    } else {
      periodArray.push({ period, periodLabel: period });
      previousPeriod = period;
    }
  }
  return periodArray;
}

export async function loadStudentDailyAttendance(payload) {
  const attendanceDate = String(payload.attendanceDate || '').trim();
  if (!attendanceDate) {
    return { error: 'attendanceDate is required' };
  }

  const today = formatIsoDate(new Date());
  if (attendanceDate > today) {
    return { error: 'Selected date is greater than current date', holidays: await loadHolidayDates() };
  }

  const { courseName, academicBatch } = parseAttCourse(payload.attCourse);
  const academicYears = await loadAcademicYears();
  const academicYearRef = academicYears[courseName]?.[academicBatch];
  if (!academicYearRef) {
    return { error: 'Invalid course selection', holidays: await loadHolidayDates() };
  }

  const calRows = await prisma.$queryRawUnsafe(
    `SELECT academic_events, comments FROM academic_calender_tb
     WHERE academic_date='${sqlDateOrNull(attendanceDate)}' AND del = 1 LIMIT 1`,
  );
  if (!calRows.length) {
    return { error: 'Selected date is not added in academic calendar', holidays: await loadHolidayDates() };
  }

  const academicEvent = String(calRows[0].academic_events || '');
  if (HOLIDAY_PREFIXES.includes(academicEvent)) {
    const comments = String(calRows[0].comments || '').trim();
    return {
      error: `Selected date is ${academicEvent}${comments ? ` - ${comments}` : ''}`,
      holidays: await loadHolidayDates(),
    };
  }

  const courses = await prisma.$queryRawUnsafe(
    `SELECT id, course_name, degree_name, department_name, course_duration
     FROM basic_setup_course_tb WHERE del = 1 AND course_name='${escapeSql(courseName)}' ORDER BY c_order ASC`,
  );

  const entries = [];
  const sections = [];
  const d = sqlDateOrNull(attendanceDate);

  for (const course of courses) {
    const cId = Number(course.id);
    const degreeName = String(course.degree_name || '').replace(/\\/g, '');
    let departmentName = String(course.department_name || '').replace(/\\/g, '');
    if (departmentName && departmentName !== '-') {
      departmentName = ` - ${departmentName}`;
    } else {
      departmentName = '';
    }

    const courseDuration = String(course.course_duration || '').replace(/\\/g, '');
    let excludeYear = '';
    if (courseName === 'U.G' && courseDuration) {
      excludeYear = ` AND B.current_year != '${escapeSql(courseDuration)}'`;
    }

    const yearRows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(A.id) AS cnt, GROUP_CONCAT(A.register_no SEPARATOR ',') AS reg_list, B.current_year
       FROM student_profile_tb AS A
       INNER JOIN student_academic_tb AS B ON A.id = B.s_id
       WHERE A.del = 1 AND A.course_id = '${cId}'
         AND (A.releaving_date = '0000-00-00' OR A.releaving_date > '${d}')
         AND B.del = 1 AND B.academic_year='${escapeSql(academicYearRef)}'
         AND B.academic_batch='${escapeSql(academicBatch)}' ${excludeYear}
       GROUP BY B.current_year ORDER BY B.current_year ASC`,
    );

    for (const yearRow of yearRows) {
      const studentRegList = String(yearRow.reg_list || '');
      if (!studentRegList) continue;

      const acYear = String(yearRow.current_year);
      const yearCount = Number(acYear) - 1;
      const yearLabel = YEAR_LABELS[yearCount] || acYear;
      const periods = await getPeriodsForDay(courseName, acYear, academicBatch, attendanceDate);
      const prdStr = courseName === 'P.G' ? '' : 'Period - ';

      const sectionEntry = {
        courseId: cId,
        degreeName,
        departmentName,
        currentYear: acYear,
        yearLabel,
        courseName,
      };
      sections.push(sectionEntry);

      for (const { period, periodLabel } of periods) {
        const attRows = await prisma.$queryRawUnsafe(
          `SELECT att_present FROM student_att_tb
           WHERE del = 1 AND academic_date='${d}'
             AND academic_year='${escapeSql(academicYearRef)}' AND academic_type='${escapeSql(academicBatch)}'
             AND course_id='${cId}' AND current_year='${escapeSql(acYear)}' AND att_period='${escapeSql(period)}'
           LIMIT 1`,
        );
        const presentList = attRows[0]?.att_present ? String(attRows[0].att_present) : '';
        entries.push({
          courseId: String(cId),
          courseType: courseName,
          academicYear: academicYearRef,
          academicType: academicBatch,
          currentYear: acYear,
          period,
          periodLabel: `${prdStr}${periodLabel}`,
          presentList,
          studentList: studentRegList,
          hasExistingRecord: attRows.length > 0,
          degreeName,
          departmentName,
          yearLabel,
        });
      }
    }
  }

  if (!entries.length) {
    return { message: 'No attendance sheet for this date', entries: [], sections: [], holidays: await loadHolidayDates() };
  }

  return { entries, sections, holidays: await loadHolidayDates() };
}

export async function saveStudentDailyAttendance(payload, memberId, meta) {
  const attendanceDate = String(payload.attendanceDate || '').trim();
  const entries = payload.entries;

  if (!attendanceDate || !Array.isArray(entries) || !entries.length) {
    return { success: false, error: 'attendanceDate and entries are required' };
  }

  const d = sqlDateOrNull(attendanceDate);
  const { create, update } = auditFields(memberId, meta);
  const coursePairs = new Set();
  const courseConditions = [];

  for (const entry of entries) {
    const courseId = String(entry.courseId ?? '').trim();
    const academicType = String(entry.academicType ?? '').trim();
    // course_id is an INT column; skip malformed rows so the reset UPDATE
    // can't crash with "Truncated incorrect DECIMAL value".
    if (!/^\d+$/.test(courseId) || !academicType) continue;
    const key = `${courseId}__${academicType}`;
    if (!coursePairs.has(key)) {
      coursePairs.add(key);
      courseConditions.push(
        `(course_id='${escapeSql(courseId)}' AND academic_type='${escapeSql(academicType)}')`,
      );
    }
  }

  const nowStr = create.created_dt.toISOString().slice(0, 19).replace('T', ' ');

  if (courseConditions.length) {
    await prisma.$executeRawUnsafe(
      `UPDATE student_att_tb SET del=0,
         updated_dt='${escapeSql(nowStr)}',
         updated_ip='${escapeSql(update.updated_ip)}',
         updated_by='${escapeSql(String(memberId))}'
       WHERE del=1 AND academic_date='${d}' AND (${courseConditions.join(' OR ')})`,
    );
  }

  let saved = false;
  let validEntries = 0;
  for (const entry of entries) {
    const {
      courseId, courseType, currentYear, academicYear, academicType, period, presentList, studentList,
    } = entry;
    if (!courseId || !currentYear || !academicYear || !period || !academicType) continue;
    validEntries += 1;

    const refSno = normalizeRollList(studentList).map((r) => r.toUpperCase());
    const absentList = normalizeRollList(presentList)
      .map((r) => r.toUpperCase())
      .filter((r) => refSno.includes(r))
      .join(',');

    const checkRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM student_att_tb
       WHERE del=0 AND academic_date='${d}'
         AND academic_year='${escapeSql(String(academicYear))}' AND academic_type='${escapeSql(String(academicType))}'
         AND course_id='${escapeSql(String(courseId))}' AND current_year='${escapeSql(String(currentYear))}'
         AND att_period='${escapeSql(String(period))}'
       ORDER BY id DESC LIMIT 1`,
    );
    const attId = checkRows[0]?.id;

    if (!attId && !absentList) continue;

    if (attId) {
      await prisma.$executeRawUnsafe(
        `UPDATE student_att_tb SET att_present='${escapeSql(absentList)}', del=1,
           updated_dt='${escapeSql(nowStr)}', updated_ip='${escapeSql(update.updated_ip)}',
           updated_by='${escapeSql(String(memberId))}'
         WHERE id='${Number(attId)}'`,
      );
      saved = true;
    } else if (absentList) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO student_att_tb(
           course_type, academic_date, academic_year, academic_type, current_year, odd_even_sem,
           course_id, att_period, day_order, subject_id, att_present, att_absent, att_leave, att_late,
           created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by
         ) VALUES (
           '${escapeSql(String(courseType || 'U.G'))}', '${d}',
           '${escapeSql(String(academicYear))}', '${escapeSql(String(academicType))}',
           '${escapeSql(String(currentYear))}', 0,
           '${escapeSql(String(courseId))}', '${escapeSql(String(period))}',
           '', '', '${escapeSql(absentList)}', '', '', '',
           '${escapeSql(nowStr)}', '${escapeSql(create.created_ip)}', '${escapeSql(String(memberId))}',
           '${escapeSql(nowStr)}', '${escapeSql(create.updated_ip)}', '${escapeSql(String(memberId))}'
         )`,
      );
      saved = true;
    }
  }

  // Legacy marks the submission successful whenever the sheet had valid rows,
  // even if no absentees were recorded (all present) — mirror that leniency.
  if (!saved && validEntries > 0) saved = true;

  if (!validEntries) {
    return { success: false, error: 'No valid attendance rows to save. Reload the sheet and try again.' };
  }

  return {
    success: saved,
    message: 'Attendance updated',
  };
}
