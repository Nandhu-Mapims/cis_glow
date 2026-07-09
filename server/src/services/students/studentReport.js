import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/index.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { legacyPublicFileUrl } from '../../utils/fileUrls.js';

const YEAR_LABELS = ['', 'I', 'II', 'III', 'IV', 'Int.', 'VI', 'VII', 'VIII', 'IX', 'X'];

const STATIC_FIELD_GROUPS = {
  'Admission Information': [
    'Application No', 'Admission No', 'Admission Date', 'Source', 'Batch', 'Course', 'Year',
    'Academic Year', 'AR Number', 'Rank', 'NEET Admit No', 'NEET Roll No', 'NEET Score',
  ],
  'Register Information': [
    'Roll No', 'Register No', 'Biometric R.No', 'Student Full Name', 'Student Title',
    'Student Name', 'Student Initial',
  ],
  'DME Tuition Fees': ['TF Receipt Date', 'TF Recipt No.', 'TF Amount'],
  'Personal1 Information': [
    'Aadhar No', 'Father Name', 'Mother Name', 'Gender', 'DOB', 'Blood Group',
    'Willingness to donate Blood', 'EMIS No', 'UMIS No',
  ],
  'Personal2 Information': [
    'Religion', 'Community', 'Caste', 'Nationality', 'Scholarship', 'First Graduate', 'Hostel',
  ],
  'Parent Information': [
    'Father Occupation', 'Father M.Income', 'Mother Occupation', 'Mother M.Incoome',
  ],
  Guardian: [
    'Staying With Guardian', 'Relationship', 'Guardian Name', 'Guardian Mobile No',
    'Guardian Email', 'Guardian Address', 'Guardian City', 'Guardian Pincode',
  ],
  Contact: [
    'Student Mobile No', 'Father Mobile No', 'Mother Mobile No', 'Telephone No',
    'Student Email', 'Father Email', 'SMS Mobile No',
  ],
  'Permanet Address': [
    'Permanet Address Fully', 'P.Door No', 'P.Street', 'P.Post', 'P.Taluk',
    'P.District', 'P.State', 'P.Pincode',
  ],
  'Communication Address': [
    'Communication Address Fully', 'C.Door No', 'C.Street', 'C.Post', 'C.Taluk',
    'C.District', 'C.State', 'C.Pincode',
  ],
  'Identification Mark': ['Personal Identification'],
  'Mark Sheet': ['Mark Sheet'],
};

const STUDENT_SELECT = `
  A.id, A.admission_no, CAST(A.admission_date AS CHAR) AS admission_date,
  A.academic_year, A.admission_source, A.course_id, A.uregister_no, A.bregister_no,
  A.register_no, A.student_title, A.student_name, A.student_initial,
  A.father_name, A.father_occupation, A.father_income, A.mother_name,
  A.mother_occupation, A.mother_income, A.student_gender,
  CAST(A.student_dob AS CHAR) AS student_dob, A.student_bg, A.student_religion,
  A.student_caste, A.student_community, A.student_nationality,
  A.door_no, A.street, A.post, A.taluk, A.district, A.state, A.pincode,
  A.mobile_no, A.contact_no, A.father_mobile_1, A.institution_email, A.personal_email,
  A.comm_address, A.guardian_name, A.guardian_no, A.guardian_email,
  A.guardian_address, A.guardian_city, A.first_graduate, A.student_photo,
  A.scholar_ship, A.caste_scholar_ship, A.application_no, A.father_title, A.mother_title,
  A.donate_blood, A.staying_with, A.guardian_relation, A.guardian_pincode,
  A.mother_mobile, A.father_email, A.c_door_no, A.c_street, A.c_post, A.c_taluk,
  A.c_district, A.c_state, A.c_pincode,
  CAST(A.releaving_date AS CHAR) AS releaving_date, A.releaving_info, A.releaving_year,
  A.persional_identification, A.persional_identification_1,
  CAST(A.tc_apply_date AS CHAR) AS tc_apply_date,
  CAST(A.tc_issue_date AS CHAR) AS tc_issue_date, A.tc_number,
  CAST(A.tf_receipt_date AS CHAR) AS tf_receipt_date, A.tf_receipt_no, A.tf_amount,
  A.ar_number, A.ar_rank, A.sms_mobile, A.neet_adm_no, A.neet_roll_no, A.neet_score,
  A.aadhar_no, A.emis_no, A.umis_no`;

function formatCourseOption(course) {
  const dept = course.department_name && course.department_name !== '-'
    ? ` - ${course.department_name}`
    : '';
  const ft = course.full_part_time === 'Part Time' ? ' (P)' : '';
  const aided = Number(course.self_finance) === 1 ? '(U)' : '';
  return `${course.degree_name}${dept}${ft}${aided}`;
}

