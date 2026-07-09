import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logExamSetup } from './setupAudit.js';
import { getEntryColumns } from './examMarkLogic.js';
import {
  loadActiveExamOptions,
  loadBatchRollNumbers,
  loadCourseSemesterOptions,
  loadScheduledSubjects,
  loadStudentsByRollNumbers,
  parseCourseSemesterKey,
  resolveExamContext,
} from './examSetupShared.js';

const PAGE = 'term_mark_entry.php';

export async function loadMarkEntry(memberId, fields = {}, audit = {}) {
  const examOptions = await loadActiveExamOptions();
  const examId = String(fields.exam_name || '').trim();
  const ctx = examId ? await resolveExamContext(examId) : null;
  const courseGroups = ctx
    ? await loadCourseSemesterOptions(ctx.courseName, ctx.academicYear, ctx.academicType)
    : [];
  const courseKey = String(fields.course_name || '').trim();
  const courseSel = parseCourseSemesterKey(courseKey);
  const subjectId = String(fields.subject_name || '').trim();

  let subjects = [];
  let subject = null;
  let columns = null;
  let students = [];

  if (ctx && courseSel) {
    subjects = await loadScheduledSubjects(ctx, courseSel.courseId, courseSel.semester);
    subject = subjects.find((s) => s.subjectId === subjectId) || null;
    if (subject && fields.action === 'go') {
      columns = getEntryColumns(ctx, subject);
      const rolls = await loadBatchRollNumbers(
        courseSel.courseId, ctx.academicYear, courseSel.semester, ctx.academicType,
      );
      const studentList = await loadStudentsByRollNumbers(rolls);
      const marksRows = await prisma.cia_marks_tb.findMany({
        where: {
          del: 1,
          exam_name: String(ctx.examSetupId),
          course_id: String(courseSel.courseId),
          academic_year: ctx.academicYear,
          current_year: String(courseSel.semester),
          academic_type: ctx.academicType,
          subject_id: subjectId,
        },
      });
      const marksMap = {};
      for (const m of marksRows) marksMap[m.register_no] = m;
      students = studentList.map((stu) => {
        const m = marksMap[stu.registerNo];
        return {
          registerNo: stu.registerNo,
          uregisterNo: stu.uregisterNo,
          name: stu.name,
          markId: m?.id || null,
          iMark: m?.i_marks ?? '',
          vMark: m?.v_marks ?? '',
          eMark: m?.e_marks ?? '',
          tMark: m?.t_marks ?? '',
          result: m?.p_status ?? '',
        };
      });
    }
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
    subjectId,
    subject,
    columns,
    students,
  };
}

export async function saveMarkEntry(payload, memberId, audit = {}) {
  const ctx = await resolveExamContext(payload.examSetupId);
  const courseSel = parseCourseSemesterKey(payload.courseKey);
  const subjectId = String(payload.subjectId || '').trim();
  if (!ctx || !courseSel || !subjectId) {
    return { success: false, message: 'Exam, course and subject are required' };
  }

  const { update, create } = auditFields(memberId, audit);
  await prisma.cia_marks_tb.updateMany({
    where: {
      del: 1,
      exam_name: String(ctx.examSetupId),
      course_id: String(courseSel.courseId),
      academic_year: ctx.academicYear,
      current_year: String(courseSel.semester),
      academic_type: ctx.academicType,
      subject_id: subjectId,
    },
    data: { del: 0, ...update },
  });

  const rows = Array.isArray(payload.students) ? payload.students : [];
  for (const row of rows) {
    const data = {
      exam_name: String(ctx.examSetupId),
      course_id: String(courseSel.courseId),
      academic_year: ctx.academicYear,
      current_year: String(courseSel.semester),
      academic_type: ctx.academicType,
      subject_id: subjectId,
      register_no: String(row.registerNo),
      i_marks: String(row.iMark ?? ''),
      v_marks: String(row.vMark ?? ''),
      e_marks: String(row.eMark ?? ''),
      t_marks: String(row.tMark ?? ''),
      p_status: String(row.result ?? ''),
      del: 1,
      ...update,
    };
    if (!row.markId) {
      await prisma.cia_marks_tb.create({ data: { ...data, ...create } });
    } else {
      await prisma.cia_marks_tb.update({ where: { id: Number(row.markId) }, data });
    }
  }

  await logExamSetup(PAGE, 'Update', 'Successful', subjectId, memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadMarkEntry(memberId, {
      exam_name: String(ctx.examSetupId),
      course_name: payload.courseKey,
      subject_name: subjectId,
      action: 'go',
    }, { ...audit, skipLog: true })),
  };
}
