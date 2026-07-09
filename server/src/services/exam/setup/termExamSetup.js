import { prisma } from '../../../config/prisma.js';
import { parseId } from '../../../utils/sqlSafe.js';
import {
  buildCourseYearOptions,
  CIA_SETUP_DEFAULTS,
  loadAcademicConfig,
  loadCiaSetupRows,
  loadExamNameOptions,
  mapTermExamSetupRow,
  parseCourseYearKey,
  parseInputDate,
} from '../../shared/ciaSetupHelpers.js';
import { auditFields, logExamSetup } from './setupAudit.js';

const PAGE = 'term_exam_setup.php';

function emptyRow() {
  return {
    examNameId: '',
    examInternal: true,
    examViva: true,
    examExternal: true,
    markOption: true,
    examStatus: false,
    sessionFn: '',
    sessionAn: '',
    fromDate: '',
    toDate: '',
    sessionTime: '',
  };
}

export async function loadTermExamSetup(memberId, fields = {}, audit = {}) {
  const academicYearArray = await loadAcademicConfig();
  const courseYearOptions = await buildCourseYearOptions(academicYearArray);
  const examNameOptions = await loadExamNameOptions();

  const selection = parseCourseYearKey(fields.course_name);
  let rows = [];
  if (selection) {
    rows = await loadCiaSetupRows(
      selection.courseName,
      selection.academicYear,
      selection.academicType,
      mapTermExamSetupRow,
    );
    if (!rows.length) rows = [emptyRow()];
  }

  await logExamSetup(PAGE, 'View', 'Successful', fields.course_name || '', memberId, audit);
  return {
    courseYearOptions,
    examNameOptions,
    courseYearKey: fields.course_name || '',
    selection,
    rows,
  };
}

export async function saveTermExamSetup(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      await prisma.cia_setup.update({
        where: { id },
        data: { del: 0, ...update },
      });
      await logExamSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return {
        success: true,
        message: 'Your details are deleted...',
        ...(await loadTermExamSetup(memberId, { course_name: payload.courseYearKey }, { ...audit, skipLog: true })),
      };
    } catch {
      await logExamSetup(PAGE, 'Delete', 'Unsuccessful', String(id), memberId, audit);
      return { success: false, message: 'Please try again...' };
    }
  }

  const courseName = String(payload.courseName || '').trim();
  const academicYear = String(payload.academicYear || '').trim();
  const academicType = String(payload.academicType || '').trim();
  if (!courseName || !academicYear || !academicType) {
    return { success: false, message: 'Course and academic year are required' };
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const { create, update } = auditFields(memberId, audit);

  for (const row of rows) {
    const examNameId = String(row.examNameId || '').trim();
    if (!examNameId) continue;

    const data = {
      course_name: courseName,
      academic_year: academicYear,
      academic_type: academicType,
      exam_name: examNameId,
      mark_option: row.markOption ? '1' : '0',
      exam_internal: row.examInternal ? 1 : 0,
      exam_viva: row.examViva ? 1 : 0,
      exam_external: row.examExternal ? 1 : 0,
      exam_status: row.examStatus ? 1 : 0,
      session_fn: String(row.sessionFn || ''),
      session_an: String(row.sessionAn || ''),
      pap_eva_frm: parseInputDate(row.fromDate) ? new Date(parseInputDate(row.fromDate)) : CIA_SETUP_DEFAULTS.pap_eva_frm,
      pap_eva_to: parseInputDate(row.toDate) ? new Date(parseInputDate(row.toDate)) : CIA_SETUP_DEFAULTS.pap_eva_to,
      pap_eva_time: String(row.sessionTime || ''),
      ...update,
    };

    if (!row.id) {
      await prisma.cia_setup.create({
        data: { ...data, ...create },
      });
    } else {
      await prisma.cia_setup.update({
        where: { id: Number(row.id) },
        data,
      });
    }
  }

  await logExamSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  const courseYearKey = `${courseName}___${academicYear}___${academicType}`;
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadTermExamSetup(memberId, { course_name: courseYearKey }, { ...audit, skipLog: true })),
  };
}