function convertNYear(year, courseType) {
  const labels = ['', 'I', 'II', 'III', 'IV', 'Int.', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const idx = Number(year);
  if (courseType && String(courseType).toLowerCase() === 'p.g' && labels[idx]) {
    return labels[idx];
  }
  return labels[idx] || String(year || '');
}

function formatDisplayDate(val) {
  if (!val || String(val).startsWith('0000-00-00')) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function expandFieldHeaders(fields) {
  const headers = [];
  for (const field of fields) {
    if (field === 'Personal Identification') {
      headers.push('Personal Identification1', 'Personal Identification2');
    } else if (field === 'Releaving Info') {
      headers.push('Releaving Info', 'R.Year');
    } else if (field === 'Mark Sheet') {
      headers.push(
        'Class/Program', 'Board/Univ.', 'Regsiter No', 'Passed Out',
        'Serial No', 'Issued Date', 'Marks %',
      );
    } else if (field.startsWith('CR_')) {
      const parts = field.split('_');
      headers.push(parts.slice(2).join('_') || field);
    } else if (field.trim()) {
      headers.push(field);
    }
  }
  return headers;
}

async function loadCategoryList() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, category_name FROM master_setup WHERE del != 0 ORDER BY category_order ASC`,
  );
  const map = {};
  for (const row of rows) {
    map[row.id] = row.category_name;
  }
  return map;
}

async function loadAcademicYearConfig() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ug_academic_year, uga_academic_year, pg_academic_year
     FROM basic_setup_tb WHERE del = 1 LIMIT 1`,
  );
  const row = rows[0] || {};
  return {
    'U.G': { regular: row.ug_academic_year, additional: row.uga_academic_year },
    'P.G': { regular: row.pg_academic_year, additional: null },
  };
}

