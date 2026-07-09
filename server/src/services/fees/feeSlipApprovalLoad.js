import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { convertNYear, loadFeeLabelMap, titleCaseName } from './feeHelpers.js';
import { loadStudentFeeContext } from './feeStudentContext.js';

export async function loadApprovalSheet(groupId) {
  const id = String(groupId || '').trim();
  if (!id) return { error: 'groupId is required' };

  const slipRows = await prisma.$queryRawUnsafe(
    `SELECT register_no, group_id, slip_details, CAST(paid_date AS CHAR) AS paid_date, f_status
     FROM fee_slip_tb WHERE del = 1 AND group_id = '${escapeSql(id)}' LIMIT 1`,
  );
  if (!slipRows.length) return { error: 'Slip not found' };
  if (Number(slipRows[0].f_status) === 1) return { error: 'Slip already approved' };

  const registerNo = slipRows[0].register_no;
  const slipPaid = JSON.parse(slipRows[0].slip_details || '{}');
  const paidDateIso = String(slipRows[0].paid_date || '').slice(0, 10);

  const ctx = await loadStudentFeeContext(registerNo, paidDateIso);
  if (ctx.error) return ctx;

  const { student, course, feeLabels, classArrayString, admissionYear, academicYearRef } = ctx;
  const studentName = titleCaseName(student.student_name, student.student_initial);
  const entries = [];
  const feeTypes = new Set();
  let feeCounter = 0;
  let validationFailed = false;

  const typeRows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT(A.fee_type), B.fee_type AS fee_type_name
     FROM fee_name_master AS A
     INNER JOIN fee_type_master AS B ON A.fee_type = B.id
     WHERE A.del = 1 AND A.course_id = '${escapeSql(student.course_id)}'
     ORDER BY B.fee_order ASC, A.fee_order ASC`,
  );

  for (const typeRow of typeRows) {
    const refFeeType = String(typeRow.fee_type);
    const slipType = slipPaid[refFeeType];
    if (!slipType) continue;
    feeTypes.add(refFeeType);

    for (const [stuClass, batchMap] of Object.entries(classArrayString)) {
      for (const [stuBatch, yearMap] of Object.entries(batchMap)) {
        for (const [stuYear, stuType] of Object.entries(yearMap)) {
          const feeRows = await prisma.$queryRawUnsafe(
            `SELECT id, fee_name, fee_amount, class_year, fee_bank, fee_order
             FROM fee_name_master
             WHERE del = 1 AND course_id = '${escapeSql(student.course_id)}' AND fee_type = '${escapeSql(refFeeType)}'
               AND admission_year = '${escapeSql(admissionYear)}' AND class_year = '${escapeSql(stuClass)}'
               AND (academic_type = '${escapeSql(stuType)}' OR academic_type LIKE '${escapeSql(stuType)},%'
                    OR academic_type LIKE '%,${escapeSql(stuType)}' OR academic_type LIKE '%,${escapeSql(stuType)},%')
             ORDER BY class_year ASC, fee_order ASC`,
          );

          for (const feeRow of feeRows) {
            const slipLine = slipType[feeRow.id] || slipType[String(feeRow.id)];
            if (!slipLine || Number(slipLine.paid) <= 0) continue;

            const paidRows = await prisma.$queryRawUnsafe(
              `SELECT fee_amount FROM student_fee
               WHERE del = 1 AND fee_id = '${escapeSql(feeRow.id)}'
                 AND academic_year = '${escapeSql(stuYear)}' AND academic_batch = '${escapeSql(stuBatch)}'
                 AND register_no = '${escapeSql(registerNo)}'`,
            );
            let paidAmount = 0;
            paidRows.forEach((p) => { paidAmount += Number(p.fee_amount || 0); });
            const feeAmount = Number(String(feeRow.fee_amount || '').trim()) || 0;

            if (paidAmount < feeAmount) {
              const balance = Number(slipLine.balance);
              if (balance !== Number(feeAmount - paidAmount)) validationFailed = true;

              const label = `${feeLabels[feeRow.fee_name] || feeRow.fee_name} — ${convertNYear(stuClass, course.course_name)} Year | ${stuYear} | ${stuBatch}`;
              entries.push({
                index: feeCounter,
                label,
                feeType: refFeeType,
                feeId: String(feeRow.id),
                feeName: String(feeRow.fee_name),
                feeBank: String(feeRow.fee_bank || ''),
                classYear: String(feeRow.class_year),
                academicYear: String(stuYear),
                academicBatch: String(stuBatch),
                paymentNo: String(slipLine.payment || '1'),
                slipId: id,
                tfeeAmount: String(slipLine.fee ?? feeAmount),
                balanceAmount: String(slipLine.balance ?? balance),
                feeFine: String(slipLine.fee_fine || '0'),
                feeAmount: String(slipLine.paid),
                selected: true,
              });
              feeCounter += 1;
            } else if (academicYearRef === stuYear) {
              // paid line — skip
            }
          }
        }
      }
    }
  }

  if (validationFailed) {
    return { error: 'Slip cannot be approved — amounts may have changed' };
  }
  if (!entries.length) {
    return { error: 'Approval sheet not available for this slip' };
  }

  return {
    studentName,
    registerNo,
    groupId: id,
    meta: {
      registerNo,
      courseId: String(student.course_id),
      admissionYear,
      feeCounter: entries.length,
      slipGroup: id,
    },
    entries,
    feeTypes: [...feeTypes],
  };
}
