import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logExamSetup } from './setupAudit.js';
import {
  loadCourseSemesterOptions,
  loadExamBatchRollNumbers,
  loadNodueExamOptions,
  loadStudentsByRollNumbers,
  parseCourseSemesterKey,
  resolveExamContext,
} from './examSetupShared.js';

const PAGE = 'term_exam_nodue.php';

async function loadNoDueOptions() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, category_name
     FROM master_setup
     WHERE del=1 AND category='No-due'
     ORDER BY category_order ASC`,
  );
  return rows.map((row) => ({
    value: String(row.id),
    label: String(row.category_name || '').trim(),
  }));
}

async function loadNodueSubjects(ctx, courseId, semester) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT C.subject_id, C.subject_name, B.subject_category
     FROM cia_schedule_tb AS A
     INNER JOIN basic_subject_marks_tb AS B ON A.subject_id = B.subject_id
     INNER JOIN basic_setup_subject_tb AS C ON C.id = B.rid
     WHERE A.del=1 AND B.del=1 AND A.academic_year='${escapeSql(ctx.academicYear)}'
       AND A.current_year='${semester}' AND A.academic_type='${escapeSql(ctx.academicType)}'
       AND A.course_id='${courseId}' AND A.exam_name='${ctx.examSetupId}'
       AND C.del=1 AND C.academic_year='${escapeSql(ctx.academicYear)}'
       AND C.course_id='${courseId}' AND C.semester_no='${semester}' AND C.subject_enable=1
       AND B.subject_category != 4
     ORDER BY C.subject_order ASC, B.subject_id ASC`,
  );
  return rows.map((row) => ({
    subjectId: String(row.subject_id),
    subjectName: String(row.subject_name || row.subject_id),
  }));
}

function pageSizeForSubjects(subjectCount) {
  if (!subjectCount) return 30;
  return Math.max(10, Math.floor(804 / subjectCount));
}

export async function loadExamNodue(memberId, fields = {}, audit = {}) {
  const examOptions = await loadNodueExamOptions();
  const noDueOptions = await loadNoDueOptions();
  const examId = String(fields.exam_name || '').trim();
  const ctx = examId ? await resolveExamContext(examId) : null;
  const courseGroups = ctx
    ? await loadCourseSemesterOptions(ctx.courseName, ctx.academicYear, ctx.academicType)
    : [];
  const courseKey = String(fields.course_name || '').trim();
  const courseSel = parseCourseSemesterKey(courseKey);

  let subjects = [];
  let students = [];
  let pagination = { page: 1, pageSize: 30, total: 0, totalPages: 0 };
  let infoMessage = '';

  if (ctx && courseSel && fields.action === 'go') {
    subjects = await loadNodueSubjects(ctx, courseSel.courseId, courseSel.semester);
    const pageSize = pageSizeForSubjects(subjects.length);
    const page = Math.max(1, Number(fields.page) || 1);
    const rolls = await loadExamBatchRollNumbers(
      ctx.examSetupId,
      courseSel.courseId,
      ctx.academicYear,
      courseSel.semester,
      ctx.academicType,
    );
    const allStudents = await loadStudentsByRollNumbers(rolls);
    const total = allStudents.length;
    const totalPages = total ? Math.ceil(total / pageSize) : 0;
    const start = (page - 1) * pageSize;
    const pageStudents = allStudents.slice(start, start + pageSize);

    let nodueRows = [];
    if (subjects.length && pageStudents.length) {
      const regFilter = pageStudents.map((s) => `'${escapeSql(s.registerNo)}'`).join(',');
      nodueRows = await prisma.$queryRawUnsafe(
        `SELECT id, register_no, subject_id, att_per
         FROM cia_exam_nodue
         WHERE del=1 AND exam_name='${escapeSql(String(ctx.examSetupId))}'
           AND course_id='${courseSel.courseId}'
           AND academic_year='${escapeSql(ctx.academicYear)}'
           AND current_year='${escapeSql(String(courseSel.semester))}'
           AND academic_type='${escapeSql(ctx.academicType)}'
           AND register_no IN (${regFilter})`,
      );
    }

    if (!subjects.length) {
      infoMessage = 'No subjects found for this exam and year. Check exam schedule setup.';
    } else if (!allStudents.length) {
      infoMessage = 'No students found in exam batch for this selection. Configure Exam Batch first.';
    }

    const nodueMap = {};
    for (const row of nodueRows) {
      const key = `${row.register_no}::${row.subject_id}`;
      nodueMap[key] = row;
    }

    students = pageStudents.map((stu, index) => ({
      index: start + index + 1,
      registerNo: stu.registerNo,
      uregisterNo: stu.uregisterNo,
      name: stu.name,
      subjects: subjects.map((sub) => {
        const existing = nodueMap[`${stu.registerNo}::${sub.subjectId}`];
        return {
          subjectId: sub.subjectId,
          nodueId: existing?.id || null,
          attPer: existing?.att_per ?? '',
        };
      }),
    }));

    pagination = { page, pageSize, total, totalPages };
  }

  await logExamSetup(PAGE, 'View', 'Successful', examId, memberId, audit);
  return {
    examOptions,
    noDueOptions,
    examId,
    ctx,
    courseGroups,
    courseKey,
    courseSel,
    subjects,
    students,
    pagination,
    infoMessage,
  };
}

