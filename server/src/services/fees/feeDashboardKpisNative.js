import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';

/**
 * Native rewrite of legacy-bridge/fee_dashboard_kpis.php, which worked by including
 * the live legacy fee_dashboard_v2.php (1144 lines) and regex-scraping specific
 * numbers out of its rendered HTML. This reimplements that file's callYear($acyear,
 * $cur_date) function (~fee_dashboard_v2.php lines 78-684) directly against the DB.
 *
 * NOTE ON VERIFICATION: this is a faithful line-by-line translation of unusually
 * dense, deeply-nested legacy PHP (per-student x per-fee-type fee applicability with
 * room-type exclusions, caste-based scholarship matching, DME/ACMEC year-1 special
 * casing, sequential scholarship deduction across fee items). It has NOT been
 * verified against known-correct production numbers - there is no pending/unpaid
 * fee data in the dev DB this was built against to compare against. Before trusting
 * these figures in production, compare them against the live legacy fee dashboard
 * for at least one real academic year with real students.
 */

const ROOM_TYPE_FEE_EXCLUSIONS = {
  55: ['8', '24', '25'],
  56: ['23', '24', '25'],
  57: ['8', '24', '23'],
  58: ['8', '23', '25'],
};

function num(value) {
  return Number(value) || 0;
}

async function loadFeeCategoryArray(courseId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT A.fee_type, B.fee_id, B.fee_type AS fee_type_name
     FROM fee_name_master AS A
     INNER JOIN fee_type_master AS B ON A.fee_type = B.id
     WHERE A.del = 1
     ORDER BY B.fee_order ASC, A.fee_order ASC`,
  );
  const feeCategoryArray = new Map(); // fee_type id -> fee_type name
  const hostelTypes = new Set();
  const examTypes = new Set();
  const stationaryTypes = new Set();
  for (const row of rows) {
    const typeName = row.fee_type_name || '';
    feeCategoryArray.set(String(row.fee_type), typeName);
    const lower = typeName.toLowerCase();
    if (lower.includes('hostel')) hostelTypes.add(typeName);
    else if (lower.includes('examination')) examTypes.add(typeName);
    else if (lower.includes('stationary')) stationaryTypes.add(typeName);
  }
  return {
    feeCategoryArray, hostelTypes, examTypes, stationaryTypes,
  };
}

async function loadScholarFeeLabelIds() {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT id FROM fee_label_master WHERE del = 1 AND is_scholar = 1 ORDER BY fee_order ASC",
  );
  return new Set(rows.map((row) => String(row.id)));
}

/** fee_name ids to exclude when a student has no hostel room assigned - lines ~204-211. */
async function loadHostelExceptFeeNameIds() {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT id FROM fee_label_master WHERE del = 1 AND fee_name LIKE 'hostel%' ORDER BY fee_order ASC",
  );
  return rows.map((row) => String(row.id));
}

function categoryBucketFor(typeName, hostelTypes, examTypes, stationaryTypes) {
  if (hostelTypes.has(typeName)) return 'hostel';
  if (examTypes.has(typeName)) return 'exam';
  if (stationaryTypes.has(typeName)) return 'stationary';
  return 'other';
}

/**
 * Fee applicable to a single student for a single fee_type, honoring room-type
 * exclusions and caste/scholarship eligibility - fee_dashboard_v2.php lines ~339-402.
 */
async function computeStudentFeeType({
  courseId, ftype, academicYear, admissionYear, cyear, admissionSource,
  studentScholar, studentScholarCom, roomTypeCode, scholarFeeLabelIds, hostelExceptFeeNameIds,
}) {
  let castSql;
  if (studentScholar === 1 && studentScholarCom) {
    const c = escapeSql(String(studentScholarCom));
    castSql = ` AND (fee_caste='' OR
      (fee_include!='except' AND (fee_caste='${c}' OR fee_caste LIKE '${c},%' OR fee_caste LIKE '%,${c}' OR fee_caste LIKE '%,${c},%')) OR
      (fee_include='except' AND fee_caste!='${c}' AND fee_caste NOT LIKE '${c},%' AND fee_caste NOT LIKE '%,${c}' AND fee_caste NOT LIKE '%,${c},%'))`;
  } else {
    castSql = " AND (fee_caste='' OR (fee_include='except' AND fee_caste!=''))";
  }

  const roomExclusionIds = ROOM_TYPE_FEE_EXCLUSIONS[Number(roomTypeCode)];
  const roomFeeSql = roomExclusionIds
    ? ` AND (fee_name NOT IN (${roomExclusionIds.map((id) => `'${id}'`).join(',')}))`
    : '';
  // No hostel room assigned: exclude hostel-labeled fees entirely (line ~347-348).
  const hostelExceptSql = (!roomTypeCode && hostelExceptFeeNameIds.length)
    ? hostelExceptFeeNameIds.map((id) => ` AND fee_name!='${id}'`).join('')
    : '';

  const academicSql = ` AND (admission_year='${escapeSql(admissionYear)}' AND class_year='${escapeSql(String(cyear))}'
    AND (academic_type='${escapeSql(academicYear.academicType)}' OR academic_type LIKE '${escapeSql(academicYear.academicType)},%'
      OR academic_type LIKE '%,${escapeSql(academicYear.academicType)}' OR academic_type LIKE '%,${escapeSql(academicYear.academicType)},%'))
    AND (fee_for='${escapeSql(admissionSource)}' OR fee_for='')`;

  const rows = await prisma.$queryRawUnsafe(
    `SELECT SUM(fee_amount) AS total, GROUP_CONCAT(id SEPARATOR ',') AS ids,
            GROUP_CONCAT(fee_name SEPARATOR ',') AS fee_names,
            GROUP_CONCAT(fee_amount SEPARATOR ',') AS fee_amounts
     FROM fee_name_master
     WHERE del = 1 AND course_id = '${escapeSql(String(courseId))}' AND fee_type = '${escapeSql(String(ftype))}'
       ${academicSql}${roomFeeSql}${castSql}${hostelExceptSql}`,
  );
  const row = rows[0] || {};
  const feeIds = String(row.ids || '').split(',').filter(Boolean);
  const feeNames = String(row.fee_names || '').split(',');
  const feeAmounts = String(row.fee_amounts || '').split(',').map(num);

  let scholarshipEligibleAmount = 0;
  feeNames.forEach((feeNameId, index) => {
    if (scholarFeeLabelIds.has(feeNameId)) {
      scholarshipEligibleAmount += feeAmounts[index] || 0;
    }
  });

  return {
    total: num(row.total),
    feeIds,
    scholarshipEligibleAmount,
    scholarshipEligibleByFeeId: feeIds.map((id, i) => ({
      feeNameId: feeNames[i], amount: feeAmounts[i] || 0, isScholar: scholarFeeLabelIds.has(feeNames[i]),
    })),
  };
}

async function computeStudentPaid({
  registerNo, feeIds, academicYear, curDate, academicBatch,
}) {
  if (!feeIds.length) return 0;
  const feeIdSql = feeIds.map((id) => `fee_id='${escapeSql(id)}'`).join(' OR ');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT SUM(fee_amount) AS total FROM student_fee
     WHERE del = 1 AND register_no = '${escapeSql(registerNo)}' AND (${feeIdSql})
       AND academic_year = '${escapeSql(academicYear)}' AND paid_date <= '${escapeSql(curDate)}'
       AND academic_batch = '${escapeSql(academicBatch)}'`,
  );
  return num(rows[0]?.total);
}

