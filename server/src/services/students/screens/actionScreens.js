import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId, parseOptionalId } from '../../../utils/sqlSafe.js';
import { saveLegacyBinaryFile } from '../../web/webUpload.js';
import { auditFields, logStudentModule } from '../studentModuleAudit.js';
import {
  ACTIVE,
  escapeHtml,
  formatStudentName,
  loadAcademicYears,
  loadCourseRows,
  loadPromotionYearPairs,
  loadStudentLookups,
  tableHtml,
  wrapReportHtml,
} from '../studentShared.js';
import {
  buildPromoteScreenPayload,
  splitYearType,
} from '../promoteHelpers.js';
import { searchStudents } from '../studentSearch.js';

const TEMP_CORE_FIELDS = [
  'application_no', 'admission_no', 'academic_year', 'course_id', 'register_no',
  'student_name', 'student_initial', 'student_gender', 'father_name', 'mother_name',
  'mobile_no', 'personal_email', 'join_status',
];

function mapTempRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    applicationNo: row.application_no,
    admissionNo: row.admission_no,
    academicYear: row.academic_year,
    courseId: row.course_id,
    registerNo: row.register_no,
    studentName: row.student_name,
    studentInitial: row.student_initial,
    gender: row.student_gender,
    fatherName: row.father_name,
    motherName: row.mother_name,
    mobileNo: row.mobile_no,
    personalEmail: row.personal_email,
    joinStatus: row.join_status,
  };
}

export async function loadPromoteScreen(memberId, fields = {}, audit = {}) {
  const lookups = await loadStudentLookups();
  const promote = await buildPromoteScreenPayload(fields);
  if (!fields.Submit && fields.action !== 'preview') {
    await logStudentModule('student_promote.php', 'View', 'Successful', '', memberId, audit);
  }
  return { ...lookups, ...promote, reportHtml: null };
}

export async function savePromoteScreen(payload, memberId, audit = {}) {
  const { create } = auditFields(memberId, audit);
  const fromYear = escapeSql(payload.from_a_year || '');
  const toYear = escapeSql(payload.to_a_year || '');
  const fromClass = String(payload.from_class || '').split('___');
  const toClass = String(payload.to_class || '').split('___');
  const fromCourse = escapeSql(fromClass[0] || '');
  const toCourse = escapeSql(toClass[0] || '');
  const fromBatch = escapeSql(fromClass[1] || 'regular');
  const toBatch = escapeSql(toClass[1] || 'regular');
  const mappings = Array.isArray(payload.mappings) ? payload.mappings : [];
  let count = 0;

  for (const map of mappings) {
    if (!map.allow) continue;
    const from = splitYearType(map.fromYear, map.fromType);
    const to = splitYearType(map.toYear, map.toType);
    const fromYearNum = escapeSql(from.year);
    const toYearNum = escapeSql(to.year);
    const fromType = escapeSql(from.type);
    const toType = escapeSql(to.type || from.type);
    const failList = String(map.failList || '').toLowerCase().replace(/\s/g, '').split(',').filter(Boolean);

    const students = await prisma.$queryRawUnsafe(
      `SELECT A.id, A.register_no, B.id AS aid, B.student_activity, B.academic_type,
              B.student_boarding, B.student_transport
       FROM student_profile_tb AS A
       INNER JOIN student_academic_tb AS B ON A.id = B.s_id
       WHERE A.course_id='${fromCourse}' AND B.course_id='${fromCourse}'
         AND B.academic_year='${fromYear}' AND B.current_year='${fromYearNum}'
         AND B.academic_type='${fromType}' AND B.academic_batch='${fromBatch}'
         AND CAST(A.releaving_date AS CHAR)='0000-00-00' AND B.del=1 AND A.del=1
       ORDER BY B.register_no ASC`,
    );

    for (const s of students) {
      if (failList.includes(String(s.register_no).toLowerCase())) continue;
      const exists = await prisma.$queryRawUnsafe(
        `SELECT id FROM student_academic_tb WHERE s_id=${Number(s.id)}
         AND academic_year='${toYear}' AND academic_batch='${toBatch}' AND del=1 LIMIT 1`,
      );
      if (exists.length) continue;
      await prisma.$executeRawUnsafe(
        `INSERT INTO student_academic_tb (
          s_id, course_id, register_no, academic_year, academic_batch, current_year,
          student_activity, academic_type, student_boarding, student_transport,
          created_dt, created_ip, created_by
        ) VALUES (
          ${Number(s.id)}, '${toCourse}', '${escapeSql(s.register_no)}', '${toYear}', '${toBatch}',
          '${toYearNum}', '${escapeSql(s.student_activity || '')}', '${toType}',
          '${escapeSql(s.student_boarding || '')}', '${escapeSql(s.student_transport || '')}',
          NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(create.created_by)}'
        )`,
      );
      count += 1;
    }
  }

  await logStudentModule('student_promote.php', 'Promote', 'Successful', String(count), memberId, audit);
  return { success: true, message: `${count} student(s) promoted`, promotedCount: count };
}

