import { prisma } from '../../config/prisma.js';
import { legacyPublicFileUrl } from '../../utils/fileUrls.js';
import { escapeSql, normalizeLegacyDate, parseId, sqlDateOrNull } from '../../utils/sqlSafe.js';
import { insertLog } from '../logService.js';
import { loadProfileRecords } from './staffProfileExtras.js';
import { loadAcademicDesignation, staffPhotoDisplayUrl } from './staffShared.js';

const normalizeDate = normalizeLegacyDate;

const PROFILE_SELECT = `
  p.id, p.staff_id, p.staff_id_temp,
  CAST(p.joined_date AS CHAR) AS joined_date,
  p.staff_name, p.staff_initial, p.staff_title, p.staff_photo,
  p.staff_gender, CAST(p.staff_dob AS CHAR) AS staff_dob, p.staff_bg,
  p.staff_religion, p.staff_community, p.staff_caste, p.marital_status,
  p.father_name, p.spouse_name, p.mobile_1, p.mobile_2, p.landline_no, p.email_id,
  p.permanent_address, p.door_no, p.street, p.post, p.taluk, p.district, p.state,
  p.country, p.pincode, p.communication_address,
  CAST(p.quarters_date AS CHAR) AS quarters_date,
  p.c_door_no, p.c_street, p.c_post, p.c_taluk, p.c_district, p.c_state, p.c_country, p.c_pincode,
  p.unit_type, p.atten_auth, p.subject_specialization, p.experience,
  p.job_category, p.class_type, p.designation, p.job_type, p.payroll_type, p.att_category,
  p.aadhar_no, p.pan_no, p.pf_ac_no, p.pf_uan, p.esi_no,
  p.b_ac_no, p.b_ac_name, p.b_name, p.b_branch, p.b_ifsc,
  p.appoi_order_no, CAST(p.appoi_order_date AS CHAR) AS appoi_order_date,
  p.pre_app_no, p.pre_reliv_no, p.pre_exp_no, p.salary_1,
  p.passport_no, p.driving_lic, p.voter_id, p.eb_proof, p.rental_agree,
  p.pvt_clinic_name, p.pvt_clinic_city, p.pvt_clinic_remarks, p.language_known,
  CAST(p.releaving_date AS CHAR) AS releaving_date,
  p.releaving_info, p.releaving_attachment`;

