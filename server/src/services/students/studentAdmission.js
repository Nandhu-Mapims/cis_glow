import { prisma } from '../../config/prisma.js';
import { escapeSql, normalizeLegacyIp, parseId, sqlDateOrNull } from '../../utils/sqlSafe.js';
import { getStudentProfile } from './studentProfile.js';

/**
 * Degree/program dropdown for admission (legacy student_profile_add_more.php flag=1).
 */
export async function getAdmissionDegreeOptions(academicYear, courseName) {
  const yearStart = Number(String(academicYear || '').split('-')[0]);
  if (!yearStart || !courseName) {
    return { options: [] };
  }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, degree_name, department_name, full_part_time, course_duration
     FROM basic_setup_course_tb
     WHERE del = 1
       AND course_name = '${escapeSql(courseName)}'
       AND year_of_start <= ${yearStart}
     ORDER BY c_order ASC`,
  );

  const options = rows.map((row) => {
    const department = String(row.department_name || '').trim();
    const departmentSuffix = department && department !== '-' ? ` - ${department}` : '';
    const fullPartTime = String(row.full_part_time || '').trim();
    const duration = String(row.course_duration || '').trim();

    return {
      id: String(row.id),
      label: `${row.degree_name}${departmentSuffix} | ${fullPartTime} (${duration} Years)`,
    };
  });

  return { options };
}

export async function registerExists(registerNo) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id FROM student_profile_tb WHERE del = 1 AND register_no = '${escapeSql(registerNo)}' LIMIT 1`,
  );
  return rows.length > 0;
}

function sqlStr(value) {
  return `'${escapeSql(value ?? '')}'`;
}

function sqlInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sqlDate(value) {
  return `'${sqlDateOrNull(value)}'`;
}

/** Build INSERT row matching legacy student_profile_add.php plus NOT NULL columns added later. */
function buildProfileInsertRow(body, meta) {
  const registerNo = String(body.registerNo || '').trim();
  const rollNo = String(body.rollNo || registerNo).trim();
  const courseId = String(body.courseId || '').trim();
  const academicYear = String(body.academicYear || '').trim();
  const studentName = String(body.studentName || '').trim();
  const loginPin = academicYear.length >= 4
    ? academicYear.slice(2, 4) + academicYear.slice(-2)
    : '';

  return {
    application_no: sqlStr(body.applicationNo),
    admission_no: sqlStr(body.admissionNo),
    admission_date: sqlDate(body.admissionDate),
    academic_year: sqlStr(academicYear),
    admission_source: sqlInt(body.admissionSource, 1),
    course_id: sqlStr(courseId),
    tregister_no: sqlStr(''),
    uregister_no: sqlStr(registerNo),
    bregister_no: sqlStr(body.bregisterNo),
    troll_no: sqlStr(''),
    register_no: sqlStr(rollNo),
    temp_register_no: sqlStr(''),
    aadhar_no: sqlStr(body.aadharNo),
    lateral_entry: sqlInt(body.lateralEntry, 0),
    student_title: sqlStr(body.studentTitle),
    student_name: sqlStr(studentName),
    student_initial: sqlStr(body.studentInitial),
    t_student_name: sqlStr(''),
    t_student_initial: sqlStr(''),
    father_title: sqlStr(body.fatherTitle),
    father_name: sqlStr(body.fatherName),
    father_occupation: sqlStr(body.fatherOccupation),
    father_income: sqlStr(body.fatherIncome),
    mother_title: sqlStr(body.motherTitle),
    mother_name: sqlStr(body.motherName),
    mother_occupation: sqlStr(body.motherOccupation),
    mother_income: sqlStr(body.motherIncome),
    student_gender: sqlStr(body.gender),
    student_dob: sqlDate(body.dateOfBirth),
    student_photo: sqlStr(''),
    student_bg: sqlStr(body.bloodGroup),
    donate_blood: sqlInt(body.donateBlood, 0),
    student_religion: sqlStr(body.religion),
    student_caste: sqlStr(body.caste),
    student_community: sqlStr(body.community),
    student_nationality: sqlStr(body.nationality || 'Indian'),
    physically_challenge: sqlStr(body.physicallyChallenge),
    language_known: sqlStr(''),
    permanent_address: sqlStr(''),
    door_no: sqlStr(body.doorNo),
    street: sqlStr(body.street),
    post: sqlStr(body.post),
    taluk: sqlStr(body.taluk),
    district: sqlStr(body.district),
    state: sqlStr(body.state),
    pincode: sqlStr(body.pincode),
    c_door_no: sqlStr(body.cDoorNo),
    c_street: sqlStr(body.cStreet),
    c_post: sqlStr(body.cPost),
    c_taluk: sqlStr(body.cTaluk),
    c_district: sqlStr(body.cDistrict),
    c_state: sqlStr(body.cState),
    c_pincode: sqlStr(body.cPincode),
    mobile_no: sqlStr(body.mobileNo),
    contact_no: sqlStr(body.contactNo),
    father_mobile_1: sqlStr(body.fatherMobile),
    mother_mobile: sqlStr(body.motherMobile),
    sms_mobile: sqlStr(body.fatherMobile || body.mobileNo),
    father_email: sqlStr(body.fatherEmail),
    institution_email: sqlStr(''),
    personal_email: sqlStr(body.personalEmail),
    comm_address: sqlStr(''),
    staying_with: sqlInt(body.stayingWith, 0),
    guardian_relation: sqlStr(body.guardianRelation),
    guardian_name: sqlStr(body.guardianName),
    guardian_no: sqlStr(body.guardianNo),
    guardian_email: sqlStr(body.guardianEmail),
    guardian_address: sqlStr(body.guardianAddress),
    guardian_city: sqlStr(body.guardianCity),
    guardian_pincode: sqlStr(body.guardianPincode),
    releaving_date: sqlDate(''),
    releaving_info: sqlStr(''),
    releaving_year: sqlInt(0),
    discontinued_attach: sqlStr(''),
    tc_number: sqlInt(0),
    cri_cert_no: sqlInt(0),
    aaadar_imp_cno: sqlInt(0),
    aaadar_las_cno: sqlInt(0),
    persional_identification: sqlStr(body.personalIdentification || body.piMark1),
    persional_identification_1: sqlStr(body.personalIdentification1 || body.piMark2),
    first_language: sqlStr(''),
    pan_no: sqlStr(''),
    pan_name: sqlStr(''),
    tc_apply_date: sqlDate(''),
    tc_issue_date: sqlDate(''),
    cri_status: sqlInt(0),
    ar_number: sqlStr(body.arNumber),
    ar_rank: sqlStr(body.arRank),
    acmec_scholorship: sqlInt(body.acmecScholorship, 0),
    acmec_amount: sqlInt(body.acmecAmount, 0),
    acmec_approved: sqlInt(body.acmecApproved, 0),
    acmec_trust: sqlInt(body.acmecTrust, 0),
    scholar_ship: sqlInt(body.scholarship, 0),
    first_graduate: sqlInt(body.firstGraduate, 0),
    caste_scholar_ship: sqlStr(body.casteScholarship),
    tf_receipt_no: sqlStr(body.tfReceiptNo),
    tf_receipt_date: sqlDate(body.tfReceiptDate),
    tf_amount: sqlInt(body.tfAmount, 0),
    neet_adm_no: sqlStr(body.neetAdmNo),
    neet_roll_no: sqlStr(body.neetRollNo),
    neet_score: sqlStr(body.neetScore),
    att_category: sqlStr(''),
    b_ac_no: sqlStr(body.bAcNo),
    b_ac_name: sqlStr(body.bAcName),
    b_name: sqlStr(body.bName),
    b_branch: sqlStr(body.bBranch),
    b_ifsc: sqlStr(body.bIfsc),
    a_pin: sqlStr(loginPin),
    emis_no: sqlStr(body.emisNo),
    umis_no: sqlStr(body.umisNo),
    created_ip: sqlStr(meta.ip),
    created_by: sqlStr(meta.username),
    updated_ip: sqlStr(''),
    updated_by: sqlStr(''),
  };
}