export async function loadAcademicPromotionScreen(memberId, fields = {}, audit = {}) {
  const lookups = await loadStudentLookups();
  const registerNo = String(fields.register_no || fields.registerNo || '').trim();
  let profile = null;
  let academics = [];

  if (registerNo) {
    const students = await searchStudents({ by: 'roll', q: registerNo });
    if (students.length) {
      const sid = students[0].id;
      profile = students[0];
      academics = await prisma.$queryRawUnsafe(
        `SELECT id, academic_year, academic_batch, current_year, academic_type,
                student_activity, register_no, course_id, student_transport
         FROM student_academic_tb WHERE del=1 AND s_id=${sid} ORDER BY academic_year DESC`,
      );
    }
  }

  if (!fields.Submit && !registerNo) {
    await logStudentModule('student_academic.php', 'View', 'Successful', '', memberId, audit);
  }
  return { ...lookups, profile, academics: academics.map((a) => ({
    id: Number(a.id),
    academicYear: a.academic_year,
    academicBatch: a.academic_batch,
    currentYear: a.current_year,
    academicType: a.academic_type,
    studentActivity: a.student_activity,
    registerNo: a.register_no,
    courseId: a.course_id,
    studentTransport: a.student_transport,
  })) };
}

export async function saveAcademicPromotionScreen(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);
  const sid = parseId(payload.studentId, 'student id');
  const aid = payload.aid ? Number(payload.aid) : null;
  const yearBatch = String(payload.a_year_batch || '').split('___');
  const acYear = escapeSql(yearBatch[0] || payload.academicYear || '');
  const acBatch = escapeSql(yearBatch[1] || payload.academicBatch || 'regular');

  await prisma.$executeRawUnsafe(
    `UPDATE student_academic_tb SET del=0, updated_by='${escapeSql(update.updated_by)}',
     updated_ip='${escapeSql(update.updated_ip)}', updated_dt=NOW()
     WHERE s_id=${sid} AND academic_year='${acYear}' AND academic_batch='${acBatch}'`,
  );

  const fields = {
    current_year: escapeSql(payload.current_year || payload.currentYear || '1'),
    academic_year: acYear,
    academic_batch: acBatch,
    student_activity: escapeSql((payload.activity || []).join ? payload.activity.join(',') : (payload.studentActivity || '')),
    register_no: escapeSql(payload.acd_reg_no || payload.registerNo || ''),
    course_id: escapeSql(payload.ac_course || payload.courseId || ''),
    academic_type: escapeSql(payload.academic_type || payload.academicType || 'regular'),
    student_transport: escapeSql(payload.student_transport || payload.studentTransport || ''),
  };

  if (aid) {
    await prisma.$executeRawUnsafe(
      `UPDATE student_academic_tb SET
        current_year='${fields.current_year}', academic_year='${fields.academic_year}',
        academic_batch='${fields.academic_batch}', student_activity='${fields.student_activity}',
        register_no='${fields.register_no}', course_id='${fields.course_id}',
        academic_type='${fields.academic_type}', student_transport='${fields.student_transport}',
        del=1, updated_by='${escapeSql(update.updated_by)}', updated_ip='${escapeSql(update.updated_ip)}',
        updated_dt=NOW() WHERE id=${aid}`,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO student_academic_tb (
        s_id, course_id, register_no, academic_year, academic_batch, current_year,
        student_activity, academic_type, student_transport, created_dt, created_ip, created_by
      ) VALUES (
        ${sid}, '${fields.course_id}', '${fields.register_no}', '${fields.academic_year}',
        '${fields.academic_batch}', '${fields.current_year}', '${fields.student_activity}',
        '${fields.academic_type}', '${fields.student_transport}', NOW(),
        '${escapeSql(update.updated_ip)}', '${escapeSql(update.updated_by)}'
      )`,
    );
  }

  await logStudentModule('student_academic.php', 'Update', 'Successful', String(sid), memberId, audit);
  return { success: true, message: 'Academic details updated' };
}

export async function loadTempAdmissionAddScreen(memberId, _fields = {}, audit = {}) {
  const lookups = await loadStudentLookups();
  await logStudentModule('student_profile_temp_add.php', 'View', 'Successful', '', memberId, audit);
  return { ...lookups, profile: null };
}

export async function saveTempAdmissionAddScreen(payload, memberId, audit = {}) {
  const { create } = auditFields(memberId, audit);
  const appNo = escapeSql(payload.application_no || payload.applicationNo || '');
  if (!appNo) return { error: 'application_no is required' };
  const dup = await prisma.$queryRawUnsafe(
    `SELECT id FROM student_profile_temp_tb WHERE del=1 AND application_no='${appNo}' LIMIT 1`,
  );
  if (dup.length) return { error: 'Application number already exists' };

  const cols = [];
  const vals = [];
  for (const key of TEMP_CORE_FIELDS) {
    const val = payload[key] ?? payload[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
    if (val !== undefined && val !== '') {
      cols.push(key);
      vals.push(`'${escapeSql(val)}'`);
    }
  }
  cols.push('created_dt', 'created_ip', 'created_by', 'del', 'join_status');
  vals.push('NOW()', `'${escapeSql(create.created_ip)}'`, `'${escapeSql(create.created_by)}'`, '1', String(payload.join_status || 0));

  await prisma.$executeRawUnsafe(
    `INSERT INTO student_profile_temp_tb (${cols.join(', ')}) VALUES (${vals.join(', ')})`,
  );
  const row = await prisma.$queryRawUnsafe(
    `SELECT * FROM student_profile_temp_tb WHERE application_no='${appNo}' ORDER BY id DESC LIMIT 1`,
  );
  await logStudentModule('student_profile_temp_add.php', 'Add', 'Successful', appNo, memberId, audit);
  return { success: true, message: 'Temp admission saved', profile: mapTempRow(row[0]) };
}

export async function loadTempAdmissionEditScreen(memberId, fields = {}, audit = {}) {
  const lookups = await loadStudentLookups();
  const appNo = String(fields.application_no || fields.applicationNo || '').trim();
  let profile = null;
  if (appNo) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM student_profile_temp_tb WHERE del=1 AND application_no='${escapeSql(appNo)}' LIMIT 1`,
    );
    profile = mapTempRow(rows[0]);
  }
  await logStudentModule('student_profile_temp_edit.php', 'View', 'Successful', appNo, memberId, audit);
  return { ...lookups, profile };
}

