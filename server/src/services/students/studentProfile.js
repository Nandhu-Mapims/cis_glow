import { prisma } from '../../config/prisma.js';
import { escapeSql, normalizeLegacyDate, parseId } from '../../utils/sqlSafe.js';
import { insertLog } from '../logService.js';

const normalizeDate = normalizeLegacyDate;

function mapProfileRow(row) {
  return {
    id: Number(row.id),
    applicationNo: row.application_no,
    admissionNo: row.admission_no,
    admissionDate: normalizeDate(row.admission_date),
    academicYear: row.academic_year,
    admissionSource: row.admission_source,
    courseId: row.course_id,
    registerNo: row.register_no,
    uregisterNo: row.uregister_no,
    bregisterNo: row.bregister_no,
    aadharNo: row.aadhar_no,
    studentTitle: row.student_title,
    studentName: row.student_name,
    studentInitial: row.student_initial,
    fatherTitle: row.father_title,
    fatherName: row.father_name,
    fatherOccupation: row.father_occupation,
    fatherIncome: row.father_income,
    motherTitle: row.mother_title,
    motherName: row.mother_name,
    motherOccupation: row.mother_occupation,
    motherIncome: row.mother_income,
    gender: row.student_gender,
    dateOfBirth: normalizeDate(row.student_dob),
    bloodGroup: row.student_bg,
    religion: row.student_religion,
    caste: row.student_caste,
    community: row.student_community,
    nationality: row.student_nationality,
    photo: row.student_photo,
    photoUrl: row.student_photo ? `/legacy/img/student_images/${row.student_photo}` : null,
    mobileNo: row.mobile_no,
    contactNo: row.contact_no,
    fatherMobile: row.father_mobile_1,
    motherMobile: row.mother_mobile,
    fatherEmail: row.father_email,
    personalEmail: row.personal_email,
    institutionEmail: row.institution_email,
    doorNo: row.door_no,
    street: row.street,
    post: row.post,
    taluk: row.taluk,
    district: row.district,
    state: row.state,
    pincode: row.pincode,
    cDoorNo: row.c_door_no,
    cStreet: row.c_street,
    cPost: row.c_post,
    cTaluk: row.c_taluk,
    cDistrict: row.c_district,
    cState: row.c_state,
    cPincode: row.c_pincode,
    guardianName: row.guardian_name,
    guardianNo: row.guardian_no,
    guardianEmail: row.guardian_email,
    guardianAddress: row.guardian_address,
    guardianCity: row.guardian_city,
    guardianRelation: row.guardian_relation,
    guardianPincode: row.guardian_pincode,
    scholarship: row.scholar_ship,
    casteScholarship: row.caste_scholar_ship,
    firstGraduate: row.first_graduate,
    releavingDate: normalizeDate(row.releaving_date),
    releavingInfo: row.releaving_info,
    releavingYear: row.releaving_year,
  };
}

const PROFILE_SELECT = `
  p.id, p.application_no, p.admission_no,
  CAST(p.admission_date AS CHAR) AS admission_date,
  p.academic_year, p.admission_source, p.course_id,
  p.register_no, p.uregister_no, p.bregister_no, p.aadhar_no,
  p.student_title, p.student_name, p.student_initial,
  p.father_title, p.father_name, p.father_occupation, p.father_income,
  p.mother_title, p.mother_name, p.mother_occupation, p.mother_income,
  p.student_gender, CAST(p.student_dob AS CHAR) AS student_dob, p.student_bg,
  p.student_religion, p.student_caste, p.student_community, p.student_nationality,
  p.student_photo, p.mobile_no, p.contact_no, p.father_mobile_1, p.mother_mobile,
  p.father_email, p.personal_email, p.institution_email,
  p.door_no, p.street, p.post, p.taluk, p.district, p.state, p.pincode,
  p.c_door_no, p.c_street, p.c_post, p.c_taluk, p.c_district, p.c_state, p.c_pincode,
  p.guardian_name, p.guardian_no, p.guardian_email, p.guardian_address,
  p.guardian_city, p.guardian_relation, p.guardian_pincode,
  p.scholar_ship, p.caste_scholar_ship, p.first_graduate,
  CAST(p.releaving_date AS CHAR) AS releaving_date,
  p.releaving_info, p.releaving_year`;

