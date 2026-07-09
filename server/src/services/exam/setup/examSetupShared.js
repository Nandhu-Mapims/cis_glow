import { prisma } from '../../../config/prisma.js';
import { basicSetupCourseSelect, ciaExamNameSelect, ciaSetupSelect } from '../../../utils/legacySelects.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { convertNYear } from '../../fees/feeHelpers.js';
import {
  formatDisplayDate,
  loadAcademicConfig,
  loadExamNameOptions,
} from '../../shared/ciaSetupHelpers.js';

export { formatDisplayDate, loadAcademicConfig, loadExamNameOptions };

export function parseCourseSemesterKey(key) {
  const parts = String(key || '').split('___');
  if (parts.length !== 2) return null;
  return { courseId: Number(parts[0]), semester: Number(parts[1]) };
}

export function parseCourseIdYearKey(key) {
  const parts = String(key || '').split('___');
  if (parts.length !== 3) return null;
  return { courseId: Number(parts[0]), academicYear: parts[1], academicType: parts[2] };
}

export function courseSemesterKey(courseId, semester) {
  return `${courseId}___${semester}`;
}

export function courseIdYearKey(courseId, academicYear, academicType) {
  return `${courseId}___${academicYear}___${academicType}`;
}

async function loadExamNameMap() {
  const rows = await prisma.cia_exam_name.findMany({
    where: { del: 1 },
    orderBy: { exam_order: 'asc' },
    select: ciaExamNameSelect,
  });
  const map = {};
  for (const row of rows) {
    map[row.id] = `${row.exam_name}${row.exam_month ? ` (${row.exam_month})` : ''}`;
  }
  return map;
}

function academicYearFilterSql(academicYearArray) {
  const years = [
    academicYearArray['U.G']?.regular,
    academicYearArray['U.G']?.additional,
    academicYearArray['P.G']?.regular,
    ...(academicYearArray.EXAM || []),
  ].filter(Boolean);
  if (!years.length) return '';
  return ` AND (${years.map((y) => `academic_year='${escapeSql(y)}'`).join(' OR ')})`;
}

export async function loadActiveExamOptions(requireExamStatusZero = true) {
  const academicYearArray = await loadAcademicConfig();
  const examNameMap = await loadExamNameMap();
  const courseRows = await prisma.$queryRawUnsafe(
    'SELECT DISTINCT course_name FROM basic_setup_course_tb WHERE del=1 ORDER BY c_order ASC',
  );
  const options = [];
  const statusClause = requireExamStatusZero ? ' AND exam_status=0' : '';

  for (const { course_name: courseName } of courseRows) {
    for (const [atype, alabel] of [['regular', 'Regular'], ['additional', 'Additional']]) {
      if (atype === 'additional' && courseName !== 'U.G') continue;
      const yearRows = await prisma.$queryRawUnsafe(
        `SELECT DISTINCT academic_year FROM cia_setup WHERE del=1 AND course_name='${escapeSql(courseName)}' AND academic_type='${escapeSql(atype)}'${statusClause} ORDER BY academic_year DESC`,
      );
      for (const row of yearRows) {
        const acYear = row.academic_year;
        const inConfig = academicYearArray[courseName]?.[atype] === acYear
          || (academicYearArray.EXAM || []).includes(acYear);
        if (!inConfig) continue;
        const examRows = await prisma.cia_setup.findMany({
          where: {
            del: 1, course_name: courseName, academic_year: acYear, academic_type: atype,
            ...(requireExamStatusZero ? { exam_status: 0 } : {}),
          },
          orderBy: { id: 'asc' },
          select: ciaSetupSelect,
        });
        for (const exam of examRows) {
          options.push({
            value: String(exam.id),
            label: examNameMap[Number(exam.exam_name)] || String(exam.exam_name),
            group: `${courseName} | ${acYear} (${alabel})`,
            examSetupId: exam.id,
            courseName, academicYear: acYear, academicType: atype,
            examInternal: exam.exam_internal === 1,
            examViva: exam.exam_viva === 1,
            examExternal: exam.exam_external === 1,
            markOption: String(exam.mark_option) === '1',
          });
        }
      }
    }
  }
  return options;
}

