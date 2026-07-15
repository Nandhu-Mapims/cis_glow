import { prisma } from '../../../config/prisma.js';
import { normalizeIp } from '../../../services/logService.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logStaffModule } from '../staffModuleAudit.js';
import {
  escapeHtml,
  formatDisplayDate,
  formatStaffName,
  loadDeptDesignationLookups,
  loadInstitutionBranding,
  resolveStaffFilter,
  staffPhotoDisplayUrl,
} from '../staffShared.js';

const FACULTY_JOB_CATEGORIES = "('255', '271', '357')";
const ACTIVE_STAFF_SQL = `(A.releaving_date > DATE(NOW()) OR CAST(A.releaving_date AS CHAR) = '0000-00-00')`;

function formatInspectionCertDate(val) {
  return formatDisplayDate(val);
}

function formatSeatsLabel(seats) {
  const value = String(seats || '').trim();
  if (!value) return '';
  return /seat/i.test(value) ? value : `${value} Seats`;
}

function splitWorkingAddress(working) {
  const parts = String(working || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return '';
  return parts.map((p) => escapeHtml(p)).join('<br>');
}

function formatCollegeClause(working) {
  const value = String(working || '').trim();
  if (!value) return '';
  return `, ${escapeHtml(value)}`;
}

async function loadInspectionConfigDetails(configId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT cfg.id, cfg.course_id, cfg.academic_year, cfg.ins_academic_year, cfg.seats,
            cfg.inspection_for, cfg.ref_letter_no,
            CAST(cfg.from_date AS CHAR) AS from_date,
            CAST(cfg.to_date AS CHAR) AS to_date,
            c.department_name
     FROM inspection_config_tb cfg
     LEFT JOIN basic_setup_course_tb c ON c.id = cfg.course_id AND c.del = 1
     WHERE cfg.del = 1 AND cfg.id = ${Number(configId)}
     LIMIT 1`,
  );
  return rows[0] || null;
}

async function buildAttendanceCertificatesHtml(rows, configId, inspectorTypeMap, inspectionNameMap, academicYear = '') {
  const cfg = await loadInspectionConfigDetails(configId);
  if (!cfg || !rows.length) return '';

  const inspectionLabel = inspectionNameMap[String(cfg.inspection_for)] || String(cfg.inspection_for || '');
  const deptLabel = String(cfg.department_name || '').trim();
  const fromDate = formatInspectionCertDate(cfg.from_date);
  const toDate = formatInspectionCertDate(cfg.to_date);
  const dates = fromDate === toDate ? toDate : `${fromDate} to ${toDate}`;
  const acYear = cfg.ins_academic_year || academicYear || cfg.academic_year || '';
  const refYear = academicYear || cfg.academic_year || acYear || '';
  const seatsLabel = formatSeatsLabel(cfg.seats);

  const blocks = rows
    .filter((r) => String(r.name || '').trim())
    .map((r) => {
      const typeLabel = inspectorTypeMap[String(r.inspectorType)] || String(r.inspectorType || '');
      const refNo = `APDCH/ATTN_CERT/${cfg.id}/${refYear}/${r.id || '0'}`;
      const addressHtml = splitWorkingAddress(r.working);
      const desigClause = r.designation ? ` ${escapeHtml(r.designation)}` : '';
      const collegeClause = formatCollegeClause(r.working);
      return `
<div class="inspection-cert-set">
  <div class="inspection-cert-sheet">
    <table class="inspection-cert-header" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td valign="bottom"><p class="inspection-cert-text">Ref: ${escapeHtml(refNo)}</p></td>
        <td valign="bottom" class="text-end"><p class="inspection-cert-text"><strong>Date:</strong> ${escapeHtml(toDate)}</p></td>
      </tr>
    </table>
    <div class="inspection-cert-title">ATTENDANCE CERTIFICATE</div>
    <p class="inspection-cert-body">
      This is to certify that <strong>${escapeHtml(r.name)}</strong>${desigClause}${collegeClause}, attended as
      ${escapeHtml(typeLabel)} to carry out for ${escapeHtml(inspectionLabel)} in the speciality of
      ${escapeHtml(deptLabel)}${seatsLabel ? ` with ${escapeHtml(seatsLabel)}` : ''} for the academic year
      ${escapeHtml(acYear)} at <strong>Adhiparasakthi Dental College and Hospital, Melmaruvathur - 603319</strong>
      on ${escapeHtml(dates)} as per the DCI Letter No ${escapeHtml(cfg.ref_letter_no || '')}.
    </p>
    <p class="inspection-cert-sign"><strong>Principal</strong></p>
  </div>
  <div class="inspection-envelope-sheet">
    <div class="inspection-envelope-label">
      <div>To</div>
      <div><strong>${escapeHtml(r.name)}</strong></div>
      ${r.designation ? `<div>${escapeHtml(r.designation)}</div>` : ''}
      ${addressHtml ? `<div>${addressHtml}</div>` : ''}
    </div>
  </div>
</div>`;
    });

  if (!blocks.length) return '';
  return `<div class="inspection-certificates">${blocks.join('')}</div>`;
}

function wrapReportHtml(title, body) {
  return `<div class="report-print"><h4 class="text-center">${escapeHtml(title)}</h4>${body}</div>`;
}

function tableHtml(headers, rows) {
  const th = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const trs = rows.map((row, i) => {
    const cells = row.map((c) => `<td>${c}</td>`).join('');
    return `<tr><td>${i + 1}</td>${cells}</tr>`;
  }).join('');
  return `<table class="table table-bordered table-sm"><thead><tr><th>S.No</th>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

function formatCourseGroupLabel(course, academicYear = '') {
  const degree = String(course.degree_name || course.degree_short_name || course.course_name || '').trim();
  let department = String(course.department_name || '').trim();
  if (department && department !== '-') {
    department = ` - ${department}`;
  } else {
    department = '';
  }
  const yearPart = academicYear ? ` | ${academicYear}` : '';
  return `${degree}${department}${yearPart}`;
}

function sqlEscape(val) {
  return escapeSql(val);
}

function normalizeAcademicType(val) {
  const t = String(val || 'regular').trim();
  return t || 'regular';
}

async function resolveInspectionContext(configId, courseId, academicYear = '', academicType = 'regular') {
  let year = String(academicYear || '').trim();
  let type = normalizeAcademicType(academicType);

  if (!year) {
    const inferred = await prisma.$queryRawUnsafe(
      `SELECT academic_year, academic_type
       FROM inspection_tb
       WHERE del = 1
         AND inspection_for = '${sqlEscape(configId)}'
         AND course_id = '${sqlEscape(courseId)}'
       ORDER BY academic_year DESC, id DESC
       LIMIT 1`,
    );
    if (inferred[0]) {
      year = String(inferred[0].academic_year || '').trim();
      type = normalizeAcademicType(inferred[0].academic_type);
    }
  }

  if (!year) {
    const cfgRows = await prisma.$queryRawUnsafe(
      `SELECT academic_year, academic_type
       FROM inspection_config_tb
       WHERE del = 1 AND id = ${Number(configId)}
       LIMIT 1`,
    );
    if (cfgRows[0]) {
      year = String(cfgRows[0].academic_year || '').trim();
      if (!type || type === 'regular') type = normalizeAcademicType(cfgRows[0].academic_type);
    }
  }

  return { academicYear: year, academicType: type };
}

async function loadInspectionRows(configId, courseId, academicYear, academicType) {
  const yearClause = academicYear
    ? `AND academic_year = '${sqlEscape(academicYear)}'`
    : '';
  const dbRows = await prisma.$queryRawUnsafe(
    `SELECT id, inspector_type, ins_name, ins_desig, ins_working, ins_mobile, ins_email
     FROM inspection_tb WHERE del = 1
       AND inspection_for = '${sqlEscape(configId)}'
       AND course_id = '${sqlEscape(courseId)}'
       ${yearClause}
       AND LOWER(academic_type) = LOWER('${sqlEscape(academicType)}')
     ORDER BY id ASC`,
  );
  return dbRows.map((r) => ({
    id: r.id,
    inspectorType: String(r.inspector_type || ''),
    name: r.ins_name,
    designation: r.ins_desig,
    working: r.ins_working,
    mobile: r.ins_mobile,
    email: r.ins_email,
  }));
}

async function softDeleteInspectionRows(configId, courseId, academicYear, academicType, memberId, ip) {
  const yearClause = academicYear
    ? `AND academic_year = '${sqlEscape(academicYear)}'`
    : '';
  await prisma.$executeRawUnsafe(
    `UPDATE inspection_tb SET del = 0, updated_dt = NOW(),
       updated_by = '${sqlEscape(memberId)}', updated_ip = '${sqlEscape(normalizeIp(ip))}'
     WHERE del = 1
       AND inspection_for = '${sqlEscape(configId)}'
       AND course_id = '${sqlEscape(courseId)}'
       ${yearClause}
       AND LOWER(academic_type) = LOWER('${sqlEscape(academicType)}')`,
  );
}

async function loadInspectionConfigOptions() {
  const [configRows, nameRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT cfg.id, cfg.inspection_for, cfg.course_id, cfg.academic_year, cfg.academic_type,
              c.course_name, c.degree_name, c.degree_short_name, c.department_name
       FROM inspection_config_tb cfg
       INNER JOIN basic_setup_course_tb c ON c.id = cfg.course_id AND c.del = 1
       WHERE cfg.del = 1 AND cfg.i_enable = 0
       ORDER BY c.c_order ASC, cfg.academic_year DESC, cfg.id ASC`,
    ),
    prisma.$queryRawUnsafe(
      'SELECT id, inspection_for FROM inspection_name WHERE del = 1',
    ),
  ]);
  const nameMap = Object.fromEntries(nameRows.map((n) => [String(n.id), n.inspection_for]));
  return { options: configRows.map((cfg) => ({
    configId: String(cfg.id),
    label: nameMap[String(cfg.inspection_for)] || String(cfg.inspection_for),
    groupLabel: formatCourseGroupLabel(cfg, cfg.academic_year),
    courseId: String(cfg.course_id),
    academicYear: cfg.academic_year || '',
    academicType: normalizeAcademicType(cfg.academic_type),
  })), inspectionNameMap: nameMap };
}

export async function loadInspectionDetailsScreen(memberId, fields = {}, audit = {}) {
  const { options: inspectionOptions, inspectionNameMap } = await loadInspectionConfigOptions();
  const inspectorTypes = await prisma.$queryRawUnsafe(
    `SELECT id, category_name FROM master_setup
     WHERE category = 'Inspection Inspector Type' AND del != 0
     ORDER BY category_order ASC`,
  );
  const inspectorTypeMap = Object.fromEntries(
    inspectorTypes.map((t) => [String(t.id), t.category_name]),
  );

  const configId = String(fields.configId || fields.inspectionFor || '').trim();
  const selected = inspectionOptions.find((o) => o.configId === configId) || null;
  const courseId = selected?.courseId || '';
  const resolved = configId && courseId
    ? await resolveInspectionContext(configId, courseId, selected?.academicYear, selected?.academicType)
    : { academicYear: '', academicType: 'regular' };
  const { academicYear, academicType } = resolved;

  let rows = [];
  if (configId && courseId) {
    rows = await loadInspectionRows(configId, courseId, academicYear, academicType);
    if (!rows.length && academicYear) {
      rows = await loadInspectionRows(configId, courseId, '', academicType);
    }
    if (!rows.length) {
      rows = await prisma.$queryRawUnsafe(
        `SELECT id, inspector_type, ins_name, ins_desig, ins_working, ins_mobile, ins_email
         FROM inspection_tb WHERE del = 1
           AND inspection_for = '${sqlEscape(configId)}'
           AND course_id = '${sqlEscape(courseId)}'
           AND academic_year = '${sqlEscape(academicYear)}'
         ORDER BY id ASC`,
      ).then((dbRows) => dbRows.map((r) => ({
        id: r.id,
        inspectorType: String(r.inspector_type || ''),
        name: r.ins_name,
        designation: r.ins_desig,
        working: r.ins_working,
        mobile: r.ins_mobile,
        email: r.ins_email,
      })));
    }
  }

  const normalizedRows = rows.length
    ? rows
    : [{ inspectorType: '', name: '', designation: '', working: '', mobile: '', email: '' }];
  const certificatesHtml = configId
    ? await buildAttendanceCertificatesHtml(normalizedRows, configId, inspectorTypeMap, inspectionNameMap, academicYear)
    : '';

  await logStaffModule('inspection_details.php', 'View', 'Successful', configId, memberId, audit);
  return {
    inspectionOptions,
    inspectorTypes: inspectorTypes.map((t) => ({ id: String(t.id), name: t.category_name })),
    configId,
    courseId,
    academicYear,
    academicType,
    selectedLabel: selected?.label || '',
    groupLabel: selected?.groupLabel || '',
    rows: normalizedRows,
    reportHtml: certificatesHtml || null,
  };
}

function buildInspectorReport(rows, title) {
  const body = tableHtml(
    ['Type', 'Name', 'Designation', 'Working At', 'Mobile', 'Email'],
    rows.map((r) => [
      escapeHtml(r.inspectorType),
      escapeHtml(r.name),
      escapeHtml(r.designation),
      escapeHtml(r.working),
      escapeHtml(r.mobile),
      escapeHtml(r.email),
    ]),
  );
  return wrapReportHtml(`Inspection Details — ${title}`, body);
}

export async function saveInspectionDetailsScreen(payload, memberId, audit = {}) {
  const configId = String(payload.configId || payload.inspectionFor || '').trim();
  const courseId = String(payload.courseId || '').trim();
  if (!configId || !courseId) {
    return { success: false, message: 'Inspection and course are required' };
  }
  const resolved = await resolveInspectionContext(
    configId,
    courseId,
    payload.academicYear,
    payload.academicType,
  );
  const { academicYear, academicType } = resolved;
  const { create, update } = auditFields(memberId, audit);

  await softDeleteInspectionRows(configId, courseId, academicYear, academicType, memberId, audit.ip || '');

  const courseRows = await prisma.$queryRawUnsafe(
    `SELECT id, course_name, degree_short_name, dept_sname FROM basic_setup_course_tb WHERE del = 1 AND id = ${Number(courseId)} LIMIT 1`,
  );
  const course = courseRows[0];
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  for (const row of rows) {
    const name = String(row.name || '').trim();
    if (!name) continue;
    const data = {
      inspection_for: configId,
      course_id: courseId,
      course_name: course?.degree_short_name?.slice(0, 10) || course?.dept_sname || String(courseId),
      academic_year: academicYear,
      academic_type: academicType,
      inspection_title: configId,
      inspector_type: String(row.inspectorType || ''),
      proforma_details: '',
      ins_name: name,
      ins_desig: String(row.designation || ''),
      ins_working: String(row.working || ''),
      ins_mobile: String(row.mobile || ''),
      ins_email: String(row.email || ''),
      del: 1,
      ...update,
    };
    if (row.id) {
      await prisma.inspection_tb.update({ where: { id: Number(row.id) }, data });
    } else {
      await prisma.inspection_tb.create({ data: { ...data, ...create } });
    }
  }

  await logStaffModule('inspection_details.php', 'Update', 'Successful', configId, memberId, audit);
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadInspectionDetailsScreen(memberId, { configId, courseId, academicYear, academicType }, { ...audit, skipLog: true })),
  };
}

export async function loadInspectionAttnSheetScreen(memberId, fields = {}, audit = {}) {
  const departments = await prisma.$queryRawUnsafe(
    `SELECT id, name, course_id FROM staff_dept_master
     WHERE del = 1 AND TRIM(name) <> ''
     ORDER BY d_order ASC, id ASC`,
  );
  if (!fields.Submit && !fields.department_id) {
    await logStaffModule('staff_attendance_sign_with_photo.php', 'View', 'Successful', '', memberId, audit);
    return {
      departments: departments.map((d) => ({ id: Number(d.id), name: d.name })),
      reportHtml: null,
    };
  }

  const deptId = Number(fields.department_id);
  const deptRow = departments.find((d) => Number(d.id) === deptId);
  const showPhoto = fields.show_photo !== false && fields.show_photo !== '0';
  const catType = fields.cat_search_type || 'Faculty';
  let rows = [];

  if (catType === 'Faculty' && deptId) {
    const staff = await prisma.$queryRawUnsafe(
      `SELECT A.id, A.staff_id, A.staff_name, A.staff_initial, A.staff_title,
              MAX(G.name) AS desg_name
       FROM staff_profile_tb AS A
       INNER JOIN staff_designation_tb AS C ON C.staff_id = A.id AND C.del = 1
       INNER JOIN staff_desg_master AS G ON G.id = C.designation AND G.del = 1
       WHERE A.del = 1
         AND C.department = ${deptId}
         AND C.is_academic = 1
         AND A.job_category IN ${FACULTY_JOB_CATEGORIES}
         AND ${ACTIVE_STAFF_SQL}
       GROUP BY A.id, A.staff_id, A.staff_name, A.staff_initial, A.staff_title
       ORDER BY A.staff_name`,
    );
    for (const s of staff) {
      const photo = showPhoto ? await staffPhotoDisplayUrl(s.staff_id, 'idcard') : null;
      const img = showPhoto && photo ? `<img src="${photo}" style="height:40px" onerror="this.src='/legacy/img/profile-avatar.jpg'" />` : '';
      rows.push([img, escapeHtml(s.staff_id), escapeHtml(formatStaffName(s)), escapeHtml(s.desg_name || ''), '', '']);
    }
  } else if (catType === 'PGStudent' && deptId) {
    const courseId = String(deptRow?.course_id || '').trim();
    if (!courseId) {
      rows = [];
    } else {
      const setup = await prisma.$queryRawUnsafe(
        'SELECT pg_academic_year FROM basic_setup_tb WHERE del = 1 LIMIT 1',
      );
      const pgYear = setup[0]?.pg_academic_year || '';
      const students = await prisma.$queryRawUnsafe(
        `SELECT A.id, A.register_no, A.student_name, A.student_initial, A.student_title, B.current_year
         FROM student_profile_tb AS A
         INNER JOIN student_academic_tb AS B ON A.id = B.s_id AND B.del = 1
         WHERE A.del = 1 AND A.course_id = '${courseId.replace(/'/g, "''")}'
           AND B.academic_year = '${String(pgYear).replace(/'/g, "''")}'
           AND B.academic_batch = 'regular'
         ORDER BY B.current_year ASC, A.academic_year DESC, A.register_no ASC`,
      );
      for (const st of students) {
        const name = `${st.student_title ? `${st.student_title}. ` : ''}${st.student_name || ''} ${st.student_initial || ''}`.trim();
        rows.push(['', escapeHtml(st.register_no || ''), escapeHtml(name), escapeHtml(`Year ${st.current_year || ''}`), '', '']);
      }
    }
  }

  const title = catType === 'PGStudent' ? 'PG Attendance Sign Sheet' : 'Attendance Sign Sheet';
  const deptLabel = deptRow?.name ? ` — ${deptRow.name}` : '';
  const emptyMsg = rows.length
    ? ''
    : `<p class="text-muted">${catType === 'PGStudent' && !deptRow?.course_id
      ? 'This department has no course linked for PG student attendance.'
      : 'No staff found for the selected department.'}</p>`;

  await logStaffModule('staff_attendance_sign_with_photo.php', 'Generate', 'Successful', String(rows.length), memberId, audit);
  return {
    departments: departments.map((d) => ({ id: Number(d.id), name: d.name })),
    reportHtml: wrapReportHtml(`${title}${deptLabel}`, emptyMsg + tableHtml(['Photo', 'Staff ID', 'Name', 'Designation', 'Sign', 'Date'], rows)),
  };
}

export async function loadInspectionAttnCertScreen(memberId, fields = {}, audit = {}) {
  const lookups = await loadDeptDesignationLookups();
  const courses = await prisma.$queryRawUnsafe(
    'SELECT id, course_name, degree_short_name, dept_sname FROM basic_setup_course_tb WHERE del = 1 ORDER BY c_order ASC',
  );
  const inspectionNames = await prisma.$queryRawUnsafe(
    'SELECT id, inspection_for FROM inspection_name WHERE del = 1 ORDER BY inspection_order ASC',
  );
  if (!fields.Submit && !fields.search_by) {
    await logStaffModule('inspection_attn_certificate.php', 'View', 'Successful', '', memberId, audit);
    return { ...lookups, courses: courses.map((c) => ({ id: c.course_id, name: c.course_name })), inspectionNames, reportHtml: null };
  }
  const staff = await resolveStaffFilter(fields);
  const brand = await loadInstitutionBranding();
  const blocks = [];
  for (const s of staff) {
    blocks.push(`<div class="border p-3 mb-3">
      <p class="text-center"><strong>${escapeHtml(brand.institutionName)}</strong></p>
      <p class="text-center">Attendance Certificate</p>
      <p>This is to certify that <strong>${escapeHtml(formatStaffName(s))}</strong> (${escapeHtml(s.staff_id)}) was present during the inspection period.</p>
      <p>From: ${escapeHtml(formatDisplayDate(fields.from_date))} To: ${escapeHtml(formatDisplayDate(fields.to_date))}</p>
    </div>`);
  }
  await logStaffModule('inspection_attn_certificate.php', 'Generate', 'Successful', String(staff.length), memberId, audit);
  return {
    ...lookups,
    courses: courses.map((c) => ({ id: String(c.id), name: c.course_name })),
    inspectionNames,
    reportHtml: wrapReportHtml('Inspection Attendance Certificate', blocks.join('') || '<p>No staff found.</p>'),
  };
}
