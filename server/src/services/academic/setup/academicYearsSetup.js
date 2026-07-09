import { prisma } from '../../../config/prisma.js';
import { escapeSql } from '../../../utils/sqlSafe.js';
import { auditFields, logAcademicSetup } from './setupAudit.js';

const PAGE = 'academic.php';

function parseInputDate(value) {
  const s = String(value || '').trim();
  if (!s || s === '0000-00-00') return null;
  const dmY = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmY) {
    const d = new Date(`${dmY[3]}-${dmY[2].padStart(2, '0')}-${dmY[1].padStart(2, '0')}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = new Date(s);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function formatDateForClient(value) {
  if (!value) return '';
  const s = String(value);
  if (s.startsWith('0000-00-00') || s.startsWith('1970-01-01')) return '';
  const d = value instanceof Date ? value : new Date(s);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1901) return '';
  return d.toISOString().slice(0, 10);
}

async function yearOptions(courseName, endYearOffset = 0) {
  const row = await prisma.basic_setup_course_tb.findFirst({
    where: { del: 1, course_name: courseName },
    orderBy: { year_of_start: 'asc' },
    select: { year_of_start: true },
  });
  const endYear = new Date().getFullYear() + endYearOffset;
  const startYear = row?.year_of_start || endYear - 10;
  const options = [];
  for (let year = endYear; year >= startYear; year -= 1) {
    const label = `${year}-${year + 1}`;
    options.push({ value: label, label });
  }
  return options;
}

async function loadAcademicSlot(courseName, academicYear, batch) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id,
            CAST(from_date AS CHAR) AS from_date,
            CAST(to_date AS CHAR) AS to_date
     FROM basic_setup_academic
     WHERE del=1 AND course_name='${escapeSql(courseName)}'
       AND academic_year='${escapeSql(academicYear)}'
       AND academic_batch='${escapeSql(batch)}'
     LIMIT 1`,
  );
  const row = rows[0];
  return {
    id: row?.id || null,
    fromDate: formatDateForClient(row?.from_date),
    toDate: formatDateForClient(row?.to_date),
  };
}

