import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logExamSetup } from './setupAudit.js';
import {
  loadActiveExamOptions,
  loadCourseSemesterOptions,
  loadSubjectCategories,
  parseCourseSemesterKey,
  resolveExamContext,
} from './examSetupShared.js';

const PAGE = 'term_exam_examiners.php';

async function loadSubjectsWithExaminerFlag(ctx, courseId, semester) {
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
  const categories = await loadSubjectCategories();

  const flagged = [];
  for (const row of rows) {
    const subjectId = String(row.subject_id);
    const countRows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS cnt FROM cia_att_examiners_tb
       WHERE del=1 AND exam_name='${escapeSql(String(ctx.examSetupId))}'
         AND course_id='${courseId}' AND academic_year='${escapeSql(ctx.academicYear)}'
         AND current_year='${semester}' AND academic_type='${escapeSql(ctx.academicType)}'
         AND subject_id='${escapeSql(subjectId)}'`,
    );
    flagged.push({
      subjectId,
      subjectName: String(row.subject_name || subjectId),
      categoryName: categories[Number(row.subject_category)] || '',
      hasExaminers: Number(countRows?.[0]?.cnt || 0) > 0,
    });
  }
  return flagged;
}

async function loadExaminerTypeRows(courseId, academicYear, semester, academicType) {
  const batchRows = await prisma.$queryRawUnsafe(
    `SELECT GROUP_CONCAT(type_examiner SEPARATOR ',') AS types
     FROM cia_att_examiner_batch
     WHERE del=1 AND course_id='${courseId}'
       AND academic_year='${escapeSql(academicYear)}'
       AND academic_type='${escapeSql(academicType)}'
       AND current_year='${semester}'`,
  );
  const typeList = [...new Set(
    String(batchRows?.[0]?.types || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  )];

  if (!typeList.length) {
    return { typeRows: [], notConfigured: true };
  }

  const typeFilter = typeList.map((t) => `examiner_type='${escapeSql(t)}'`).join(' OR ');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT examiner_type, examiner_name
     FROM cia_att_examiners_type
     WHERE del=1 AND (${typeFilter})
     ORDER BY id ASC`,
  );
  return {
    typeRows: rows.map((row) => ({
      examinerType: String(row.examiner_type),
      examinerLabel: String(row.examiner_name || row.examiner_type),
    })),
    notConfigured: false,
  };
}