/** Legacy term_exam_nodue.php — current UG/PG academic year only (no exam_academic_year list). */
export async function loadNodueExamOptions() {
  const academicYearArray = await loadAcademicConfig();
  const examNameMap = await loadExamNameMap();
  const courseRows = await prisma.$queryRawUnsafe(
    'SELECT DISTINCT course_name FROM basic_setup_course_tb WHERE del=1 ORDER BY c_order ASC',
  );
  const options = [];

  for (const { course_name: courseName } of courseRows) {
    for (const [atype, alabel] of [['regular', 'Regular'], ['additional', 'Additional']]) {
      if (atype === 'additional' && courseName !== 'U.G') continue;
      const configYear = academicYearArray[courseName]?.[atype];
      if (!configYear) continue;

      const yearRows = await prisma.$queryRawUnsafe(
        `SELECT DISTINCT academic_year FROM cia_setup
         WHERE del=1 AND course_name='${escapeSql(courseName)}'
           AND LOWER(academic_type)=LOWER('${escapeSql(atype)}')
           AND exam_status=0
         ORDER BY academic_year DESC`,
      );

      for (const row of yearRows) {
        if (row.academic_year !== configYear) continue;

        const examRows = await prisma.$queryRawUnsafe(
          `SELECT id, exam_name, exam_internal, exam_viva, exam_external, mark_option,
                  course_name, academic_year, academic_type
           FROM cia_setup
           WHERE del=1 AND course_name='${escapeSql(courseName)}'
             AND academic_year='${escapeSql(row.academic_year)}'
             AND LOWER(academic_type)=LOWER('${escapeSql(atype)}')
             AND exam_status=0
           ORDER BY id ASC`,
        );

        for (const exam of examRows) {
          options.push({
            value: String(exam.id),
            label: examNameMap[Number(exam.exam_name)] || String(exam.exam_name),
            group: `${courseName} | ${row.academic_year} (${alabel})`,
            examSetupId: exam.id,
            courseName,
            academicYear: row.academic_year,
            academicType: String(exam.academic_type || atype).toLowerCase(),
            examInternal: Number(exam.exam_internal) === 1,
            examViva: Number(exam.exam_viva) === 1,
            examExternal: Number(exam.exam_external) === 1,
            markOption: String(exam.mark_option) === '1',
          });
        }
      }
    }
  }

  return options;
}

export async function loadReportExamOptions() {
  const academicYearArray = await loadAcademicConfig();
  const examNameMap = await loadExamNameMap();
  const yearFilter = academicYearFilterSql(academicYearArray);
  const courseRows = await prisma.$queryRawUnsafe(
    'SELECT DISTINCT course_name FROM basic_setup_course_tb WHERE del=1 ORDER BY c_order ASC',
  );
  const options = [];
  for (const { course_name: courseName } of courseRows) {
    for (const [atype, alabel] of [['regular', 'Regular'], ['additional', 'Additional']]) {
      if (atype === 'additional' && courseName !== 'U.G') continue;
      const yearRows = await prisma.$queryRawUnsafe(
        `SELECT DISTINCT academic_year FROM cia_setup WHERE del=1 AND course_name='${escapeSql(courseName)}' AND academic_type='${escapeSql(atype)}'${yearFilter} ORDER BY academic_year DESC`,
      );
      for (const row of yearRows) {
        const acYear = row.academic_year;
        const examRows = await prisma.cia_setup.findMany({
          where: { del: 1, course_name: courseName, academic_year: acYear, academic_type: atype, exam_status: 0 },
          orderBy: { id: 'asc' },
          select: ciaSetupSelect,
        });
        if (!examRows.length) continue;
        for (const exam of examRows) {
          options.push({
            value: String(exam.id),
            label: examNameMap[Number(exam.exam_name)] || String(exam.exam_name),
            group: `${courseName} | ${acYear} (${alabel})`,
            examSetupId: exam.id,
            courseName, academicYear: acYear, academicType: atype,
            examInternal: exam.exam_internal === 1,
            examViva: exam.exam_viva === 1,
            examExternal: exam.exam_external === 1,
            markOption: String(exam.mark_option) === '1',
          });
        }
      }
    }
  }
  return options;
}

