import { prisma } from '../../../config/prisma.js';
import { escapeSql, parseId } from '../../../utils/sqlSafe.js';
import { saveLegacyBinaryFile } from '../../web/webUpload.js';
import { logStudentModule } from '../studentModuleAudit.js';
import {
  ACTIVE,
  studentActiveSql,
  escapeHtml,
  formatStudentName,
  alumniPhotoUrl,
  loadAlumniLookups,
  loadStudentLookups,
  resolveAlumniFilter,
  resolveStudentFilter,
  studentIdCardPhotoUrl,
  tableHtml,
  wrapReportHtml,
} from '../studentShared.js';
import {
  COLLAGE_GENERATE_DEFAULTS,
  generateCollageImage,
  loadCollageTemplates,
} from '../collageGenerate.js';
import {
  buildAlumniIdCardReport,
  parseAlumniIdCardOptions,
} from '../alumniIdCard.js';
import { getStudentAttachmentCatalog } from '../studentAttachments.js';
import {
  buildAddressLabelFilterOptions,
  generateAddressLabelReport,
} from '../addressLabel.js';

async function studentsForReport(fields, memberId, page, audit) {
  const students = await resolveStudentFilter(fields);
  if (!audit?.skipLog) await logStudentModule(page, 'Generate', 'Successful', String(students.length), memberId, audit);
  return students;
}

export async function loadIdCardScreen(memberId, fields = {}, audit = {}) {
  const lookups = await loadStudentLookups();
  if (!fields.Submit && !fields.search_by) {
    await logStudentModule('student_id_card.php', 'View', 'Successful', '', memberId, audit);
    return { ...lookups, frontEnable: true, backEnable: true, reportHtml: null };
  }
  const students = await studentsForReport(fields, memberId, 'student_id_card.php', audit);
  const cards = [];
  for (const s of students) {
    const photo = await studentIdCardPhotoUrl(s.register_no);
    const img = photo ? `<img src="${photo}" alt="" style="max-height:90px"/>` : '';
    const addr = [s.door_no, s.street, s.post, s.taluk, s.district, s.state, s.pincode]
      .filter(Boolean).map((x) => escapeHtml(String(x).trim())).join(', ');
    cards.push(`<div class="d-inline-block border p-2 m-2" style="width:240px">
      ${fields.front_enable !== false ? `<div><strong>${escapeHtml(formatStudentName(s))}</strong><br/>${img}<br/>${escapeHtml(s.register_no)}</div>` : ''}
      ${fields.back_enable !== false ? `<div class="mt-2 small">${addr}<br/>Mob: ${escapeHtml(s.mobile_no || s.father_mobile_1 || '')}</div>` : ''}
    </div>`);
  }
  return { ...lookups, count: students.length, reportHtml: wrapReportHtml('Student ID Cards', cards.join('') || '<p>No students found.</p>') };
}

export async function loadPhotoEmptyScreen(memberId, fields = {}, audit = {}) {
  const lookups = await loadStudentLookups();
  if (!fields.Submit && !fields.search_course) {
    await logStudentModule('student_photo_empty.php', 'View', 'Successful', '', memberId, audit);
    return { ...lookups, reportHtml: null };
  }
  let sql = `SELECT id, register_no, student_name, student_initial, course_id, academic_year
    FROM student_profile_tb WHERE del = 1 AND ${ACTIVE}`;
  if (fields.search_course) {
    const [courseId, admissionYear] = String(fields.search_course).split('___');
    if (courseId) sql += ` AND course_id='${escapeSql(courseId)}'`;
    if (admissionYear) sql += ` AND academic_year='${escapeSql(admissionYear)}'`;
  }
  if (fields.search_year) sql += ` AND id IN (
    SELECT s_id FROM student_academic_tb WHERE del=1 AND current_year='${escapeSql(fields.search_year)}'
  )`;
  sql += ' ORDER BY register_no ASC';
  const students = await prisma.$queryRawUnsafe(sql);
  const rows = [];
  for (const s of students) {
    const photo = await studentIdCardPhotoUrl(s.register_no);
    if (photo) continue;
    rows.push([escapeHtml(s.register_no), escapeHtml(formatStudentName(s)), escapeHtml(s.course_id), escapeHtml(s.academic_year)]);
  }
  await logStudentModule('student_photo_empty.php', 'Generate', 'Successful', String(rows.length), memberId, audit);
  return { ...lookups, reportHtml: wrapReportHtml('Students Without ID Card Photo', tableHtml(['Register No', 'Name', 'Course', 'Batch'], rows)) };
}