export async function getStudentProfile(studentId) {
  const sid = parseId(studentId, 'student id');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ${PROFILE_SELECT},
      c.degree_name, c.department_name, c.course_name, c.degree_short_name
    FROM student_profile_tb p
    LEFT JOIN basic_setup_course_tb c ON c.id = CAST(p.course_id AS UNSIGNED) AND c.del = 1
    WHERE p.del = 1 AND p.id = ${sid}
    LIMIT 1`,
  );

  if (!rows.length) return null;

  const profile = mapProfileRow(rows[0]);
  profile.course = {
    id: rows[0].course_id,
    name: rows[0].course_name,
    degreeName: rows[0].degree_name,
    departmentName: rows[0].department_name,
    shortName: rows[0].degree_short_name,
  };

  const academics = await prisma.$queryRawUnsafe(
    `SELECT id, academic_year, academic_batch, current_year, academic_type,
      student_boarding, student_hostel, scholar_ship, student_transport
    FROM student_academic_tb
    WHERE del = 1 AND s_id = ${sid}
    ORDER BY academic_year DESC, current_year DESC`,
  );

  profile.academics = academics.map((a) => ({
    id: Number(a.id),
    academicYear: a.academic_year,
    batch: a.academic_batch,
    currentYear: Number(a.current_year),
    type: a.academic_type,
    boarding: a.student_boarding,
    hostel: a.student_hostel,
    scholarship: a.scholar_ship,
    transport: a.student_transport,
  }));

  return profile;
}

const UPDATABLE_FIELDS = {
  student_name: 'studentName',
  student_initial: 'studentInitial',
  student_title: 'studentTitle',
  register_no: 'registerNo',
  student_gender: 'gender',
  student_bg: 'bloodGroup',
  student_religion: 'religion',
  student_caste: 'caste',
  student_community: 'community',
  student_nationality: 'nationality',
  father_name: 'fatherName',
  father_title: 'fatherTitle',
  mother_name: 'motherName',
  mother_title: 'motherTitle',
  mobile_no: 'mobileNo',
  contact_no: 'contactNo',
  father_mobile_1: 'fatherMobile',
  mother_mobile: 'motherMobile',
  father_email: 'fatherEmail',
  personal_email: 'personalEmail',
  aadhar_no: 'aadharNo',
  door_no: 'doorNo',
  street: 'street',
  post: 'post',
  taluk: 'taluk',
  district: 'district',
  state: 'state',
  pincode: 'pincode',
  c_door_no: 'cDoorNo',
  c_street: 'cStreet',
  c_post: 'cPost',
  c_district: 'cDistrict',
  c_state: 'cState',
  c_pincode: 'cPincode',
  guardian_name: 'guardianName',
  guardian_no: 'guardianNo',
  guardian_email: 'guardianEmail',
  guardian_relation: 'guardianRelation',
};

export async function updateStudentProfile(studentId, body, meta) {
  const sid = parseId(studentId, 'student id');
  const existingRows = await prisma.$queryRawUnsafe(
    `SELECT id, register_no FROM student_profile_tb WHERE del = 1 AND id = ${sid} LIMIT 1`,
  );
  const existing = existingRows[0];
  if (!existing) return { error: 'Student not found' };

  if (body.registerNo && body.registerNo !== existing.register_no) {
    const dupRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM student_profile_tb WHERE del = 1 AND register_no = '${escapeSql(body.registerNo)}' AND id != ${sid} LIMIT 1`,
    );
    if (dupRows.length) return { error: 'Roll number already exists' };
  }

  const data = {};
  Object.entries(UPDATABLE_FIELDS).forEach(([col, key]) => {
    if (body[key] !== undefined) data[col] = body[key];
  });

  if (!Object.keys(data).length) {
    return { error: 'No fields to update' };
  }

  data.updated_ip = meta.ip || '';
  data.updated_by = meta.username || '';

  const sets = Object.entries(data)
    .map(([col, val]) => `${col}='${escapeSql(val)}'`)
    .join(', ');
  await prisma.$executeRawUnsafe(
    `UPDATE student_profile_tb SET ${sets}, updated_dt=NOW() WHERE id = ${sid}`,
  );

  await insertLog(
    ['student_profile_edit', 'Update', 'Successful', `id=${sid}`, new Date(), meta.ip, '', meta.username],
    '',
  );

  return { success: true, profile: await getStudentProfile(sid) };
}