async function loadCourseMetadata() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, course_name, degree_name, department_name
     FROM basic_setup_course_tb WHERE del = 1 ORDER BY c_order ASC`,
  );
  const courseById = {};
  const courseNameById = {};
  const orderIds = [];
  for (const row of rows) {
    courseById[row.id] = row;
    courseNameById[row.id] = row.course_name;
    orderIds.push(row.id);
  }
  return { courseById, courseNameById, orderIds };
}

function buildCourseAcademicFilter(orderIds, courseNameById, academicYearArray) {
  if (!orderIds.length) return '';
  const parts = orderIds.map((cId) => {
    const cName = courseNameById[cId];
    const acyear = academicYearArray[cName] || {};
    if (acyear.additional) {
      return `(A.course_id='${cId}' AND ((B.academic_year='${escapeSql(acyear.regular)}' AND B.academic_batch='regular') OR (B.academic_year='${escapeSql(acyear.additional)}' AND B.academic_batch='additional')))`;
    }
    return `(A.course_id='${cId}' AND B.academic_year='${escapeSql(acyear.regular)}' AND B.academic_batch='regular')`;
  });
  return ` AND (${parts.join(' OR ')})`;
}

function buildReportFilters(options) {
  const {
    courseName,
    searchBy,
    academicYear,
    discontinued,
    courseById,
    courseNameById,
    orderIds,
    academicYearArray,
  } = options;

  const courseParts = String(courseName || 'All---All').split('---');
  let academicYearSearch = '';
  let academicYearLabel = '';
  let academicCourseNameLabel = 'All Courses';

  if (courseParts[0] !== 'All' && courseParts[1] === 'All') {
    const ids = orderIds.filter((id) => courseNameById[id] === courseParts[0]);
    if (ids.length) {
      academicYearSearch += ` AND (${ids.map((id) => `A.course_id='${id}'`).join(' OR ')})`;
    }
    academicCourseNameLabel = `ALL ${courseParts[0]}`;
  } else if (courseParts[1] && courseParts[1] !== 'All') {
    academicYearSearch += ` AND A.course_id='${escapeSql(courseParts[1])}'`;
    const course = courseById[courseParts[1]];
    if (course) {
      const dept = course.department_name && course.department_name !== '-'
        ? ` ${course.department_name}`
        : '';
      academicCourseNameLabel = `${course.degree_name}${dept}`;
    }
  }

  if (searchBy === 'year') {
    if (academicYear && academicYear !== 'All___') {
      if (academicYear === 'All___regular') {
        academicYearSearch += " AND B.academic_batch='regular'";
        academicYearLabel = 'All year (Regular)';
      } else if (academicYear === 'All___additional') {
        academicYearSearch += " AND B.academic_batch='additional'";
        academicYearLabel = 'All year (Additional)';
      } else {
        const [yr, batch] = academicYear.split('___');
        academicYearSearch += ` AND B.current_year='${escapeSql(yr)}' AND B.academic_batch='${escapeSql(batch)}'`;
        academicYearLabel = `${yr} Year (${batch.charAt(0).toUpperCase()}${batch.slice(1)})`;
      }
    }
  } else if (academicYear && academicYear !== 'All') {
    academicYearSearch += ` AND A.academic_year='${escapeSql(academicYear)}'`;
    academicYearLabel = academicYear;
  }

  let discontinuedText = '';
  if (discontinued === 'Regular') {
    discontinuedText = " AND (A.releaving_date='0000-00-00' OR A.releaving_date>=DATE(NOW()))";
  } else if (discontinued === 'Discontinue') {
    discontinuedText = " AND (A.releaving_date!='0000-00-00' AND A.releaving_date<DATE(NOW()))";
  }

  const orderByLabel = orderIds.length
    ? `FIELD(A.course_id,${orderIds.map((id) => `'${id}'`).join(',')}), A.academic_year DESC, A.register_no ASC`
    : 'A.academic_year DESC, A.register_no ASC';

  const courseAcademicString = searchBy === 'year'
    ? buildCourseAcademicFilter(orderIds, courseNameById, academicYearArray)
    : '';

  return {
    academicYearSearch,
    academicYearLabel,
    academicCourseNameLabel,
    discontinuedText,
    orderByLabel,
    courseAcademicString,
  };
}

async function loadStudentAcademic(student, courseNameById, academicYearArray) {
  const courseName = courseNameById[student.course_id];
  const acyear = academicYearArray[courseName] || {};
  let aSearchStr = '';
  if (acyear.regular && acyear.additional) {
    aSearchStr = ` AND ((academic_year='${escapeSql(acyear.regular)}' AND academic_batch='regular') OR (academic_year='${escapeSql(acyear.additional)}' AND academic_batch='additional'))`;
  } else if (acyear.regular) {
    aSearchStr = ` AND academic_year='${escapeSql(acyear.regular)}' AND academic_batch='regular'`;
  }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT current_year, academic_type, student_boarding, student_transport, student_activity,
            academic_year, academic_batch
     FROM student_academic_tb
     WHERE s_id='${escapeSql(student.id)}'${aSearchStr}
     ORDER BY academic_year DESC, academic_batch DESC
     LIMIT 1`,
  );

  const row = rows[0] || {};
  return {
    currentYear: row.current_year,
    academicType: row.academic_type,
    studentBoarding: row.student_boarding,
    studentTransport: row.student_transport,
    studentActivity: row.student_activity ? String(row.student_activity).split(',') : [],
    cAcademicYear: row.academic_year,
    academicBatch: row.academic_batch,
  };
}

async function loadHostelInfo(studentId, currentDate) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.room_id, C.block_id
     FROM hostel_rooms_tb AS A
     INNER JOIN student_hostel_tb AS B ON A.id = B.room_no
     INNER JOIN hostel_blocks_tb AS C ON B.block_no = C.id
     WHERE A.del = 1 AND B.del = 1 AND C.del = 1
       AND B.s_id='${escapeSql(studentId)}'
       AND (B.to_month>='${escapeSql(currentDate)}' OR B.to_month='0000-00-00')
     LIMIT 1`,
  );
  if (!rows.length) return '';
  return `Yes (Block: ${rows[0].block_id}, Room: ${rows[0].room_id})`;
}

async function loadAttachmentNo(studentId, attachId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT attach_no FROM student_attachment_tb
     WHERE del = 1 AND attach_id='${escapeSql(attachId)}' AND s_id='${escapeSql(studentId)}'
     LIMIT 1`,
  );
  return rows[0]?.attach_no || '';
}

async function loadCertificates(studentId) {
  return prisma.$queryRawUnsafe(
    `SELECT cregister_no, course_name, board, year_of_passing, tmr_code,
            CAST(tmr_date AS CHAR) AS tmr_date, total_marks
     FROM student_certificate
     WHERE s_id='${escapeSql(studentId)}' AND del = 1
     ORDER BY FIELD(course_name, 'X', 'XII', 'U.G', 'P.G', 'Other'), id ASC`,
  );
}

function buildPermanentAddress(student) {
  let ref = '';
  if (student.door_no) ref = student.door_no;
  if (student.street) ref += ` ${student.street}`;
  if (student.post) ref += `, ${student.post}`;
  if (student.taluk) ref += `, ${student.taluk}`;
  if (student.district) ref += `, ${student.district}`;
  if (student.state) ref += `, ${student.state}`;
  if (student.pincode) ref += ` - ${student.pincode}`;
  return ref.trim();
}

