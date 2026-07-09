import { prisma } from '../../config/prisma.js';
import { escapeSql, normalizeLegacyIp, parseId, sqlDateOrNull } from '../../utils/sqlSafe.js';
import { getStaffProfile } from './staffProfile.js';
import { getStaffProfileOptions, saveProfileRecords } from './staffProfileExtras.js';

function randomFrom(chars, length) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function generatePassword(length = 6) {
  return randomFrom('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*?', length);
}

function generatePin(length = 4) {
  return randomFrom('0123456789', length);
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

function buildStaffProfileInsertRow(body, meta, loginPass, loginPin) {
  const staffId = String(body.staffId || '').trim();
  const staffName = String(body.staffName || '').trim();
  const jobCategory = String(body.jobCategory || '').trim();
  const designationId = String(body.designationId || '').trim();
  const classTypes = Array.isArray(body.classTypes)
    ? body.classTypes.filter(Boolean).join(',')
    : String(body.classTypes || '').trim();
  const joinedDate = body.joinedDate || new Date().toISOString().slice(0, 10);

  return {
    staff_id_temp: sqlStr(''),
    staff_id: sqlStr(staffId),
    joined_date: sqlDate(joinedDate),
    staff_name: sqlStr(staffName),
    staff_initial: sqlStr(body.staffInitial),
    staff_title: sqlStr(body.staffTitle),
    staff_photo: sqlStr(''),
    staff_gender: sqlStr(body.gender),
    staff_dob: sqlDate(body.dateOfBirth),
    staff_bg: sqlStr(body.bloodGroup),
    staff_religion: sqlStr(body.religion),
    atten_auth: sqlInt(0),
    staff_community: sqlStr(body.community),
    staff_caste: sqlStr(body.caste),
    marital_status: sqlStr(body.maritalStatus),
    father_name: sqlStr(body.fatherName),
    spouse_name: sqlStr(''),
    mobile_1: sqlStr(body.mobile1),
    mobile_2: sqlStr(body.mobile2),
    landline_no: sqlStr(''),
    email_id: sqlStr(body.emailId),
    permanent_address: sqlStr(body.permanentAddress),
    door_no: sqlStr(body.doorNo),
    street: sqlStr(body.street),
    post: sqlStr(body.post),
    taluk: sqlStr(body.taluk),
    district: sqlStr(body.district),
    state: sqlStr(body.state),
    country: sqlStr(body.country || 'India'),
    pincode: sqlStr(body.pincode),
    communication_address: sqlStr(''),
    quarters_date: sqlDate(''),
    c_door_no: sqlStr(''),
    c_street: sqlStr(''),
    c_post: sqlStr(''),
    c_taluk: sqlStr(''),
    c_district: sqlStr(''),
    c_state: sqlStr(''),
    c_country: sqlStr(''),
    c_pincode: sqlStr(''),
    appoi_order_no: sqlStr(''),
    appoi_order_date: sqlDate(''),
    pre_app_no: sqlStr(''),
    pre_reliv_no: sqlStr(''),
    pre_exp_no: sqlStr(''),
    releaving_date: sqlDate(''),
    releaving_info: sqlStr(''),
    releaving_attachment: sqlStr(''),
    unit_type: sqlStr(body.unitType || ''),
    subject_specialization: sqlStr(body.departmentId),
    experience: sqlStr(''),
    job_category: sqlStr(jobCategory),
    class_type: sqlStr(classTypes),
    designation: sqlStr(designationId),
    job_type: sqlStr(body.jobType || 'Full Time'),
    pf_calculate: sqlInt(0),
    prof_tax: sqlStr(''),
    salary_1: sqlStr(''),
    salary: sqlStr(''),
    b_ac_no: sqlStr(body.bankAcNo),
    b_ac_name: sqlStr(body.bankAcName),
    b_name: sqlStr(body.bankName),
    b_branch: sqlStr(body.bankBranch),
    b_ifsc: sqlStr(body.bankIfsc),
    pan_no: sqlStr(body.panNo),
    pf_ac_no: sqlStr(body.pfAcNo || body.pfaNo),
    pf_uan: sqlStr(''),
    esi_no: sqlStr(''),
    ug_reg_no: sqlStr(''),
    ug_reg_date: sqlDate(''),
    ug_dental_council: sqlStr(''),
    pg_reg_no: sqlStr(''),
    pg_reg_date: sqlDate(''),
    pg_dental_council: sqlStr(''),
    reg_validity: sqlDate(''),
    aadhar_no: sqlStr(body.aadharNo),
    passport_no: sqlStr(''),
    driving_lic: sqlStr(''),
    voter_id: sqlStr(''),
    eb_proof: sqlStr(''),
    rental_agree: sqlStr(''),
    pan_card: sqlStr(''),
    pvt_clinic_name: sqlStr(''),
    pvt_clinic_city: sqlStr(''),
    pvt_clinic_remarks: sqlStr(''),
    payroll_type: sqlStr(body.payrollType || 'academic'),
    att_category: sqlStr(body.attendanceCategory),
    extra_curricular: sqlStr(''),
    extra_skills: sqlStr(''),
    area_interest: sqlStr(''),
    area_interests: sqlStr(''),
    language_known: sqlStr(''),
    reg_no: sqlStr(body.regNo),
    reg_date: sqlDate(body.regDate),
    dental_council: sqlStr(body.dentalCouncil),
    address_proof: sqlStr(body.addressProof),
    address_proof_id: sqlStr(body.addressProofId),
    identity_proof: sqlStr(body.identityProof),
    identity_proof_id: sqlStr(body.identityProofId),
    a_password: sqlStr(''),
    temp_password: sqlStr(loginPass),
    a_pin: sqlStr(loginPin),
    staff_profile: sqlStr(''),
    created_ip: sqlStr(meta.ip),
    created_by: sqlStr(meta.username),
    updated_ip: sqlStr(''),
    updated_by: sqlStr(''),
  };
}

export async function getStaffAdmissionOptions() {
  const [options, lastRow] = await Promise.all([
    getStaffProfileOptions(),
    prisma.$queryRawUnsafe(
      `SELECT staff_id FROM staff_profile_tb WHERE del = 1
       ORDER BY id DESC, staff_id+0 DESC, staff_id DESC LIMIT 1`,
    ),
  ]);

  return {
    ...options,
    lastStaffId: lastRow[0]?.staff_id ? String(lastRow[0].staff_id) : '',
  };
}

export async function getDesignationsByDepartment(departmentId) {
  const deptId = parseId(departmentId, 'department id');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, name FROM staff_desg_master
     WHERE del = 1 AND d_id = ${deptId} ORDER BY d_order ASC`,
  );
  return rows.map((row) => ({ id: Number(row.id), name: row.name }));
}

export async function isStaffIdAvailable(staffId) {
  const id = String(staffId || '').trim();
  if (!id) return { available: false };
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id FROM staff_profile_tb WHERE del = 1 AND staff_id = '${escapeSql(id)}' LIMIT 1`,
  );
  return { available: rows.length === 0, staffId: id };
}

