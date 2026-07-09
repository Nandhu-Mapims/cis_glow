import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { loadCourseYearGroups, parseCourseKey } from './setup/feeCourseYearGroups.js';

function parseSelection(fields = {}) {
  const parsed = parseCourseKey(fields.courseKey);
  if (parsed.courseKey) return parsed;
  return {
    courseKey: fields.courseId && fields.academicYear
      ? `${fields.courseId}___${fields.academicYear}___${fields.academicBatch || 'regular'}`
      : '',
    courseId: String(fields.courseId || '').trim(),
    academicYear: String(fields.academicYear || '').trim(),
    academicBatch: String(fields.academicBatch || 'regular').trim().toLowerCase(),
  };
}

export async function loadScholarshipSetup(fields = {}) {
  const courseGroups = await loadCourseYearGroups();
  const courseOptions = courseGroups.flatMap((group) => group.options);
  const { courseKey, courseId, academicYear, academicBatch } = parseSelection(fields);
  const currentYear = String(fields.currentYear || '').trim();
  const loadStudents = fields.loadStudents === true || fields.Submit === 'Go';

  let classOptions = [];
  let students = [];

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
    const rows = await prisma.$queryRawUnsafe(
      `SELECT P.id AS student_id, P.register_no, P.student_name, P.student_initial,
              P.first_graduate, P.caste_scholar_ship,
              COALESCE(S.s_amount, 0) AS s_amount
       FROM student_profile_tb AS P
       INNER JOIN student_academic_tb AS A ON A.s_id = P.id
       LEFT JOIN student_fee_scholarship AS S
         ON S.del = 1
         AND S.s_id = P.id
         AND S.course_id = '${escapeSql(courseId)}'
         AND S.academic_year = '${escapeSql(academicYear)}'
         AND S.academic_batch = '${escapeSql(academicBatch)}'
         AND S.current_year = '${escapeSql(currentYear)}'
       WHERE P.del = 1
         AND A.del = 1
         AND A.course_id = '${escapeSql(courseId)}'
         AND A.academic_year = '${escapeSql(academicYear)}'
         AND A.academic_batch = '${escapeSql(academicBatch)}'
         AND A.academic_type = '${escapeSql(academicBatch)}'
         AND A.current_year = '${escapeSql(currentYear)}'
         AND P.scholar_ship = 1
         AND (P.caste_scholar_ship LIKE 's%' OR P.first_graduate = 1)
       ORDER BY P.caste_scholar_ship DESC, P.first_graduate DESC, P.student_name ASC, P.student_initial ASC`,
    );

    students = rows.map((row) => ({
      studentId: String(row.student_id),
      registerNo: row.register_no,
      name: `${row.student_name || ''} ${row.student_initial || ''}`.trim(),
      scholarshipType: `${String(row.caste_scholar_ship || '').toUpperCase()}${Number(row.first_graduate) === 1 ? `${row.caste_scholar_ship ? ', ' : ''}First Graduate` : ''}`,
      amount: Number(row.s_amount) || 0,
    }));
  }

  return {
    courseGroups,
    courseOptions,
    classOptions,
    selected: { courseKey, courseId, academicYear, currentYear, academicBatch },
    students,
    loaded: Boolean(loadStudents && courseId && academicYear && currentYear),
  };
}

export async function saveScholarshipSetup(payload = {}, memberId = '', audit = {}) {
  const { courseId, academicYear, academicBatch } = parseSelection(payload);
  const currentYear = String(payload.currentYear || '').trim();
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  if (!courseId || !academicYear || !currentYear) {
    return { error: 'courseId, academicYear and currentYear are required' };
  }

  await prisma.$executeRawUnsafe(
    `UPDATE student_fee_scholarship
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

    await prisma.$executeRawUnsafe(
      `INSERT INTO student_fee_scholarship
        (course_id, academic_year, academic_batch, current_year, s_id, s_amount, del, created_dt, created_ip, created_by)
       VALUES
        ('${escapeSql(courseId)}', '${escapeSql(academicYear)}', '${escapeSql(academicBatch)}', '${escapeSql(currentYear)}',
         '${escapeSql(studentId)}', '${escapeSql(amount)}', 1, NOW(), '${escapeSql(audit.ip || '')}', '${escapeSql(memberId || 'system')}')
       ON DUPLICATE KEY UPDATE
         s_amount = VALUES(s_amount),
         del = 1,
         updated_by = '${escapeSql(memberId || 'system')}',
         updated_ip = '${escapeSql(audit.ip || '')}',
         updated_dt = NOW()`,
    );
    saved += 1;
  }

  const reload = await loadScholarshipSetup({
    courseKey: `${courseId}___${academicYear}___${academicBatch}`,
    currentYear,
    loadStudents: true,
  });

  return { success: true, saved, message: 'Your details are added...', ...reload };
}