/**
 * Create student admission (legacy student_profile_add.php core INSERT).
 */
export async function createStudentAdmission(body, meta) {
  const audit = { ...meta, ip: normalizeLegacyIp(meta?.ip) };
  const registerNo = String(body.registerNo || '').trim();
  const rollNo = String(body.rollNo || registerNo).trim();
  const courseId = String(body.courseId || '').trim();
  const academicYear = String(body.academicYear || '').trim();
  const studentName = String(body.studentName || '').trim();

  if (!registerNo || !courseId || !academicYear || !studentName) {
    return { error: 'registerNo, courseId, academicYear, and studentName are required' };
  }

  if (await registerExists(rollNo)) {
    return { error: 'Register number already exists' };
  }

  const profileRow = buildProfileInsertRow(body, audit);
  const profileCols = Object.keys(profileRow);
  const profileVals = Object.values(profileRow);

  await prisma.$executeRawUnsafe(
    `INSERT INTO student_profile_tb (${profileCols.join(', ')}, created_dt)
     VALUES (${profileVals.join(', ')}, NOW())`,
  );

  const idRows = await prisma.$queryRawUnsafe(
    `SELECT id FROM student_profile_tb WHERE del = 1 AND register_no = '${escapeSql(rollNo)}'
     ORDER BY id DESC LIMIT 1`,
  );
  const studentId = parseId(idRows[0]?.id, 'student id');

  await prisma.$executeRawUnsafe(
    `INSERT INTO student_academic_tb (
      s_id, course_id, academic_year, academic_type, academic_batch,
      register_no, current_year, student_boarding, student_hostel, scholar_ship,
      student_transport, medical_history, student_activity,
      created_dt, created_ip, created_by, updated_ip, updated_by
    ) VALUES (
      ${studentId}, ${sqlInt(courseId)}, '${escapeSql(academicYear)}', 'regular', 'regular',
      '${escapeSql(rollNo)}', 1, 0, 0, 0, 0, 0, '',
      NOW(), '${escapeSql(audit.ip || '')}', '${escapeSql(audit.username || '')}', '', ''
    )`,
  );

  return { success: true, profile: await getStudentProfile(studentId) };
}