export async function createStaffAdmission(body, meta) {
  const audit = { ...meta, ip: normalizeLegacyIp(meta?.ip) };
  const staffId = String(body.staffId || '').trim();
  const staffName = String(body.staffName || '').trim();
  const jobCategory = String(body.jobCategory || '').trim();
  const departmentId = String(body.departmentId || '').trim();
  const designationId = String(body.designationId || '').trim();

  if (!staffId || !staffName || !jobCategory || !departmentId || !designationId) {
    return {
      error: 'staffId, staffName, jobCategory, departmentId, and designationId are required',
    };
  }

  if (!(await isStaffIdAvailable(staffId)).available) {
    return { error: 'Staff ID already exists' };
  }

  const loginPass = generatePassword(6);
  const loginPin = generatePin(4);
  const joinedDate = body.joinedDate || new Date().toISOString().slice(0, 10);
  const profileRow = buildStaffProfileInsertRow(body, audit, loginPass, loginPin);
  const profileCols = Object.keys(profileRow);
  const profileVals = Object.values(profileRow);

  await prisma.$executeRawUnsafe(
    `INSERT INTO staff_profile_tb (${profileCols.join(', ')}, created_dt)
     VALUES (${profileVals.join(', ')}, NOW())`,
  );

  const idRows = await prisma.$queryRawUnsafe(
    `SELECT id FROM staff_profile_tb WHERE del = 1 AND staff_id = '${escapeSql(staffId)}'
     ORDER BY id DESC LIMIT 1`,
  );
  const rowId = parseId(idRows[0]?.id, 'staff id');

  await prisma.$executeRawUnsafe(
    `INSERT INTO staff_designation_tb (
      staff_id, department, designation, unit_type, from_date, to_date,
      is_academic, created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by
    ) VALUES (
      '${String(rowId)}', '${escapeSql(departmentId)}', '${escapeSql(designationId)}', '',
      '${sqlDateOrNull(joinedDate)}', '0000-00-00', '1', NOW(),
      '${escapeSql(audit.ip || '')}', '${escapeSql(audit.username || '')}',
      '0000-00-00 00:00:00', '', ''
    )`,
  );

  const hasRecords = Array.isArray(body.education)
    || Array.isArray(body.experience)
    || (body.activities && typeof body.activities === 'object');
  if (hasRecords) {
    const recordResult = await saveProfileRecords(rowId, {
      education: body.education,
      experience: body.experience,
      activities: body.activities,
    }, audit);
    if (recordResult.error) {
      return { error: recordResult.error };
    }
  }

  return { success: true, profile: await getStaffProfile(rowId), tempPassword: loginPass, tempPin: loginPin };
}
