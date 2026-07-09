import { prisma } from '../../../config/prisma.js';
import { basicSetupCourseSelect } from '../../../utils/legacySelects.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { convertNYear } from '../../fees/feeHelpers.js';
import { loadAcademicConfig } from '../../shared/ciaSetupHelpers.js';
import {
  batchLetters,
  courseIdYearKey,
  getCourseById,
  loadBatchCount,
  parseCourseIdYearKey,
} from '../academicSetupShared.js';
import { auditFields, logAcademicSetup } from './setupAudit.js';

const PAGE = 'subject_batch.php';
const ATT_EOS = 2016;

async function loadBannerImageUrl() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT banner_image FROM basic_banner_tb WHERE del = 1 AND id = 1 LIMIT 1',
  );
  const image = rows[0]?.banner_image;
  return image ? `/legacy/img/global_images/${encodeURIComponent(image)}` : '';
}

async function buildSubjectBatchCourseOptions() {
  const academicYearArray = await loadAcademicConfig();
  const courses = await prisma.basic_setup_course_tb.findMany({
    where: { del: 1 },
    orderBy: { c_order: 'asc' },
    select: basicSetupCourseSelect,
  });
  const options = [];

  for (const course of courses) {
    let dept = String(course.department_name || '').trim();
    if (dept && dept !== '-') dept = ` - ${dept}`;
    else dept = '';
    const ft = course.full_part_time === 'Full Time' ? 'FT' : 'PT';
    let yearOfStart = Number(course.year_of_start) || 2000;
    if (yearOfStart < ATT_EOS) yearOfStart = ATT_EOS;

    const pushYears = (configYear, batch, batchLabel, yearLabelFn) => {
      if (!configYear) return;
      const startYear = Number(String(configYear).split('-')[0]) || 0;
      const group = `${course.course_name} | ${course.degree_name}${dept} | ${ft} | ${batchLabel}`;
      for (let i = startYear; i >= yearOfStart; i -= 1) {
        const acYear = yearLabelFn(i);
        options.push({
          value: courseIdYearKey(course.id, acYear, batch),
          label: `${course.degree_name}${dept} | ${acYear} (${batchLabel})`,
          group,
          courseId: course.id,
          courseName: course.course_name,
          academicYear: acYear,
          academicType: batch,
          courseDuration: Number(course.course_duration) || Number(course.total_semester) || 0,
          totalSemester: Number(course.total_semester) || Number(course.course_duration) || 0,
        });
      }
    };

    pushYears(
      academicYearArray[course.course_name]?.regular,
      'regular',
      'Regular',
      (i) => `${i + 1}-${i + 2}`,
    );
    pushYears(
      academicYearArray[course.course_name]?.additional,
      'additional',
      'Additional',
      (i) => `${i}-${i + 1}`,
    );
  }

  return options;
}

