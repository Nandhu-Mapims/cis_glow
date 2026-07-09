import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { loadCourseYearGroups, parseCourseKey } from './setup/feeCourseYearGroups.js';

function formatDisplayDate(value) {
  const raw = String(value || '').slice(0, 10);
  if (!raw || raw.startsWith('0000')) return '';
  const [y, m, d] = raw.split('-');
  return `${d}-${m}-${y}`;
}

export async function loadDmeSetup(fields = {}) {
  const courseGroups = await loadCourseYearGroups();
  const courseOptions = courseGroups.flatMap((group) => group.options);
  const { courseKey, courseId, academicYear, academicBatch } = parseCourseKey(fields.courseKey);

  let students = [];
  if (courseId && academicYear) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT P.id AS student_id, P.register_no, P.student_name, P.student_initial,
              CAST(P.tf_receipt_date AS CHAR) AS tf_receipt_date,
              P.tf_receipt_no, P.tf_amount,
              COALESCE(D.s_amount, 0) AS approved_amount
       FROM student_profile_tb AS P
       INNER JOIN student_academic_tb AS A
         ON A.s_id = P.id
         AND A.del = 1
         AND A.course_id = '${escapeSql(courseId)}'
         AND A.academic_year = '${escapeSql(academicYear)}'
         AND A.academic_batch = '${escapeSql(academicBatch)}'
       LEFT JOIN student_fee_dme AS D
         ON D.del = 1
         AND D.s_id = P.id
         AND D.course_id = '${escapeSql(courseId)}'
         AND D.academic_year = '${escapeSql(academicYear)}'
         AND D.academic_batch = '${escapeSql(academicBatch)}'
         AND D.current_year = '1'
       WHERE P.del = 1
       ORDER BY P.student_name ASC, P.student_initial ASC`,
    );

    students = rows.map((row) => ({
      studentId: String(row.student_id),
      registerNo: row.register_no,
      name: `${row.student_name || ''} ${row.student_initial || ''}`.trim(),
      receiptNo: row.tf_receipt_no || '',
      receiptDate: formatDisplayDate(row.tf_receipt_date),
      receiptAmount: Number(row.tf_amount) || 0,
      amount: Number(row.approved_amount) || 0,
    }));
  }

  return {
    courseGroups,
    courseOptions,
    selected: { courseKey, courseId, academicYear, academicBatch },
    currentYear: '1',
    students,
  };
}

export async function saveDmeSetup(payload = {}, memberId = '', audit = {}) {
  const { courseId, academicYear, academicBatch } = parseCourseKey(payload.courseKey);
  const currentYear = '1';
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  if (!courseId || !academicYear) {
    return { error: 'courseKey is required' };
  }

  await prisma.$executeRawUnsafe(
    `UPDATE student_fee_dme
     SET del = 0,
         updated_by = '${escapeSql(memberId || 'system')}',
         updated_ip = '${escapeSql(audit.ip || '')}',
         updated_dt = NOW()
     WHERE del = 1
       AND course_id = '${escapeSql(courseId)}'
       AND academic_year = '${escapeSql(academicYear)}'
       AND academic_batch = '${escapeSql(academicBatch)}'
       AND current_year = '${escapeSql(currentYear)}'`,
  );

  let saved = 0;
  for (const row of rows) {
    const studentId = String(row.studentId || '').trim();
    const amount = Number(row.amount) || 0;
    if (!studentId || amount <= 0) continue;

    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM student_fee_dme
       WHERE del = 0
         AND course_id = '${escapeSql(courseId)}'
         AND academic_year = '${escapeSql(academicYear)}'
         AND academic_batch = '${escapeSql(academicBatch)}'
         AND current_year = '${escapeSql(currentYear)}'
         AND s_id = '${escapeSql(studentId)}'
       LIMIT 1`,
    );

    if (existing[0]?.id) {
      await prisma.$executeRawUnsafe(
        `UPDATE student_fee_dme
         SET s_amount = '${escapeSql(amount)}',
             del = 1,
             updated_by = '${escapeSql(memberId || 'system')}',
             updated_ip = '${escapeSql(audit.ip || '')}',
             updated_dt = NOW()
         WHERE id = '${escapeSql(existing[0].id)}'`,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO student_fee_dme
          (course_id, academic_year, academic_batch, current_year, s_id, s_amount, del, created_dt, created_ip, created_by)
         VALUES
          ('${escapeSql(courseId)}', '${escapeSql(academicYear)}', '${escapeSql(academicBatch)}', '${escapeSql(currentYear)}',
           '${escapeSql(studentId)}', '${escapeSql(amount)}', 1, NOW(), '${escapeSql(audit.ip || '')}', '${escapeSql(memberId || 'system')}')`,
      );
    }
    saved += 1;
  }

  return { success: true, saved };
}
