import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import {
  buildCasteScholarshipFilter,
  buildNoScholarshipFilter,
  loadAcademicYearSetup,
  loadFeeLabelMap,
  ugAcYearString,
} from './feeHelpers.js';

export async function loadStudentFeeContext(registerNo, paidDateIso, shared = {}) {
  const roll = String(registerNo || '').trim().toUpperCase();
  if (!roll) return { error: 'registerNo is required' };

  const studentRows = await prisma.$queryRawUnsafe(
    `SELECT id, register_no, student_name, student_initial, course_id, academic_year,
            admission_source, scholar_ship, first_graduate, caste_scholar_ship, tf_amount, acmec_amount
     FROM student_profile_tb WHERE del = 1 AND register_no = '${escapeSql(roll)}'
     ORDER BY created_dt DESC LIMIT 1`,
  );
  if (!studentRows.length) return { error: 'Student not found or fee sheet unavailable' };

  const student = studentRows[0];
  const courseRows = await prisma.$queryRawUnsafe(
    `SELECT id, course_name, degree_name, department_name, course_duration, full_part_time
     FROM basic_setup_course_tb WHERE del = 1 AND id = ${Number(student.course_id)} LIMIT 1`,
  );
  if (!courseRows.length) return { error: 'Course not found' };

  const course = courseRows[0];
  const academicYears = shared.academicYears || await loadAcademicYearSetup(prisma);
  const feeLabelData = shared.feeLabelMap || await loadFeeLabelMap(prisma);
  const feeLabels = feeLabelData.labels || feeLabelData;
  const feeScholarArray = feeLabelData.scholarIds || shared.feeScholarArray || [];

  const paidDateRef = paidDateIso ? new Date(paidDateIso) : new Date();
  const generatedDate = paidDateIso || new Date().toISOString().slice(0, 10);

  const roomRows = await prisma.$queryRawUnsafe(
    `SELECT A.room_id, C.block_id, A.room_type
     FROM hostel_rooms_tb AS A
     INNER JOIN student_hostel_tb AS B ON A.id = B.room_no
     INNER JOIN hostel_blocks_tb AS C ON B.block_no = C.id
     WHERE A.del = 1 AND B.del = 1 AND C.del = 1 AND B.s_id = '${escapeSql(student.id)}'
       AND (B.to_month >= '${escapeSql(generatedDate)}' OR B.to_month = '0000-00-00')
     LIMIT 1`,
  );
  const roomId = roomRows[0]?.room_id || '';
  const roomType = roomRows[0]?.room_type || '';

  const acYearString = ugAcYearString(course.course_name, student.academic_year, academicYears);
  const acRefRows = await prisma.$queryRawUnsafe(
    `SELECT academic_year FROM student_academic_tb
     WHERE del = 1 AND s_id = '${escapeSql(student.id)}' ${acYearString}
       AND course_id = '${escapeSql(student.course_id)}'
     ORDER BY academic_year DESC, academic_batch DESC LIMIT 1`,
  );
  const academicYearRef = acRefRows[0]?.academic_year || '';

  const academicRows = await prisma.$queryRawUnsafe(
    `SELECT academic_year, current_year, academic_type, academic_batch
     FROM student_academic_tb
     WHERE del = 1 AND s_id = '${escapeSql(student.id)}' AND course_id = '${escapeSql(student.course_id)}'
     ORDER BY academic_year ASC, academic_batch ASC`,
  );

  const [scholarshipRows, dmeRows, acmecRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT academic_year, academic_batch, current_year, s_amount
       FROM student_fee_scholarship
       WHERE del = 1 AND course_id = '${escapeSql(student.course_id)}' AND s_id = '${escapeSql(student.id)}'`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT academic_year, academic_batch, current_year, s_amount
       FROM student_fee_dme
       WHERE del = 1 AND course_id = '${escapeSql(student.course_id)}' AND s_id = '${escapeSql(student.id)}'`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT academic_year, academic_batch, current_year, s_amount
       FROM student_fee_acmec
       WHERE del = 1 AND course_id = '${escapeSql(student.course_id)}' AND s_id = '${escapeSql(student.id)}'`,
    ),
  ]);

  const scholarshipMap = new Map(
    scholarshipRows.map((row) => [`${row.academic_year}|${row.academic_batch}|${row.current_year}`, Number(row.s_amount) || 0]),
  );
  const dmeMap = new Map(
    dmeRows.map((row) => [`${row.academic_year}|${row.academic_batch}|${row.current_year}`, Number(row.s_amount) || 0]),
  );
  const acmecMap = new Map(
    acmecRows.map((row) => [`${row.academic_year}|${row.academic_batch}|${row.current_year}`, Number(row.s_amount) || 0]),
  );

  const classArrayString = {};
  const scFeeAmount = {};
  const admissionYear = student.academic_year;
  const admissionSource = student.admission_source || '';
  const scholarShip = Number(student.scholar_ship) === 1;
  const casteScholarship = Number(student.first_graduate) === 1
    ? 'firstgraduate'
    : (student.caste_scholar_ship || '');
  const stuTfAmount = Number(student.tf_amount) || 0;
  const stuAcmecAmount = Number(student.acmec_amount) || 0;

  for (const row of academicRows) {
    const stuAcademicYear = row.academic_year;
    const stuClass = row.current_year;
    const stuAcType = String(row.academic_type || '');
    const stuBatch = String(row.academic_batch || '').toLowerCase();

    if (!scFeeAmount[stuAcademicYear]) scFeeAmount[stuAcademicYear] = {};
    if (!scFeeAmount[stuAcademicYear][stuClass]) scFeeAmount[stuAcademicYear][stuClass] = {};
    if (!scFeeAmount[stuAcademicYear][stuClass][stuBatch]) {
      scFeeAmount[stuAcademicYear][stuClass][stuBatch] = { amt: 0, amt1: 0 };
    }

    const discountKey = `${stuAcademicYear}|${stuBatch}|${stuClass}`;
    const scholarshipAmount = scholarshipMap.get(discountKey) || 0;
    scFeeAmount[stuAcademicYear][stuClass][stuBatch].amt += scholarshipAmount;
    scFeeAmount[stuAcademicYear][stuClass][stuBatch].amt1 += scholarshipAmount;

    const dmeAmount = dmeMap.get(discountKey) || 0;
    if (dmeAmount === 0 && stuTfAmount > 0
      && Number(stuClass) === 1 && stuBatch === 'regular' && stuAcType.toLowerCase() === 'regular') {
      if (!scFeeAmount[admissionYear]) scFeeAmount[admissionYear] = {};
      if (!scFeeAmount[admissionYear][1]) scFeeAmount[admissionYear][1] = {};
      if (!scFeeAmount[admissionYear][1].regular) scFeeAmount[admissionYear][1].regular = { amt: 0, amt1: 0 };
      scFeeAmount[admissionYear][1].regular.amt += stuTfAmount;
    } else {
      scFeeAmount[stuAcademicYear][stuClass][stuBatch].amt += dmeAmount;
    }

    const acmecAmount = acmecMap.get(discountKey) || 0;
    if (acmecAmount === 0 && stuAcmecAmount > 0
      && Number(stuClass) === 1 && stuBatch === 'regular' && stuAcType.toLowerCase() === 'regular') {
      if (!scFeeAmount[admissionYear]) scFeeAmount[admissionYear] = {};
      if (!scFeeAmount[admissionYear][1]) scFeeAmount[admissionYear][1] = {};
      if (!scFeeAmount[admissionYear][1].regular) scFeeAmount[admissionYear][1].regular = { amt: 0, amt1: 0 };
      scFeeAmount[admissionYear][1].regular.amt += stuAcmecAmount;
    } else {
      scFeeAmount[stuAcademicYear][stuClass][stuBatch].amt += acmecAmount;
    }

    if (academicYearRef && String(academicYearRef).slice(0, 4) >= String(stuAcademicYear).slice(0, 4)) {
      if (!classArrayString[stuClass]) classArrayString[stuClass] = {};
      if (!classArrayString[stuClass][stuBatch]) classArrayString[stuClass][stuBatch] = {};
      classArrayString[stuClass][stuBatch][stuAcademicYear] = stuAcType;
    }
  }

  let academicSearchString = '';
  let academicSearchString1 = '';
  if (Object.keys(classArrayString).length) {
    const parts = [];
    Object.entries(classArrayString).forEach(([stuClass, batchMap]) => {
      Object.entries(batchMap).forEach(([stuBatch, yearMap]) => {
        Object.entries(yearMap).forEach(([stuYear, stuType]) => {
          parts.push(
            `(A.admission_year='${escapeSql(admissionYear)}' AND A.class_year='${escapeSql(stuClass)}' AND ( A.academic_type='${escapeSql(stuType)}' OR A.academic_type LIKE '${escapeSql(stuType)},%' OR A.academic_type LIKE '%,${escapeSql(stuType)}' OR A.academic_type LIKE '%,${escapeSql(stuType)},%' ))`,
          );
        });
      });
    });
    academicSearchString1 = ` AND (${parts.join(' OR ')})`;
    academicSearchString = ` AND (fee_for='${escapeSql(admissionSource)}' OR fee_for='')`;
    academicSearchString1 += ` AND (A.fee_for='${escapeSql(admissionSource)}' OR A.fee_for='')`;
    if (scholarShip && casteScholarship) {
      academicSearchString += buildCasteScholarshipFilter(casteScholarship);
      academicSearchString1 += buildCasteScholarshipFilter(casteScholarship, 'A');
    } else {
      academicSearchString += buildNoScholarshipFilter();
      academicSearchString1 += buildNoScholarshipFilter('A');
    }
  }

  return {
    student,
    course,
    feeLabels,
    feeScholarArray,
    academicYears,
    paidDateRef,
    roomId,
    roomType,
    academicYearRef,
    classArrayString,
    scFeeAmount,
    admissionYear,
    admissionSource,
    academicSearchString,
    academicSearchString1,
  };
}