function buildCommunicationAddress(student) {
  let ref = '';
  if (student.c_door_no) ref = student.c_door_no;
  if (student.c_street) ref += ` ${student.c_street}`;
  if (student.c_post) ref += `, ${student.c_post}`;
  if (student.c_taluk) ref += `, ${student.c_taluk}`;
  if (student.c_district) ref += `, ${student.c_district}`;
  if (student.c_state) ref += `, ${student.c_state}`;
  if (student.c_pincode) ref += ` - ${student.c_pincode}`;
  return ref.trim();
}

function formatAadhar(aadhar) {
  const s = String(aadhar || '').replace(/\s/g, '');
  if (s.length < 12) return s;
  return `${s.slice(0, 4)} ${s.slice(4, 8)} ${s.slice(8, 12)}`;
}

function formatYearField(student, academic, courseById, courseNameById) {
  const course = courseById[student.course_id];
  if (!academic.currentYear || !course) return '';
  const yearLabel = convertNYear(academic.currentYear, courseNameById[student.course_id]);
  const typeSuffix = academic.academicType ? ` (${academic.academicType})` : '';
  return `${yearLabel} - ${course.degree_name}${typeSuffix}`;
}

function formatCourseField(student, courseById) {
  const course = courseById[student.course_id];
  if (!course) return '';
  const dept = course.department_name && String(course.department_name).trim()
    ? ` - ${course.department_name}`
    : '';
  return `${course.degree_name}${dept}`;
}