export async function saveExamNodue(payload, memberId, audit = {}) {
  const ctx = await resolveExamContext(payload.examSetupId);
  const courseSel = parseCourseSemesterKey(payload.courseKey);
  if (!ctx || !courseSel) {
    return { success: false, message: 'Exam and course are required' };
  }

  const { update, create } = auditFields(memberId, audit);
  const rows = Array.isArray(payload.students) ? payload.students : [];
  const examName = String(ctx.examSetupId);
  const courseId = String(courseSel.courseId);
  const semester = String(courseSel.semester);

  for (const row of rows) {
    const registerNo = String(row.registerNo || '').trim();
    if (!registerNo) continue;

    await prisma.cia_exam_nodue.updateMany({
      where: {
        del: 1,
        exam_name: examName,
        course_id: courseId,
        academic_year: ctx.academicYear,
        current_year: semester,
        academic_type: ctx.academicType,
        register_no: registerNo,
      },
      data: { del: 0, ...update },
    });

    const subjectRows = Array.isArray(row.subjects) ? row.subjects : [];
    for (const sub of subjectRows) {
      const subjectId = String(sub.subjectId || '').trim();
      const attPer = String(sub.attPer ?? '').trim();
      const nodueId = sub.nodueId ? Number(sub.nodueId) : null;

      if (!subjectId) continue;

      if (!nodueId && attPer) {
        await prisma.cia_exam_nodue.create({
          data: {
            exam_name: examName,
            course_id: courseId,
            academic_year: ctx.academicYear,
            current_year: semester,
            academic_type: ctx.academicType,
            subject_id: subjectId,
            register_no: registerNo,
            att_per: attPer,
            del: 1,
            ...create,
          },
        });
      } else if (nodueId) {
        await prisma.cia_exam_nodue.update({
          where: { id: nodueId },
          data: {
            exam_name: examName,
            course_id: courseId,
            academic_year: ctx.academicYear,
            current_year: semester,
            academic_type: ctx.academicType,
            subject_id: subjectId,
            register_no: registerNo,
            att_per: attPer,
            del: 1,
            ...update,
          },
        });
      }
    }
  }

  await logExamSetup(PAGE, 'Update', 'Successful', examName, memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadExamNodue(memberId, {
      exam_name: examName,
      course_name: payload.courseKey,
      action: 'go',
      page: payload.page || 1,
    }, { ...audit, skipLog: true })),
  };
}
