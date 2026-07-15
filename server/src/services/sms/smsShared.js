import { prisma } from '../../config/prisma.js';
import { convertNYear } from '../fees/feeHelpers.js';
import { auditFields } from '../shared/moduleAudit.js';
import { escapeSql } from '../../utils/sqlSafe.js';

async function loadAcademicYears() {
  const rows = await prisma.$queryRaw`
    SELECT ug_academic_year, uga_academic_year, pg_academic_year
    FROM basic_setup_tb
    WHERE del = 1
    LIMIT 1
  `;
  const setup = rows[0] || {};
  return {
    'U.G': {
      regular: setup.ug_academic_year || '',
      additional: setup.uga_academic_year || '',
    },
    'P.G': { regular: setup.pg_academic_year || '' },
  };
}

async function loadActiveCourses() {
  return prisma.$queryRaw`
    SELECT id, course_name, degree_name, department_name, course_duration, full_part_time, c_order
    FROM basic_setup_course_tb
    WHERE del = 1
    ORDER BY c_order ASC
  `;
}

export async function loadSmsTemplates() {
  const rows = await prisma.$queryRaw`
    SELECT id, template_id, sms_template, sample_message
    FROM sms_template_tb
    WHERE del = 1
    ORDER BY id DESC
  `;
  return rows.map((row) => ({
    id: row.id,
    templateId: row.template_id,
    content: row.sms_template,
    sample: row.sample_message,
  }));
}