export async function loadAddressLabelScreen(memberId, fields = {}, audit = {}) {
  const [lookups, filterOptions] = await Promise.all([
    loadStudentLookups(),
    buildAddressLabelFilterOptions(),
  ]);
  const submitted = Boolean(fields.Submit || fields.search_course || fields.search_year);
  if (!submitted) {
    await logStudentModule('student_address.php', 'View', 'Successful', '', memberId, audit);
    return {
      ...lookups,
      ...filterOptions,
      filters: {
        search_by: 'batch',
        display_opt: 'Regular',
        search_course: [],
        search_year: [],
      },
      reportHtml: null,
      count: 0,
    };
  }

  const report = await generateAddressLabelReport(fields);
  if (!audit?.skipLog) {
    await logStudentModule(
      'student_address.php',
      'Generate',
      'Successful',
      String(report.count || 0),
      memberId,
      audit,
    );
  }
  return {
    ...lookups,
    ...filterOptions,
    filters: {
      search_by: fields.search_by === 'year' ? 'year' : 'batch',
      display_opt: ['Regular', 'Discontinue', 'All'].includes(fields.display_opt)
        ? fields.display_opt
        : 'Regular',
      search_course: Array.isArray(fields.search_course)
        ? fields.search_course
        : (fields.search_course ? [fields.search_course] : []),
      search_year: Array.isArray(fields.search_year)
        ? fields.search_year
        : (fields.search_year ? [fields.search_year] : []),
    },
    count: report.count,
    reportHtml: report.reportHtml,
  };
}

function courseTypeCodeFromName(courseName) {
  if (courseName === 'U.G') return 1;
  if (courseName === 'P.G') return 2;
  return 0;
}

export async function loadAttachmentsReportScreen(memberId, fields = {}, audit = {}) {
  const lookups = await loadStudentLookups();
  if (!fields.Submit && !fields.search_course && !(fields.search_by && fields.search_input)) {
    await logStudentModule('student_attachments_report.php', 'View', 'Successful', '', memberId, audit);
    return { ...lookups, reportHtml: null, students: null };
  }

  let sql = `SELECT A.id, A.register_no, A.student_name, A.student_initial, A.course_id, C.course_name
    FROM student_profile_tb AS A
    LEFT JOIN basic_setup_course_tb AS C ON C.id = CAST(A.course_id AS UNSIGNED)
    WHERE A.del = 1 AND ${studentActiveSql('A')}`;
  if (fields.search_by === 'roll_no' && fields.search_input) {
    const ids = String(fields.search_input).split(',').map((s) => s.trim()).filter(Boolean).map((s) => `'${escapeSql(s)}'`);
    if (ids.length) sql += ` AND A.register_no IN (${ids.join(',')})`;
  } else if (fields.search_by === 'batch' && fields.search_input) {
    sql += ` AND A.academic_year='${escapeSql(fields.search_input)}'`;
  }
  if (fields.search_course) {
    const [courseId, admissionYear] = String(fields.search_course).split('___');
    if (courseId) sql += ` AND A.course_id='${escapeSql(courseId)}'`;
    if (admissionYear) sql += ` AND A.academic_year='${escapeSql(admissionYear)}'`;
  }
  sql += ' ORDER BY A.register_no ASC LIMIT 500';
  const rawStudents = await prisma.$queryRawUnsafe(sql);
  const studentIds = rawStudents.map((s) => Number(s.id)).filter((id) => Number.isInteger(id));

  const attachmentCounts = studentIds.length
    ? await prisma.$queryRawUnsafe(
      `SELECT s_id, COUNT(*) AS c FROM student_attachment_tb
       WHERE del=1 AND attach_file != '' AND s_id IN (${studentIds.join(',')})
       GROUP BY s_id`,
    )
    : [];
  const countsById = new Map(attachmentCounts.map((r) => [Number(r.s_id), Number(r.c)]));

  // Required attachment count per course type (UG/PG) — drives the pending/in-review/complete status.
  const typeCounts = await prisma.$queryRawUnsafe(
    `SELECT ug, pg FROM master_setup WHERE category = 'Attachment' AND del != 0`,
  );
  const requiredByCode = { 1: 0, 2: 0 };
  typeCounts.forEach((t) => {
    if (Number(t.ug) === 1) requiredByCode[1] += 1;
    if (Number(t.pg) === 2) requiredByCode[2] += 1;
  });

  const students = rawStudents.map((s) => {
    const fileCount = countsById.get(Number(s.id)) || 0;
    const required = requiredByCode[courseTypeCodeFromName(s.course_name)] || 0;
    const status = fileCount === 0 ? 'pending' : (required > 0 && fileCount >= required ? 'complete' : 'in_review');
    return {
      id: Number(s.id),
      registerNo: s.register_no,
      name: formatStudentName(s),
      courseName: s.course_name || null,
      fileCount,
      requiredCount: required,
      status,
    };
  });

  const rows = students.map((s) => [
    escapeHtml(s.registerNo),
    escapeHtml(s.name),
    escapeHtml(String(s.fileCount)),
  ]);
  await logStudentModule('student_attachments_report.php', 'Generate', 'Successful', String(rows.length), memberId, audit);
  return {
    ...lookups,
    students,
    count: students.length,
    reportHtml: wrapReportHtml('Student Attachments Report', tableHtml(['Register No', 'Name', 'Files'], rows)),
  };
}

