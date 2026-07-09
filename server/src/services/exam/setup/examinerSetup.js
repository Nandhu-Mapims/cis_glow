import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logExamSetup } from './setupAudit.js';
import {
  buildCourseIdYearOptions,
  getMaxBatchCount,
  parseCourseIdYearKey,
} from './examSetupShared.js';

const PAGE = 'term_examiner_setup.php';

async function loadCourseDuration(courseId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT course_duration, total_semester FROM basic_setup_course_tb
     WHERE del=1 AND id='${courseId}' LIMIT 1`,
  );
  const row = rows?.[0];
  return Number(row?.course_duration) || Number(row?.total_semester) || 0;
}

async function loadMaxBatchNo(courseId, academicYear, semester, academicType) {
  const fromExamBatch = await getMaxBatchCount(courseId, academicYear, semester, academicType);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT batch_no FROM cia_att_examiner_batch
     WHERE del=1 AND course_id='${courseId}'
       AND academic_year='${escapeSql(academicYear)}'
       AND current_year='${semester}'
       AND academic_type='${escapeSql(academicType)}'
     ORDER BY batch_no+0 DESC LIMIT 1`,
  );
  const fromExaminerBatch = Number(rows?.[0]?.batch_no) || 0;
  return Math.max(fromExamBatch, fromExaminerBatch, 1);
}

async function loadExaminerTypeRows() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, examiner_type, examiner_name
     FROM cia_att_examiners_type
     WHERE del=1
     ORDER BY id ASC`,
  );
  return rows.map((row, index) => ({
    index,
    examinerType: String(row.examiner_type),
    examinerLabel: String(row.examiner_name || row.examiner_type),
  }));
}

async function loadBatchTypeMap(courseId, academicYear, semester, academicType, totalBatch) {
  const map = {};
  for (let batchNo = 1; batchNo <= totalBatch; batchNo += 1) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT type_examiner FROM cia_att_examiner_batch
       WHERE del=1 AND course_id='${courseId}'
         AND academic_year='${escapeSql(academicYear)}'
         AND current_year='${semester}'
         AND academic_type='${escapeSql(academicType)}'
         AND batch_no='${batchNo}'
       LIMIT 1`,
    );
    const types = String(rows?.[0]?.type_examiner || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    map[batchNo] = new Set(types);
  }
  return map;
}

export async function loadExaminerSetup(memberId, fields = {}, audit = {}) {
  const courseOptions = await buildCourseIdYearOptions();
  const courseKey = String(fields.course_name || '').trim();
  const courseSel = parseCourseIdYearKey(courseKey);
  const semester = fields.semester_name ? Number(fields.semester_name) : null;

  let semesterOptions = [];
  let totalBatch = 0;
  let rows = [];

  if (courseSel) {
    const duration = await loadCourseDuration(courseSel.courseId);
    for (let i = 1; i <= duration; i += 1) {
      semesterOptions.push({ value: i, label: String(i) });
    }
  }

  if (courseSel && semester) {
    totalBatch = await loadMaxBatchNo(
      courseSel.courseId,
      courseSel.academicYear,
      semester,
      courseSel.academicType,
    );
    const typeRows = await loadExaminerTypeRows();
    const batchMap = await loadBatchTypeMap(
      courseSel.courseId,
      courseSel.academicYear,
      semester,
      courseSel.academicType,
      totalBatch,
    );

    rows = typeRows.map((type) => {
      let selectedBatch = null;
      for (let batchNo = 1; batchNo <= totalBatch; batchNo += 1) {
        if (batchMap[batchNo]?.has(type.examinerType)) {
          selectedBatch = batchNo;
          break;
        }
      }
      return {
        ...type,
        selectedBatch,
      };
    });
  }

  await logExamSetup(PAGE, 'View', 'Successful', courseKey, memberId, audit);
  return {
    courseOptions,
    courseKey,
    courseSel,
    semester,
    semesterOptions,
    totalBatch,
    rows,
  };
}

export async function saveExaminerSetup(payload, memberId, audit = {}) {
  const courseSel = parseCourseIdYearKey(payload.courseKey);
  const semester = Number(payload.semester);
  const totalBatch = Number(payload.totalBatch) || 0;
  if (!courseSel || !semester || !totalBatch) {
    return { success: false, message: 'Course, year and batch setup are required' };
  }

  const { update, create } = auditFields(memberId, audit);
  const ip = create.created_ip || update.updated_ip || '';
  const by = create.created_by || update.updated_by || memberId;
  const courseId = String(courseSel.courseId);
  const academicYear = courseSel.academicYear;
  const academicType = courseSel.academicType;

  const listByBatch = {};
  for (let i = 1; i <= totalBatch; i += 1) listByBatch[i] = [];

  const inputRows = Array.isArray(payload.rows) ? payload.rows : [];
  for (const row of inputRows) {
    const examinerType = String(row.examinerType || '').trim();
    const batchNo = Number(row.selectedBatch);
    if (examinerType && batchNo) {
      listByBatch[batchNo].push(examinerType);
    }
  }

  const hasSelection = Object.values(listByBatch).some((types) => types.length > 0);
  if (!hasSelection) {
    return { success: false, message: 'Please select at least one examiner type for a batch' };
  }

  await prisma.$executeRawUnsafe(
    `UPDATE cia_att_examiner_batch SET del=0, updated_dt=NOW(),
       updated_ip='${escapeSql(ip)}', updated_by='${escapeSql(by)}'
     WHERE del=1 AND course_id='${courseId}'
       AND academic_year='${escapeSql(academicYear)}'
       AND current_year='${semester}'
       AND academic_type='${escapeSql(academicType)}'`,
  );

  for (let batchNo = 1; batchNo <= totalBatch; batchNo += 1) {
    const typeExaminer = listByBatch[batchNo].join(',');
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM cia_att_examiner_batch
       WHERE del=0 AND course_id='${courseId}'
         AND academic_year='${escapeSql(academicYear)}'
         AND current_year='${semester}'
         AND academic_type='${escapeSql(academicType)}'
         AND batch_no='${batchNo}'
       ORDER BY id DESC LIMIT 1`,
    );
    const batchId = existing?.[0]?.id ? Number(existing[0].id) : null;

    if (!batchId && typeExaminer) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO cia_att_examiner_batch
         (course_id, academic_year, current_year, academic_type, batch_no, type_examiner, rid,
          created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by)
         VALUES ('${courseId}', '${escapeSql(academicYear)}', '${semester}',
           '${escapeSql(academicType)}', '${batchNo}', '${escapeSql(typeExaminer)}', 0,
           NOW(), '${escapeSql(ip)}', '${escapeSql(by)}',
           '0000-00-00 00:00:00', '', '')`,
      );
    } else if (batchId && typeExaminer) {
      await prisma.$executeRawUnsafe(
        `UPDATE cia_att_examiner_batch SET
           course_id='${courseId}', academic_year='${escapeSql(academicYear)}',
           current_year='${semester}', academic_type='${escapeSql(academicType)}',
           batch_no='${batchNo}', type_examiner='${escapeSql(typeExaminer)}', del=1,
           updated_dt=NOW(), updated_ip='${escapeSql(ip)}', updated_by='${escapeSql(by)}'
         WHERE id='${batchId}'`,
      );
    }
  }

  await logExamSetup(PAGE, 'Update', 'Successful', courseId, memberId, audit);
  return {
    success: true,
    message: 'Your details are added...',
    ...(await loadExaminerSetup(memberId, {
      course_name: payload.courseKey,
      semester_name: semester,
    }, { ...audit, skipLog: true })),
  };
}
