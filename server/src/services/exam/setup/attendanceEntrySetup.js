import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logExamSetup } from './setupAudit.js';
import {
  loadActiveExamOptions,
  loadCourseSemesterOptions,
  loadExamBatchRollNumbers,
  loadStudentsByRollNumbers,
  parseCourseSemesterKey,
  resolveExamContext,
} from './examSetupShared.js';

const PAGE = 'term_attendance_entry.php';

async function loadAttendanceSubjects(ctx, courseId, semester) {
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

export async function loadAttendanceEntry(memberId, fields = {}, audit = {}) {
  const examOptions = await loadActiveExamOptions();
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

  if (ctx && courseSel && fields.action === 'go') {
    subjects = await loadAttendanceSubjects(ctx, courseSel.courseId, courseSel.semester);
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

    let attRows = [];
    if (subjects.length && pageStudents.length) {
      const regFilter = pageStudents.map((s) => `'${escapeSql(s.registerNo)}'`).join(',');
      attRows = await prisma.$queryRawUnsafe(
        `SELECT id, register_no, subject_id, att_per
         FROM cia_att_tb
         WHERE del=1 AND exam_name='${escapeSql(String(ctx.examSetupId))}'
           AND course_id='${courseSel.courseId}'
           AND academic_year='${escapeSql(ctx.academicYear)}'
           AND current_year='${courseSel.semester}' AND academic_type='${escapeSql(ctx.academicType)}'
           AND register_no IN (${regFilter})`,
      );
    }

    const attMap = {};
    for (const row of attRows) {
      attMap[`${row.register_no}::${row.subject_id}`] = row;
    }

    students = pageStudents.map((stu, index) => ({
      index: start + index + 1,
      registerNo: stu.registerNo,
      uregisterNo: stu.uregisterNo,
      name: stu.name,
      subjects: subjects.map((sub) => {
        const existing = attMap[`${stu.registerNo}::${sub.subjectId}`];
        return {
          subjectId: sub.subjectId,
          attId: existing?.id ? Number(existing.id) : null,
          attPer: existing?.att_per ?? '',
        };
      }),
    }));

    pagination = { page, pageSize, total, totalPages };
  }

  await logExamSetup(PAGE, 'View', 'Successful', examId, memberId, audit);
  return {
    examOptions,
    examId,
    ctx,
    courseGroups,
    courseKey,
    courseSel,
    subjects,
    students,
    pagination,
  };
}

export async function saveAttendanceEntry(payload, memberId, audit = {}) {
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
  const ip = create.created_ip || update.updated_ip || '';
  const by = create.created_by || update.updated_by || memberId;

  for (const row of rows) {
    const registerNo = String(row.registerNo || '').trim();
    if (!registerNo) continue;

    await prisma.$executeRawUnsafe(
      `UPDATE cia_att_tb SET del=0, updated_dt=NOW(), updated_ip='${escapeSql(ip)}', updated_by='${escapeSql(by)}'
       WHERE del=1 AND exam_name='${escapeSql(examName)}' AND course_id='${escapeSql(courseId)}'
         AND academic_year='${escapeSql(ctx.academicYear)}' AND current_year='${escapeSql(semester)}'
         AND academic_type='${escapeSql(ctx.academicType)}' AND register_no='${escapeSql(registerNo)}'`,
    );

    const subjectRows = Array.isArray(row.subjects) ? row.subjects : [];
    for (const sub of subjectRows) {
      const subjectId = String(sub.subjectId || '').trim();
      const attPer = String(sub.attPer ?? '').trim();
      if (!subjectId) continue;

      let attId = sub.attId ? Number(sub.attId) : null;
      if (!attId) {
        const existing = await prisma.$queryRawUnsafe(
          `SELECT id FROM cia_att_tb
           WHERE del=0 AND exam_name='${escapeSql(examName)}' AND course_id='${escapeSql(courseId)}'
             AND academic_year='${escapeSql(ctx.academicYear)}' AND current_year='${escapeSql(semester)}'
             AND academic_type='${escapeSql(ctx.academicType)}' AND subject_id='${escapeSql(subjectId)}'
             AND register_no='${escapeSql(registerNo)}' LIMIT 1`,
        );
        attId = existing?.[0]?.id ? Number(existing[0].id) : null;
      }

      if (!attId && attPer) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO cia_att_tb
           (exam_name, course_id, academic_year, current_year, academic_type, subject_id, register_no, att_per,
            created_dt, created_ip, created_by, del)
           VALUES ('${escapeSql(examName)}', '${escapeSql(courseId)}', '${escapeSql(ctx.academicYear)}',
             '${escapeSql(semester)}', '${escapeSql(ctx.academicType)}', '${escapeSql(subjectId)}',
             '${escapeSql(registerNo)}', '${escapeSql(attPer)}',
             NOW(), '${escapeSql(ip)}', '${escapeSql(by)}', 1)`,
        );
      } else if (attId) {
        await prisma.$executeRawUnsafe(
          `UPDATE cia_att_tb SET
             exam_name='${escapeSql(examName)}', course_id='${escapeSql(courseId)}',
             academic_year='${escapeSql(ctx.academicYear)}', current_year='${escapeSql(semester)}',
             academic_type='${escapeSql(ctx.academicType)}', subject_id='${escapeSql(subjectId)}',
             register_no='${escapeSql(registerNo)}', att_per='${escapeSql(attPer)}', del=1,
             updated_dt=NOW(), updated_ip='${escapeSql(ip)}', updated_by='${escapeSql(by)}'
           WHERE id='${attId}'`,
        );
      }
    }
  }

  await logExamSetup(PAGE, 'Update', 'Successful', examName, memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadAttendanceEntry(memberId, {
      exam_name: examName,
      course_name: payload.courseKey,
      action: 'go',
      page: payload.page || 1,
    }, { ...audit, skipLog: true })),
  };
}