export async function loadTempAffidavitScreen(memberId, fields = {}, audit = {}) {
  const lookups = await loadStudentLookups();
  if (!fields.application_no && !fields.Submit) {
    await logStudentModule('student_profile_temp_affidavit.php', 'View', 'Successful', '', memberId, audit);
    return { ...lookups, reportHtml: null };
  }
  const appNo = escapeSql(fields.application_no || '');
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM student_profile_temp_tb WHERE del=1 AND application_no='${appNo}' LIMIT 1`,
  );
  if (!rows.length) {
    return { ...lookups, reportHtml: wrapReportHtml('Affidavit', '<p>Application not found.</p>') };
  }
  const s = rows[0];
  const body = `<div class="p-3 border">
    <p><strong>Application:</strong> ${escapeHtml(s.application_no)}</p>
    <p><strong>Name:</strong> ${escapeHtml(formatStudentName(s))}</p>
    <p><strong>Father:</strong> ${escapeHtml(s.father_name)}</p>
    <p><strong>Course:</strong> ${escapeHtml(s.course_id)} | <strong>Batch:</strong> ${escapeHtml(s.academic_year)}</p>
    <p class="mt-4"><em>Affidavit — student admission (temp profile)</em></p>
  </div>`;
  await logStudentModule('student_profile_temp_affidavit.php', 'Generate', 'Successful', appNo, memberId, audit);
  return { ...lookups, reportHtml: wrapReportHtml('Student Admission Affidavit', body) };
}

export async function loadAlumniRegistrationScreen(memberId, fields = {}, audit = {}) {
  const fieldLabels = {
    alumni_name: 'Name',
    alumni_email: 'Email',
    alumni_mobile: 'Mobile',
    alumni_course: 'Course',
    alumni_yop: 'YOP',
  };
  if (!fields.search && !fields.Submit) {
    await logStudentModule('alumni_registration.php', 'View', 'Successful', '', memberId, audit);
    return { fieldLabels, reportHtml: null };
  }
  let where = 'del = 1';
  if (fields.from_date) where += ` AND DATE(created_dt) >= '${escapeSql(fields.from_date)}'`;
  if (fields.to_date) where += ` AND DATE(created_dt) <= '${escapeSql(fields.to_date)}'`;
  if (fields.find && fields.field && fieldLabels[fields.field]) {
    where += ` AND ${fields.field} LIKE '%${escapeSql(fields.find)}%'`;
  }
  const rows = await prisma.$queryRawUnsafe(
    `SELECT alumni_name, alumni_email, alumni_mobile, alumni_course, alumni_yop, alumni_regno,
            CAST(created_dt AS CHAR) AS created_dt
     FROM alumni_tb WHERE ${where} ORDER BY created_dt DESC LIMIT 500`,
  );
  const tableRows = rows.map((r) => [
    escapeHtml(r.alumni_regno),
    escapeHtml(r.alumni_name),
    escapeHtml(r.alumni_email),
    escapeHtml(r.alumni_mobile),
    escapeHtml(r.alumni_course),
    escapeHtml(r.alumni_yop),
    escapeHtml(String(r.created_dt || '').slice(0, 10)),
  ]);
  await logStudentModule('alumni_registration.php', 'Generate', 'Successful', String(tableRows.length), memberId, audit);
  return {
    fieldLabels,
    reportHtml: wrapReportHtml('Alumni Registration', tableHtml(['Reg No', 'Name', 'Email', 'Mobile', 'Course', 'YOP', 'Registered'], tableRows)),
  };
}

function buildAlumniReportYopOptions() {
  const options = [];
  for (let year = new Date().getFullYear(); year >= 1994; year -= 1) {
    const value = `${year}-${year + 1}`;
    options.push({ value, label: value });
  }
  return options;
}

async function loadAlumniReportCourseOptions() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, degree_name, department_name
     FROM basic_setup_course_tb WHERE del=1 ORDER BY c_order ASC`,
  );
  return rows.map((row) => {
    const deptName = String(row.department_name || '').trim();
    const dept = deptName && deptName !== '-' ? ` - ${deptName}` : '';
    return { value: String(row.id), label: `${row.degree_name || ''}${dept}`.trim() };
  });
}

