import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { convertNYear } from '../../fees/feeHelpers.js';
import { logExamSetup } from '../setup/setupAudit.js';
import {
  basicSetupCourseSelect,
  ciaExamNameSelect,
  ciaSetupSelect,
} from '../../../utils/legacySelects.js';
import {
  buildPrintHeader,
  loadAcademicConfig,
  loadBatchRollNumbers,
  loadCourseSemesterOptions,
  loadStudentsByRollNumbers,
  parseCourseSemesterKey,
  resolveExamContext,
} from '../setup/examSetupShared.js';

const PAGE = 'term_attendance_report.php';

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

async function loadAttendanceReportExamOptions() {
  const academicYearArray = await loadAcademicConfig();
  const examNameMap = await loadExamNameMap();
  const courseRows = await prisma.$queryRawUnsafe(
    'SELECT DISTINCT course_name FROM basic_setup_course_tb WHERE del=1 ORDER BY c_order ASC',
  );
  const options = [];

  for (const { course_name: courseName } of courseRows) {
    for (const [atype, alabel] of [['regular', 'Regular'], ['additional', 'Additional']]) {
      if (atype === 'additional' && courseName !== 'U.G') continue;
      const acYear = academicYearArray[courseName]?.[atype];
      if (!acYear) continue;

      const examRows = await prisma.cia_setup.findMany({
        where: {
          del: 1,
          course_name: courseName,
          academic_year: acYear,
          academic_type: atype,
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
          courseName,
          academicYear: acYear,
          academicType: atype,
        });
      }
    }
  }
  return options;
}

async function loadReportSubjects(ctx, courseId, semester) {
  const categories = await prisma.$queryRawUnsafe(
    'SELECT id, category_name FROM subject_master WHERE del=1',
  );
  const catMap = {};
  for (const row of categories) catMap[row.id] = row.category_name;

  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT B.subject_id, B.subject_name, B.subject_category, B.short_subject_name
     FROM cia_schedule_tb AS A
     INNER JOIN basic_subject_marks_tb AS B ON A.subject_id = B.subject_id
     INNER JOIN basic_setup_subject_tb AS C ON C.id = B.rid
     WHERE A.del=1 AND B.del=1 AND A.academic_year='${escapeSql(ctx.academicYear)}'
       AND A.current_year='${semester}' AND A.academic_type='${escapeSql(ctx.academicType)}'
       AND A.course_id='${courseId}' AND A.exam_name='${ctx.examSetupId}'
       AND C.del=1 AND C.academic_year='${escapeSql(ctx.academicYear)}'
       AND C.course_id='${courseId}' AND C.semester_no='${semester}' AND C.subject_enable=1
     ORDER BY C.subject_order ASC, B.subject_id ASC`,
  );

  return rows.map((row) => {
    const cat = catMap[Number(row.subject_category)] || '';
    const shortName = String(row.short_subject_name || row.subject_name || row.subject_id);
    return {
      subjectId: String(row.subject_id),
      subjectName: String(row.subject_name || row.subject_id),
      shortName,
      categoryName: cat,
      categoryShort: cat.slice(0, 3),
    };
  });
}

async function buildCourseLabel(courseId, semester, courseName) {
  const course = await prisma.basic_setup_course_tb.findFirst({
    where: { del: 1, id: courseId },
    select: basicSetupCourseSelect,
  });
  if (!course) return '';
  return `${convertNYear(semester, courseName)} - ${course.degree_name}`;
}

function buildAttendanceReportHtml(ctx, courseSel, subjects, students, courseLabel) {
  let headerCells = '';
  for (const sub of subjects) {
    headerCells += `<th><small>${sub.shortName}<br>(${sub.categoryShort})</small></th>`;
  }

  let body = '';
  students.forEach((stu, idx) => {
    let cells = '';
    for (const sub of stu.subjects) {
      cells += `<td align="right">${sub.attPer ?? ''}</td>`;
    }
    body += `<tr><td>${idx + 1}</td><td>${stu.registerNo}</td><td nowrap>${stu.name}</td>${cells}</tr>`;
  });

  const table = `<table class="table table-bordered table-sm"><thead class="table-secondary">
    <tr><th>#</th><th>Roll.No</th><th>Name</th>${headerCells}</tr>
    </thead><tbody>${body}</tbody></table>`;

  return `${buildPrintHeader('Term Attendance', `${ctx.examNameLabel}<br>${courseLabel}`)}${table}`;
}

export async function loadAttendanceReport(memberId, fields = {}, audit = {}) {
  const examOptions = await loadAttendanceReportExamOptions();
  const examId = String(fields.exam_name || '').trim();
  const ctx = examId ? await resolveExamContext(examId) : null;
  const courseGroups = ctx
    ? await loadCourseSemesterOptions(ctx.courseName, ctx.academicYear, ctx.academicType)
    : [];
  const courseKey = String(fields.course_name || '').trim();
  const courseSel = parseCourseSemesterKey(courseKey);

  let subjects = [];
  let students = [];
  let reportHtml = '';
  let courseLabel = '';

  if (ctx && courseSel) {
    subjects = await loadReportSubjects(ctx, courseSel.courseId, courseSel.semester);
    courseLabel = await buildCourseLabel(courseSel.courseId, courseSel.semester, ctx.courseName);
    const rolls = await loadBatchRollNumbers(
      courseSel.courseId,
      ctx.academicYear,
      courseSel.semester,
      ctx.academicType,
    );
    const studentList = await loadStudentsByRollNumbers(rolls);

    let attRows = [];
    if (subjects.length && studentList.length) {
      const regFilter = studentList.map((s) => `'${escapeSql(s.registerNo)}'`).join(',');
      attRows = await prisma.$queryRawUnsafe(
        `SELECT register_no, subject_id, att_per
         FROM cia_att_tb
         WHERE del=1 AND exam_name='${escapeSql(String(ctx.examSetupId))}'
           AND course_id='${courseSel.courseId}'
           AND academic_year='${escapeSql(ctx.academicYear)}'
           AND current_year='${courseSel.semester}'
           AND academic_type='${escapeSql(ctx.academicType)}'
           AND register_no IN (${regFilter})`,
      );
    }

    const attMap = {};
    for (const row of attRows) {
      attMap[`${row.register_no}::${row.subject_id}`] = row.att_per ?? '';
    }

    students = studentList.map((stu) => ({
      registerNo: stu.registerNo,
      name: stu.name,
      subjects: subjects.map((sub) => ({
        subjectId: sub.subjectId,
        attPer: attMap[`${stu.registerNo}::${sub.subjectId}`] ?? '',
      })),
    }));

    reportHtml = buildAttendanceReportHtml(ctx, courseSel, subjects, students, courseLabel);
  }

  await logExamSetup(PAGE, 'View', 'Successful', examId, memberId, audit);
  return {
    examOptions,
    examId,
    ctx,
    courseGroups,
    courseKey,
    courseSel,
    courseLabel,
    subjects,
    students,
    reportHtml,
  };
}

export async function saveAttendanceReport() {
  return { success: false, message: 'Report is view only' };
}
