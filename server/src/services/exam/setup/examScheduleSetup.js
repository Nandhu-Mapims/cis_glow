import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logExamSetup } from './setupAudit.js';
import {
  batchLetters,
  formatDisplayDate,
  getMaxBatchCount,
  loadActiveExamOptions,
  loadCourseSemesterOptions,
  loadInvigilatorOptions,
  loadSubjectCategories,
  parseCourseSemesterKey,
  resolveExamContext,
} from './examSetupShared.js';
import { parseInputDate } from '../../shared/ciaSetupHelpers.js';

const PAGE = 'term_exam_schedule.php';

function scheduleCourseId(courseId) {
  return String(courseId ?? '');
}

function scheduleInvigilatorList(invigilators = []) {
  return invigilators.join(',').slice(0, 25);
}

function buildScheduleRowData(row, ctx, courseSel, examDate, auditUpdate) {
  return {
    exam_name: String(ctx.examSetupId),
    course_id: scheduleCourseId(courseSel.courseId),
    academic_year: ctx.academicYear,
    current_year: String(courseSel.semester),
    academic_type: ctx.academicType,
    subject_id: String(row.subjectId),
    sub_category: String(row.categoryName || ''),
    batch_no: (row.batchNos || []).join(','),
    exam_date: new Date(examDate),
    exam_session: row.examSession === 'AN' ? 'AN' : 'FN',
    invigilator: scheduleInvigilatorList(row.invigilators),
    evaluation_frm_date: new Date(examDate),
    evaluation_to_date: new Date(examDate),
    evaluator: '',
    internal_min: 0,
    internal_max: Number(row.internalMax ?? 0) || 0,
    viva_min: 0,
    viva_max: Number(row.vivaMax ?? 0) || 0,
    external_min: 0,
    external_max: Number(row.externalMax ?? 0) || 0,
    pass_mark: String(row.passMark ?? 0),
    absent_list: '',
    del: 1,
    ...auditUpdate,
  };
}

async function loadSubjectRows(ctx, courseId, semester) {
  const categories = await loadSubjectCategories();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.subject_id, A.subject_name, A.internal_max, A.viva_max, A.external_max,
            A.pass_mark, A.subject_category
     FROM basic_subject_marks_tb AS A
     INNER JOIN basic_setup_subject_tb AS B ON A.rid=B.id
     WHERE A.del=1 AND B.del=1 AND B.academic_year='${escapeSql(ctx.academicYear)}'
       AND B.course_id='${courseId}' AND B.semester_no='${semester}' AND B.subject_enable=1
     ORDER BY B.subject_order ASC`,
  );
  return rows.map((row) => ({
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    categoryName: categories[Number(row.subject_category)] || '',
    internalMax: ctx.examInternal ? Number(row.internal_max) || 0 : 0,
    vivaMax: ctx.examViva ? Number(row.viva_max) || 0 : 0,
    externalMax: ctx.examExternal ? Number(row.external_max) || 0 : 0,
    passMark: Number(row.pass_mark) || 0,
  }));
}

async function loadExistingSchedules(ctx, courseId, semester) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, subject_id, CAST(exam_date AS CHAR) AS exam_date, exam_session, batch_no, invigilator,
            internal_max, viva_max, external_max, pass_mark
     FROM cia_schedule_tb
     WHERE del=1 AND exam_name='${escapeSql(String(ctx.examSetupId))}'
       AND course_id='${Number(courseId)}'
       AND academic_year='${escapeSql(ctx.academicYear)}'
       AND current_year='${escapeSql(String(semester))}'
       AND academic_type='${escapeSql(ctx.academicType)}'
     ORDER BY exam_date ASC`,
  );
  const map = {};
  for (const row of rows) {
    map[row.subject_id] = {
      id: row.id,
      examDate: formatDisplayDate(row.exam_date),
      examSession: row.exam_session || 'FN',
      batchNos: String(row.batch_no || '').split(',').filter(Boolean),
      invigilators: String(row.invigilator || '').split(',').filter(Boolean),
      internalMax: Number(row.internal_max) || 0,
      vivaMax: Number(row.viva_max) || 0,
      externalMax: Number(row.external_max) || 0,
      passMark: Number(row.pass_mark) || 0,
    };
  }
  return map;
}

