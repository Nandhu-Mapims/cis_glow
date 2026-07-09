import { prisma } from '../../../config/prisma.js';
import { parseId } from '../../../utils/sqlSafe.js';
import {
  buildCourseYearOptions,
  CIA_SETUP_DEFAULTS,
  loadAcademicConfig,
  loadCiaSetupRows,
  loadExamNameOptions,
  mapAdmissionSetupRow,
  parseCourseYearKey,
} from '../../shared/ciaSetupHelpers.js';
import { auditFields, logAcademicSetup } from './setupAudit.js';

const PAGE = 'academic_admission_setup.php';

function emptyRow() {
  return {
    examNameId: '',
    examInternal: true,
    examViva: true,
    examExternal: true,
    markOption: true,
    examStatus: false,
  };
}

export async function loadAdmissionExam(memberId, fields = {}, audit = {}) {
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
      mapAdmissionSetupRow,
    );
    if (!rows.length) rows = [emptyRow()];
  }

  await logAcademicSetup(PAGE, 'View', 'Successful', fields.course_name || '', memberId, audit);
  return {
    courseYearOptions,
    examNameOptions,
    courseYearKey: fields.course_name || '',
    selection,
    rows,
  };
}

export async function saveAdmissionExam(payload, memberId, audit = {}) {
  if (payload.action === 'delete') {
    const id = parseId(payload.id);
    try {
      const { update } = auditFields(memberId, audit);
      await prisma.cia_setup.update({
        where: { id },
        data: { del: 0, ...update },
      });
      await logAcademicSetup(PAGE, 'Delete', 'Successful', String(id), memberId, audit);
      return {
        success: true,
        message: 'Your details are deleted...',
        ...(await loadAdmissionExam(memberId, { course_name: payload.courseYearKey }, { ...audit, skipLog: true })),
      };
    } catch {
      await logAcademicSetup(PAGE, 'Delete', 'Unsuccessful', String(id), memberId, audit);
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
      ...update,
    };

    if (!row.id) {
      await prisma.cia_setup.create({
        data: { ...data, ...CIA_SETUP_DEFAULTS, ...create },
      });
    } else {
      await prisma.cia_setup.update({
        where: { id: Number(row.id) },
        data,
      });
    }
  }

  await logAcademicSetup(PAGE, 'Update', 'Successful', '', memberId, audit);
  const courseYearKey = `${courseName}___${academicYear}___${academicType}`;
  return {
    success: true,
    message: 'Your details are Updated...',
    ...(await loadAdmissionExam(memberId, { course_name: courseYearKey }, { ...audit, skipLog: true })),
  };
}