export async function saveTempAdmissionEditScreen(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);
  const sid = parseId(payload.student_id || payload.studentId, 'student id');
  const appNo = escapeSql(payload.application_no || payload.applicationNo || '');
  const dup = await prisma.$queryRawUnsafe(
    `SELECT id FROM student_profile_temp_tb WHERE del=1 AND application_no='${appNo}' AND id!=${sid} LIMIT 1`,
  );
  if (dup.length) return { error: 'Application number already exists' };

  const sets = [];
  for (const key of TEMP_CORE_FIELDS) {
    const val = payload[key] ?? payload[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
    if (val !== undefined) sets.push(`${key}='${escapeSql(val)}'`);
  }
  sets.push(`updated_dt=NOW()`, `updated_ip='${escapeSql(update.updated_ip)}'`, `updated_by='${escapeSql(update.updated_by)}'`);

  await prisma.$executeRawUnsafe(
    `UPDATE student_profile_temp_tb SET ${sets.join(', ')} WHERE id=${sid}`,
  );
  const row = await prisma.$queryRawUnsafe(`SELECT * FROM student_profile_temp_tb WHERE id=${sid} LIMIT 1`);
  await logStudentModule('student_profile_temp_edit.php', 'Update', 'Successful', appNo, memberId, audit);
  return { success: true, message: 'Temp profile updated', profile: mapTempRow(row[0]) };
}

