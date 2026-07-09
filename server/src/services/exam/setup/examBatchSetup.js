import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { convertNYear } from '../../fees/feeHelpers.js';
import {
  buildCourseYearOptions,
  loadAcademicConfig,
  parseCourseYearKey,
} from '../../shared/ciaSetupHelpers.js';
import { auditFields, logExamSetup } from './setupAudit.js';
import {
  batchLetters,
  buildPrintHeader,
  getMaxBatchCount,
  loadActiveStudentsForBatch,
  loadBatchAssignments,
} from './examSetupShared.js';

const PAGE = 'exam_batch.php';

function parseCourseProgramKey(key) {
  const parts = String(key || '').split('___');
  if (parts.length !== 2) return null;
  const courseId = Number(parts[0]);
  const semester = Number(parts[1]);
  if (!courseId || !semester) return null;
  return { courseId, semester };
}

function courseProgramKey(courseId, semester) {
  return `${courseId}___${semester}`;
}

async function loadCoursePrograms(courseName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, degree_name, department_short_name, course_duration, total_semester, course_name
     FROM basic_setup_course_tb
     WHERE del=1 AND course_name='${escapeSql(courseName)}'
     ORDER BY c_order ASC`,
  );
  return rows.map((row) => ({
    courseId: Number(row.id),
    degreeName: row.degree_name || '',
    departmentShortName: row.department_short_name || '',
    courseDuration: Number(row.course_duration) || Number(row.total_semester) || 0,
    courseName: row.course_name || '',
  }));
}

function buildBatchPrintHtml(selection, semester, totalBatch, students, assignments, letters) {
  const batches = [];
  for (let t = 1; t <= totalBatch; t += 1) {
    const rolls = new Set(assignments[t] || []);
    const batchStudents = students.filter((s) => rolls.has(s.registerNo));
    batches.push({ label: letters[t], students: batchStudents });
  }
  let html = buildPrintHeader(
    `${convertNYear(semester, selection.courseName)} year Exam Batch List`,
    `Academic Year: ${selection.academicYear}`,
  );
  html += '<div class="row">';
  for (const batch of batches) {
    html += `<div style="float:left;margin:15px;width:22%;"><table class="table table-bordered w-100">
      <tr><td colspan="4" class="text-center fw-bold">Batch ${batch.label}</td></tr>
      <tr class="table-secondary"><th>#</th><th>Reg. No.</th><th>Roll.No.</th><th>Name</th></tr>`;
    batch.students.forEach((stu, i) => {
      html += `<tr><td class="text-center">${i + 1}</td><td class="text-center">${stu.uregisterNo}</td><td class="text-center">${stu.registerNo}</td><td>${stu.name}</td></tr>`;
    });
    html += '</table></div>';
  }
  html += `</div><p class="mt-3"><strong>Total Student : ${students.length}</strong></p>`;
  return html;
}

export async function loadExamBatch(memberId, fields = {}, audit = {}) {
  const academicYearArray = await loadAcademicConfig();
  const courseYearOptions = await buildCourseYearOptions(academicYearArray);
  const courseYearKey = String(fields.course_name || '').trim();
  const yearSelection = parseCourseYearKey(courseYearKey);
  const courseProgramKeyValue = String(fields.course_program || '').trim();
  const programSelection = parseCourseProgramKey(courseProgramKeyValue);

  let coursePrograms = [];
  let selection = null;
  let semester = 0;

  if (yearSelection) {
    coursePrograms = await loadCoursePrograms(yearSelection.courseName);
    if (programSelection) {
      const program = coursePrograms.find((p) => p.courseId === programSelection.courseId);
      semester = programSelection.semester;
      selection = {
        courseId: programSelection.courseId,
        courseName: yearSelection.courseName,
        academicYear: yearSelection.academicYear,
        academicType: yearSelection.academicType,
        courseDuration: program?.courseDuration || 0,
        degreeName: program?.degreeName || '',
        departmentShortName: program?.departmentShortName || '',
      };
    }
  }

  let totalBatch = Number(fields.total_batch) || 0;
  let students = [];
  let assignments = {};
  let letters = {};
  let printHtml = '';

  if (selection && semester) {
    if (!totalBatch) {
      totalBatch = await getMaxBatchCount(
        selection.courseId, selection.academicYear, semester, selection.academicType,
      );
    }
    students = await loadActiveStudentsForBatch(
      selection.courseId, selection.academicYear, semester, selection.academicType,
    );
    assignments = await loadBatchAssignments(
      selection.courseId, selection.academicYear, semester, selection.academicType, totalBatch,
    );
    letters = batchLetters(totalBatch);
    if (fields.action === 'go' || fields.Save === 'Go') {
      printHtml = buildBatchPrintHtml(selection, semester, totalBatch, students, assignments, letters);
    }
  }

  await logExamSetup(PAGE, 'View', 'Successful', courseYearKey, memberId, audit);
  return {
    courseYearOptions,
    courseYearKey,
    courseProgramKey: courseProgramKeyValue,
    yearSelection,
    coursePrograms: coursePrograms.map((program) => ({
      ...program,
      academicYear: yearSelection?.academicYear || '',
    })),
    selection,
    semester,
    totalBatch: totalBatch || '',
    students,
    assignments,
    batchLetters: letters,
    printHtml,
  };
}

