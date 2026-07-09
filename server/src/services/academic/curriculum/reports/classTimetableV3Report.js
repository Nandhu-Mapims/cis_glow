import { logAcademicSetup } from '../../setup/setupAudit.js';
import {
  buildClassTimetablePrintHtml,
  buildCourseIdYearOptions,
  getCourseById,
  parseCourseIdYearKey,
} from './reportShared.js';

const PAGE = 'class_time_table_v3.php';

export async function loadClassTimetableV3Report(memberId, fields = {}, audit = {}) {
  const courseYearOptions = await buildCourseIdYearOptions();
  const selection = parseCourseIdYearKey(fields.course_name);
  const semester = Number(fields.semester_name) || 0;
  const showDateBatch = fields.show_date_batch === 1 || fields.show_date_batch === '1';
  const generate = Boolean(fields.generate || fields.Submit === 'Go');
  let html = '';
  let course = null;

  if (selection) {
    course = await getCourseById(selection.courseId);
  }

  if (generate && selection && semester) {
    let dept = String(course?.department_name || '').trim();
    if (dept && dept !== '-') dept = ` - ${dept}`;
    const degreeLabel = `${course?.degree_name || ''}${dept} (${selection.academicType === 'additional' ? 'Additional' : 'Regular'})`;
    html = await buildClassTimetablePrintHtml({
      courseId: selection.courseId,
      courseName: course?.course_name || '',
      academicYear: selection.academicYear,
      academicType: selection.academicType,
      semester,
      showDateBatch,
      tableName: 'timetable_tb_new',
      degreeLabel,
      memberId,
    });
  }

  await logAcademicSetup(PAGE, 'View', 'Successful', `${fields.course_name || ''}__${semester}`, memberId, audit);
  return {
    courseYearOptions,
    courseYearKey: fields.course_name || '',
    selection,
    semester,
    showDateBatch,
    totalSemester: course ? Number(course.total_semester) || Number(course.course_duration) || 0 : 0,
    html,
  };
}

export async function saveClassTimetableV3Report(memberId, fields = {}, audit = {}) {
  return loadClassTimetableV3Report(memberId, fields, audit);
}
