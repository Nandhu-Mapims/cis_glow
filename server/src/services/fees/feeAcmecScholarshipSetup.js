import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { logFeeSetup } from './setup/setupAudit.js';
import { loadLegacyCourseYearGroups, parseCourseKey } from './setup/feeCourseYearGroups.js';

const PAGE = 'acmec_fee_scholarship.php';

function resolveCourseKey(fields = {}) {
  const parsed = parseCourseKey(fields.courseKey);
  if (parsed.courseKey) return parsed;
  const courseId = String(fields.courseId || '').trim();
  const academicYear = String(fields.academicYear || '').trim();
  const academicBatch = String(fields.academicBatch || 'regular').trim().toLowerCase();
  if (!courseId || !academicYear) {
    return { courseKey: '', courseId: '', academicYear: '', academicBatch: 'regular' };
  }
  return {
    courseKey: `${courseId}___${academicYear}___${academicBatch}`,
    courseId,
    academicYear,
    academicBatch,
  };
}

export async function loadAcmecScholarshipSetup(fields = {}) {
  const courseGroups = await loadLegacyCourseYearGroups();
  const courseOptions = courseGroups.flatMap((group) => group.options);
  const { courseKey, courseId, academicYear, academicBatch } = resolveCourseKey(fields);
  const currentYear = String(fields.currentYear || '').trim();
  const loadStudents = Boolean(courseKey && currentYear);

  let classOptions = [];
  let students = [];
  let enrolledCount = 0;

  if (courseId) {
    const courseRows = await prisma.$queryRawUnsafe(
      `SELECT course_duration FROM basic_setup_course_tb WHERE del = 1 AND id = ${Number(courseId)} LIMIT 1`,
    );
    const duration = Number(courseRows[0]?.course_duration) || 1;
    classOptions = Array.from({ length: duration }, (_, i) => ({
      value: String(i + 1),
      label: String(i + 1),
    }));
  }

  if (loadStudents && courseId && academicYear && currentYear) {
    const countRows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(DISTINCT P.id) AS enrolled,
              SUM(CASE WHEN P.acmec_scholorship = 1 THEN 1 ELSE 0 END) AS acmec_flagged
       FROM student_profile_tb AS P
       INNER JOIN student_academic_tb AS B ON P.id = B.s_id
       WHERE P.del = 1 AND B.del = 1 AND P.course_id = '${escapeSql(courseId)}'
         AND B.course_id = '${escapeSql(courseId)}' AND B.academic_year = '${escapeSql(academicYear)}'
         AND B.academic_batch = '${escapeSql(academicBatch)}' AND B.academic_type = '${escapeSql(academicBatch)}'
         AND B.current_year = '${escapeSql(currentYear)}'`,
    );
    enrolledCount = Number(countRows[0]?.enrolled) || 0;

    const rows = await prisma.$queryRawUnsafe(
      `SELECT P.id AS student_id, P.register_no, P.student_name, P.student_initial, P.acmec_amount,
              COALESCE(A.s_amount, 0) AS approved_amount
       FROM student_profile_tb AS P
       INNER JOIN student_academic_tb AS B ON P.id = B.s_id
       LEFT JOIN student_fee_acmec AS A
         ON A.del = 1 AND A.s_id = P.id AND A.course_id = '${escapeSql(courseId)}'
         AND A.academic_year = '${escapeSql(academicYear)}' AND A.academic_batch = '${escapeSql(academicBatch)}'
         AND A.current_year = '${escapeSql(currentYear)}'
       WHERE P.del = 1 AND B.del = 1 AND P.acmec_scholorship = 1 AND P.course_id = '${escapeSql(courseId)}'
         AND B.course_id = '${escapeSql(courseId)}' AND B.academic_year = '${escapeSql(academicYear)}'
         AND B.academic_batch = '${escapeSql(academicBatch)}' AND B.academic_type = '${escapeSql(academicBatch)}'
         AND B.current_year = '${escapeSql(currentYear)}'
       ORDER BY P.student_name ASC, P.student_initial ASC`,
    );

    students = rows.map((row) => ({
      studentId: String(row.student_id),
      registerNo: row.register_no,
      name: `${row.student_name || ''} ${row.student_initial || ''}`.trim(),
      profileAmount: row.acmec_amount || '',
      amount: Number(row.approved_amount) || 0,
    }));
  }

  return {
    courseGroups,
    courseOptions,
    classOptions,
    selected: { courseKey, courseId, academicYear, currentYear, academicBatch },
    students,
    enrolledCount,
    loaded: loadStudents,
  };
}

export async function saveAcmecScholarshipSetup(payload = {}, memberId = '', audit = {}) {
  const { courseId, academicYear, academicBatch } = resolveCourseKey(payload);
  const currentYear = String(payload.currentYear || '').trim();
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  if (!courseId || !academicYear || !currentYear) {
    return { error: 'courseKey and currentYear are required' };
  }

  await prisma.$executeRawUnsafe(
    `UPDATE student_fee_acmec SET del = 0, updated_by = '${escapeSql(memberId)}',
     updated_ip = '${escapeSql(audit.ip || '')}', updated_dt = NOW()
     WHERE del = 1 AND course_id = '${escapeSql(courseId)}' AND academic_year = '${escapeSql(academicYear)}'
       AND academic_batch = '${escapeSql(academicBatch)}' AND current_year = '${escapeSql(currentYear)}'`,
  );

  let saved = 0;
  for (const row of rows) {
    const studentId = String(row.studentId || '').trim();
    const amount = String(row.amount ?? '').trim();
    if (!studentId || !amount) continue;

    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM student_fee_acmec WHERE del = 0 AND course_id = '${escapeSql(courseId)}'
       AND academic_year = '${escapeSql(academicYear)}' AND academic_batch = '${escapeSql(academicBatch)}'
       AND current_year = '${escapeSql(currentYear)}' AND s_id = '${escapeSql(studentId)}' LIMIT 1`,
    );
    const rid = existing[0]?.id;

    if (rid) {
      await prisma.$executeRawUnsafe(
        `UPDATE student_fee_acmec SET course_id='${escapeSql(courseId)}', academic_year='${escapeSql(academicYear)}',
         academic_batch='${escapeSql(academicBatch)}', current_year='${escapeSql(currentYear)}',
         s_id='${escapeSql(studentId)}', s_amount='${escapeSql(amount)}', del=1,
         updated_by='${escapeSql(memberId)}', updated_ip='${escapeSql(audit.ip || '')}', updated_dt=NOW()
         WHERE id=${Number(rid)}`,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO student_fee_acmec (course_id, academic_year, academic_batch, current_year, s_id, s_amount,
         received_date, del, created_dt, created_ip, created_by)
         VALUES ('${escapeSql(courseId)}', '${escapeSql(academicYear)}', '${escapeSql(academicBatch)}',
         '${escapeSql(currentYear)}', '${escapeSql(studentId)}', '${escapeSql(amount)}', CURDATE(), 1,
         NOW(), '${escapeSql(audit.ip || '')}', '${escapeSql(memberId)}')`,
      );
    }
    saved += 1;
  }

  await logFeeSetup(PAGE, 'Update', 'Successful', `${courseId}__${academicYear}__${currentYear}`, memberId, audit);
  return {
    success: true,
    saved,
    message: 'Your details are Updated...',
    ...(await loadAcmecScholarshipSetup({
      courseKey: `${courseId}___${academicYear}___${academicBatch}`,
      currentYear,
    })),
  };
}
