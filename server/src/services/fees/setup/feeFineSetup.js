import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logFeeSetup } from './setupAudit.js';

const PAGE = 'fee_fine_config.php';

const YEAR_LABELS = ['', 'I', 'II', 'III', 'IV', 'Int.', 'VI', 'VII', 'VIII', 'IX', 'X'];

function convertNYear(year, courseName) {
  return YEAR_LABELS[Number(year)] || String(year);
}

function formatDueDate(value) {
  if (!value) return '';
  const str = String(value);
  if (str.startsWith('0000-00-00')) return '';
  const d = value instanceof Date ? value : new Date(str);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function parseDueDate(value) {
  const str = String(value || '').trim();
  if (!str) return null;
  const match = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const iso = new Date(str);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

async function loadAcademicYearOptions() {
  const years = await prisma.$queryRaw`
    SELECT DISTINCT admission_year
    FROM fee_name_master
    WHERE del = 1
    ORDER BY admission_year DESC
  `;
  const options = [];
  for (const row of years) {
    const year = row.admission_year;
    options.push({ value: `${year}___regular`, label: `${year} (Regular)`, year, batch: 'regular' });
    options.push({ value: `${year}___additional`, label: `${year} (Additional)`, year, batch: 'additional' });
  }
  return options;
}

async function buildFineGrid(academicYear, academicBatch, academicType) {
  const feeTypes = await prisma.fee_type_master.findMany({
    where: { del: 1 },
    orderBy: { fee_order: 'asc' },
    select: { id: true, fee_type: true },
  });

  const courseList = academicType === 'Regular' ? ['U.G', 'P.G'] : ['U.G'];
  const sections = [];
  const rows = [];

  for (const courseName of courseList) {
    const course = await prisma.basic_setup_course_tb.findFirst({
      where: { del: 1, course_name: courseName },
      orderBy: { course_duration: 'desc' },
      select: { course_duration: true },
    });
    const totalYears = course?.course_duration || 0;

    for (let y = 1; y <= totalYears; y += 1) {
      sections.push({
        courseName,
        classYear: y,
        label: `${courseName} | ${convertNYear(y, courseName)} Year | ${academicType}`,
      });

      for (const feeType of feeTypes) {
        const existingRows = await prisma.$queryRawUnsafe(
          `SELECT id, CAST(fee_due_date AS CHAR) AS fee_due_date, fee_fine_amount, fee_fine_type
           FROM fee_fine_master
           WHERE del = 1 AND course_name = '${escapeSql(courseName)}'
             AND academic_year = '${escapeSql(academicYear)}'
             AND academic_batch = '${escapeSql(academicBatch)}'
             AND academic_type = '${escapeSql(academicType)}'
             AND class_year = '${escapeSql(String(y))}'
             AND fee_type = '${escapeSql(String(feeType.id))}'
           LIMIT 1`,
        );
        const existing = existingRows[0];

        rows.push({
          id: existing?.id || null,
          courseName,
          classYear: y,
          feeTypeId: feeType.id,
          feeTypeLabel: feeType.fee_type,
          dueDate: formatDueDate(existing?.fee_due_date),
          fineAmount: existing?.fee_fine_amount || '',
          fineType: existing?.fee_fine_type === 'per_day' ? 'per_day' : 'one_time',
        });
      }
    }
  }

  return { sections, rows };
}

export async function loadFeeFineSetup(memberId, fields = {}, audit = {}) {
  const academicYearOptions = await loadAcademicYearOptions();
  const academicType = fields.academicType || fields.a_actype || 'Regular';

  let academicYear = '';
  let academicBatch = '';
  const yearRef = fields.academicYearRef || fields.academic_year_ref || '';
  if (yearRef.includes('___')) {
    const [year, batch] = yearRef.split('___');
    academicYear = year;
    academicBatch = batch;
  }

  const result = {
    academicYearOptions,
    academicType,
    academicYearRef: yearRef,
    rows: [],
    sections: [],
  };

  if (academicYear && academicBatch && academicType) {
    const grid = await buildFineGrid(academicYear, academicBatch, academicType);
    result.academicYear = academicYear;
    result.academicBatch = academicBatch;
    result.sections = grid.sections;
    result.rows = grid.rows;
  }

  await logFeeSetup(PAGE, 'View', 'Successful', yearRef, memberId, audit);
  return result;
}

export async function saveFeeFineSetup(payload, memberId, audit = {}) {
  const academicYear = String(payload.academicYear || '').trim();
  const academicBatch = String(payload.academicBatch || '').trim();
  const academicType = String(payload.academicType || 'Regular').trim();
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  if (!academicYear || !academicBatch) {
    return { success: false, message: 'Academic year is required' };
  }

  const { create, update } = auditFields(memberId, audit);
  let saved = false;

  for (const row of rows) {
    const dueDate = parseDueDate(row.dueDate);
    const fineAmount = String(row.fineAmount || '').trim();
    if (!fineAmount || !dueDate) continue;

    const data = {
      course_name: String(row.courseName || ''),
      academic_year: academicYear,
      academic_batch: academicBatch,
      academic_type: academicType,
      class_year: String(row.classYear || ''),
      fee_type: String(row.feeTypeId || ''),
      fee_due_date: dueDate,
      fee_fine_amount: fineAmount,
      fee_fine_type: row.fineType === 'per_day' ? 'per_day' : 'one_time',
    };

    if (!row.id) {
      await prisma.fee_fine_master.create({ data: { ...data, ...create } });
      saved = true;
    } else {
      await prisma.fee_fine_master.update({
        where: { id: Number(row.id) },
        data: { ...data, ...update },
      });
      saved = true;
    }
  }

  const status = saved ? 'Successful' : 'Unsuccessful';
  await logFeeSetup(PAGE, 'Update', status, '', memberId, audit);

  if (!saved) {
    return { success: false, message: 'No valid rows to save' };
  }

  const reload = await loadFeeFineSetup(memberId, {
    academicYearRef: `${academicYear}___${academicBatch}`,
    academicType,
  }, { ...audit, memberId });

  return {
    success: true,
    message: 'Your details are Updated...',
    ...reload,
  };
}
