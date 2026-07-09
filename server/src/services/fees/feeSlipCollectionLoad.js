import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { studentIdCardPhotoUrl } from '../students/studentShared.js';
import {
  convertNYear,
  hostelFeeMatch,
  roomFeeString,
  titleCaseName,
} from './feeHelpers.js';
import { loadStudentFeeContext } from './feeStudentContext.js';

async function computeFine(refCourseName, stuYear, stuBatch, stuType, stuClass, refFeeType, paidDateRef, lastPaidDate) {
  const fineRows = await prisma.$queryRawUnsafe(
    `SELECT CAST(fee_due_date AS CHAR) AS fee_due_date, fee_fine_amount, fee_fine_type
     FROM fee_fine_master
     WHERE del = 1 AND course_name = '${escapeSql(refCourseName)}'
       AND academic_year = '${escapeSql(stuYear)}' AND academic_batch = '${escapeSql(stuBatch)}'
       AND academic_type = '${escapeSql(stuType)}' AND class_year = '${escapeSql(stuClass)}'
       AND fee_type = '${escapeSql(refFeeType)}'
       AND CAST(fee_due_date AS CHAR) NOT LIKE '0000-00-00%'
     LIMIT 1`,
  );
  const fine = fineRows[0];
  if (!fine?.fee_due_date || !fine.fee_fine_amount) return 0;
  const dueTs = new Date(fine.fee_due_date).getTime();
  if (Number.isNaN(dueTs)) return 0;
  if (paidDateRef <= dueTs) return 0;
  let totalFine = Number(fine.fee_fine_amount) || 0;
  if (fine.fee_fine_type !== 'one_time') {
    let start = dueTs;
    const end = paidDateRef;
    if (lastPaidDate && lastPaidDate > start) start = lastPaidDate;
    const days = Math.ceil(Math.abs(end - start) / 86400000);
    if (days > 0) totalFine *= days;
  }
  return totalFine;
}