export async function loadSubjectBatch(memberId, fields = {}, audit = {}) {
  const courseYearOptions = await buildSubjectBatchCourseOptions();
  const selection = parseCourseIdYearKey(fields.course_name);
  const semester = Number(fields.semester_name) || 0;
  const totalBatch = Number(fields.total_batch) || 0;

  let course = null;
  let students = [];
  let batchAssignments = {};
  let resolvedBatchCount = totalBatch;

  if (selection) {
    course = await getCourseById(selection.courseId);
    if (semester && selection.academicType) {
      if (!resolvedBatchCount) {
        resolvedBatchCount = await loadBatchCount(
          selection.courseId,
          selection.academicYear,
          semester,
          selection.academicType,
        );
      }

      const studentRows = await prisma.$queryRawUnsafe(
        `SELECT A.register_no, A.student_name, A.student_initial
         FROM student_profile_tb AS A
         INNER JOIN student_academic_tb AS B ON A.id = B.s_id
         WHERE A.del=1 AND B.del=1 AND A.course_id='${escapeSql(String(selection.courseId))}'
           AND B.course_id='${escapeSql(String(selection.courseId))}' AND B.academic_year='${escapeSql(selection.academicYear)}'
           AND B.current_year='${escapeSql(String(semester))}' AND B.academic_batch='${escapeSql(selection.academicType)}'
         ORDER BY FIELD(B.academic_type,'','Regular','Additional','Break'), A.student_name ASC, A.student_initial ASC`,
      );
      students = studentRows.map((r) => ({
        registerNo: r.register_no,
        name: `${r.student_name || ''} ${r.student_initial || ''}`.trim(),
      }));

      const batchRows = await prisma.$queryRawUnsafe(
        `SELECT batch_no, roll_no FROM basic_subject_batch_tb
         WHERE del = 1 AND course_id = '${escapeSql(String(selection.courseId))}'
           AND academic_year = '${escapeSql(selection.academicYear)}'
           AND current_year = '${escapeSql(String(semester))}'
           AND LOWER(academic_type) = LOWER('${escapeSql(selection.academicType)}')`,
      );
      for (const row of batchRows) {
        const rolls = String(row.roll_no || '').split(',').filter(Boolean);
        for (const roll of rolls) batchAssignments[roll] = row.batch_no;
      }
    }
  }

  await logAcademicSetup(PAGE, 'View', 'Successful', fields.course_name || '', memberId, audit);
  const bannerUrl = await loadBannerImageUrl();
  const printMeta = selection && semester && course ? {
    title: `${convertNYear(semester, course.course_name)} year Student Batch List`,
    subtitle: `Academic Year: ${selection.academicYear}`,
  } : null;

  return {
    courseYearOptions,
    courseYearKey: fields.course_name || '',
    selection,
    semester,
    totalSemester: course ? Number(course.course_duration) || 0 : 0,
    totalBatch: resolvedBatchCount,
    batchLetters: batchLetters(resolvedBatchCount || 0),
    students,
    batchAssignments,
    bannerUrl,
    printMeta,
    scope: selection && semester ? {
      courseId: selection.courseId,
      academicYear: selection.academicYear,
      currentYear: semester,
      academicType: selection.academicType,
      courseName: course?.course_name,
    } : null,
  };
}

export async function saveSubjectBatch(payload, memberId, audit = {}) {
  const scope = payload.scope || {};
  const courseId = Number(scope.courseId);
  const academicYear = String(scope.academicYear || '').trim();
  const currentYear = String(scope.currentYear || '').trim();
  const academicType = String(scope.academicType || '').trim();
  const totalBatch = Number(payload.totalBatch) || 0;
  const assignments = payload.assignments || {};

  if (!courseId || !academicYear || !currentYear || !academicType || !totalBatch) {
    return { success: false, message: 'Batch setup scope is incomplete' };
  }

  const rollnoList = {};
  for (const [roll, batchNo] of Object.entries(assignments)) {
    if (!roll || !batchNo) continue;
    if (!rollnoList[batchNo]) rollnoList[batchNo] = [];
    rollnoList[batchNo].push(roll);
  }

  const { create, update } = auditFields(memberId, audit);
  await prisma.basic_subject_batch_tb.updateMany({
    where: {
      del: 1,
      course_id: courseId,
      academic_year: academicYear,
      current_year: currentYear,
      academic_type: academicType,
    },
    data: { del: 0, ...update },
  });

  for (let i = 1; i <= totalBatch; i += 1) {
    const rollList = (rollnoList[i] || []).join(',');
    const existing = await prisma.basic_subject_batch_tb.findFirst({
      where: {
        course_id: courseId,
        academic_year: academicYear,
        current_year: currentYear,
        academic_type: academicType,
        batch_no: String(i),
      },
      orderBy: { id: 'desc' },
    });

    if (!existing?.id && rollList) {
      await prisma.basic_subject_batch_tb.create({
        data: {
          course_id: courseId,
          academic_year: academicYear,
          current_year: currentYear,
          academic_type: academicType,
          batch_no: String(i),
          roll_no: rollList,
          ...create,
        },
      });
    } else if (existing?.id) {
      await prisma.basic_subject_batch_tb.update({
        where: { id: existing.id },
        data: {
          roll_no: rollList,
          del: rollList ? 1 : 0,
          ...update,
        },
      });
    }
  }

  await logAcademicSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  const courseYearKey = `${courseId}___${academicYear}___${academicType}`;
  return {
    success: true,
    message: 'Your details are added...',
    ...(await loadSubjectBatch(memberId, {
      course_name: courseYearKey,
      semester_name: currentYear,
      total_batch: totalBatch,
    }, { ...audit, skipLog: true })),
  };
}

export function buildSubjectBatchPrintHeader(scope, courseName) {
  return {
    title: `${convertNYear(scope.currentYear, courseName)} year Student Batch List`,
    subtitle: `Academic Year: ${scope.academicYear}`,
  };
}
