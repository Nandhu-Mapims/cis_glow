import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';

/**
 * Legacy searchByRollNo parity (student_profile_edit_more.php).
 */
export async function searchStudents({ by, q, studentId }) {
  let sql = '';

  if (by === 'roll' && q) {
    const rolls = q.split(',').map((s) => s.trim()).filter(Boolean);
    if (!rolls.length) return [];
    const clauses = rolls.map((r) => `register_no='${escapeSql(r)}'`).join(' OR ');
    sql = `SELECT id, admission_no, academic_year, register_no, student_name, student_initial, course_id
      FROM student_profile_tb WHERE del=1 AND (${clauses})
      ORDER BY student_name ASC, student_initial ASC`;
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