export async function loadCollectionSheet(registerNo, paidDateIso, options = {}) {
  const { skipPhoto = false, pendingOnly = false, shared = {} } = options;
  const ctx = await loadStudentFeeContext(registerNo, paidDateIso, shared);
  if (ctx.error) return ctx;

  const {
    student, course, feeLabels, feeScholarArray, paidDateRef, roomId, roomType,
    academicYearRef, classArrayString, scFeeAmount, admissionYear,
    academicSearchString, academicSearchString1,
  } = ctx;

  if (!academicSearchString1) {
    return { error: 'No pending fee rows for this student.' };
  }

  const studentName = titleCaseName(student.student_name, student.student_initial);
  const courseLabel = [course.degree_name, course.department_name].filter(Boolean).join(' ').trim();
  const photoUrl = skipPhoto ? '' : await studentIdCardPhotoUrl(student.register_no);
  const entries = [];
  const feeTypes = new Set();
  const feeTypeTabs = [];
  const feeTypeTabIds = new Set();
  let feeCounter = 0;
  let paymentMap = null;
  const fineCache = new Map();

  if (pendingOnly) {
    const allPaidRows = await prisma.$queryRawUnsafe(
      `SELECT fee_id, academic_year, academic_batch, CAST(paid_date AS CHAR) AS paid_date, fee_amount
       FROM student_fee
       WHERE del = 1 AND register_no = '${escapeSql(student.register_no)}'
       ORDER BY paid_date ASC`,
    );
    paymentMap = new Map();
    for (const paidRow of allPaidRows) {
      const key = `${paidRow.fee_id}|${paidRow.academic_year}|${paidRow.academic_batch}`;
      if (!paymentMap.has(key)) paymentMap.set(key, []);
      paymentMap.get(key).push(paidRow);
    }
  }

  const getPaidRows = async (feeId, stuYear, stuBatch) => {
    if (paymentMap) {
      return paymentMap.get(`${feeId}|${stuYear}|${stuBatch}`) || [];
    }
    return prisma.$queryRawUnsafe(
      `SELECT CAST(paid_date AS CHAR) AS paid_date, fee_amount FROM student_fee
       WHERE del = 1 AND fee_id = '${escapeSql(feeId)}'
         AND academic_year = '${escapeSql(stuYear)}' AND academic_batch = '${escapeSql(stuBatch)}'
         AND register_no = '${escapeSql(student.register_no)}'
       ORDER BY paid_date ASC`,
    );
  };

  const getFine = async (stuYear, stuBatch, stuType, stuClass, refFeeType, lastPaidDate = 0) => {
    const cacheKey = `${stuYear}|${stuBatch}|${stuType}|${stuClass}|${refFeeType}|${lastPaidDate}`;
    if (fineCache.has(cacheKey)) return fineCache.get(cacheKey);
    const fine = await computeFine(
      course.course_name, stuYear, stuBatch, stuType, stuClass, refFeeType, paidDateRef, lastPaidDate,
    );
    fineCache.set(cacheKey, fine);
    return fine;
  };

  const typeRows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT(A.fee_type), B.fee_id, B.fee_type AS fee_type_name
     FROM fee_name_master AS A
     INNER JOIN fee_type_master AS B ON A.fee_type = B.id
     WHERE A.del = 1 AND A.course_id = '${escapeSql(student.course_id)}' ${academicSearchString1}
     ORDER BY B.fee_order ASC, A.fee_order ASC`,
  );

  for (const typeRow of typeRows) {
    const refFeeType = typeRow.fee_type;
    const refFeeTypeId = String(refFeeType);
    feeTypes.add(refFeeTypeId);
    if (!feeTypeTabIds.has(refFeeTypeId)) {
      feeTypeTabIds.add(refFeeTypeId);
      feeTypeTabs.push({
        id: refFeeTypeId,
        name: typeRow.fee_type_name || `Fee type ${refFeeTypeId}`,
      });
    }

    for (const [stuClass, batchMap] of Object.entries(classArrayString)) {
      for (const [stuBatch, yearMap] of Object.entries(batchMap)) {
        for (const [stuYear, stuType] of Object.entries(yearMap)) {
          const refTotalFine = await getFine(stuYear, stuBatch, stuType, stuClass, refFeeType);

          const academicFilter = ` AND (admission_year='${escapeSql(admissionYear)}' AND class_year='${escapeSql(stuClass)}' AND (academic_type='${escapeSql(stuType)}' OR academic_type LIKE '${escapeSql(stuType)},%' OR academic_type LIKE '%,${escapeSql(stuType)}' OR academic_type LIKE '%,${escapeSql(stuType)},%' ))`;
          const feeRows = await prisma.$queryRawUnsafe(
            `SELECT id, fee_name, fee_amount, fee_scholarship, class_year, fee_bank, fee_order
             FROM fee_name_master
             WHERE del = 1 AND course_id = '${escapeSql(student.course_id)}' AND fee_type = '${escapeSql(refFeeType)}'
               ${academicSearchString} ${academicFilter} ${roomFeeString(roomType)}
             ORDER BY class_year ASC, fee_order ASC`,
          );

          for (const feeRow of feeRows) {
            let feeAmount = Number(String(feeRow.fee_amount || '').trim()) || 0;
            const feeAmount1 = feeAmount;
            const feeNameId = feeRow.fee_name;

            if (feeScholarArray.includes(String(feeNameId))) {
              const sc = scFeeAmount[stuYear]?.[feeRow.class_year]?.[stuBatch];
              if (sc) {
                if (!sc.amt1 && Number(feeRow.fee_scholarship) > 0) sc.amt += Number(feeRow.fee_scholarship);
                if (sc.amt > 0) {
                  const schAmt = sc.amt;
                  if (feeAmount >= schAmt) {
                    sc.amt = 0;
                    feeAmount -= schAmt;
                  } else {
                    sc.amt -= feeAmount;
                    feeAmount = 0;
                  }
                  if (feeAmount < 0) feeAmount = 0;
                }
              }
            }

            if (!hostelFeeMatch(feeLabels[feeNameId], roomId)) continue;

            const paidRows = await getPaidRows(feeRow.id, stuYear, stuBatch);
            let paidAmount = 0;
            let paymentNo = 0;
            let lastPaidDate = 0;
            paidRows.forEach((p) => {
              paidAmount += Number(p.fee_amount || 0);
              paymentNo += 1;
              lastPaidDate = new Date(p.paid_date).getTime();
            });

            let totalFine = refTotalFine;
            if (totalFine > 0 && paidRows.length) {
              totalFine = await getFine(stuYear, stuBatch, stuType, stuClass, refFeeType, lastPaidDate);
            }

            if (paidAmount < feeAmount) {
              const balance = feeAmount - paidAmount;
              const sectionLabel = `${convertNYear(stuClass, course.course_name)} Year | ${stuYear} | ${stuBatch}`;
              const feeNameLabel = feeLabels[feeNameId] || String(feeNameId);
              entries.push({
                index: feeCounter,
                status: 'pending',
                label: `${feeNameLabel} — ${sectionLabel}`,
                feeNameLabel,
                sectionKey: `${stuClass}|${stuYear}|${stuBatch}`,
                sectionLabel,
                feeType: refFeeTypeId,
                feeId: String(feeRow.id),
                feeName: String(feeNameId),
                feeBank: String(feeRow.fee_bank || ''),
                classYear: String(feeRow.class_year),
                academicYear: String(stuYear),
                academicBatch: String(stuBatch),
                paymentNo: String(paymentNo + 1),
                tfeeAmount: String(feeAmount),
                originalFeeAmount: String(feeAmount1),
                scholarshipDeducted: feeAmount1 !== feeAmount ? String(feeAmount1 - feeAmount) : '',
                balanceAmount: String(balance),
                feeFine: String(totalFine),
                feeAmount: String(balance),
                selected: false,
              });
              feeCounter += 1;
            } else if (!pendingOnly && academicYearRef === stuYear) {
              const sectionLabel = `${convertNYear(stuClass, course.course_name)} Year | ${stuYear} | ${stuBatch}`;
              const feeNameLabel = feeLabels[feeNameId] || String(feeNameId);
              entries.push({
                index: feeCounter,
                status: 'paid',
                label: `${feeNameLabel} — ${sectionLabel}`,
                feeNameLabel,
                sectionKey: `${stuClass}|${stuYear}|${stuBatch}`,
                sectionLabel,
                feeType: refFeeTypeId,
                feeId: String(feeRow.id),
                feeName: String(feeNameId),
                feeBank: String(feeRow.fee_bank || ''),
                classYear: String(feeRow.class_year),
                academicYear: String(stuYear),
                academicBatch: String(stuBatch),
                paymentNo: String(paymentNo),
                tfeeAmount: String(feeAmount),
                originalFeeAmount: String(feeAmount1),
                scholarshipDeducted: feeAmount1 !== feeAmount ? String(feeAmount1 - feeAmount) : '',
                balanceAmount: '0',
                feeFine: '0',
                feeAmount: '0',
                selected: false,
                disabled: true,
              });
              feeCounter += 1;
            }
          }
        }
      }
    }
  }

  const hasPending = entries.some((e) => e.status === 'pending');

  if (!entries.length) {
    return {
      studentName,
      registerNo: student.register_no,
      courseLabel,
      photoUrl,
      meta: {
        registerNo: student.register_no,
        courseId: String(student.course_id),
        admissionYear,
        feeCounter: 0,
      },
      entries: [],
      feeTypes: [],
      feeTypeTabs: [],
      message: 'No pending fee rows for this student.',
    };
  }

  return {
    studentName,
    registerNo: student.register_no,
    courseLabel,
    photoUrl,
    meta: {
      registerNo: student.register_no,
      courseId: String(student.course_id),
      admissionYear,
      feeCounter: entries.filter((e) => e.status === 'pending').length,
    },
    entries,
    feeTypes: [...feeTypes],
    feeTypeTabs,
    message: hasPending ? undefined : 'All fees for the current academic year are paid.',
  };
}