function formatAlumniDate(value) {
  if (!value) return '';
  const text = String(value);
  if (text.startsWith('0000-00-00')) return '';
  return text.slice(0, 10);
}

async function loadAlumniCourseOptions(selected = '') {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT course_name FROM basic_setup_course_tb WHERE del=1 ORDER BY c_order ASC`,
  );
  return rows.map((row) => ({
    value: row.course_name,
    label: row.course_name,
    selected: String(row.course_name) === String(selected),
  }));
}

function buildAlumniYopOptions(selected = '') {
  const startYear = 1994;
  const endYear = new Date().getFullYear();
  const options = [];
  for (let year = endYear; year >= startYear; year -= 1) {
    const value = `${year}-${year + 1}`;
    options.push({ value, label: value, selected: value === selected });
  }
  return options;
}

async function loadAlumniClassOptions(courseName, yop, selectedClass = '') {
  if (!courseName || !yop) return [];
  const startYear = String(yop).split('-')[0];
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, degree_name, department_name, full_part_time, course_duration
     FROM basic_setup_course_tb
     WHERE del=1 AND course_name='${escapeSql(courseName)}'
       AND year_of_start <= '${escapeSql(startYear)}'
     ORDER BY c_order ASC`,
  );
  return rows.map((row) => {
    const dept = row.department_name && String(row.department_name).trim() !== '-'
      ? ` - ${row.department_name}`
      : '';
    const label = `${row.degree_name}${dept} | ${row.full_part_time} (${row.course_duration} Years)`;
    return {
      value: String(row.id),
      label,
      selected: String(row.id) === String(selectedClass),
    };
  });
}

function buildStudentAddress(row) {
  return [row.door_no, row.street, row.post, row.taluk, row.district, row.state, row.pincode]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
}

function alumniFieldValues(payload) {
  const dobRaw = payload.dob || payload.a_dob || payload.alumni_dob || '';
  let alumniDob = '0000-00-00';
  if (dobRaw) {
    const parsed = new Date(dobRaw);
    if (!Number.isNaN(parsed.getTime())) {
      alumniDob = parsed.toISOString().slice(0, 10);
    }
  }
  return {
    regNo: escapeSql(payload.reg_no || payload.regNo || payload.a_regno || ''),
    name: escapeSql(payload.alumni_name || payload.name || payload.a_name || ''),
    email: escapeSql(payload.alumni_email || payload.email || payload.a_email || ''),
    mobile: escapeSql(payload.alumni_mobile || payload.mobile || payload.a_mobile || ''),
    address: escapeSql(payload.alumni_address || payload.address || payload.a_address || ''),
    course: escapeSql(payload.alumni_course || payload.course || payload.a_degree || ''),
    dept: escapeSql(payload.alumni_dept || payload.dept || payload.a_class || ''),
    yop: escapeSql(payload.alumni_yop || payload.yop || payload.a_year || ''),
    pgd: escapeSql(payload.alumni_pgd || payload.pgd || payload.a_pg || ''),
    cp: escapeSql(payload.alumni_cp || payload.cp || payload.a_clinic || ''),
    ws: escapeSql(payload.alumni_ws || payload.ws || payload.a_work || ''),
    gender: escapeSql(payload.alumni_gender || payload.gender || payload.a_gender || ''),
    alumniDob,
  };
}