function formatAlumniReportDate(value) {
  if (!value) return '';
  const text = String(value);
  if (text.startsWith('0000-00-00')) return '';
  const [year, month, day] = text.slice(0, 10).split('-');
  if (!year || !month || !day) return text.slice(0, 10);
  return `${day}-${month}-${year}`;
}

function buildAlumniReportWhere(fields = {}) {
  let where = 'del = 1';
  if (fields.from_date) where += ` AND DATE(created_dt) >= '${escapeSql(fields.from_date)}'`;
  if (fields.to_date) where += ` AND DATE(created_dt) <= '${escapeSql(fields.to_date)}'`;
  if (fields.a_year) where += ` AND alumni_yop = '${escapeSql(fields.a_year)}'`;
  if (fields.a_class) where += ` AND alumni_dept = '${escapeSql(fields.a_class)}'`;
  return where;
}

async function buildAlumniReportTableRows(where) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT alumni_regno, alumni_name,
            CAST(alumni_dob AS CHAR) AS alumni_dob, alumni_gender, alumni_dept, alumni_yop,
            alumni_pgd, alumni_cp, alumni_ws, alumni_email, alumni_mobile,
            CAST(created_dt AS CHAR) AS created_dt, alumni_address, alumni_file
     FROM alumni_tb WHERE ${where} ORDER BY alumni_name ASC LIMIT 500`,
  );
  const courseIds = [...new Set(rows.map((row) => String(row.alumni_dept || '').trim()).filter(Boolean))];
  const courseMap = new Map();
  if (courseIds.length) {
    const courses = await prisma.$queryRawUnsafe(
      `SELECT id, degree_name, department_name
       FROM basic_setup_course_tb WHERE del=1 AND id IN (${courseIds.map((id) => `'${escapeSql(id)}'`).join(',')})`,
    );
    for (const course of courses) {
      const deptName = String(course.department_name || '').trim();
      const dept = deptName && deptName !== '-' ? ` - ${deptName}` : '';
      courseMap.set(String(course.id), `${course.degree_name || ''}${dept}`.trim());
    }
  }

  const tableRows = [];
  for (const row of rows) {
    const photoUrl = await alumniPhotoUrl(row.alumni_regno, row.alumni_file);
    const photoCell = photoUrl
      ? `<a href="${escapeHtml(photoUrl)}" target="_blank" rel="noopener noreferrer">View</a>`
      : '';
    tableRows.push([
      escapeHtml(row.alumni_regno),
      `<strong>${escapeHtml(row.alumni_name)}</strong>`,
      escapeHtml(formatAlumniReportDate(row.alumni_dob)),
      escapeHtml(row.alumni_gender),
      escapeHtml(courseMap.get(String(row.alumni_dept || '').trim()) || row.alumni_dept || ''),
      escapeHtml(row.alumni_yop),
      escapeHtml(row.alumni_pgd),
      escapeHtml(row.alumni_cp),
      escapeHtml(row.alumni_ws),
      escapeHtml(row.alumni_email),
      escapeHtml(row.alumni_mobile),
      escapeHtml(formatAlumniReportDate(row.created_dt)),
      escapeHtml(row.alumni_address),
      photoCell,
    ]);
  }
  return tableRows;
}

export async function loadAlumniReportScreen(memberId, fields = {}, audit = {}) {
  const yopOptions = buildAlumniReportYopOptions();
  const courseOptions = await loadAlumniReportCourseOptions();
  const submitted = fields.Submit === 'Search' || fields.Submit === 'Generate';
  const where = buildAlumniReportWhere(fields);
  const tableRows = await buildAlumniReportTableRows(where);

  if (submitted) {
    await logStudentModule('alumni_report.php', 'Generate', 'Successful', String(tableRows.length), memberId, audit);
  } else {
    await logStudentModule('alumni_report.php', 'View', 'Successful', String(tableRows.length), memberId, audit);
  }

  return {
    yopOptions,
    courseOptions,
    filters: {
      from_date: fields.from_date || '',
      to_date: fields.to_date || '',
      a_year: fields.a_year || '',
      a_class: fields.a_class || '',
    },
    reportHtml: wrapReportHtml(
      'Alumni Register Report',
      tableHtml(
        [
          'Register No',
          'Name',
          'Date of Birth',
          'Gender',
          'Course',
          'Year Of Pass',
          'PG Details',
          'Clinical Practice',
          'Working Status',
          'Email',
          'Mobile No',
          'Registered Date',
          'Address',
          'Photo',
        ],
        tableRows,
      ),
    ),
  };
}

export async function loadAlumniIdCardScreen(memberId, fields = {}, audit = {}) {
  const lookups = await loadAlumniLookups();
  const submitted = fields.Submit === 'Go' || fields.Submit === 'Generate';
  const hasSearch = Boolean(
    String(fields.search_input || fields.searchInput || fields.find || '').trim()
    || fields.search_course,
  );
  if (!submitted && !hasSearch) {
    await logStudentModule('alumni_id_card.php', 'View', 'Successful', '', memberId, audit);
    return { ...lookups, frontEnable: true, backEnable: true, reportHtml: null };
  }

  const options = parseAlumniIdCardOptions(fields);
  const rows = await resolveAlumniFilter(fields);
  const { count, reportHtml } = await buildAlumniIdCardReport(rows, options);
  await logStudentModule('alumni_id_card.php', 'Generate', 'Successful', String(count), memberId, audit);
  return {
    ...lookups,
    ...options,
    count,
    reportHtml,
  };
}

export async function loadCollageGenerateScreen(memberId, fields = {}, audit = {}) {
  const templates = await loadCollageTemplates();
  const defaults = {
    ...COLLAGE_GENERATE_DEFAULTS,
    ...(fields.filters || {}),
  };

  if (fields.Search !== 'Search' && !fields.search_by_a_no) {
    await logStudentModule('colage_generate.php', 'View', 'Successful', '', memberId, audit);
    return { templates, defaults, outputUrl: null };
  }

  try {
    const result = await generateCollageImage(memberId, { ...defaults, ...fields });
    if (result.error) {
      await logStudentModule('colage_generate.php', 'Generate', 'Failed', result.error, memberId, audit);
      return {
        templates,
        defaults: { ...defaults, ...fields },
        validationMessage: result.error,
        outputUrl: null,
      };
    }
    await logStudentModule('colage_generate.php', 'Generate', 'Successful', result.filename || '', memberId, audit);
    return {
      templates,
      defaults: { ...defaults, ...fields },
      outputUrl: result.outputUrl,
      filename: result.filename,
    };
  } catch (err) {
    const message = err.message || 'Collage generation failed';
    await logStudentModule('colage_generate.php', 'Generate', 'Failed', message, memberId, audit);
    return {
      templates,
      defaults: { ...defaults, ...fields },
      validationMessage: message,
      outputUrl: null,
    };
  }
}

export async function loadAttachmentsViewScreen(memberId, fields = {}, audit = {}) {
  const studentId = fields.studentId ? parseId(fields.studentId) : null;
  let catalog = null;
  if (studentId) catalog = await getStudentAttachmentCatalog(studentId);
  await logStudentModule('student_attachments_view.php', 'View', 'Successful', String(studentId || ''), memberId, audit);
  return { catalog, readOnly: true };
}

export async function loadAttachmentsUploadScreen(memberId, fields = {}, audit = {}) {
  const studentId = fields.studentId ? parseId(fields.studentId) : null;
  let catalog = null;
  if (studentId) catalog = await getStudentAttachmentCatalog(studentId);
  await logStudentModule('student_attachments.php', 'View', 'Successful', String(studentId || ''), memberId, audit);
  return { catalog, readOnly: false };
}

export async function loadPhotoUploadScreen(memberId, _fields = {}, audit = {}) {
  await logStudentModule('student_photo_upload.php', 'View', 'Successful', '', memberId, audit);
  return { uploads: [] };
}

async function savePhoto(registerNo, file) {
  if (!registerNo) return { error: 'Select a student first' };
  if (!file?.name || !file?.data) return { error: 'Choose a photo to upload' };
  const ext = String(file.name).split('.').pop()?.toLowerCase() || '';
  if (!['png', 'jpg', 'jpeg'].includes(ext)) {
    return { error: 'Only .png or .jpg photos are allowed' };
  }
  const result = await saveLegacyBinaryFile({
    folder: 'student_idcard',
    file: { name: `${registerNo}.${ext}`, data: file.data },
    allowedExt: new Set(['png', 'jpg', 'jpeg']),
    preserveName: true,
    maxBytes: 2 * 1024 * 1024,
  });
  if (result.error) return { error: result.error };
  return { success: true, savedAs: `${registerNo}.${ext}`, publicUrl: result.publicUrl };
}

// Two ways in: pick one student then upload their photo (any original file name — see
// MORE_HANDLERS['photo-upload']), or a bulk batch where each file's own name IS the
// register no (legacy student_photo_upload.php convention, e.g. 24CSE001.jpg). Either
// way the file is always saved as `<register_no>.<ext>`, matching the naming convention
// studentIdCardPhotoUrl() looks up elsewhere (id card, profile, etc).
export async function savePhotoUploadScreen(payload, memberId, audit = {}) {
  const bulkFiles = Array.isArray(payload.files) ? payload.files : null;

  if (bulkFiles) {
    const results = [];
    for (const file of bulkFiles) {
      const name = String(file?.name || '').trim();
      const match = /^(.+)\.(png|jpe?g)$/i.exec(name);
      if (!match) {
        results.push({ name, error: 'File must be named register_no.png/.jpg' });
        continue;
      }
      const registerNo = match[1];
      const outcome = await savePhoto(registerNo, file);
      results.push(outcome.error ? { name, registerNo, error: outcome.error } : { name, registerNo, ...outcome });
    }
    const successCount = results.filter((r) => r.success).length;
    await logStudentModule('student_photo_upload.php', 'Update', 'Successful', `${successCount}/${results.length}`, memberId, audit);
    return { success: true, message: `${successCount} of ${results.length} photo(s) saved`, results };
  }

  const registerNo = String(payload.registerNo || '').trim();
  const outcome = await savePhoto(registerNo, payload.file);
  if (outcome.error) return { error: outcome.error };
  await logStudentModule('student_photo_upload.php', 'Update', 'Successful', registerNo, memberId, audit);
  return { success: true, message: `Photo saved for ${registerNo}`, publicUrl: outcome.publicUrl };
}