async function resolveFieldCells(field, student, ctx) {
  const { categoryList, courseById, courseNameById, academic, currentDate } = ctx;
  const val = (v) => (v == null ? '' : String(v));

  switch (field) {
    case 'Application No': return [val(student.application_no)];
    case 'Admission No': return [val(student.admission_no)];
    case 'Admission Date': return [formatDisplayDate(student.admission_date)];
    case 'Source': return [val(categoryList[student.admission_source])];
    case 'Batch': return [val(student.academic_year)];
    case 'Academic Year': {
      const suffix = academic.academicBatch === 'additional' ? ' (Additional)' : '';
      return [val(academic.cAcademicYear) + suffix];
    }
    case 'TF Receipt Date': return [formatDisplayDate(student.tf_receipt_date)];
    case 'TF Recipt No.': return [val(student.tf_receipt_no)];
    case 'TF Amount': return [val(student.tf_amount)];
    case 'AR Number': return [val(student.ar_number)];
    case 'Rank': return [val(student.ar_rank)];
    case 'NEET Admit No': return [val(student.neet_adm_no)];
    case 'NEET Roll No': return [val(student.neet_roll_no)];
    case 'NEET Score': return [val(student.neet_score)];
    case 'EMIS No': return [val(student.emis_no)];
    case 'UMIS No': return [val(student.umis_no)];
    case 'Aadhar No': return [formatAadhar(student.aadhar_no)];
    case 'Year': return [formatYearField(student, academic, courseById, courseNameById)];
    case 'Hostel': return [await loadHostelInfo(student.id, currentDate)];
    case 'Course': return [formatCourseField(student, courseById)];
    case 'Roll No': return [val(student.register_no)];
    case 'Register No': return [val(student.uregister_no)];
    case 'Biometric R.No': return [val(student.bregister_no)];
    case 'Scholarship': {
      if (student.scholar_ship != 1) return [''];
      const cast = student.caste_scholar_ship
        ? ` (${String(student.caste_scholar_ship).toUpperCase()})`
        : '';
      return [`Yes${cast}`];
    }
    case 'First Graduate': return [student.first_graduate == 1 ? 'Yes' : ''];
    case 'Student Full Name':
      return [`${val(student.student_title)} ${val(student.student_name)} ${val(student.student_initial)}`.trim()];
    case 'Student Title': return [val(student.student_title)];
    case 'Student Initial': return [val(student.student_initial)];
    case 'Student Name': return [val(student.student_name)];
    case 'Father Name':
      return [`${val(student.father_title)} ${val(student.father_name)}`.trim()];
    case 'Mother Name':
      return [`${val(student.mother_title)} ${val(student.mother_name)}`.trim()];
    case 'Gender': return [val(student.student_gender)];
    case 'DOB': return [formatDisplayDate(student.student_dob)];
    case 'Blood Group': return [val(categoryList[student.student_bg])];
    case 'Willingness to donate Blood': return [student.donate_blood == 1 ? 'Yes' : ''];
    case 'Religion': return [val(categoryList[student.student_religion])];
    case 'Community': return [val(categoryList[student.student_community])];
    case 'Caste': return [val(student.student_caste)];
    case 'Nationality': return [val(student.student_nationality)];
    case 'Father Occupation': return [val(student.father_occupation)];
    case 'Father M.Income': return [val(student.father_income)];
    case 'Mother Occupation': return [val(student.mother_occupation)];
    case 'Mother M.Incoome':
    case 'Mother M.Income': return [val(student.mother_income)];
    case 'Staying With Guardian': return [student.staying_with == 1 ? 'Yes' : ''];
    case 'Relationship': return [val(student.guardian_relation)];
    case 'Guardian Name': return [val(student.guardian_name)];
    case 'Guardian Mobile No': return [val(student.guardian_no)];
    case 'Guardian Email': return [val(student.guardian_email)];
    case 'Guardian Address': return [val(student.guardian_address)];
    case 'Guardian City': return [val(student.guardian_city)];
    case 'Guardian Pincode': return [val(student.guardian_pincode)];
    case 'Student Mobile No': return [val(student.mobile_no)];
    case 'Father Mobile No': return [val(student.father_mobile_1)];
    case 'Mother Mobile No': return [val(student.mother_mobile)];
    case 'Telephone No': return [val(student.contact_no)];
    case 'Student Email': return [val(student.personal_email)];
    case 'Father Email': return [val(student.father_email)];
    case 'SMS Mobile No': return [val(student.sms_mobile)];
    case 'Permanet Address Fully': return [buildPermanentAddress(student)];
    case 'P.Door No': return [val(student.door_no)];
    case 'P.Street': return [val(student.street)];
    case 'P.Post': return [val(student.post)];
    case 'P.Taluk': return [val(student.taluk)];
    case 'P.District': return [val(student.district)];
    case 'P.State': return [val(student.state)];
    case 'P.Pincode': return [val(student.pincode)];
    case 'Communication Address Fully': return [buildCommunicationAddress(student)];
    case 'C.Door No': return [val(student.c_door_no)];
    case 'C.Street': return [val(student.c_street)];
    case 'C.Post': return [val(student.c_post)];
    case 'C.Taluk': return [val(student.c_taluk)];
    case 'C.District': return [val(student.c_district)];
    case 'C.State': return [val(student.c_state)];
    case 'C.Pincode': return [val(student.c_pincode)];
    case 'Personal Identification':
      return [val(student.persional_identification), val(student.persional_identification_1)];
    case 'Hosteller': return [academic.studentBoarding == 1 ? 'Yes' : ''];
    case 'Transport': return [academic.studentTransport == 1 ? 'Yes' : ''];
    case 'Activities': {
      const actList = academic.studentActivity
        .map((actId) => categoryList[actId])
        .filter(Boolean)
        .join(', ');
      return [actList];
    }
    case 'Releaving Date':
      return [formatDisplayDate(student.releaving_date)];
    case 'Releaving Info': {
      if (String(student.releaving_info || '').toLowerCase() !== 'discontinued') {
        return ['Completed', ''];
      }
      return ['Discontinued', val(student.releaving_year)];
    }
    case 'TC Apply Date': return [formatDisplayDate(student.tc_apply_date)];
    case 'TC Issue Date': return [formatDisplayDate(student.tc_issue_date)];
    case 'TC No.': return [val(student.tc_number)];
    case 'Mark Sheet': {
      const certs = await loadCertificates(student.id);
      if (!certs.length) return [['', '', '', '', '', '', '']];
      return certs.map((cert) => [
        val(cert.course_name),
        val(cert.board),
        val(cert.cregister_no),
        val(cert.year_of_passing),
        val(cert.tmr_code),
        formatDisplayDate(cert.tmr_date),
        val(cert.total_marks),
      ]);
    }
    default: {
      if (field.startsWith('CR_')) {
        const attachId = field.split('_')[1];
        return [await loadAttachmentNo(student.id, attachId)];
      }
      return field.trim() ? [''] : [];
    }
  }
}