export async function loadAcademicYears(memberId, _fields = {}, audit = {}) {
  const setup = await prisma.basic_setup_tb.findFirst({ where: { del: 1, id: 1 } });
  if (!setup) {
    await logAcademicSetup(PAGE, 'View', 'Successful', '', memberId, audit);
    return {
      id: null,
      ugYearOptions: await yearOptions('U.G'),
      pgYearOptions: await yearOptions('P.G'),
      examYearOptions: await yearOptions('U.G', -1),
    };
  }

  const examYears = String(setup.exam_academic_year || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  const [ugSlot, ugaSlot, pgSlot] = await Promise.all([
    loadAcademicSlot('U.G', setup.ug_academic_year, 'regular'),
    loadAcademicSlot('U.G', setup.uga_academic_year, 'additional'),
    loadAcademicSlot('P.G', setup.pg_academic_year, 'regular'),
  ]);

  await logAcademicSetup(PAGE, 'View', 'Successful', '', memberId, audit);

  return {
    id: setup.id,
    institutionName: setup.institution_name,
    institutionName2: setup.institution_name_2,
    institutionShortName: setup.institution_short_name,
    institutionLogo: setup.institution_logo,
    institutionAddress: setup.instution_address,
    institutionPhone: setup.instution_phone,
    institutionEmail: setup.instution_email,
    ugAcademicYear: setup.ug_academic_year,
    ugaAcademicYear: setup.uga_academic_year,
    ugOddEvenSem: setup.ug_odd_even_sem,
    pgAcademicYear: setup.pg_academic_year,
    pgOddEvenSem: setup.pg_odd_even_sem,
    examAcademicYears: examYears,
    ugAcId: ugSlot.id,
    ugFromDate: ugSlot.fromDate,
    ugToDate: ugSlot.toDate,
    ugaAcId: ugaSlot.id,
    ugaFromDate: ugaSlot.fromDate,
    ugaToDate: ugaSlot.toDate,
    pgAcId: pgSlot.id,
    pgFromDate: pgSlot.fromDate,
    pgToDate: pgSlot.toDate,
    ugYearOptions: await yearOptions('U.G'),
    pgYearOptions: await yearOptions('P.G'),
    examYearOptions: await yearOptions('U.G', -1),
  };
}

async function upsertAcademicRecord({
  id,
  courseName,
  academicYear,
  batch,
  fromDate,
  toDate,
}, memberId, audit) {
  const { create, update } = auditFields(memberId, audit);
  const from = parseInputDate(fromDate);
  const to = parseInputDate(toDate);
  const fromSql = from ? from.toISOString().slice(0, 10) : '0000-00-00';
  const toSql = to ? to.toISOString().slice(0, 10) : '0000-00-00';

  if (id) {
    await prisma.$executeRaw`
      UPDATE basic_setup_academic
      SET course_name = ${courseName},
          academic_year = ${academicYear},
          academic_batch = ${batch},
          from_date = ${fromSql},
          to_date = ${toSql},
          updated_dt = ${update.updated_dt},
          updated_ip = ${update.updated_ip},
          updated_by = ${update.updated_by},
          del = 1
      WHERE id = ${Number(id)}
    `;
    return Number(id);
  }

  await prisma.$executeRaw`
    INSERT INTO basic_setup_academic (
      course_name, academic_year, academic_batch, from_date, to_date,
      created_dt, created_ip, created_by, updated_dt, updated_ip, updated_by, del
    ) VALUES (
      ${courseName}, ${academicYear}, ${batch}, ${fromSql}, ${toSql},
      ${create.created_dt}, ${create.created_ip}, ${create.created_by},
      ${create.updated_dt}, ${create.updated_ip}, ${create.updated_by}, 1
    )
  `;
  const created = await prisma.$queryRawUnsafe(
    `SELECT id FROM basic_setup_academic
     WHERE del=1 AND course_name='${escapeSql(courseName)}'
       AND academic_year='${escapeSql(academicYear)}'
       AND academic_batch='${escapeSql(batch)}'
     ORDER BY id DESC LIMIT 1`,
  );
  return created[0]?.id || null;
}

export async function saveAcademicYears(payload, memberId, audit = {}) {
  const ugAcademicYear = String(payload.ugAcademicYear || '').trim();
  const ugaAcademicYear = String(payload.ugaAcademicYear || '').trim();
  const pgAcademicYear = String(payload.pgAcademicYear || '').trim();

  if (!ugAcademicYear || !ugaAcademicYear || !pgAcademicYear) {
    return { success: false, message: 'Academic years are required' };
  }

  const examList = Array.isArray(payload.examAcademicYears)
    ? payload.examAcademicYears.map((v) => String(v).trim()).filter(Boolean)
    : [];
  const examAcademicYear = examList.join(',');

  const { update } = auditFields(memberId, audit);
  const setupId = Number(payload.id) || 1;

  const existing = await prisma.basic_setup_tb.findFirst({ where: { id: setupId, del: 1 } });
  if (!existing) {
    return { success: false, message: 'Institution setup not found' };
  }

  const { id: _archiveId, ...archiveData } = existing;
  await prisma.basic_setup_tb.create({
    data: { ...archiveData, del: 0 },
  });

  await prisma.basic_setup_tb.update({
    where: { id: setupId },
    data: {
      institution_name: String(payload.institutionName || '').trim(),
      institution_name_2: String(payload.institutionName2 || '').trim(),
      institution_short_name: String(payload.institutionShortName || '').trim(),
      instution_address: String(payload.institutionAddress || '').trim(),
      instution_phone: String(payload.institutionPhone || '').trim(),
      instution_email: String(payload.institutionEmail || '').trim(),
      ug_academic_year: ugAcademicYear,
      uga_academic_year: ugaAcademicYear,
      ug_odd_even_sem: Number(payload.ugOddEvenSem) || 1,
      pg_academic_year: pgAcademicYear,
      pg_odd_even_sem: Number(payload.pgOddEvenSem) || 1,
      exam_academic_year: examAcademicYear,
      del: 1,
      ...update,
    },
  });

  await prisma.basic_setup_academic.updateMany({
    where: {
      del: 1,
      OR: [
        { course_name: 'U.G', academic_year: ugAcademicYear, academic_batch: 'regular' },
        { course_name: 'P.G', academic_year: pgAcademicYear, academic_batch: 'regular' },
        { course_name: 'U.G', academic_year: ugaAcademicYear, academic_batch: 'additional' },
      ],
    },
    data: { del: 0, ...update },
  });

  await Promise.all([
    upsertAcademicRecord({
      id: payload.ugAcId,
      courseName: 'U.G',
      academicYear: ugAcademicYear,
      batch: 'regular',
      fromDate: payload.ugFromDate,
      toDate: payload.ugToDate,
    }, memberId, audit),
    upsertAcademicRecord({
      id: payload.ugaAcId,
      courseName: 'U.G',
      academicYear: ugaAcademicYear,
      batch: 'additional',
      fromDate: payload.ugaFromDate,
      toDate: payload.ugaToDate,
    }, memberId, audit),
    upsertAcademicRecord({
      id: payload.pgAcId,
      courseName: 'P.G',
      academicYear: pgAcademicYear,
      batch: 'regular',
      fromDate: payload.pgFromDate,
      toDate: payload.pgToDate,
    }, memberId, audit),
  ]);

  await logAcademicSetup(PAGE, 'Update', 'Successful', String(setupId), memberId, audit);
  return {
    success: true,
    message: 'Your details are updated...',
    ...(await loadAcademicYears(memberId, {}, { ...audit, skipLog: true })),
  };
}