async function loadCourseSlotCounts() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT A.course_id, B.academic_year, B.current_year, B.academic_type,
           COUNT(DISTINCT A.id) AS student_count
    FROM student_profile_tb AS A
    INNER JOIN student_academic_tb AS B ON A.id = B.s_id
    WHERE A.del = 1 AND B.del = 1
      AND A.mobile_no != ''
      AND (A.releaving_date > DATE(NOW()) OR A.releaving_date = '0000-00-00')
    GROUP BY A.course_id, B.academic_year, B.current_year, B.academic_type
  `);
  const map = new Map();
  for (const row of rows) {
    const key = `${row.course_id}___${row.academic_year}___${row.current_year}___${row.academic_type}`;
    map.set(key, Number(row.student_count) || 0);
  }
  return map;
}

function courseGroupLabel(course, batch) {
  const ft = String(course.full_part_time || '').toLowerCase() === 'part time' ? 'PT' : 'FT';
  const dept = course.department_name && course.department_name !== '-'
    ? ` - ${course.department_name}`
    : '';
  const batchLabel = batch === 'regular' ? 'Regular' : 'Additional';
  return `${course.course_name} | ${course.degree_name || course.course_name}${dept} | ${ft} | ${batchLabel}`;
}

function buildCourseSlotOptions(courses, academicYears, countMap, labelBuilder) {
  const options = [];
  const groups = [];
  for (const course of courses) {
    const batches = ['regular'];
    if (course.course_name === 'U.G') batches.push('additional');
    for (const batch of batches) {
      const acYear = academicYears[course.course_name]?.[batch] || '';
      if (!acYear) continue;
      const groupLabel = courseGroupLabel(course, batch);
      const groupOptions = [];
      const maxYear = Math.min(10, Math.max(1, Number(course.course_duration) || 1));
      for (let year = 1; year <= maxYear; year += 1) {
        const value = `${course.id}___${acYear}___${year}___${batch}`;
        const count = countMap.get(value) || 0;
        const label = `${labelBuilder(course, year, batch)} (${count})`;
        const option = { value, label, mobileCount: count, group: groupLabel };
        options.push(option);
        groupOptions.push(option);
      }
      if (groupOptions.length) {
        groups.push({ label: groupLabel, options: groupOptions });
      }
    }
  }
  return { options, groups };
}

export async function resolveCourseSlotMobiles(selectedKeys = [], mobileField = 'mobile_no', options = {}) {
  const { includeDetails = false } = options;
  const column = mobileField === 'father_mobile_1' ? 'A.father_mobile_1' : 'A.mobile_no';
  const mobiles = [];
  const mobileDetails = [];
  let count = 0;

  for (const key of selectedKeys) {
    const [courseId, acYear, year, batch] = String(key).split('___');
    if (!courseId || !acYear || !year || !batch) continue;
    const selectSql = includeDetails
      ? `SELECT ${column} AS mobile, A.student_name`
      : `SELECT ${column} AS mobile`;
    const rows = await prisma.$queryRawUnsafe(`
      ${selectSql}
      FROM student_profile_tb AS A
      INNER JOIN student_academic_tb AS B ON A.id = B.s_id
      WHERE A.del = 1 AND B.del = 1
        AND A.course_id = '${escapeSql(courseId)}'
        AND ${column} != ''
        AND (A.releaving_date > DATE(NOW()) OR A.releaving_date = '0000-00-00')
        AND B.course_id = '${escapeSql(courseId)}'
        AND B.academic_year = '${escapeSql(acYear)}'
        AND B.current_year = '${escapeSql(year)}'
        AND B.academic_type = '${escapeSql(batch)}'
    `);
    for (const row of rows) {
      const mobile = String(row.mobile || '').trim();
      if (!mobile) continue;
      count += 1;
      mobiles.push(mobile);
      if (includeDetails) {
        mobileDetails.push(`${mobile} (${String(row.student_name || '').trim()})`);
      }
    }
  }

  const uniqueMobiles = [...new Set(mobiles)];
  return {
    mobiles: uniqueMobiles.join(','),
    mobileCount: uniqueMobiles.length,
    mobileDetails: [...new Set(mobileDetails)],
  };
}

export async function loadCourseSmsOptions() {
  const academicYears = await loadAcademicYears();
  const courses = await loadActiveCourses();
  const countMap = await loadCourseSlotCounts();
  return buildCourseSlotOptions(
    courses,
    academicYears,
    countMap,
    (course, year, batch) => {
      const yearLabel = convertNYear(year, course.course_name);
      const batchLabel = batch === 'regular' ? 'regular' : 'additional';
      return `${course.degree_name || course.course_name} ${yearLabel} (${batchLabel})`;
    },
  );
}

const YEAR_LABELS = ['', 'I', 'II', 'III', 'IV', 'Int.', 'VI', 'VII', 'VIII', 'IX', 'X'];

export async function loadParentCourseOptions() {
  const academicYears = await loadAcademicYears();
  const courses = await loadActiveCourses();
  const countMap = await loadCourseSlotCounts();
  const { options } = buildCourseSlotOptions(courses, academicYears, countMap, (course, year, batch) => {
    const dept = course.department_name && course.department_name !== '-' ? ` - ${course.department_name}` : '';
    const yearLabel = YEAR_LABELS[year] || String(year);
    return `${course.degree_name || course.course_name}${dept} ${yearLabel} (${batch})`;
  });
  return options;
}

export async function loadParentRecipients(selectedCourses = []) {
  if (!selectedCourses.length) return [];

  const recipients = [];
  for (const key of selectedCourses) {
    const [courseId, acYear, year, batch] = String(key).split('___');
    if (!courseId || !acYear || !year || !batch) continue;
    const rows = await prisma.$queryRaw`
      SELECT A.register_no, A.student_name, A.student_initial, A.father_mobile_1
      FROM student_profile_tb AS A
      INNER JOIN student_academic_tb AS B ON A.id = B.s_id
      WHERE A.del = 1 AND B.del = 1
        AND A.course_id = ${courseId}
        AND A.father_mobile_1 != ''
        AND (A.releaving_date > DATE(NOW()) OR A.releaving_date = '0000-00-00')
        AND B.course_id = ${courseId}
        AND B.academic_year = ${acYear}
        AND B.current_year = ${year}
        AND B.academic_type = ${batch}
      ORDER BY A.register_no ASC
    `;
    for (const row of rows) {
      const mobile = String(row.father_mobile_1 || '').trim();
      if (!mobile) continue;
      recipients.push({
        registerNo: row.register_no,
        studentName: `${row.student_name || ''} ${row.student_initial || ''}`.trim(),
        mobile,
      });
    }
  }

  const seen = new Set();
  return recipients.filter((r) => {
    if (seen.has(r.mobile)) return false;
    seen.add(r.mobile);
    return true;
  });
}

export function normalizeSmsMobile(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return digits;
  if (digits.length === 12 && digits.startsWith('91')) {
    const local = digits.slice(-10);
    return /^[6-9]/.test(local) ? local : null;
  }
  return null;
}

/** Extract valid 10-digit Indian mobile numbers from comma/newline-separated text or embedded in messages. */
export function parseMobileList(value) {
  const text = String(value || '');
  const found = [];
  const add = (part) => {
    const normalized = normalizeSmsMobile(part);
    if (normalized && !found.includes(normalized)) found.push(normalized);
  };
  for (const part of text.split(/[,\n\r;]+/)) {
    if (part.trim()) add(part.trim());
  }
  for (const match of text.match(/\b[6-9]\d{9}\b/g) || []) {
    add(match);
  }
  return found;
}

export async function loadStaffSmsGroups() {
  const rows = await prisma.$queryRaw`
    SELECT id, group_title, group_mobile
    FROM sms_group_tb
    WHERE del = 1
    ORDER BY id ASC
  `;
  return rows.map((row) => {
    const list = parseMobileList(row.group_mobile);
    return {
      id: Number(row.id),
      title: row.group_title,
      mobiles: list.join(','),
      mobileCount: list.length,
    };
  });
}

/** Legacy staff_sms.php — job categories from edu_setup_tb + staff mobile_1 */
export async function loadStaffCategorySmsGroups() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT B.id, B.category_name, COUNT(A.id) AS cnt
    FROM staff_profile_tb AS A
    INNER JOIN edu_setup_tb AS B ON A.job_category = B.id
    WHERE A.del = 1
      AND (A.releaving_date > DATE(NOW()) OR A.releaving_date = '0000-00-00')
      AND A.mobile_1 != ''
      AND B.category = 'Category'
    GROUP BY B.id, B.category_name
    ORDER BY B.id ASC
  `);
  return rows.map((row) => ({
    id: Number(row.id),
    title: row.category_name,
    mobileCount: Number(row.cnt) || 0,
  }));
}