async function buildStudentRows(students, fields, showSerialNo, meta) {
  const rows = [];
  let counter = 1;
  for (const student of students) {
    const academic = await loadStudentAcademic(
      student,
      meta.courseNameById,
      meta.academicYearArray,
    );
    const ctx = { ...meta, academic };
    const segments = [];
    let markSheetExtras = [];

    if (showSerialNo) segments.push({ type: 'serial', values: [String(counter)] });

    for (const field of fields) {
      const resolved = await resolveFieldCells(field, student, ctx);
      if (field === 'Mark Sheet') {
        const certRows = resolved.length ? resolved : [['', '', '', '', '', '', '']];
        segments.push({ type: 'marksheet', values: certRows[0] });
        markSheetExtras = certRows.slice(1);
      } else {
        segments.push({ type: 'field', values: resolved });
      }
    }

    const rowspan = Math.max(1, 1 + markSheetExtras.length);
    rows.push({ segments, rowspan, markSheetExtras });
    counter += 1;
  }

  return rows;
}

function flattenRowSegments(segments, markSheetExtras = null) {
  const cells = [];
  for (const segment of segments) {
    if (segment.type === 'marksheet') {
      cells.push(...(markSheetExtras || segment.values));
    } else if (markSheetExtras) {
      cells.push(...segment.values.map(() => ''));
    } else {
      cells.push(...segment.values);
    }
  }
  return cells;
}

function buildTableHtml(fields, tableRows, showSerialNo) {
  const colCount = expandFieldHeaders(fields).length + (showSerialNo ? 1 : 0);
  let header = `<table cellpadding='3' cellspacing='0' class='table table-bordered'>
<thead>
<tr><th colspan='${fields.length}' nowrap style='background:none; border: none;'>&nbsp;</th></tr>
<tr bgcolor='#CCCCCC'>`;
  if (showSerialNo) {
    header += "<th nowrap height='30' align='left'>S.No.</th>";
  }
  for (const field of fields) {
    if (field === 'Personal Identification') {
      header += "<th height='30' nowrap align='left'>Personal Identification1</th><th nowrap align='left'>Personal Identification2</th>";
    } else if (field === 'Releaving Info') {
      header += "<th height='30' nowrap align='left'>Releaving Info</th><th align='left' nowrap>R.Year</th>";
    } else if (field === 'Mark Sheet') {
      header += `<th align='left' nowrap>Class/Program</th>
  <th align='left' nowrap>Board/Univ.</th>
  <th height='30' nowrap align='left'>Regsiter No</th>
  <th align='left' nowrap>Passed Out</th>
  <th height='30' nowrap align='left'>Serial No</th>
  <th align='left' nowrap>Issued Date</th>
  <th height='30' nowrap align='left'>Marks %</th>`;
    } else if (field.startsWith('CR_')) {
      const label = field.split('_').slice(2).join('_');
      header += `<th align='left' nowrap>${escapeHtml(label)}</th>`;
    } else if (field.trim()) {
      header += `<th height='30' nowrap align='left'>${escapeHtml(field)}</th>`;
    }
  }
  header += `</tr></thead>
<tfoot>
<tr><th height='30' align='right' colspan='${Math.max(colCount - 2, 1)}' style='border: none;'>&nbsp;</th>
<th height='30' align='right' width='200'><span id='print_page_no' style='text-align:center; border: none;'>&nbsp;</span></th>
</tr>
</tfoot>`;

  let body = '';
  for (const row of tableRows) {
    const spanAttr = row.rowspan > 1 ? ` rowspan="${row.rowspan}"` : '';
    body += '<tr>';
    for (const segment of row.segments) {
      if (segment.type === 'marksheet') {
        for (const cell of segment.values) {
          body += `<td height='25' nowrap>${escapeHtml(cell)}&nbsp;</td>`;
        }
      } else {
        for (const cell of segment.values) {
          body += `<td nowrap valign='top'${spanAttr}>${escapeHtml(cell)}&nbsp;</td>`;
        }
      }
    }
    body += '</tr>';

    for (const extra of row.markSheetExtras) {
      body += '<tr>';
      for (const segment of row.segments) {
        if (segment.type === 'marksheet') {
          for (const cell of extra) {
            body += `<td height='25' nowrap>${escapeHtml(cell)}&nbsp;</td>`;
          }
        }
      }
      body += '</tr>';
    }
  }

  return `${header}${body}</table>`;
}

