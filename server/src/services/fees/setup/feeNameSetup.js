import { prisma } from '../../../config/prisma.js';
import { basicSetupCourseSelect } from '../../../utils/legacySelects.js';
import { escapeSql, parseId } from '../../../utils/sqlSafe.js';
import { auditFields, logFeeSetup } from './setupAudit.js';

const PAGE = 'fee_name_config.php';

const CASTE_OPTIONS = [
  { value: 'scst', label: 'SC/ST' },
  { value: 'sca', label: 'SCA' },
  { value: 'firstgraduate', label: 'First Graduate' },
];

const ACADEMIC_TYPE_OPTIONS = [
  { value: 'Regular', label: 'Regular' },
  { value: 'Additional', label: 'Additional' },
  { value: 'Break', label: 'Break' },
];

function formatSqlDateTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function updateFeeNameRow(id, data, update) {
  await prisma.$executeRawUnsafe(
    `UPDATE fee_name_master SET
      fee_type = '${escapeSql(data.fee_type)}',
      fee_for = '${escapeSql(data.fee_for)}',
      fee_name = '${escapeSql(data.fee_name)}',
      fee_amount = '${escapeSql(data.fee_amount)}',
      course_id = ${Number(data.course_id)},
      admission_year = '${escapeSql(data.admission_year)}',
      class_year = '${escapeSql(data.class_year)}',
      fee_include = '${escapeSql(data.fee_include)}',
      fee_caste = '${escapeSql(data.fee_caste)}',
      fee_bank = '${escapeSql(data.fee_bank)}',
      fee_order = ${Number(data.fee_order) || 0},
      academic_type = '${escapeSql(data.academic_type)}',
      fee_scholarship = '${escapeSql(data.fee_scholarship)}',
      fee_discount = '${escapeSql(data.fee_discount)}',
      updated_dt = '${formatSqlDateTime(update.updated_dt)}',
      updated_ip = '${escapeSql(update.updated_ip)}',
      updated_by = '${escapeSql(update.updated_by)}'
    WHERE id = ${Number(id)}`,
  );
}

async function softDeleteFeeNameRow(id, update) {
  await prisma.$executeRawUnsafe(
    `UPDATE fee_name_master SET
      del = 0,
      updated_dt = '${formatSqlDateTime(update.updated_dt)}',
      updated_ip = '${escapeSql(update.updated_ip)}',
      updated_by = '${escapeSql(update.updated_by)}'
    WHERE id = ${Number(id)}`,
  );
}