async function loadExaminerRows(ctx, courseId, semester, subjectId, typeRows) {
  const rows = [];
  for (const type of typeRows) {
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id, ext_name, ext_desig, ext_working, ext_mobile, ext_email
       FROM cia_att_examiners_tb
       WHERE del=1 AND exam_name='${escapeSql(String(ctx.examSetupId))}'
         AND course_id='${courseId}' AND academic_year='${escapeSql(ctx.academicYear)}'
         AND current_year='${semester}' AND academic_type='${escapeSql(ctx.academicType)}'
         AND subject_id='${escapeSql(subjectId)}'
         AND examiner_type='${escapeSql(type.examinerType)}'
       LIMIT 1`,
    );
    const row = existing?.[0];
    rows.push({
      examinerType: type.examinerType,
      examinerLabel: type.examinerLabel,
      recordId: row?.id ? Number(row.id) : null,
      extName: row?.ext_name ?? '',
      extDesig: row?.ext_desig ?? '',
      extWorking: row?.ext_working ?? '',
      extMobile: row?.ext_mobile ?? '',
      extEmail: row?.ext_email ?? '',
    });
  }
  return rows;
}

export async function loadExamExaminers(memberId, fields = {}, audit = {}) {
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
  let examiners = [];
  let infoMessage = '';
  let notConfigured = false;

  if (ctx && courseSel) {
    subjects = await loadSubjectsWithExaminerFlag(ctx, courseSel.courseId, courseSel.semester);
    if (subjectId && fields.action === 'go') {
      const typeResult = await loadExaminerTypeRows(
        courseSel.courseId,
        ctx.academicYear,
        courseSel.semester,
        ctx.academicType,
      );
      notConfigured = typeResult.notConfigured;
      if (typeResult.notConfigured) {
        infoMessage = 'Examiner types are not configured for this year. Use Examiner Setup to assign batch-specific types, then return here to enter examiner details.';
      } else if (typeResult.typeRows.length) {
        examiners = await loadExaminerRows(
          ctx,
          String(courseSel.courseId),
          String(courseSel.semester),
          subjectId,
          typeResult.typeRows,
        );
      } else {
        infoMessage = 'No examiner types found for the configured batch setup. Check Examiner Setup for this course and year.';
      }
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
    examiners,
    infoMessage,
    notConfigured,
  };
}

export async function saveExamExaminers(payload, memberId, audit = {}) {
  const ctx = await resolveExamContext(payload.examSetupId);
  const courseSel = parseCourseSemesterKey(payload.courseKey);
  const subjectId = String(payload.subjectId || '').trim();
  if (!ctx || !courseSel || !subjectId) {
    return { success: false, message: 'Exam, course and subject are required' };
  }

  const { update, create } = auditFields(memberId, audit);
  const examName = String(ctx.examSetupId);
  const courseId = String(courseSel.courseId);
  const semester = String(courseSel.semester);
  const ip = create.created_ip || update.updated_ip || '';
  const by = create.created_by || update.updated_by || memberId;

  await prisma.$executeRawUnsafe(
    `UPDATE cia_att_examiners_tb SET del=0, updated_dt=NOW(), updated_ip='${escapeSql(ip)}', updated_by='${escapeSql(by)}'
     WHERE del=1 AND exam_name='${escapeSql(examName)}' AND course_id='${escapeSql(courseId)}'
       AND academic_year='${escapeSql(ctx.academicYear)}' AND current_year='${escapeSql(semester)}'
       AND academic_type='${escapeSql(ctx.academicType)}' AND subject_id='${escapeSql(subjectId)}'`,
  );

  const rows = Array.isArray(payload.examiners) ? payload.examiners : [];
  for (const row of rows) {
    const examinerType = String(row.examinerType || '').trim();
    if (!examinerType) continue;

    const extName = String(row.extName ?? '');
    const extDesig = String(row.extDesig ?? '');
    const extWorking = String(row.extWorking ?? '');
    const extMobile = String(row.extMobile ?? '');
    const extEmail = String(row.extEmail ?? '');
    const recordId = row.recordId ? Number(row.recordId) : null;

    if (!recordId) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO cia_att_examiners_tb
         (exam_name, course_id, academic_year, current_year, academic_type, subject_id, exam_date,
          examiner_type, ext_name, ext_desig, ext_working, ext_mobile, ext_email,
          int_ex_name, int_skill_name, register_no, i_marks, v_marks, e_marks, t_marks, p_status,
          created_dt, created_ip, created_by, del)
         VALUES ('${escapeSql(examName)}', '${escapeSql(courseId)}', '${escapeSql(ctx.academicYear)}',
           '${escapeSql(semester)}', '${escapeSql(ctx.academicType)}', '${escapeSql(subjectId)}', CURDATE(),
           '${escapeSql(examinerType)}', '${escapeSql(extName)}', '${escapeSql(extDesig)}',
           '${escapeSql(extWorking)}', '${escapeSql(extMobile)}', '${escapeSql(extEmail)}',
           '', '', '', '', '', '', '', '',
           NOW(), '${escapeSql(ip)}', '${escapeSql(by)}', 1)`,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE cia_att_examiners_tb SET
           exam_name='${escapeSql(examName)}', course_id='${escapeSql(courseId)}',
           academic_year='${escapeSql(ctx.academicYear)}', current_year='${escapeSql(semester)}',
           academic_type='${escapeSql(ctx.academicType)}', subject_id='${escapeSql(subjectId)}',
           exam_date=CURDATE(), examiner_type='${escapeSql(examinerType)}',
           ext_name='${escapeSql(extName)}', ext_desig='${escapeSql(extDesig)}',
           ext_working='${escapeSql(extWorking)}', ext_mobile='${escapeSql(extMobile)}',
           ext_email='${escapeSql(extEmail)}', del=1,
           updated_dt=NOW(), updated_ip='${escapeSql(ip)}', updated_by='${escapeSql(by)}'
         WHERE id='${recordId}'`,
      );
    }
  }

  await logExamSetup(PAGE, 'Update', 'Successful', subjectId, memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadExamExaminers(memberId, {
      exam_name: examName,
      course_name: payload.courseKey,
      subject_name: subjectId,
      action: 'go',
    }, { ...audit, skipLog: true })),
  };
}
