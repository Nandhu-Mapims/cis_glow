import { prisma } from '../../config/prisma.js';
import { basicSetupCourseSelect, ciaExamNameSelect } from '../../utils/legacySelects.js';
import { escapeSql } from '../../utils/sqlSafe.js';

export function formatDisplayDate(val) {
  const raw = String(val || '').trim();
  if (!raw || raw.startsWith('0000-00-00')) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export function parseInputDate(val) {
  const s = String(val || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parts = s.split('-');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export async function loadAcademicConfig() {
  const setup = await prisma.basic_setup_tb.findFirst({
    where: { del: 1 },
    select: {
      ug_academic_year: true,
      uga_academic_year: true,
      pg_academic_year: true,
      exam_academic_year: true,
    },
  });
  const examYears = String(setup?.exam_academic_year || '')
    .split(',')
    .map((y) => y.trim())
    .filter(Boolean);

  return {
    'U.G': { regular: setup?.ug_academic_year || '', additional: setup?.uga_academic_year || '' },
    'P.G': { regular: setup?.pg_academic_year || '', additional: '' },
    EXAM: examYears,
  };
}

export async function buildCourseYearOptions(academicYearArray) {
  const courseRows = await prisma.basic_setup_course_tb.findMany({
    where: { del: 1 },
    orderBy: { c_order: 'asc' },
    select: { course_name: true },
  });
  const seenCourses = new Set();
  const courseNames = [];
  for (const row of courseRows) {
    if (!seenCourses.has(row.course_name)) {
      seenCourses.add(row.course_name);
      courseNames.push(row.course_name);
    }
  }

  const options = [];
  for (const courseName of courseNames) {
    const startRow = await prisma.$queryRawUnsafe(
      `SELECT year_of_start FROM basic_setup_course_tb
       WHERE del = 1 AND course_name = '${escapeSql(courseName)}' AND year_of_start > 2000
       ORDER BY year_of_start ASC LIMIT 1`,
    );
    const yearOfStart = Number(startRow[0]?.year_of_start) || 2000;
    const acyear = academicYearArray[courseName] || {};

    const pushYear = (acYear, batch, labelSuffix) => {
      if (!acYear) return;
      const startYear = Number(String(acYear).split('-')[0]);
      if (!startYear) return;
      for (let i = startYear; i >= yearOfStart; i -= 1) {
        const yearLabel = `${i}-${i + 1}`;
        const inExamList = academicYearArray.EXAM?.includes(yearLabel);
        if (acyear.regular === yearLabel || acyear.additional === yearLabel || inExamList) {
          options.push({
            value: `${courseName}___${yearLabel}___${batch}`,
            label: `${courseName} | ${yearLabel} (${labelSuffix})`,
            group: `${courseName} | ${labelSuffix}`,
            courseName,
            academicYear: yearLabel,
            academicType: batch,
          });
        }
      }
    };

    pushYear(acyear.regular, 'regular', 'Regular');
    if (courseName === 'U.G') {
      pushYear(acyear.additional, 'additional', 'Additional');
    }
  }

  return options;
}

export async function loadExamNameOptions() {
  const rows = await prisma.cia_exam_name.findMany({
    where: { del: 1 },
    orderBy: { exam_order: 'asc' },
    select: ciaExamNameSelect,
  });
  return rows.map((row) => ({
    value: String(row.id),
    label: `${row.exam_name}${row.exam_month ? ` (${row.exam_month})` : ''}`,
  }));
}

export function parseCourseYearKey(key) {
  const parts = String(key || '').split('___');
  if (parts.length !== 3) return null;
  return {
    courseName: parts[0],
    academicYear: parts[1],
    academicType: parts[2],
  };
}

export function mapAdmissionSetupRow(row) {
  return {
    id: row.id,
    examNameId: String(row.exam_name),
    examInternal: row.exam_internal === 1,
    examViva: row.exam_viva === 1,
    examExternal: row.exam_external === 1,
    markOption: String(row.mark_option) === '1',
    examStatus: row.exam_status === 1,
  };
}

export function mapTermExamSetupRow(row) {
  return {
    ...mapAdmissionSetupRow(row),
    sessionFn: row.session_fn || '',
    sessionAn: row.session_an || '',
    fromDate: formatDisplayDate(row.pap_eva_frm),
    toDate: formatDisplayDate(row.pap_eva_to),
    sessionTime: row.pap_eva_time || '',
  };
}

export async function loadCiaSetupRows(courseName, academicYear, academicType, mapper = mapAdmissionSetupRow) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, course_name, academic_year, academic_type, exam_name, session_fn, session_an,
            CAST(pap_eva_frm AS CHAR) AS pap_eva_frm,
            CAST(pap_eva_to AS CHAR) AS pap_eva_to,
            pap_eva_time, exam_internal, exam_viva, exam_external,
            mark_option, exam_status, del
     FROM cia_setup
     WHERE del=1 AND course_name='${escapeSql(courseName)}'
       AND academic_year='${escapeSql(academicYear)}' AND academic_type='${escapeSql(academicType)}'
     ORDER BY id ASC`,
  );
  return rows.map((row) => mapper(row));
}

export const CIA_SETUP_DEFAULTS = {
  session_fn: '',
  session_an: '',
  pap_eva_frm: new Date('1970-01-01'),
  pap_eva_to: new Date('1970-01-01'),
  pap_eva_time: '',
};
