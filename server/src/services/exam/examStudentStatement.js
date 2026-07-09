import { prisma } from '../../config/prisma.js';
import { buildExamStudentStatementHtml } from './examStudentStatementCore.js';

/** Legacy: student/exam_statement.php */
export async function loadExamStudentStatement(_memberId, registerNo, fields = {}) {
  const roll = String(registerNo || '').trim();
  if (!roll) {
    return { error: 'Register number is required' };
  }

  const student = await prisma.student_profile_tb.findFirst({
    where: { del: 1, register_no: roll },
    select: { id: true, register_no: true, student_name: true, student_initial: true },
  });
  if (!student) {
    return { error: 'Student not found' };
  }

  const result = await buildExamStudentStatementHtml(roll, fields || {});
  if (result.error) return result;

  return {
    ...result,
    student: {
      registerNo: student.register_no,
      name: `${student.student_name || ''} ${student.student_initial || ''}`.trim(),
    },
  };
}