function parseClassTypes(value) {
  if (!value) return [];
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

function parseLanguageIds(value) {
  if (!value) return [];
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

function mapProfileRow(row) {
  const usesQuartersAddress = String(row.communication_address || '') === '1';
  return {
    id: Number(row.id),
    staffId: row.staff_id,
    joinedDate: normalizeDate(row.joined_date),
    staffName: row.staff_name,
    staffInitial: row.staff_initial,
    staffTitle: row.staff_title,
    photo: row.staff_photo,
    photoUrl: row.staff_photo ? legacyPublicFileUrl(`staff_images/${row.staff_photo}`) : null,
    gender: row.staff_gender,
    dateOfBirth: normalizeDate(row.staff_dob),
    bloodGroup: row.staff_bg,
    religion: row.staff_religion,
    community: row.staff_community,
    caste: row.staff_caste,
    maritalStatus: row.marital_status,
    fatherName: row.father_name,
    spouseName: row.spouse_name,
    mobile1: row.mobile_1,
    mobile2: row.mobile_2,
    landlineNo: row.landline_no,
    emailId: row.email_id,
    permanentAddress: row.permanent_address,
    doorNo: row.door_no,
    street: row.street,
    post: row.post,
    taluk: row.taluk,
    district: row.district,
    state: row.state,
    country: row.country,
    pincode: row.pincode,
    usesQuartersAddress,
    quartersDate: normalizeDate(row.quarters_date),
    cDoorNo: row.c_door_no,
    cStreet: row.c_street,
    cPost: row.c_post,
    cTaluk: row.c_taluk,
    cDistrict: row.c_district,
    cState: row.c_state,
    cCountry: row.c_country,
    cPincode: row.c_pincode,
    unitType: row.unit_type,
    attenAuth: Number(row.atten_auth) === 1,
    departmentId: row.subject_specialization,
    experience: row.experience,
    jobCategoryId: row.job_category,
    classTypes: parseClassTypes(row.class_type),
    classType: row.class_type,
    designationId: row.designation,
    jobType: row.job_type,
    payrollType: row.payroll_type,
    attCategory: row.att_category,
    aadharNo: row.aadhar_no,
    panNo: row.pan_no,
    pfAcNo: row.pf_ac_no,
    pfUan: row.pf_uan,
    esiNo: row.esi_no,
    bankAcNo: row.b_ac_no,
    bankAcName: row.b_ac_name,
    bankName: row.b_name,
    bankBranch: row.b_branch,
    bankIfsc: row.b_ifsc,
    appoiOrderNo: row.appoi_order_no,
    appoiOrderDate: normalizeDate(row.appoi_order_date),
    preAppNo: row.pre_app_no,
    preRelivNo: row.pre_reliv_no,
    preExpNo: row.pre_exp_no,
    salary1: row.salary_1,
    passportNo: row.passport_no,
    drivingLic: row.driving_lic,
    voterId: row.voter_id,
    ebProof: row.eb_proof,
    rentalAgree: row.rental_agree,
    pvtClinicName: row.pvt_clinic_name,
    pvtClinicCity: row.pvt_clinic_city,
    pvtClinicRemarks: row.pvt_clinic_remarks,
    languageIds: parseLanguageIds(row.language_known),
    releavingDate: normalizeDate(row.releaving_date),
    releavingInfo: row.releaving_info,
    releavingAttachment: row.releaving_attachment,
    releavingAttachmentUrl: row.releaving_attachment
      ? legacyPublicFileUrl(`staff_documents/${row.releaving_attachment}`)
      : null,
  };
}

async function loadEduLabel(id) {
  if (!id) return null;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT category_name, category_sname FROM edu_setup_tb
     WHERE del = 1 AND id = '${escapeSql(String(id))}' LIMIT 1`,
  );
  if (!rows.length) return null;
  return rows[0].category_name || rows[0].category_sname;
}

async function loadMasterLabel(table, id) {
  if (!id) return null;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT name FROM ${table} WHERE del = 1 AND id = ${Number(id) || 0} LIMIT 1`,
  );
  return rows[0]?.name || null;
}

function isDesignationActive(row, today = new Date()) {
  const day = new Date(today);
  day.setHours(0, 0, 0, 0);
  if (row.fromDate && row.fromDate !== '0000-00-00') {
    const from = new Date(row.fromDate);
    from.setHours(0, 0, 0, 0);
    if (from > day) return false;
  }
  if (row.toDate && row.toDate !== '0000-00-00') {
    const to = new Date(row.toDate);
    to.setHours(0, 0, 0, 0);
    if (to < day) return false;
  }
  return true;
}

function pickCurrentRoleFromHistory(designations) {
  const active = designations.filter((d) => isDesignationActive(d));
  const academic = active.filter((d) => d.isAcademic);
  const pool = academic.length ? academic : active;
  return pool[pool.length - 1] || designations[designations.length - 1] || null;
}

async function resolveCurrentRole(staffRowId, designations) {
  const academic = await loadAcademicDesignation(staffRowId);
  if (academic) {
    return {
      departmentId: academic.department,
      departmentName: academic.dept_name || null,
      designationId: academic.designation,
      designationName: academic.desg_name || null,
    };
  }
  const picked = pickCurrentRoleFromHistory(designations);
  if (!picked) return null;
  return {
    departmentId: picked.departmentId,
    departmentName: picked.departmentName,
    designationId: picked.designationId,
    designationName: picked.designationName,
  };
}

async function loadAttCategoryLabel(payrollType, attCategory) {
  if (!attCategory) return null;
  const id = Number(attCategory);
  if (!Number.isFinite(id)) return attCategory;
  if (String(payrollType).toLowerCase() === 'fixed') {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT payroll_type FROM basic_setup_payroll_tb WHERE del = 1 AND id = ${id} LIMIT 1`,
    );
    return rows[0]?.payroll_type || null;
  }
  const rows = await prisma.$queryRawUnsafe(
    `SELECT staff_category, morning_in, evening_in
     FROM basic_attendance_setup_tb WHERE del = 1 AND id = ${id} LIMIT 1`,
  );
  if (!rows.length) return null;
  const r = rows[0];
  return `${r.staff_category} (${String(r.morning_in).slice(0, 5)}-${String(r.evening_in).slice(0, 5)})`;
}

export async function getStaffProfile(staffRowId) {
  const sid = parseId(staffRowId, 'staff id');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ${PROFILE_SELECT}
     FROM staff_profile_tb p
     WHERE p.del = 1 AND p.id = ${sid}
     LIMIT 1`,
  );

  if (!rows.length) return null;

  const profile = mapProfileRow(rows[0]);

  const [jobCategoryName, designationName, departmentName, bankName, attCategoryName, records] = await Promise.all([
    loadEduLabel(profile.jobCategoryId),
    loadMasterLabel('staff_desg_master', profile.designationId),
    loadMasterLabel('staff_dept_master', profile.departmentId),
    loadEduLabel(profile.bankName),
    loadAttCategoryLabel(profile.payrollType, profile.attCategory),
    loadProfileRecords(sid, profile.staffId),
  ]);

  profile.jobCategoryName = jobCategoryName;
  profile.designationName = designationName;
  profile.departmentName = departmentName;
  profile.bankNameLabel = bankName;
  profile.attCategoryName = attCategoryName;

  const designations = await prisma.$queryRawUnsafe(
    `SELECT d.id, d.department, d.designation, d.unit_type, d.is_academic,
      CAST(d.from_date AS CHAR) AS from_date,
      CAST(d.to_date AS CHAR) AS to_date
     FROM staff_designation_tb d
     WHERE d.del = 1 AND d.staff_id = '${String(sid)}'
     ORDER BY d.id ASC`,
  );

  const deptIds = [...new Set(designations.map((d) => d.department).filter(Boolean))];
  const desgIds = [...new Set(designations.map((d) => d.designation).filter(Boolean))];

  const deptMap = {};
  const desgMap = {};
  if (deptIds.length) {
    const deptRows = await prisma.$queryRawUnsafe(
      `SELECT id, name FROM staff_dept_master WHERE del = 1 AND id IN (${deptIds.join(',')})`,
    );
    deptRows.forEach((r) => { deptMap[Number(r.id)] = r.name; });
  }
  if (desgIds.length) {
    const desgRows = await prisma.$queryRawUnsafe(
      `SELECT id, name FROM staff_desg_master WHERE del = 1 AND id IN (${desgIds.join(',')})`,
    );
    desgRows.forEach((r) => { desgMap[Number(r.id)] = r.name; });
  }

  profile.designations = designations.map((d) => ({
    id: Number(d.id),
    departmentId: d.department,
    departmentName: deptMap[Number(d.department)] || null,
    designationId: d.designation,
    designationName: desgMap[Number(d.designation)] || null,
    unitType: d.unit_type || '',
    isAcademic: Number(d.is_academic) === 1,
    fromDate: normalizeDate(d.from_date),
    toDate: normalizeDate(d.to_date),
  }));

  const currentRole = await resolveCurrentRole(sid, profile.designations);
  if (currentRole) {
    profile.currentDepartmentId = currentRole.departmentId;
    profile.currentDepartmentName = currentRole.departmentName;
    profile.currentDesignationId = currentRole.designationId;
    profile.currentDesignationName = currentRole.designationName;
  } else {
    profile.currentDepartmentName = profile.departmentName;
    profile.currentDesignationName = profile.designationName;
  }

  const roleParts = [profile.currentDepartmentName, profile.currentDesignationName].filter(Boolean);
  profile.currentRoleLabel = roleParts.join(' · ') || null;

  Object.assign(profile, records);

  profile.photoUrl = await staffPhotoDisplayUrl(profile.staffId, 'profile', profile.photo);
  profile.displayName = [
    profile.staffTitle ? `${profile.staffTitle}.` : '',
    profile.staffName,
    profile.staffInitial,
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  profile.resigned = profile.releavingDate
    && profile.releavingDate !== '0000-00-00'
    && new Date(profile.releavingDate) < new Date(new Date().toDateString());

  return profile;
}

const DATE_FIELDS = new Set([
  'joined_date',
  'appoi_order_date',
  'quarters_date',
]);

const UPDATABLE_FIELDS = {
  staff_name: 'staffName',
  staff_initial: 'staffInitial',
  staff_title: 'staffTitle',
  staff_gender: 'gender',
  staff_bg: 'bloodGroup',
  staff_religion: 'religion',
  staff_community: 'community',
  staff_caste: 'caste',
  marital_status: 'maritalStatus',
  father_name: 'fatherName',
  spouse_name: 'spouseName',
  mobile_1: 'mobile1',
  mobile_2: 'mobile2',
  landline_no: 'landlineNo',
  email_id: 'emailId',
  permanent_address: 'permanentAddress',
  door_no: 'doorNo',
  street: 'street',
  post: 'post',
  taluk: 'taluk',
  district: 'district',
  state: 'state',
  country: 'country',
  pincode: 'pincode',
  c_door_no: 'cDoorNo',
  c_street: 'cStreet',
  c_post: 'cPost',
  c_taluk: 'cTaluk',
  c_district: 'cDistrict',
  c_state: 'cState',
  c_country: 'cCountry',
  c_pincode: 'cPincode',
  aadhar_no: 'aadharNo',
  pan_no: 'panNo',
  pf_ac_no: 'pfAcNo',
  pf_uan: 'pfUan',
  esi_no: 'esiNo',
  b_ac_no: 'bankAcNo',
  b_ac_name: 'bankAcName',
  b_name: 'bankName',
  b_branch: 'bankBranch',
  b_ifsc: 'bankIfsc',
  job_category: 'jobCategoryId',
  subject_specialization: 'departmentId',
  job_type: 'jobType',
  payroll_type: 'payrollType',
  att_category: 'attCategory',
  unit_type: 'unitType',
  appoi_order_no: 'appoiOrderNo',
  pre_app_no: 'preAppNo',
  pre_reliv_no: 'preRelivNo',
  pre_exp_no: 'preExpNo',
  salary_1: 'salary1',
  passport_no: 'passportNo',
  driving_lic: 'drivingLic',
  voter_id: 'voterId',
  eb_proof: 'ebProof',
  rental_agree: 'rentalAgree',
  pvt_clinic_name: 'pvtClinicName',
  pvt_clinic_city: 'pvtClinicCity',
  pvt_clinic_remarks: 'pvtClinicRemarks',
};

export async function updateStaffProfile(staffRowId, body, meta) {
  const sid = parseId(staffRowId, 'staff id');

  const existingRows = await prisma.$queryRawUnsafe(
    `SELECT id, staff_id FROM staff_profile_tb WHERE del = 1 AND id = ${sid} LIMIT 1`,
  );
  if (!existingRows.length) return { error: 'Staff not found' };

  if (body.staffId && body.staffId !== existingRows[0].staff_id) {
    const dupRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM staff_profile_tb WHERE del = 1 AND staff_id = '${escapeSql(body.staffId)}' AND id != ${sid} LIMIT 1`,
    );
    if (dupRows.length) return { error: 'Staff ID already exists' };
  }

  const data = {};
  Object.entries(UPDATABLE_FIELDS).forEach(([col, key]) => {
    if (body[key] !== undefined) data[col] = body[key];
  });
  if (body.staffId !== undefined) data.staff_id = body.staffId;
  if (body.joinedDate !== undefined) data.joined_date = body.joinedDate;
  if (body.appoiOrderDate !== undefined) data.appoi_order_date = body.appoiOrderDate;
  if (body.quartersDate !== undefined) data.quarters_date = body.quartersDate;
  if (body.usesQuartersAddress !== undefined) {
    data.communication_address = body.usesQuartersAddress ? '1' : '';
  }
  if (body.attenAuth !== undefined) {
    data.atten_auth = body.attenAuth ? 1 : 0;
  }
  if (body.classTypes !== undefined) {
    data.class_type = Array.isArray(body.classTypes)
      ? body.classTypes.filter(Boolean).join(',')
      : String(body.classTypes || '');
  }

  if (!Object.keys(data).length) {
    return { error: 'No fields to update' };
  }

  const sets = Object.entries(data)
    .map(([col, val]) => {
      if (DATE_FIELDS.has(col)) {
        return `${col}='${sqlDateOrNull(val)}'`;
      }
      return `${col}='${escapeSql(val)}'`;
    })
    .join(', ');

  await prisma.$executeRawUnsafe(
    `UPDATE staff_profile_tb SET ${sets},
      updated_dt=NOW(),
      updated_ip='${escapeSql(meta.ip || '')}',
      updated_by='${escapeSql(meta.username || '')}'
     WHERE id = ${sid}`,
  );

  await insertLog(
    ['staff_profile_edit', 'Update', 'Successful', `id=${sid}`, new Date(), meta.ip, '', meta.username],
    '',
  );

  return { success: true, profile: await getStaffProfile(sid) };
}