async function buildReportHtml(options, tableHtml) {
  const {
    showHeader,
    reportTitle,
    academicYearLabel,
    academicCourseNameLabel,
    searchBy,
  } = options;

  let metaBlock = '';
  if (showHeader) {
    const bannerRows = await prisma.$queryRawUnsafe(
      `SELECT banner_image FROM basic_banner_tb WHERE del = 1 AND id = 1 LIMIT 1`,
    );
    const banner = bannerRows[0]?.banner_image;
    const logo = banner
      ? `<img src='/legacy/img/global_images/${escapeHtml(banner)}' width='500' height='100' />`
      : '';
    metaBlock = `<table class="header_table" height="96" border="0" cellpadding="0" cellspacing="0" width="100%">
<tbody><tr>
<td height="95" align="center" valign="middle" width="70%">${logo}</td>
<td nowrap valign="top" width="30%"><div class="promote_card">
<span>Student Report</span>${academicYearLabel ? `<br>${escapeHtml(academicYearLabel)}` : ''}
<br><span class="note_content">${escapeHtml(academicCourseNameLabel)}</span>
</div></td>
</tr></tbody></table>
<p>${escapeHtml(reportTitle)}</p>`;
  } else {
    metaBlock = `<table border="0" cellpadding="3" cellspacing="0" width="50%" class="table table-bordered"><tbody>`;
    if (academicCourseNameLabel) {
      metaBlock += `<tr><td width="14%" align="right" class="padding_right15"><p class="note_content" style="font-size:14px;">Course</p></td>
<td width="86%" class="border_bottom"><p class="note_content" style="font-size:18px;"><strong>${escapeHtml(academicCourseNameLabel)}</strong></p></td></tr>`;
    }
    if (academicYearLabel) {
      metaBlock += `<tr><td width="14%" align="right" class="padding_right15"><p class="note_content" style="font-size:14px;">${escapeHtml(searchBy)}</p></td>
<td width="86%" class="border_bottom"><p class="note_content padding_left15" style="font-size:16px;"><strong>${escapeHtml(academicYearLabel)}</strong></p></td></tr>`;
    }
    if (reportTitle) {
      metaBlock += `<tr><td width="14%" align="right" class="padding_right15"><p class="note_content" style="font-size:14px;">Title</p></td>
<td width="86%" class="border_bottom"><p class="note_content padding_left15" style="font-size:16px;"><strong>${escapeHtml(reportTitle)}</strong></p></td></tr>`;
    }
    metaBlock += '</tbody></table>';
  }

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1" />
<title>Student Report</title>
<link href="/legacy/css/bootstrap.min.css" rel="stylesheet">
<link href="/legacy/assets/font-awesome/css/font-awesome.css" rel="stylesheet" />
<link href="/legacy/css/style.css" rel="stylesheet">
<link href="/legacy/css/print_style.css?v=1" rel="stylesheet">
<style>
@media print {
thead { display: table-header-group;}
tfoot { display: table-footer-group; }
body {counter-reset:section;}
#print_page_no { font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #333333; margin: 0px; padding: 0px;}
#print_page_no:after{counter-increment:section;content: "Page: " counter(section);}
}
.table-bordered{ border: none;}
</style>
</head>
<body onload="window.print()" style="padding-left:50px;">
<div style="width:850px; margin:20px 10px 20px 30px;">
${metaBlock}
${tableHtml}
</div>
</body>
</html>`;
}

async function writeCsvExport(headers, tableRows) {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of tableRows) {
    lines.push(flattenRowSegments(row.segments).map(csvCell).join(','));
    for (const extra of row.markSheetExtras) {
      lines.push(flattenRowSegments(row.segments, extra).map(csvCell).join(','));
    }
  }

  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const filename = `student_profile_report_${timestamp}.csv`;
  const excelDir = path.join(config.legacyFilesPath, 'excel');
  await fs.mkdir(excelDir, { recursive: true });
  await fs.writeFile(path.join(excelDir, filename), `\uFEFF${lines.join('\n')}`, 'utf8');

  return {
    downloadUrl: legacyPublicFileUrl(`excel/${filename}`),
    filename,
    format: 'csv',
  };
}

/**
 * Field catalog for student export (legacy student_profile_export.php).
 */
export async function getStudentReportFields() {
  const attachmentRows = await prisma.$queryRawUnsafe(
    `SELECT id, category_name FROM master_setup
     WHERE category = 'Attachment' AND del != 0
     ORDER BY category_order ASC`,
  );

  const attachmentFields = attachmentRows.map(
    (row) => `CR_${row.id}_${row.category_name}`,
  );

  const groups = Object.entries(STATIC_FIELD_GROUPS).map(([name, fields]) => ({
    name,
    fields: [...fields],
  }));

  groups.push({
    name: 'Attachments',
    fields: attachmentFields,
  });

  return { groups };
}

/**
 * Course / batch / year filter options for export.
 */
export async function getStudentReportFilters() {
  const courseRows = await prisma.$queryRawUnsafe(
    `SELECT id, course_name, degree_name, department_name, full_part_time, c_order
     FROM basic_setup_course_tb WHERE del = 1 ORDER BY c_order ASC`,
  );

  const batchRows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT CAST(academic_year AS CHAR) AS academic_year
     FROM student_profile_tb WHERE del = 1
     ORDER BY academic_year DESC`,
  );

  const courseOptions = [{ value: 'All---All', label: 'All Courses' }];
  const courseGroups = {};

  for (const row of courseRows) {
    const courseName = row.course_name;
    if (!courseGroups[courseName]) {
      courseGroups[courseName] = [];
      courseOptions.push({
        value: `${courseName}---All`,
        label: `${courseName} Courses`,
      });
    }
    courseGroups[courseName].push({
      value: `${courseName}---${row.id}`,
      label: formatCourseOption(row),
    });
  }

  const groupedCourses = Object.entries(courseGroups).map(([courseName, options]) => ({
    courseName,
    options,
  }));

  const batchOptions = [
    { value: 'All', label: '--All Batch--' },
    ...batchRows.map((row) => ({
      value: row.academic_year,
      label: row.academic_year,
    })),
  ];

  const yearOptions = [
    { value: 'All___', label: 'All Year' },
    { value: 'All___regular', label: 'All Regular' },
    { value: 'All___additional', label: 'All Additional' },
  ];

  for (let i = 1; i <= 5; i += 1) {
    const label = YEAR_LABELS[i] || String(i);
    yearOptions.push(
      { value: `${i}___regular`, label: `${label} Year (R)` },
      { value: `${i}___additional`, label: `${label} Year (A)` },
    );
  }

  return {
    courseOptions,
    groupedCourses,
    batchOptions,
    yearOptions,
  };
}