export async function loadExamSchedule(memberId, fields = {}, audit = {}) {
  const examOptions = await loadActiveExamOptions();
  const examId = String(fields.exam_name || '').trim();
  const ctx = examId ? await resolveExamContext(examId) : null;
  const courseGroups = ctx
    ? await loadCourseSemesterOptions(ctx.courseName, ctx.academicYear, ctx.academicType)
    : [];
  const courseKey = String(fields.course_name || '').trim();
  const courseSel = parseCourseSemesterKey(courseKey);

  let rows = [];
  let totalBatch = 1;
  let batchOptions = [];
  const invigilatorOptions = await loadInvigilatorOptions();

  if (ctx && courseSel) {
    totalBatch = await getMaxBatchCount(
      courseSel.courseId, ctx.academicYear, courseSel.semester, ctx.academicType,
    );
    const letters = batchLetters(totalBatch);
    batchOptions = Object.entries(letters).map(([value, label]) => ({ value, label }));
    const subjects = await loadSubjectRows(ctx, courseSel.courseId, courseSel.semester);
    const existing = await loadExistingSchedules(ctx, courseSel.courseId, courseSel.semester);
    rows = subjects.map((sub) => {
      const ex = existing[sub.subjectId] || {};
      const isTheory = String(sub.categoryName).toLowerCase() === 'theory';
      return {
        ...sub,
        scheduleId: ex.id || null,
        examDate: ex.examDate || '',
        examSession: ex.examSession || 'FN',
        batchNos: ex.batchNos?.length
          ? ex.batchNos
          : (isTheory ? Object.keys(letters) : Object.keys(letters)),
        invigilators: ex.invigilators || [],
        internalMax: ex.internalMax || sub.internalMax,
        vivaMax: ex.vivaMax || sub.vivaMax,
        externalMax: ex.externalMax || sub.externalMax,
        passMark: ex.passMark || sub.passMark,
        marksReadonly: ctx.markOption,
        isTheory,
      };
    });
  }

  await logExamSetup(PAGE, 'View', 'Successful', examId, memberId, audit);
  return {
    examOptions,
    examId,
    ctx,
    courseGroups,
    courseKey,
    courseSel,
    rows,
    totalBatch,
    batchOptions,
    invigilatorOptions,
  };
}

export async function saveExamSchedule(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = Number(payload.id);
    const { update } = auditFields(memberId, audit);
    await prisma.cia_schedule_tb.update({ where: { id }, data: { del: 0, ...update } });
    await logExamSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
    return {
      success: true,
      message: 'Your details are deleted...',
      ...(await loadExamSchedule(memberId, payload.reloadFields || {}, { ...audit, skipLog: true })),
    };
  }

  const ctx = await resolveExamContext(payload.examSetupId);
  const courseSel = parseCourseSemesterKey(payload.courseKey);
  if (!ctx || !courseSel) return { success: false, message: 'Exam and course are required' };

  const { update, create } = auditFields(memberId, audit);
  await prisma.cia_schedule_tb.updateMany({
    where: {
      del: 1,
      exam_name: String(ctx.examSetupId),
      course_id: scheduleCourseId(courseSel.courseId),
      academic_year: ctx.academicYear,
      current_year: String(courseSel.semester),
      academic_type: ctx.academicType,
    },
    data: { del: 0, ...update },
  });

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  for (const row of rows) {
    const examDate = parseInputDate(row.examDate);
    if (!examDate) continue;
    const data = buildScheduleRowData(row, ctx, courseSel, examDate, update);
    if (!row.scheduleId) {
      await prisma.cia_schedule_tb.create({ data: { ...data, ...create } });
    } else {
      await prisma.cia_schedule_tb.update({
        where: { id: Number(row.scheduleId) },
        data,
      });
    }
  }

  await logExamSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadExamSchedule(memberId, {
      exam_name: String(ctx.examSetupId),
      course_name: payload.courseKey,
    }, { ...audit, skipLog: true })),
  };
}
