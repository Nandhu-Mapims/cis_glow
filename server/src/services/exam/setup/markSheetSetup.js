import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { convertNYear } from '../../fees/feeHelpers.js';
import { logExamSetup } from './setupAudit.js';
import {
  batchLetters,
  formatDisplayDate,
  getMaxBatchCount,
  loadActiveExamOptions,
  loadCourseSemesterOptions,
  loadSubjectCategories,
  parseCourseSemesterKey,
  resolveExamContext,
} from './examSetupShared.js';

const PAGE = 'term_mark_sheet.php';

export async function loadMarkSheet(memberId, fields = {}, audit = {}) {
  const examOptions = await loadActiveExamOptions();
  const examId = String(fields.exam_name || '').trim();
  const ctx = examId ? await resolveExamContext(examId) : null;
  const courseGroups = ctx
    ? await loadCourseSemesterOptions(ctx.courseName, ctx.academicYear, ctx.academicType)
    : [];
  const courseKey = String(fields.course_name || '').trim();
  const courseSel = parseCourseSemesterKey(courseKey);
  const markOpt = String(fields.mopt || '1');

  let schedules = [];
  if (ctx && courseSel) {
    const categories = await loadSubjectCategories();
    const totalBatch = await getMaxBatchCount(
      courseSel.courseId, ctx.academicYear, courseSel.semester, ctx.academicType,
    );
    const letters = batchLetters(totalBatch);
    const schedRows = await prisma.$queryRawUnsafe(
      `SELECT A.id, CAST(A.exam_date AS CHAR) AS exam_date, A.exam_session, A.batch_no, A.internal_max, A.viva_max,
              A.external_max, A.pass_mark, B.subject_id, B.subject_name, B.subject_category
       FROM cia_schedule_tb AS A
       INNER JOIN basic_subject_marks_tb AS B ON A.subject_id=B.subject_id
       WHERE A.del=1 AND B.del=1 AND A.academic_year='${escapeSql(ctx.academicYear)}'
         AND A.current_year='${courseSel.semester}' AND A.academic_type='${escapeSql(ctx.academicType)}'
         AND A.course_id='${courseSel.courseId}' AND A.exam_name='${ctx.examSetupId}'
       ORDER BY A.exam_date ASC`,
    );
    schedules = schedRows.map((row) => {
      const batchList = String(row.batch_no || '').split(',').filter(Boolean);
      const batchLabel = batchList.map((b) => letters[Number(b)] || b).join(', ');
      return {
        scheduleId: row.id,
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        categoryName: categories[Number(row.subject_category)] || '',
        examDate: formatDisplayDate(row.exam_date),
        examSession: row.exam_session,
        batchLabel: batchLabel || 'All',
        internalMax: row.internal_max,
        vivaMax: row.viva_max,
        externalMax: row.external_max,
        passMark: row.pass_mark,
        printParams: {
          eid: row.id,
          exam: ctx.examSetupId,
          course: courseSel.courseId,
          ayear: ctx.academicYear,
          cyear: courseSel.semester,
          atype: ctx.academicType,
          subject: row.subject_id,
          scheid: row.id,
          mark: markOpt,
        },
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
    markOpt,
    schedules,
    courseLabel: courseSel && ctx
      ? `${convertNYear(courseSel.semester, ctx.courseName)} - ${courseGroups[0]?.degreeLabel || ''}`
      : '',
  };
}

export async function saveMarkSheet() {
  return { success: false, message: 'Mark sheet is view/print only' };
}
