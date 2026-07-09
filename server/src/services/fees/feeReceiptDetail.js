import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { formatDisplayDate, loadFeeLabelMap, titleCaseName } from './feeHelpers.js';

export async function lookupReceiptDetail(receiptNo) {
  const receipt = String(receiptNo || '').trim().toUpperCase();
  if (!receipt) {
    return { error: 'receiptNo is required' };
  }

  const feeRows = await prisma.$queryRawUnsafe(
    `SELECT fee_name, amount, fee_amount, fine_amount, discount_amount, total_amount,
            register_no, CAST(paid_date AS CHAR) AS paid_date, receipt_no
     FROM student_fee
     WHERE del = 1 AND receipt_no = '${escapeSql(receipt)}'
     ORDER BY id ASC`,
  );

  if (!feeRows.length) {
    return { error: 'Requested receipt no can\'t be found...', allowed: false };
  }

  const { labels } = await loadFeeLabelMap(prisma);
  const registerNo = feeRows[0].register_no;
  const studentRows = await prisma.$queryRawUnsafe(
    `SELECT A.register_no, A.student_name, A.student_initial, A.academic_year,
            B.degree_name, B.department_name
     FROM student_profile_tb AS A
     INNER JOIN basic_setup_course_tb AS B ON A.course_id = B.id
     WHERE A.del = 1 AND B.del = 1 AND A.register_no = '${escapeSql(registerNo)}'
     LIMIT 1`,
  );

  if (!studentRows.length) {
    return { error: 'Student not found for receipt', allowed: false };
  }

  const student = studentRows[0];
  const feeLines = [];
  let totalAmount = 0;

  feeRows.forEach((row) => {
    const label = labels[row.fee_name] || row.fee_name;
    const amount = Number(row.fee_amount || row.amount || 0);
    feeLines.push({ label, amount });
    totalAmount += amount;
  });

  const dept = student.department_name && student.department_name !== '-'
    ? ` ${String(student.department_name).toUpperCase()}`
    : '';

  return {
    allowed: true,
    receipt: {
      receiptNo: feeRows[0].receipt_no,
      paidDate: formatDisplayDate(feeRows[0].paid_date),
      registerNo: student.register_no,
      studentName: titleCaseName(student.student_name, student.student_initial),
      courseLabel: `${String(student.degree_name || '').trim()}${dept} ${student.academic_year || ''}`.trim(),
      feeLines,
      totalAmount,
    },
  };
}
