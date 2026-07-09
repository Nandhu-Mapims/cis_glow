import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';

export async function getStudentFeeHistory(registerNo) {
  const roll = String(registerNo || '').trim();
  if (!roll) {
    return { error: 'registerNo is required' };
  }

  const studentRows = await prisma.$queryRawUnsafe(
    `SELECT id, register_no, student_name, student_initial, course_id, academic_year
     FROM student_profile_tb WHERE del = 1 AND register_no = '${escapeSql(roll)}' LIMIT 1`,
  );
  if (!studentRows.length) {
    return { error: 'Student not found' };
  }
  const student = studentRows[0];

  const courseRows = await prisma.$queryRawUnsafe(
    `SELECT degree_name, department_name FROM basic_setup_course_tb
     WHERE del = 1 AND id = ${Number(student.course_id)} LIMIT 1`,
  );
  const course = courseRows[0] || {};

  const fees = await prisma.$queryRawUnsafe(
    `SELECT id, receipt_no, CAST(paid_date AS CHAR) AS paid_date, fee_name, fee_amount,
            total_amount, amount_type, payment_no, discount_amount, fine_amount
     FROM student_fee
     WHERE del = 1 AND register_no = '${escapeSql(roll)}'
     ORDER BY paid_date DESC, id DESC
     LIMIT 500`,
  );

  const receipts = {};
  fees.forEach((row) => {
    const key = row.receipt_no;
    if (!receipts[key]) {
      receipts[key] = {
        receiptNo: row.receipt_no,
        paidDate: row.paid_date,
        amountType: row.amount_type,
        lines: [],
        total: 0,
      };
    }
    const amount = Number(row.total_amount || row.fee_amount || 0);
    receipts[key].lines.push({
      id: Number(row.id),
      feeName: row.fee_name,
      feeAmount: row.fee_amount,
      totalAmount: row.total_amount,
      paymentNo: row.payment_no,
      discountAmount: row.discount_amount,
      fineAmount: row.fine_amount,
    });
    receipts[key].total += amount;
  });

  return {
    student: {
      registerNo: student.register_no,
      name: `${student.student_name || ''} ${student.student_initial || ''}`.trim(),
      academicYear: student.academic_year,
      courseLabel: `${course.degree_name || ''}${course.department_name ? ` - ${course.department_name}` : ''}`.trim(),
    },
    receipts: Object.values(receipts),
    lineCount: fees.length,
  };
}