export async function resolveExamContext(examSetupId) {
  const id = Number(examSetupId);
  if (!id) return null;
  const setup = await prisma.cia_setup.findFirst({
    where: { del: 1, id },
    select: ciaSetupSelect,
  });
  if (!setup) return null;
  const examNameMap = await loadExamNameMap();
  return {
    examSetupId: setup.id,
    courseName: setup.course_name,
    academicYear: setup.academic_year,
    academicType: setup.academic_type,
    examNameLabel: examNameMap[Number(setup.exam_name)] || '',
    examInternal: setup.exam_internal === 1,
    examViva: setup.exam_viva === 1,
    examExternal: setup.exam_external === 1,
    markOption: String(setup.mark_option) === '1',
    examTmark: (setup.exam_internal === 1 ? 1 : 0) + (setup.exam_viva === 1 ? 1 : 0) + (setup.exam_external === 1 ? 1 : 0),
  };
}

export async function loadCourseSemesterOptions(courseName, academicYear, academicType) {
  const courses = await prisma.basic_setup_course_tb.findMany({
    where: { del: 1, course_name: courseName },
    orderBy: { course_name: 'asc' },
    select: basicSetupCourseSelect,
  });
  return courses.map((c) => {
    let dept = String(c.department_short_name || '').trim();
    if (dept && dept !== '-') dept = ` - ${dept}`;
    const semesters = [];
    for (let i = 1; i <= (Number(c.total_semester) || 0); i += 1) {
      semesters.push({
        value: courseSemesterKey(c.id, i),
        label: `${i} Year`,
        courseId: c.id,
        semester: i,
        degreeLabel: `${c.degree_name}${dept} | ${academicYear}`,
        courseLabel: `${convertNYear(i, courseName)} - ${c.degree_name}`,
      });
    }
    return { courseId: c.id, degreeLabel: `${c.degree_name}${dept} | ${academicYear}`, semesters };
  });
}

export async function buildCourseIdYearOptions() {
  const academicYearArray = await loadAcademicConfig();
  const courses = await prisma.$queryRawUnsafe(
    `SELECT id, c_order, full_part_time, course_name, degree_name, degree_short_name,
            department_name, department_short_name, year_of_start, course_duration, total_semester
     FROM basic_setup_course_tb
     WHERE del=1
     ORDER BY c_order ASC`,
  );
  const options = [];
  for (const course of courses) {
    let dept = String(course.department_name || '').trim();
    if (dept && dept !== '-') dept = ` - ${dept}`;
    const deptShort = String(course.department_short_name || course.dept_sname || '').trim();
    const ft = course.full_part_time === 'Full Time' ? 'FT' : 'PT';
    const pushYear = (acYear, batch, batchLabel) => {
      if (!acYear) return;
      const startYear = Number(String(acYear).split('-')[0]);
      const yearOfStart = Number(course.year_of_start) || 2000;
      for (let i = startYear; i >= yearOfStart; i -= 1) {
        const yearLabel = `${i}-${i + 1}`;
        if (acYear === yearLabel || academicYearArray.EXAM?.includes(yearLabel)) {
          options.push({
            value: courseIdYearKey(course.id, yearLabel, batch),
            label: `${course.degree_name}${dept} | ${yearLabel} (${batchLabel})`,
            group: `${course.course_name} | ${course.degree_name}${dept} | ${ft} | ${batchLabel}`,
            courseId: Number(course.id),
            courseName: course.course_name,
            academicYear: yearLabel,
            academicType: batch,
            degreeName: course.degree_name || '',
            departmentShortName: deptShort,
            courseDuration: Number(course.course_duration) || Number(course.total_semester) || 0,
            totalSemester: Number(course.total_semester) || Number(course.course_duration) || 0,
          });
        }
      }
    };
    pushYear(academicYearArray[course.course_name]?.regular, 'regular', 'Regular');
    if (course.course_name === 'U.G') {
      pushYear(academicYearArray[course.course_name]?.additional, 'additional', 'Additional');
    }
  }
  return options;
}

