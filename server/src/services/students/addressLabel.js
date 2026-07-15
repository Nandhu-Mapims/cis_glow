import { prisma } from '../../config/prisma.js';
import { escapeSql } from '../../utils/sqlSafe.js';
import { convertNYear } from '../fees/feeHelpers.js';
import { escapeHtml } from './studentShared.js';

const LABEL_COLS = 3;
const LABEL_ROWS_PER_PAGE = 8;

const ADDRESS_SELECT = `
  register_no, uregister_no, course_id, student_name, student_initial,
  district, pincode, post, state, street, taluk, door_no,
  father_name, student_gender, father_mobile_1`;

function asList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (value == null || value === '') return [];
  return String(value).split(',').map((v) => v.trim()).filter(Boolean);
}

function deptSuffix(departmentName) {
  const dept = String(departmentName || '').trim();
  return dept && dept !== '-' ? ` - ${dept}` : '';
}

function displayOptSql(displayOpt, alias = '') {
  const col = alias ? `${alias}.releaving_date` : 'releaving_date';
  if (displayOpt === 'Discontinue') {
    return ` AND (CAST(${col} AS CHAR) NOT LIKE '0000-00-00%' AND CAST(${col} AS CHAR) <= DATE_FORMAT(NOW(), '%Y-%m-%d'))`;
  }
  if (displayOpt === 'All') return '';
  return ` AND (CAST(${col} AS CHAR) LIKE '0000-00-00%' OR CAST(${col} AS CHAR) > DATE_FORMAT(NOW(), '%Y-%m-%d'))`;
}

function formatAddressLine(doorNo, street, post, taluk, district, pincode) {
  let address = '';
  const door = escapeHtml(String(doorNo || '').trim());
  const streetVal = escapeHtml(String(street || '').trim());
  const postVal = escapeHtml(String(post || '').trim());
  const talukVal = escapeHtml(String(taluk || '').trim());
  const districtVal = escapeHtml(String(district || '').trim());
  const pin = escapeHtml(String(pincode || '').trim());

  if (door) {
    address += door.endsWith(',') ? `${door} ` : `${door}, `;
  }
  if (streetVal) {
    address += streetVal.endsWith(',') ? `${streetVal}<br>` : `${streetVal},<br>`;
  }
  if (postVal) {
    address += postVal.endsWith(',') ? `${postVal}<br>` : `${postVal},<br>`;
  }
  if (talukVal) {
    address += talukVal.endsWith(',') ? `${talukVal}<br>` : `${talukVal},<br>`;
  }
  if (districtVal) {
    address += districtVal.endsWith(',')
      ? `${districtVal.slice(0, -1)}<br>`
      : `${districtVal},<br>`;
  }

  address = address.trim();
  if (address.endsWith(',<br>')) address = address.slice(0, -5);
  else if (address.endsWith('<br>')) address = address.slice(0, -4);

  if (pin && address) address += ` - ${pin}.`;
  return address;
}

function formatFatherLine(fatherName, gender) {
  const name = String(fatherName || '').trim();
  if (!name) return '';
  const prefix = String(gender || '').toLowerCase() === 'female' ? 'D/O.' : 'S/O.';
  return `${prefix} ${escapeHtml(name)},<br>`;
}

function formatStudentLabelName(row) {
  return `${String(row.student_name || '').trim()} ${String(row.student_initial || '').trim()}`.trim();
}