export async function resolveStaffCategoryMobiles(categoryIds = [], options = {}) {
  const { includeDetails = false } = options;
  const ids = categoryIds.map(Number).filter(Boolean);
  if (!ids.length) {
    return { mobiles: '', mobileCount: 0, mobileDetails: [] };
  }

  const selectSql = includeDetails
    ? 'SELECT A.mobile_1 AS mobile, A.staff_name AS name'
    : 'SELECT A.mobile_1 AS mobile';
  const rows = await prisma.$queryRawUnsafe(`
    ${selectSql}
    FROM staff_profile_tb AS A
    INNER JOIN edu_setup_tb AS B ON A.job_category = B.id
    WHERE A.del = 1
      AND (A.releaving_date > DATE(NOW()) OR A.releaving_date = '0000-00-00')
      AND A.mobile_1 != ''
      AND B.category = 'Category'
      AND B.id IN (${ids.join(',')})
    ORDER BY A.staff_name ASC
  `);

  const mobiles = [];
  const mobileDetails = [];
  for (const row of rows) {
    const mobile = String(row.mobile || '').trim();
    if (!mobile) continue;
    mobiles.push(mobile);
    if (includeDetails) {
      const name = String(row.name || '').trim();
      mobileDetails.push(name ? `${mobile} (${name})` : mobile);
    }
  }

  const uniqueMobiles = [...new Set(mobiles)];
  const uniqueDetails = [...new Set(mobileDetails)];
  return {
    mobiles: uniqueMobiles.join(','),
    mobileCount: uniqueMobiles.length,
    mobileDetails: uniqueDetails,
  };
}

export async function recordSmsSend({
  memberId,
  audit,
  registerNo,
  mobiles,
  messageType,
  message,
  templateId,
}) {
  const { create } = auditFields(memberId, audit);
  const mobileList = String(mobiles || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  const unique = [...new Set(mobileList)];
  if (!unique.length || !String(message || '').trim()) {
    return { success: false, message: 'Message and mobile numbers are required' };
  }

  await prisma.sms_message_tb.create({
    data: {
      course_type: '',
      register_no: String(registerNo || ''),
      send_date: new Date(),
      message_type: messageType,
      mobile_no: unique.join(', '),
      sample_message: String(message).trim(),
      template_id: String(templateId || ''),
      sms_report: 'queued',
      ...create,
    },
  });

  return {
    success: true,
    message: `Message queued for ${unique.length} mobile(s)...`,
    sentCount: unique.length,
  };
}