/** fee_dashboard_v2.php callYear() — returns the accumulator totals this module needs. */
export async function callYear(acYear, curDate) {
  const { feeCategoryArray, hostelTypes, examTypes, stationaryTypes } = await loadFeeCategoryArray();
  const scholarFeeLabelIds = await loadScholarFeeLabelIds();
  const hostelExceptFeeNameIds = await loadHostelExceptFeeNameIds();

  const totals = {
    total: 0, paid: 0, unpaid: 0, cUnpaid: 0, hUnpaid: 0, examUnpaid: 0, sriUnpaid: 0,
    scholarship: 0, scholarshipReceived: 0, dmefee: 0, dmefeeReceived: 0, acmecfee: 0, acmecfeeReceived: 0,
  };

  const courseBatches = [
    { courseName: 'U.G', batch: 'regular' },
    { courseName: 'U.G', batch: 'additional' },
    { courseName: 'P.G', batch: 'regular' },
  ];

  for (const { courseName, batch } of courseBatches) {
    const courses = await prisma.$queryRawUnsafe(
      `SELECT id, course_duration FROM basic_setup_course_tb WHERE del = 1 AND course_name = '${escapeSql(courseName)}' ORDER BY c_order ASC`,
    );

    for (const course of courses) {
      const courseId = course.id;
      const duration = Number(course.course_duration) || 0;

      for (let cyear = 1; cyear <= duration; cyear += 1) {
        const students = await prisma.$queryRawUnsafe(
          `SELECT A.id, A.register_no, A.academic_year AS adm_year, A.admission_source, A.scholar_ship, A.caste_scholar_ship,
                  A.first_graduate, A.tf_amount, A.acmec_amount
           FROM student_profile_tb AS A
           INNER JOIN student_academic_tb AS B ON A.id = B.s_id
           WHERE A.del = 1 AND A.course_id = '${escapeSql(String(courseId))}'
             AND B.del = 1 AND B.course_id = '${escapeSql(String(courseId))}'
             AND B.academic_year = '${escapeSql(acYear)}' AND B.current_year = '${escapeSql(String(cyear))}'
             AND B.academic_batch = '${escapeSql(batch)}'`,
        );

        // Per course/year accumulators feeding the h/exam/sri/other totals & fee-pending.
        const yearBuckets = { other: { fee: 0, paid: 0 }, hostel: { fee: 0, paid: 0 }, exam: { fee: 0, paid: 0 }, stationary: { fee: 0, paid: 0 } };
        let yearScholarshipApplied = 0;
        let yearDmeFallback = 0; // tpaid_total: student.tf_amount fallback (no explicit dme record)
        let yearDmeReceived = 0; // trpaid_total: explicit student_fee_dme record
        let yearAcmecFallback = 0; // acpaid_total
        let yearAcmecReceived = 0; // acrpaid_total

        for (const student of students) {
          const academicRows = await prisma.$queryRawUnsafe(
            `SELECT academic_year, academic_type FROM student_academic_tb
             WHERE del = 1 AND s_id = '${escapeSql(String(student.id))}' AND course_id = '${escapeSql(String(courseId))}'
               AND current_year = '${escapeSql(String(cyear))}' AND academic_batch = '${escapeSql(batch)}'
             ORDER BY academic_year DESC`,
          );
          const academicTypeByYear = new Map(academicRows.map((row) => [row.academic_year, row.academic_type]));
          const studentActype = academicTypeByYear.get(acYear);
          if (!studentActype) continue; // matches PHP: `if ($stu_final_actype) {`

          const studentScholar = num(student.scholar_ship);
          const studentScholarCom = num(student.first_graduate) === 1 ? 'firstgraduate' : student.caste_scholar_ship;

          // Scholarship / DME / ACMEC per-student special amounts (lines 309-330).
          let tfFeeAmount = 0; let tfFeeAmount1 = 0;
          let acmecFeeAmount = 0; let acmecFeeAmount1 = 0;
          const scRows = await prisma.$queryRawUnsafe(
            `SELECT s_amount FROM student_fee_scholarship WHERE del=1 AND course_id='${escapeSql(String(courseId))}'
             AND academic_year='${escapeSql(acYear)}' AND academic_batch='${escapeSql(batch)}' AND current_year='${escapeSql(String(cyear))}' AND s_id='${escapeSql(String(student.id))}'`,
          );
          const scFeeAmount = num(scRows[0]?.s_amount);

          if (cyear === 1 && batch === 'regular') {
            const dmeRows = await prisma.$queryRawUnsafe(
              `SELECT s_amount FROM student_fee_dme WHERE del=1 AND course_id='${escapeSql(String(courseId))}'
               AND academic_year='${escapeSql(acYear)}' AND academic_batch='${escapeSql(batch)}' AND current_year='${escapeSql(String(cyear))}' AND s_id='${escapeSql(String(student.id))}'`,
            );
            const dmeAmt = num(dmeRows[0]?.s_amount);
            if (dmeAmt > 0) tfFeeAmount1 = dmeAmt;
            else tfFeeAmount = num(student.tf_amount);
          }

          if (batch === 'regular' || batch === 'additional') {
            const acmecRows = await prisma.$queryRawUnsafe(
              `SELECT s_amount FROM student_fee_acmec WHERE del=1 AND course_id='${escapeSql(String(courseId))}'
               AND academic_year='${escapeSql(acYear)}' AND academic_batch='${escapeSql(batch)}' AND current_year='${escapeSql(String(cyear))}' AND s_id='${escapeSql(String(student.id))}'`,
            );
            const acmecAmt = num(acmecRows[0]?.s_amount);
            if (acmecAmt > 0) acmecFeeAmount1 = acmecAmt;
            else acmecFeeAmount = num(student.acmec_amount);
          }

          let scholarshipAmt = scFeeAmount + tfFeeAmount + tfFeeAmount1 + acmecFeeAmount + acmecFeeAmount1;
          yearDmeFallback += tfFeeAmount;
          yearDmeReceived += tfFeeAmount1;
          yearAcmecFallback += acmecFeeAmount;
          yearAcmecReceived += acmecFeeAmount1;

          // Hostel room (drives room-type fee exclusions) - lines 339-343.
          const roomRows = await prisma.$queryRawUnsafe(
            `SELECT A.room_type FROM hostel_rooms_tb AS A
             INNER JOIN student_hostel_tb AS B ON A.id = B.room_no
             INNER JOIN hostel_blocks_tb AS C ON B.block_no = C.id
             WHERE A.del=1 AND B.del=1 AND C.del=1 AND B.s_id='${escapeSql(String(student.id))}' LIMIT 1`,
          );
          const roomType = roomRows[0]?.room_type ?? null;

          for (const [ftype] of feeCategoryArray) {
            const typeName = feeCategoryArray.get(ftype);
            const bucket = categoryBucketFor(typeName, hostelTypes, examTypes, stationaryTypes);

            // eslint-disable-next-line no-await-in-loop
            const applicable = await computeStudentFeeType({
              courseId,
              ftype,
              academicYear: { academicType: studentActype },
              admissionYear: student.adm_year ?? '',
              cyear,
              admissionSource: student.admission_source,
              studentScholar,
              studentScholarCom,
              roomTypeCode: roomType,
              scholarFeeLabelIds,
              hostelExceptFeeNameIds,
            });

            // Sequential scholarship deduction across this student's scholarship-eligible fee items (lines 380-402).
            for (const item of applicable.scholarshipEligibleByFeeId) {
              if (!item.isScholar) continue;
              if (scholarshipAmt <= 0) break;
              const take = Math.min(item.amount, scholarshipAmt);
              scholarshipAmt -= take;
              yearScholarshipApplied += take;
            }

            yearBuckets[bucket].fee += applicable.total;

            // eslint-disable-next-line no-await-in-loop
            const paid = await computeStudentPaid({
              registerNo: student.register_no,
              feeIds: applicable.feeIds,
              academicYear: acYear,
              curDate,
              academicBatch: batch,
            });
            yearBuckets[bucket].paid += paid;
          }
        }

        for (const bucket of Object.values(yearBuckets)) {
          const pending = Math.max(0, bucket.fee - bucket.paid);
          totals.total += bucket.fee;
          totals.paid += bucket.paid;
          totals.unpaid += pending;
        }
        totals.cUnpaid += Math.max(0, yearBuckets.other.fee - yearBuckets.other.paid);
        totals.hUnpaid += Math.max(0, yearBuckets.hostel.fee - yearBuckets.hostel.paid);
        totals.examUnpaid += Math.max(0, yearBuckets.exam.fee - yearBuckets.exam.paid);
        totals.sriUnpaid += Math.max(0, yearBuckets.stationary.fee - yearBuckets.stationary.paid);
        totals.scholarship += yearScholarshipApplied;

        const dmeReceive = yearDmeFallback - yearDmeReceived;
        totals.dmefee += Math.max(0, dmeReceive);
        totals.dmefeeReceived += yearDmeReceived;

        const acmecReceive = yearAcmecFallback - yearAcmecReceived;
        totals.acmecfee += Math.max(0, acmecReceive);
        totals.acmecfeeReceived += yearAcmecReceived;
      }
    }
  }

  return totals;
}