function buildLabelCell(student, courseName, leftBorder) {
  const name = escapeHtml(formatStudentLabelName(student));
  const courseLine = `<strong>${escapeHtml(courseName)}</strong> | ${escapeHtml(student.uregister_no || '')}`;
  const father = formatFatherLine(student.father_name, student.student_gender);
  const address = formatAddressLine(
    student.door_no,
    student.street,
    student.post,
    student.taluk,
    student.district,
    student.pincode,
  );
  const mobile = student.father_mobile_1
    ? `<br>M: ${escapeHtml(String(student.father_mobile_1).trim())}`
    : '';
  const border = leftBorder
    ? 'border-left:solid 1px #000; '
    : '';

  return `<td style="${border}border-right:solid 1px #000; border-bottom:solid 1px #000; font-family: Arial, Helvetica, sans-serif; color:#333333; font-size:0.8em; padding: 5px 10px; width:32%; height:135px;" valign="top"><strong>${name}</strong><br><span style="font-size:0.85em; ">${courseLine}</span><br> ${father}${address}${mobile}</td>`;
}

function buildLabelTables(entries) {
  const header = `<table class="cis-address-label-table" width="850" border="8" cellpadding="10" cellspacing="10" style="page-break-after:always; table-layout: fixed; border:none;"><tbody><tr>`;
  let html = header;
  let stcount = 0;
  let rcount = 0;
  let leftBorder = true;

  for (const entry of entries) {
    html += buildLabelCell(entry.student, entry.courseName, leftBorder);
    leftBorder = false;
    if (stcount % LABEL_COLS === LABEL_COLS - 1) {
      html += '</tr><tr>';
      leftBorder = true;
      rcount += 1;
      if (rcount % LABEL_ROWS_PER_PAGE === 0) {
        html += '</tr></tbody></table>';
        html += header;
      }
    }
    stcount += 1;
  }

  if (stcount % LABEL_COLS !== 0) {
    const filled = stcount % LABEL_COLS;
    const width = 100 / LABEL_COLS;
    for (let i = filled; i < LABEL_COLS; i += 1) {
      html += `<td style="font-family: Arial, Helvetica, sans-serif; color:#333333; font-size:0.8em; margin: 2px; padding: 5px 10px; width: ${width}%" valign="top"> </td>`;
    }
  }

  html += '</tr></tbody></table>';
  return html;
}

async function loadAcademicYearConfig() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ug_academic_year, uga_academic_year, pg_academic_year
     FROM basic_setup_tb WHERE del = 1 LIMIT 1`,
  );
  const row = rows[0] || {};
  return {
    'U.G': { regular: row.ug_academic_year || '', additional: row.uga_academic_year || '' },
    'P.G': { regular: row.pg_academic_year || '', additional: '' },
  };
}

async function loadCourses() {
  return prisma.$queryRawUnsafe(
    `SELECT id, course_name, degree_name, department_name, full_part_time,
            year_of_start, course_duration
     FROM basic_setup_course_tb WHERE del = 1 ORDER BY c_order ASC`,
  );
}

export async function buildAddressLabelFilterOptions() {
  const [courses, academicYears] = await Promise.all([
    loadCourses(),
    loadAcademicYearConfig(),
  ]);

  const batchGroups = [];
  const yearGroups = [];

  for (const course of courses) {
    const dept = deptSuffix(course.department_name);
    const ft = course.full_part_time === 'Full Time' ? 'FT' : 'PT';
    const degree = String(course.degree_name || '').trim();
    const courseName = course.course_name;
    const groupLabel = `${courseName} | ${degree}${dept} | ${ft}`;
    const regularYear = academicYears[courseName]?.regular || '';
    const startYear = regularYear ? Number(String(regularYear).split('-')[0]) : new Date().getFullYear();
    const yearOfStart = Number(course.year_of_start) || startYear;
    const duration = Number(course.course_duration) || 1;

    const batchOptions = [];
    for (let y = startYear; y >= yearOfStart; y -= 1) {
      const acYear = `${y}-${y + 1}`;
      batchOptions.push({
        value: `${course.id}___${acYear}`,
        label: `${degree}${dept} | ${acYear}`,
      });
    }
    batchGroups.push({ label: groupLabel, options: batchOptions });

    const yearRegular = [];
    for (let i = 1; i <= duration; i += 1) {
      const yearLabel = convertNYear(i, courseName);
      yearRegular.push({
        value: `${course.id}___${i}___regular`,
        label: `${yearLabel} - ${degree}${dept}`,
      });
    }
    yearGroups.push({
      label: `${groupLabel} | Regular`,
      options: yearRegular,
    });

    if (courseName === 'U.G') {
      const yearAdditional = [];
      for (let i = 1; i <= duration; i += 1) {
        const yearLabel = convertNYear(i, courseName);
        yearAdditional.push({
          value: `${course.id}___${i}___additional`,
          label: `${yearLabel} - ${degree}${dept}`,
        });
      }
      yearGroups.push({
        label: `${groupLabel} | Additional`,
        options: yearAdditional,
      });
    }
  }

  return { batchGroups, yearGroups };
}

async function fetchBatchStudents(token, displayOpt, courseById) {
  const [courseId, academicYear] = String(token).split('___');
  if (!courseId || !academicYear) return [];
  const course = courseById.get(String(courseId));
  const courseName = course?.degree_name || '';
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ${ADDRESS_SELECT}
     FROM student_profile_tb
     WHERE del = 1
       AND course_id='${escapeSql(courseId)}'
       AND academic_year='${escapeSql(academicYear)}'
       ${displayOptSql(displayOpt)}
     ORDER BY student_name ASC, student_initial ASC`,
  );
  return rows.map((student) => ({ student, courseName }));
}