export async function loadSubjectCategories() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT id, category_name FROM subject_master WHERE del=1',
  );
  const map = {};
  for (const row of rows) map[row.id] = row.category_name;
  return map;
}

export async function loadScheduledSubjects(ctx, courseId, semester) {
  const categories = await loadSubjectCategories();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT B.subject_id, B.subject_name, B.subject_category,
            A.internal_max, A.viva_max, A.external_max, A.pass_mark, A.id AS schedule_id
     FROM cia_schedule_tb AS A
     INNER JOIN basic_subject_marks_tb AS B ON A.subject_id = B.subject_id
     INNER JOIN basic_setup_subject_tb AS C ON C.id = B.rid
     WHERE A.del=1 AND B.del=1 AND A.academic_year='${escapeSql(ctx.academicYear)}'
       AND A.current_year='${semester}' AND A.academic_type='${escapeSql(ctx.academicType)}'
       AND A.course_id='${courseId}' AND A.exam_name='${ctx.examSetupId}'
       AND C.del=1 AND C.academic_year='${escapeSql(ctx.academicYear)}'
       AND C.course_id='${courseId}' AND C.semester_no='${semester}' AND C.subject_enable=1
     ORDER BY C.subject_order ASC`,
  );
  const result = [];
  const courseIdStr = String(courseId);
  for (const row of rows) {
    const marksRows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS c FROM cia_marks_tb
       WHERE del=1 AND exam_name='${escapeSql(String(ctx.examSetupId))}'
         AND course_id='${escapeSql(courseIdStr)}'
         AND academic_year='${escapeSql(ctx.academicYear)}'
         AND current_year='${escapeSql(String(semester))}'
         AND academic_type='${escapeSql(ctx.academicType)}'
         AND subject_id='${escapeSql(String(row.subject_id))}'`,
    );
    const marksCount = Number(marksRows[0]?.c) || 0;
    result.push({
      subjectId: row.subject_id,
      subjectName: row.subject_name,
      categoryName: categories[Number(row.subject_category)] || '',
      internalMax: Number(row.internal_max) || 0,
      vivaMax: Number(row.viva_max) || 0,
      externalMax: Number(row.external_max) || 0,
      passMark: Number(row.pass_mark) || 0,
      scheduleId: row.schedule_id,
      hasMarks: marksCount > 0,
    });
  }
  return result;
}

function parseRollNumbers(rows) {
  const rolls = new Set();
  for (const row of rows) {
    String(row.roll_no || '').split(',').forEach((r) => {
      const t = r.trim();
      if (t) rolls.add(t);
    });
  }
  return [...rolls];
}

async function loadRollNumbersFromBatchTable(table, {
  examSetupId, courseId, academicYear, semester, academicType,
}) {
  const examFilter = examSetupId != null && examSetupId !== ''
    ? `AND exam_name='${escapeSql(String(examSetupId))}'`
    : '';
  const rows = await prisma.$queryRawUnsafe(
    `SELECT roll_no FROM ${table}
     WHERE del=1 AND course_id='${Number(courseId)}'
       AND academic_year='${escapeSql(academicYear)}'
       AND current_year='${escapeSql(String(semester))}'
       AND academic_type='${escapeSql(academicType)}'
       ${examFilter}`,
  );
  return parseRollNumbers(rows);
}

export async function loadBatchRollNumbers(courseId, academicYear, semester, academicType) {
  return loadRollNumbersFromBatchTable('cia_batch_tb', {
    courseId, academicYear, semester, academicType,
  });
}

export async function loadExamBatchRollNumbers(examSetupId, courseId, academicYear, semester, academicType) {
  const ctx = {
    examSetupId, courseId, academicYear, semester, academicType,
  };
  const examRolls = await loadRollNumbersFromBatchTable('cia_batch_new', ctx);
  if (examRolls.length) return examRolls;
  return loadRollNumbersFromBatchTable('cia_batch_tb', {
    courseId, academicYear, semester, academicType,
  });
}