async function insertFeeNameRow(data, create) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO fee_name_master (
      course_id, admission_year, academic_type, class_year,
      fee_type, fee_for, fee_include, fee_caste, fee_name, fee_amount,
      fee_bank, fee_order, fee_due_date, fee_fine_amount, fee_fine_type,
      fee_scholarship, fee_discount, hostel_type,
      created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del
    ) VALUES (
      ${Number(data.course_id)},
      '${escapeSql(data.admission_year)}',
      '${escapeSql(data.academic_type)}',
      '${escapeSql(data.class_year)}',
      '${escapeSql(data.fee_type)}',
      '${escapeSql(data.fee_for)}',
      '${escapeSql(data.fee_include)}',
      '${escapeSql(data.fee_caste)}',
      '${escapeSql(data.fee_name)}',
      '${escapeSql(data.fee_amount)}',
      '${escapeSql(data.fee_bank)}',
      ${Number(data.fee_order) || 0},
      '0000-00-00',
      '',
      'one_time',
      '${escapeSql(data.fee_scholarship)}',
      '${escapeSql(data.fee_discount)}',
      '',
      '${formatSqlDateTime(create.created_dt)}',
      '${escapeSql(create.created_ip)}',
      '${escapeSql(create.created_by)}',
      '${formatSqlDateTime(create.updated_dt)}',
      '${escapeSql(create.updated_ip)}',
      '${escapeSql(create.updated_by)}',
      1
    )`,
  );
}

function nextAcademicYear(year) {
  const match = String(year || '').match(/^(\d{4})-(\d{4})$/);
  if (!match) return '';
  const start = Number(match[1]) + 1;
  const end = Number(match[2]) + 1;
  return `${start}-${end}`;
}

async function loadBatchOptions() {
  const setup = await prisma.basic_setup_tb.findFirst({
    where: { del: 1 },
    select: { ug_academic_year: true, uga_academic_year: true, pg_academic_year: true },
  });

  const ugYear = setup?.ug_academic_year || '';
  const ugaYear = setup?.uga_academic_year || '';
  const academicYearByCourse = {
    'U.G': ugYear && ugaYear ? (ugYear > ugaYear ? ugYear : ugaYear) : (ugYear || ugaYear),
    'P.G': setup?.pg_academic_year || '',
  };

  const courses = await prisma.basic_setup_course_tb.findMany({
    where: { del: 1 },
    orderBy: { c_order: 'asc' },
    select: basicSetupCourseSelect,
  });

  const groups = [];

  for (const course of courses) {
    const academicYearRef = academicYearByCourse[course.course_name] || '';
    const options = [];
    const seen = new Set();

    const pushOption = (admissionYear) => {
      const key = `${course.id}___${admissionYear}`;
      if (seen.has(key)) return;
      seen.add(key);
      const dept = course.department_name && course.department_name !== '-'
        ? ` - ${course.department_name}`
        : '';
      options.push({
        value: key,
        label: `${course.degree_name}${dept} | ${admissionYear}`,
        courseId: course.id,
        admissionYear,
        totalYears: course.course_duration,
        courseName: course.course_name,
      });
    };

    if (academicYearRef) {
      pushOption(academicYearRef);
    }

    const admissionYears = await prisma.$queryRaw`
      SELECT DISTINCT academic_year
      FROM student_profile_tb
      WHERE del = 1 AND course_id = ${String(course.id)}
      ORDER BY academic_year DESC
    `;
    for (const row of admissionYears) {
      pushOption(row.academic_year);
    }

    const feeYears = await prisma.$queryRaw`
      SELECT DISTINCT admission_year
      FROM fee_name_master
      WHERE del = 1 AND course_id = ${String(course.id)}
      ORDER BY admission_year DESC
    `;
    for (const row of feeYears) {
      pushOption(row.admission_year);
    }

    if (options.length) {
      const latestYear = options
        .map((o) => o.admissionYear)
        .sort((a, b) => b.localeCompare(a))[0];
      const upcomingYear = nextAcademicYear(latestYear);
      if (upcomingYear) pushOption(upcomingYear);

      options.sort((a, b) => b.admissionYear.localeCompare(a.admissionYear));
    }

    if (options.length) {
      groups.push({
        courseName: course.course_name,
        label: `${course.course_name} | ${course.degree_name}${course.department_name && course.department_name !== '-' ? ` - ${course.department_name}` : ''}`,
        options,
      });
    }
  }

  return groups;
}

async function loadLookups() {
  const [feeTypes, feeBanks, feeLabels, quotas] = await Promise.all([
    prisma.fee_type_master.findMany({ where: { del: 1 }, orderBy: { fee_order: 'asc' } }),
    prisma.fee_bank_master.findMany({ where: { del: 1 }, orderBy: { bank_id: 'asc' } }),
    prisma.fee_label_master.findMany({ where: { del: 1 }, orderBy: { fee_order: 'asc' } }),
    prisma.master_setup.findMany({
      where: { category: 'Quota', del: { not: 0 } },
      orderBy: { category_order: 'asc' },
    }),
  ]);

  return {
    feeTypes: feeTypes.map((r) => ({ value: String(r.id), label: r.fee_type })),
    feeBanks: feeBanks.map((r) => ({ value: String(r.id), label: r.bank_name })),
    feeLabels: feeLabels.map((r) => ({
      value: String(r.id),
      label: r.fee_name,
      isScholar: r.is_scholar === 1,
    })),
    feeForOptions: quotas.map((r) => ({ value: String(r.id), label: r.category_name })),
    casteOptions: CASTE_OPTIONS,
    academicTypeOptions: ACADEMIC_TYPE_OPTIONS,
    scholarLabelIds: feeLabels.filter((r) => r.is_scholar === 1).map((r) => r.id),
  };
}

function mapFeeNameRow(row, locked) {
  return {
    id: row.id,
    feeOrder: row.fee_order,
    feeType: String(row.fee_type ?? ''),
    feeFor: String(row.fee_for ?? ''),
    feeName: String(row.fee_name ?? ''),
    feeAmount: row.fee_amount,
    feeBank: String(row.fee_bank ?? ''),
    classYear: Number(row.class_year) || 1,
    feeInclude: row.fee_include === 'except' ? 'except' : '',
    feeCaste: row.fee_caste ? row.fee_caste.split(',').filter(Boolean) : [],
    academicTypes: row.academic_type
      ? row.academic_type.split(',').filter(Boolean)
      : ['Regular'],
    feeScholarship: row.fee_scholarship || '',
    feeDiscount: row.fee_discount || '',
    locked: Boolean(locked),
  };
}

async function loadFeeRows(courseId, admissionYear, totalYears) {
  const tabs = [];
  for (let y = 1; y <= totalYears; y += 1) {
    const dbRows = await prisma.$queryRawUnsafe(
      `SELECT id, fee_order, fee_type, fee_for, fee_name, fee_amount, fee_bank, class_year,
              fee_include, fee_caste, academic_type, fee_scholarship, fee_discount
       FROM fee_name_master
       WHERE del = 1 AND course_id = '${escapeSql(String(courseId))}'
         AND admission_year = '${escapeSql(admissionYear)}'
         AND class_year = '${escapeSql(String(y))}'
       ORDER BY fee_order ASC`,
    );

    const rows = [];
    for (const row of dbRows) {
      const usageCount = await prisma.student_fee.count({
        where: { del: 1, fee_id: String(row.id) },
      });
      const locked = usageCount > 0;
      rows.push(mapFeeNameRow(row, locked));
    }

    tabs.push({ classYear: y, rows });
  }
  return tabs;
}

export async function loadFeeNameSetup(memberId, fields = {}, audit = {}) {
  const batchGroups = await loadBatchOptions();
  const lookups = await loadLookups();
  const courseRef = fields.courseId || fields.course_id || '';

  let courseId = null;
  let admissionYear = '';
  let totalYears = 0;
  let tabs = [];

  if (courseRef.includes('___')) {
    const [cid, year] = courseRef.split('___');
    courseId = Number(cid);
    admissionYear = year;
    for (const group of batchGroups) {
      const match = group.options.find((o) => o.value === courseRef);
      if (match) {
        totalYears = match.totalYears;
        break;
      }
    }
    if (courseId && admissionYear && totalYears) {
      tabs = await loadFeeRows(courseId, admissionYear, totalYears);
    }
  }

  await logFeeSetup(PAGE, 'View', 'Successful', courseRef, memberId, audit);
  return {
    batchGroups,
    lookups,
    courseRef,
    courseId,
    admissionYear,
    totalYears,
    tabs,
  };
}

export async function saveFeeNameSetup(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      await softDeleteFeeNameRow(id, update);
      await logFeeSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      const reload = await loadFeeNameSetup(memberId, {
        courseId: payload.courseRef,
      }, { ...audit, memberId });
      return { success: true, message: 'Your details are deleted...', ...reload };
    } catch {
      await logFeeSetup(PAGE, 'Delete', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  const courseId = Number(payload.courseId);
  const admissionYear = String(payload.admissionYear || '').trim();
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  if (!courseId || !admissionYear) {
    return { success: false, message: 'Batch selection is required' };
  }

  const { create, update } = auditFields(memberId, audit);
  let saved = false;

  for (const row of rows) {
    if (row.locked) continue;

    const feeName = String(row.feeName || '').trim();
    const feeAmount = String(row.feeAmount || '').trim();
    if (!feeName || !feeAmount) continue;

    const feeCaste = Array.isArray(row.feeCaste) ? row.feeCaste.join(',') : '';
    const academicTypes = Array.isArray(row.academicTypes) ? row.academicTypes.join(',') : '';
    const data = {
      fee_type: String(row.feeType || ''),
      fee_for: String(row.feeFor || ''),
      fee_name: feeName,
      fee_amount: feeAmount,
      course_id: courseId,
      admission_year: admissionYear,
      class_year: String(row.classYear || '1'),
      fee_include: row.feeInclude === 'except' ? 'except' : '',
      fee_caste: feeCaste,
      fee_bank: String(row.feeBank || ''),
      fee_order: Number(row.feeOrder) || 0,
      academic_type: academicTypes,
      fee_scholarship: String(row.feeScholarship || ''),
      fee_discount: String(row.feeDiscount || ''),
    };

    if (!row.id) {
      await insertFeeNameRow(data, create);
      saved = true;
    } else {
      await updateFeeNameRow(Number(row.id), data, update);
      saved = true;
    }
  }

  await logFeeSetup(PAGE, 'Update', saved ? 'Successful' : 'Unsuccessful', '', memberId, audit);

  const reload = await loadFeeNameSetup(memberId, {
    courseId: `${courseId}___${admissionYear}`,
  }, { ...audit, memberId });

  return {
    success: saved,
    message: saved ? 'Your details are Updated...' : 'No valid rows to save',
    ...reload,
  };
}
