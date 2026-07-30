import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';

/**
 * Legacy searchByRollNo parity (student_profile_edit_more.php).
 */
export async function searchStudents({ by, q, studentId, partial = false }) {
  let sql = '';

  if (by === 'roll' && q) {
    // `partial` allows a fragment (min 3 chars) to match anywhere in the register no,
    // instead of requiring the full exact value — used where staff are picking one
    // student from a live search rather than pasting an exact known register no.
    const rolls = q.split(',').map((s) => s.trim()).filter((s) => (partial ? s.length >= 3 : s));
    if (!rolls.length) return [];
    const clauses = partial
      ? rolls.map((r) => `register_no LIKE '%${escapeSql(r)}%'`).join(' OR ')
      : rolls.map((r) => `register_no='${escapeSql(r)}'`).join(' OR ');
    sql = `SELECT id, admission_no, academic_year, register_no, student_name, student_initial, course_id
      FROM student_profile_tb WHERE del=1 AND (${clauses})
      ORDER BY student_name ASC, student_initial ASC${partial ? ' LIMIT 25' : ''}`;
  } else if (by === 'batch' && q) {
    const [courseId, admissionYear] = q.split('___');
    if (!courseId || !admissionYear) return [];
    sql = `SELECT id, admission_no, academic_year, register_no, student_name, student_initial, course_id
      FROM student_profile_tb WHERE del=1 AND course_id='${escapeSql(courseId)}'
      AND academic_year='${escapeSql(admissionYear)}'
      ORDER BY student_name ASC, student_initial ASC`;
  } else {
    return [];
  }

  const rows = await prisma.$queryRawUnsafe(sql);
  const selectedId = studentId ? Number(studentId) : null;

  return rows.map((row, index) => ({
    id: Number(row.id),
    admissionNo: row.admission_no,
    academicYear: row.academic_year,
    registerNo: row.register_no,
    name: `${row.student_name || ''} ${row.student_initial || ''}`.trim(),
    courseId: row.course_id,
    selected: (index === 0 && !selectedId) || selectedId === Number(row.id),
  }));
}