/**
 * Generate student report HTML or CSV export (legacy student_profile_export_more/xls.php).
 */
export async function generateStudentReport(payload) {
  const fields = Array.isArray(payload.fields)
    ? payload.fields.map((f) => String(f).trim()).filter(Boolean)
    : String(payload.fields || '').split(',').map((f) => f.trim()).filter(Boolean);

  if (!fields.length) {
    return { error: 'At least one report field is required' };
  }

  const format = payload.format === 'xls' ? 'xls' : 'html';
  const searchBy = payload.searchBy === 'year' ? 'year' : 'batch';
  const academicYear = payload.academicYear
    || (searchBy === 'year' ? 'All___' : 'All');
  const discontinued = ['Regular', 'Discontinue', 'All'].includes(payload.discontinued)
    ? payload.discontinued
    : 'Regular';
  const showSerialNo = Boolean(payload.showSerialNo);
  const showHeader = Boolean(payload.showHeader);
  const reportTitle = String(payload.reportTitle || '');

  const [categoryList, academicYearArray, courseMeta] = await Promise.all([
    loadCategoryList(),
    loadAcademicYearConfig(),
    loadCourseMetadata(),
  ]);

  const filters = buildReportFilters({
    courseName: payload.courseName || 'All---All',
    searchBy,
    academicYear,
    discontinued,
    ...courseMeta,
    academicYearArray,
  });

  const sql = searchBy === 'year'
    ? `SELECT ${STUDENT_SELECT}
       FROM student_profile_tb AS A
       INNER JOIN student_academic_tb AS B
         ON A.id = B.s_id AND A.course_id = B.course_id AND A.register_no = B.register_no
       WHERE A.del = 1 AND B.del = 1
         ${filters.academicYearSearch}
         ${filters.discontinuedText}
         ${filters.courseAcademicString}
       ORDER BY ${filters.orderByLabel}`
    : `SELECT ${STUDENT_SELECT}
       FROM student_profile_tb AS A
       WHERE A.del = 1
         ${filters.academicYearSearch}
         ${filters.discontinuedText}
       ORDER BY ${filters.orderByLabel}`;

  const students = await prisma.$queryRawUnsafe(sql);
  const currentDate = new Date().toISOString().slice(0, 10);
  const meta = {
    categoryList,
    academicYearArray,
    courseById: courseMeta.courseById,
    courseNameById: courseMeta.courseNameById,
    currentDate,
  };

  const tableRows = await buildStudentRows(students, fields, showSerialNo, meta);

  if (format === 'xls') {
    const headers = expandFieldHeaders(fields);
    if (showSerialNo) headers.unshift('S.No.');
    const file = await writeCsvExport(headers, tableRows);
    return file;
  }

  const tableHtml = buildTableHtml(fields, tableRows, showSerialNo);
  const html = await buildReportHtml({
    showHeader,
    reportTitle,
    academicYearLabel: filters.academicYearLabel,
    academicCourseNameLabel: filters.academicCourseNameLabel,
    searchBy,
  }, tableHtml);

  if (!html || html.length < 50) {
    return { error: 'Report generation returned no data' };
  }

  return { html };
}