export async function computeFeeDashboardKpisNative() {
  const setup = await prisma.basic_setup_tb.findFirst({ where: { del: 1 } });
  const pgRegularYear = setup?.pg_academic_year || '';
  const startYear = Number(String(pgRegularYear).slice(0, 4)) || new Date().getFullYear();
  const curDate = new Date().toISOString().slice(0, 10);

  const years = [];
  const overall = {
    unpaidCollege: 0, unpaidHostel: 0, unpaidExam: 0, unpaidStationary: 0, scholarship: 0, dme: 0,
  };

  for (let year = startYear; year >= 2018; year -= 1) {
    const acYear = `${year}-${year + 1}`;
    // eslint-disable-next-line no-await-in-loop
    const cy = await callYear(acYear, curDate);
    years.push({
      academicYear: acYear,
      feeAmount: cy.total,
      feePaid: cy.paid,
      feeUnpaid: cy.unpaid,
      scholarship: cy.scholarship,
      dme: cy.dmefee,
      acmec: cy.acmecfee,
    });
    overall.unpaidCollege += cy.cUnpaid;
    overall.unpaidHostel += cy.hUnpaid;
    overall.unpaidExam += cy.examUnpaid;
    overall.unpaidStationary += cy.sriUnpaid;
    overall.scholarship += cy.scholarship;
    overall.dme += cy.dmefee;
  }

  return { years, overall };
}