async function loadStudentAlumniDraft(regNo) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.id, A.register_no, A.student_name, A.student_initial, A.personal_email, A.mobile_no,
            A.door_no, A.street, A.post, A.taluk, A.district, A.state, A.pincode, A.course_id,
            A.student_gender, A.academic_year,
            IF(CAST(A.student_dob AS CHAR) LIKE '0000-00-00%', NULL, CAST(A.student_dob AS CHAR)) AS student_dob,
            CAST(A.releaving_date AS CHAR) AS releaving_date,
            B.course_name
     FROM student_profile_tb AS A
     LEFT JOIN basic_setup_course_tb AS B ON B.id = A.course_id AND B.del = 1
     WHERE A.del = 1 AND A.register_no='${escapeSql(regNo)}'
     LIMIT 1`,
  );
  if (!rows.length) return null;

  const student = rows[0];
  const acRows = await prisma.$queryRawUnsafe(
    `SELECT academic_year FROM student_academic_tb
     WHERE del=1 AND s_id=${Number(student.id)} ORDER BY academic_year DESC LIMIT 1`,
  );
  let yop = acRows[0]?.academic_year || student.academic_year || '';
  const rel = String(student.releaving_date || '');
  if (rel && !rel.startsWith('0000')) {
    const d = new Date(rel);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      yop = `${y}-${y + 1}`;
    }
  }

  return {
    id: null,
    isNew: true,
    fromStudent: true,
    regNo: student.register_no || regNo,
    name: formatStudentName(student),
    email: student.personal_email || '',
    mobile: student.mobile_no || '',
    address: buildStudentAddress(student),
    course: student.course_name || '',
    dept: String(student.course_id || ''),
    yop,
    pgd: '',
    cp: '',
    ws: '',
    gender: student.student_gender || '',
    dob: formatAlumniDate(student.student_dob),
    file: '',
    photoUrl: null,
  };
}

async function findAlumniByRegNo(regNo) {
  return prisma.$queryRawUnsafe(
    `SELECT id, alumni_regno, alumni_name, alumni_email, alumni_mobile, alumni_address,
            alumni_course, alumni_dept, alumni_yop, alumni_pgd, alumni_cp, alumni_ws,
            alumni_gender,
            IF(CAST(alumni_dob AS CHAR) LIKE '0000-00-00%', NULL, CAST(alumni_dob AS CHAR)) AS alumni_dob,
            alumni_file
     FROM alumni_tb
     WHERE del=1 AND TRIM(alumni_regno)='${escapeSql(regNo)}'
     LIMIT 1`,
  );
}

function mapAlumniRow(row) {
  if (!row) return null;
  const file = String(row.alumni_file || '').replace(/%20/g, ' ');
  return {
    id: Number(row.id),
    regNo: row.alumni_regno || '',
    name: row.alumni_name || '',
    email: row.alumni_email || '',
    mobile: row.alumni_mobile || '',
    address: row.alumni_address || '',
    course: row.alumni_course || '',
    dept: row.alumni_dept || '',
    yop: row.alumni_yop || '',
    pgd: row.alumni_pgd || '',
    cp: row.alumni_cp || '',
    ws: row.alumni_ws || '',
    gender: row.alumni_gender || '',
    dob: formatAlumniDate(row.alumni_dob),
    file,
    photoUrl: file ? `/legacy/files/alumni/alumni_photos/${encodeURIComponent(file)}` : null,
  };
}

async function fetchAlumniListRows(whereClause = '', limit = 50) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, alumni_regno, alumni_name FROM alumni_tb
     WHERE del=1 ${whereClause}
     ORDER BY alumni_name ASC
     LIMIT ${limit}`,
  );
  return rows.map((row) => ({
    id: Number(row.id),
    regNo: row.alumni_regno || '',
    name: row.alumni_name || '',
  }));
}