export async function loadStudentsByRollNumbers(rollNumbers) {
  if (!rollNumbers.length) return [];
  const filter = rollNumbers.map((r) => `register_no='${escapeSql(r)}'`).join(' OR ');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT uregister_no, register_no, student_name, student_initial FROM student_profile_tb
     WHERE del=1 AND (${filter}) ORDER BY student_name ASC, student_initial ASC`,
  );
  return rows.map((row) => ({
    uregisterNo: row.uregister_no || row.register_no,
    registerNo: row.register_no,
    name: `${row.student_name || ''} ${row.student_initial || ''}`.trim(),
  }));
}

export async function loadActiveStudentsForBatch(courseId, academicYear, semester, academicType) {
  const currentDate = new Date().toISOString().slice(0, 10);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.register_no, A.student_name, A.student_initial, A.uregister_no
     FROM student_profile_tb AS A INNER JOIN student_academic_tb AS B ON A.id=B.s_id
     WHERE A.del=1 AND B.del=1 AND A.course_id='${escapeSql(String(courseId))}'
       AND (A.releaving_date='0000-00-00' OR A.releaving_date>'${currentDate}')
       AND B.course_id='${escapeSql(String(courseId))}' AND B.academic_year='${escapeSql(academicYear)}'
       AND B.current_year='${escapeSql(String(semester))}' AND LOWER(B.academic_batch)=LOWER('${escapeSql(academicType)}')
     ORDER BY A.student_name ASC, A.student_initial ASC`,
  );
  return rows.map((row, index) => ({
    index,
    registerNo: row.register_no,
    uregisterNo: row.uregister_no || row.register_no,
    name: `${row.student_name || ''} ${row.student_initial || ''}`.trim(),
  }));
}

export async function loadBatchAssignments(courseId, academicYear, semester, academicType, totalBatch) {
  const map = {};
  for (let i = 1; i <= totalBatch; i += 1) map[i] = [];
  const rows = await prisma.$queryRawUnsafe(
    `SELECT batch_no, roll_no FROM cia_batch_tb
     WHERE del=1 AND course_id='${escapeSql(String(courseId))}'
       AND academic_year='${escapeSql(academicYear)}'
       AND current_year='${escapeSql(String(semester))}'
       AND LOWER(academic_type)=LOWER('${escapeSql(academicType)}')`,
  );
  for (const row of rows) {
    const batchNo = Number(row.batch_no);
    if (!batchNo) continue;
    String(row.roll_no || '').split(',').forEach((r) => {
      const t = r.trim();
      if (t && map[batchNo]) map[batchNo].push(t);
    });
  }
  return map;
}

export async function getMaxBatchCount(courseId, academicYear, semester, academicType) {
  const row = await prisma.$queryRawUnsafe(
    `SELECT batch_no FROM cia_batch_tb WHERE del=1 AND course_id='${escapeSql(String(courseId))}'
     AND academic_year='${escapeSql(academicYear)}' AND current_year='${escapeSql(String(semester))}'
     AND LOWER(academic_type)=LOWER('${escapeSql(academicType)}') ORDER BY batch_no+0 DESC LIMIT 1`,
  );
  return Math.max(1, Number(row[0]?.batch_no) || 1);
}

export function batchLetters(count) {
  const labels = {};
  let letter = 'A';
  for (let i = 1; i <= count; i += 1) { labels[i] = letter; letter = String.fromCharCode(letter.charCodeAt(0) + 1); }
  return labels;
}

export async function loadInvigilatorOptions() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id, staff_name, staff_initial, staff_title FROM staff_profile_tb
     WHERE del=1 AND job_category=255 AND (releaving_date='0000-00-00' OR releaving_date > DATE(NOW()))
     ORDER BY staff_name ASC, staff_initial ASC`,
  );
  return rows.map((row) => ({
    value: String(row.id),
    label: `${row.staff_id} | ${[row.staff_title, row.staff_name, row.staff_initial].filter(Boolean).join(' ').trim()}`,
  }));
}

export function buildPrintHeader(title, subtitle) {
  return `<div class="text-center mb-3"><h4 class="mb-1">${title}</h4>${subtitle ? `<p class="mb-0">${subtitle}</p>` : ''}</div>`;
}