async function fetchYearStudents(token, displayOpt, courseById, academicYears) {
  const [courseId, currentYear, academicBatch] = String(token).split('___');
  if (!courseId || !currentYear || !academicBatch) return [];
  const course = courseById.get(String(courseId));
  if (!course) return [];
  const mappedYear = academicYears[course.course_name]?.[academicBatch];
  if (!mappedYear) return [];
  const courseName = course.degree_name || '';
  const rows = await prisma.$queryRawUnsafe(
    `SELECT A.register_no, A.uregister_no, A.course_id, A.student_name, A.student_initial,
            A.district, A.pincode, A.post, A.state, A.street, A.taluk, A.door_no,
            A.father_name, A.student_gender, A.father_mobile_1
     FROM student_profile_tb AS A
     INNER JOIN student_academic_tb AS B ON A.id = B.s_id
     WHERE A.del = 1
       AND A.course_id='${escapeSql(courseId)}'
       AND B.academic_year='${escapeSql(mappedYear)}'
       AND B.current_year='${escapeSql(currentYear)}'
       AND B.academic_batch='${escapeSql(academicBatch)}'
       ${displayOptSql(displayOpt, 'A')}
     ORDER BY A.student_name ASC, A.student_initial ASC`,
  );
  return rows.map((student) => ({ student, courseName }));
}

export async function generateAddressLabelReport(fields = {}) {
  const searchBy = fields.search_by === 'year' ? 'year' : 'batch';
  const displayOpt = ['Regular', 'Discontinue', 'All'].includes(fields.display_opt)
    ? fields.display_opt
    : 'Regular';
  const tokens = searchBy === 'year'
    ? asList(fields.search_year)
    : asList(fields.search_course);

  if (!tokens.length) {
    return { count: 0, reportHtml: '<p class="text-muted mb-0">Select at least one course / year, then click Go.</p>' };
  }

  const [courses, academicYears] = await Promise.all([
    loadCourses(),
    loadAcademicYearConfig(),
  ]);
  const courseById = new Map(courses.map((c) => [String(c.id), c]));

  const entries = [];
  for (const token of tokens) {
    const part = searchBy === 'year'
      ? await fetchYearStudents(token, displayOpt, courseById, academicYears)
      : await fetchBatchStudents(token, displayOpt, courseById);
    entries.push(...part);
  }

  if (!entries.length) {
    return { count: 0, reportHtml: '<p class="mb-0">No students found.</p>' };
  }

  return {
    count: entries.length,
    reportHtml: `<div class="cis-address-label-print" id="printContent">${buildLabelTables(entries)}</div>`,
  };
}