async function fetchAlumniFullRow(id) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, alumni_regno, alumni_name, alumni_email, alumni_mobile, alumni_address,
            alumni_course, alumni_dept, alumni_yop, alumni_pgd, alumni_cp, alumni_ws,
            alumni_gender,
            IF(CAST(alumni_dob AS CHAR) LIKE '0000-00-00%', NULL, CAST(alumni_dob AS CHAR)) AS alumni_dob,
            alumni_file
     FROM alumni_tb WHERE del=1 AND id=${Number(id)} LIMIT 1`,
  );
  return rows[0] || null;
}

async function alumniEditPayload(alumni, fields = {}, extras = {}) {
  const classCourse = fields.course || alumni?.course || '';
  const classYop = fields.yop || alumni?.yop || '';
  const classDept = fields.dept || alumni?.dept || '';
  return {
    ...extras,
    alumni,
    courseOptions: await loadAlumniCourseOptions(classCourse),
    yopOptions: buildAlumniYopOptions(classYop),
    classOptions: alumni
      ? await loadAlumniClassOptions(classCourse, classYop, classDept)
      : [],
    selectedAlumniId: alumni?.id || extras.selectedAlumniId || null,
  };
}

export async function loadAlumniEditScreen(memberId, fields = {}, audit = {}) {
  const courseOptions = await loadAlumniCourseOptions();
  const yopOptions = buildAlumniYopOptions();
  const searchBy = fields.search_by === 'roll_no' ? 'roll_no' : 'name';
  const searchInput = String(fields.search_input ?? fields.reg_no ?? fields.regNo ?? '').trim();
  const alumniId = parseOptionalId(fields.alumni_id ?? fields.alumniId);

  if (alumniId && (fields.course || fields.yop)) {
    const row = await fetchAlumniFullRow(alumniId);
    if (row) {
      const alumni = mapAlumniRow(row);
      if (fields.course) alumni.course = fields.course;
      if (fields.yop) alumni.yop = fields.yop;
      if (!audit?.skipLog) {
        await logStudentModule('alumni_profile_edit.php', 'View', 'Successful', String(alumniId), memberId, audit);
      }
      return alumniEditPayload(alumni, fields, {
        alumniList: fields.alumniList || await fetchAlumniListRows(),
        selectedAlumniId: alumniId,
      });
    }
  }

  if (alumniId) {
    const row = await fetchAlumniFullRow(alumniId);
    if (!row) {
      return { courseOptions, yopOptions, classOptions: [], alumniList: fields.alumniList || await fetchAlumniListRows() };
    }
    const alumni = mapAlumniRow(row);
    if (!audit?.skipLog) {
      await logStudentModule('alumni_profile_edit.php', 'View', 'Successful', alumni.regNo, memberId, audit);
    }
    return alumniEditPayload(alumni, fields, {
      // Picking a specific alumnus from a filtered search shouldn't blow away that
      // search's results and replace them with the full unfiltered roster — reuse
      // the list the client already has (see AlumniEditPanel's handleSelectAlumni).
      alumniList: fields.alumniList || await fetchAlumniListRows(),
      selectedAlumniId: alumniId,
    });
  }

  if (searchInput) {
    const where = searchBy === 'roll_no'
      ? `AND TRIM(alumni_regno)='${escapeSql(searchInput)}'`
      : `AND alumni_name LIKE '%${escapeSql(searchInput)}%'`;
    const alumniList = await fetchAlumniListRows(where);

    if (!alumniList.length && searchBy === 'roll_no') {
      const draft = await loadStudentAlumniDraft(searchInput);
      if (draft) {
        if (!audit?.skipLog) {
          await logStudentModule('alumni_profile_edit.php', 'View', 'Successful', searchInput, memberId, audit);
        }
        return alumniEditPayload(draft, fields, { fromStudent: true, alumniList: [] });
      }
      if (!audit?.skipLog) {
        await logStudentModule('alumni_profile_edit.php', 'View', 'Successful', searchInput, memberId, audit);
      }
      return {
        courseOptions,
        yopOptions,
        classOptions: [],
        alumniList: [],
        notFound: true,
        message: 'No alumni profile found for this register number.',
      };
    }

    if (!alumniList.length) {
      if (!audit?.skipLog) {
        await logStudentModule('alumni_profile_edit.php', 'View', 'Successful', searchInput, memberId, audit);
      }
      return {
        courseOptions,
        yopOptions,
        classOptions: [],
        alumniList: [],
        notFound: true,
        message: 'No alumni found.',
      };
    }

    const row = await fetchAlumniFullRow(alumniList[0].id);
    const alumni = mapAlumniRow(row);
    if (!audit?.skipLog) {
      await logStudentModule('alumni_profile_edit.php', 'View', 'Successful', alumni.regNo, memberId, audit);
    }
    return alumniEditPayload(alumni, fields, {
      alumniList,
      selectedAlumniId: alumniList[0].id,
    });
  }

  if (!audit?.skipLog) {
    await logStudentModule('alumni_profile_edit.php', 'View', 'Successful', '', memberId, audit);
  }
  return {
    courseOptions,
    yopOptions,
    classOptions: [],
    alumniList: await fetchAlumniListRows(),
  };
}

export async function saveAlumniEditScreen(payload, memberId, audit = {}) {
  const { create, update } = auditFields(memberId, audit);
  const sid = parseOptionalId(payload.student_id || payload.studentId);
  const isNew = Boolean(payload.isNew) || !sid;
  const fields = alumniFieldValues(payload);
  if (!fields.regNo) return { error: 'Register number is required' };

  const dup = await prisma.$queryRawUnsafe(
    isNew
      ? `SELECT id FROM alumni_tb WHERE del=1 AND TRIM(alumni_regno)='${fields.regNo}' LIMIT 1`
      : `SELECT id FROM alumni_tb WHERE del=1 AND TRIM(alumni_regno)='${fields.regNo}' AND id!=${sid} LIMIT 1`,
  );
  if (dup.length) return { error: 'Register number already exists' };

  if (isNew) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO alumni_tb (
        alumni_name, alumni_email, alumni_mobile, alumni_address, alumni_course, alumni_dept,
        alumni_yop, alumni_pgd, alumni_cp, alumni_ws, alumni_regno, alumni_gender, alumni_dob,
        alumni_file, created_dt, created_ip, updated_by, updated_ip
      ) VALUES (
        '${fields.name}', '${fields.email}', '${fields.mobile}', '${fields.address}',
        '${fields.course}', '${fields.dept}', '${fields.yop}', '${fields.pgd}', '${fields.cp}',
        '${fields.ws}', '${fields.regNo}', '${fields.gender}', '${fields.alumniDob}', '',
        NOW(), '${escapeSql(create.created_ip)}', '${escapeSql(create.created_by)}', '${escapeSql(create.created_ip)}'
      )`,
    );
    await logStudentModule('alumni_profile_edit.php', 'Add', 'Successful', fields.regNo, memberId, audit);
    return {
      success: true,
      message: 'Alumni profile created',
      ...(await loadAlumniEditScreen(memberId, { reg_no: fields.regNo }, { ...audit, skipLog: true })),
    };
  }

  await prisma.$executeRawUnsafe(
    `UPDATE alumni_tb SET
      alumni_regno='${fields.regNo}',
      alumni_name='${fields.name}',
      alumni_email='${fields.email}',
      alumni_mobile='${fields.mobile}',
      alumni_address='${fields.address}',
      alumni_course='${fields.course}',
      alumni_dept='${fields.dept}',
      alumni_yop='${fields.yop}',
      alumni_pgd='${fields.pgd}',
      alumni_cp='${fields.cp}',
      alumni_ws='${fields.ws}',
      alumni_gender='${fields.gender}',
      alumni_dob='${fields.alumniDob}',
      updated_by='${escapeSql(update.updated_by)}',
      updated_ip='${escapeSql(update.updated_ip)}',
      updated_dt=NOW()
    WHERE id=${sid}`,
  );
  await logStudentModule('alumni_profile_edit.php', 'Update', 'Successful', fields.regNo, memberId, audit);
  return {
    success: true,
    message: 'Alumni profile updated',
    ...(await loadAlumniEditScreen(memberId, { reg_no: fields.regNo }, { ...audit, skipLog: true })),
  };
}