export async function saveExamBatch(payload, memberId, audit = {}) {
  const yearSelection = parseCourseYearKey(payload.courseYearKey);
  const programSelection = parseCourseProgramKey(payload.courseProgramKey);
  const semester = programSelection?.semester || Number(payload.semester);
  const totalBatch = Number(payload.totalBatch);
  if (!yearSelection || !programSelection || !semester || !totalBatch) {
    return { success: false, message: 'Course, year and batch count are required' };
  }

  const selection = {
    courseId: programSelection.courseId,
    academicYear: yearSelection.academicYear,
    academicType: yearSelection.academicType,
  };

  const { update, create } = auditFields(memberId, audit);
  const courseId = String(selection.courseId);
  await prisma.$executeRawUnsafe(
    `UPDATE cia_batch_tb SET del=0,
      updated_by='${escapeSql(update.updated_by || memberId)}',
      updated_ip='${escapeSql(update.updated_ip || '')}',
      updated_dt=NOW()
     WHERE del=1 AND course_id='${escapeSql(courseId)}'
       AND academic_year='${escapeSql(selection.academicYear)}'
       AND current_year='${escapeSql(String(semester))}'
       AND LOWER(academic_type)=LOWER('${escapeSql(selection.academicType)}')`,
  );

  const rollAssignments = payload.assignments || {};
  for (let i = 1; i <= totalBatch; i += 1) {
    const rolls = (rollAssignments[i] || []).filter(Boolean);
    const rollList = rolls.join(',');
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM cia_batch_tb WHERE del=0 AND course_id='${escapeSql(courseId)}'
       AND academic_year='${escapeSql(selection.academicYear)}' AND current_year='${escapeSql(String(semester))}'
       AND LOWER(academic_type)=LOWER('${escapeSql(selection.academicType)}') AND batch_no='${i}'
       AND updated_by='${escapeSql(memberId)}' ORDER BY id DESC LIMIT 1`,
    );
    const batchId = existing[0]?.id;
    if (!batchId && rollList) {
      await prisma.cia_batch_tb.create({
        data: {
          exam_name: '',
          course_id: courseId,
          academic_year: selection.academicYear,
          current_year: String(semester),
          academic_type: selection.academicType,
          rid: 0,
          batch_no: String(i),
          roll_no: rollList,
          ...create,
        },
      });
    } else if (batchId) {
      await prisma.cia_batch_tb.update({
        where: { id: Number(batchId) },
        data: {
          course_id: courseId,
          academic_year: selection.academicYear,
          current_year: String(semester),
          academic_type: selection.academicType,
          batch_no: String(i),
          roll_no: rollList,
          del: 1,
          ...update,
        },
      });
    }
  }

  await logExamSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are added...',
    ...(await loadExamBatch(memberId, {
      course_name: payload.courseYearKey,
      course_program: payload.courseProgramKey,
      semester_name: semester,
      total_batch: totalBatch,
      action: 'go',
    }, { ...audit, skipLog: true })),
  };
}

export { courseProgramKey, parseCourseProgramKey };