export async function loadCollageImageScreen(memberId, _fields = {}, audit = {}) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, image_title, image_filename FROM colage_image_tb WHERE del=1 ORDER BY id ASC LIMIT 200`,
  );
  await logStudentModule('colage_image.php', 'View', 'Successful', '', memberId, audit);
  return {
    images: rows.map((r) => ({
      id: Number(r.id),
      title: r.image_title,
      filename: r.image_filename,
      url: r.image_filename ? `/legacy/files/cage/cimg/${r.image_filename}` : null,
    })),
  };
}

export async function saveCollageImageScreen(payload, memberId, audit = {}) {
  const { update } = auditFields(memberId, audit);
  const titles = Array.isArray(payload.titles) ? payload.titles : [];
  const deleteIds = Array.isArray(payload.deleteIds) ? payload.deleteIds : [];
  for (const item of titles) {
    if (!item.id) continue;
    await prisma.$executeRawUnsafe(
      `UPDATE colage_image_tb SET image_title='${escapeSql(item.title || '')}',
       updated_dt=NOW(), updated_ip='${escapeSql(update.updated_ip)}',
       updated_by='${escapeSql(update.updated_by)}' WHERE id=${Number(item.id)}`,
    );
  }
  const files = Array.isArray(payload.files) ? payload.files : [];
  const uploadTitle = String(payload.photo_title || payload.albumTitle || '').trim();
  for (const file of files) {
    const result = await saveLegacyBinaryFile({
      folder: 'cage/cimg',
      file: { name: file.name, data: file.data },
      allowedExt: new Set(['png', 'jpg', 'jpeg', 'gif']),
      maxBytes: 5 * 1024 * 1024,
    });
    if (result.error) continue;
    const title = String(file.title || uploadTitle || '').trim();
    await prisma.$executeRawUnsafe(
      `INSERT INTO colage_image_tb (image_title, image_filename, updated_dt, updated_ip, updated_by, del)
       VALUES ('${escapeSql(title)}', '${escapeSql(result.filename)}', NOW(),
       '${escapeSql(update.updated_ip)}', '${escapeSql(update.updated_by)}', 1)`,
    );
  }
  for (const id of deleteIds) {
    if (!id) continue;
    await prisma.$executeRawUnsafe(
      `UPDATE colage_image_tb SET del=0, updated_dt=NOW(), updated_ip='${escapeSql(update.updated_ip)}',
       updated_by='${escapeSql(update.updated_by)}' WHERE id=${Number(id)}`,
    );
  }
  await logStudentModule('colage_image.php', 'Update', 'Successful', String(titles.length + files.length + deleteIds.length), memberId, audit);
  return { success: true, message: 'Collage images updated', ...(await loadCollageImageScreen(memberId, {}, { ...audit, skipLog: true })) };
}

export async function promotePreviewRows(fields) {
  const fromYear = escapeSql(fields.from_a_year || '');
  const fromClass = String(fields.from_class || '').split('___');
  const fromCourse = escapeSql(fromClass[0] || '');
  const fromBatch = escapeSql(fromClass[1] || 'regular');
  if (!fromYear || !fromCourse) return [];
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.register_no, A.student_name, A.student_initial, B.current_year, B.academic_type
     FROM student_profile_tb AS A
     INNER JOIN student_academic_tb AS B ON A.id = B.s_id
     WHERE A.course_id='${fromCourse}' AND B.academic_year='${fromYear}' AND B.academic_batch='${fromBatch}'
       AND B.del=1 AND A.del=1 AND CAST(A.releaving_date AS CHAR)='0000-00-00'
     ORDER BY B.register_no ASC LIMIT 500`,
  );
  return rows.map((r) => [
    escapeHtml(r.register_no),
    escapeHtml(formatStudentName(r)),
    escapeHtml(String(r.current_year)),
    escapeHtml(r.academic_type),
  ]);
}

export async function loadPromotePreviewScreen(memberId, fields = {}, audit = {}) {
  const rows = await promotePreviewRows(fields);
  const yearPairs = fields.from_a_year ? (await loadPromotionYearPairs(fields.from_a_year)).yearPairs : [];
  return {
    ...(await loadStudentLookups()),
    yearPairs,
    reportHtml: rows.length
      ? wrapReportHtml('Promotion Preview', tableHtml(['Register No', 'Name', 'Year', 'Type'], rows))
      : null,
  };
}
